import type { CrmLead, CrmLeadStatus, CrmWorkflow } from "@/lib/db";
import {
  claimDueCrmWorkflowJobs,
  cancelCrmWorkflowJob,
  completeCrmWorkflowJob,
  createCrmActivity,
  createCrmWorkflowExecution,
  getActiveCrmWorkflowsForLeadStatus,
  getCrmLeadById,
  getCrmEmailTemplateById,
  getCrmWorkflows,
  hasPendingCrmWorkflowJob,
  hasSuccessfulCrmWorkflowExecution,
  scheduleCrmWorkflowJob,
} from "@/lib/db";
import { sendCrmEmail } from "@/lib/crm-email-sender";

type RunLeadStatusWorkflowsInput = {
  lead: CrmLead;
  previousStatus: CrmLeadStatus;
  nextStatus: CrmLeadStatus;
  changedBy: string;
  baseUrl?: string;
};

function replaceTemplateVariables(value: string, lead: CrmLead) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ").trim();
  const replacements: Record<string, string> = {
    cliente_nombre: fullName || lead.firstName || "cliente",
    cliente_email: lead.email,
    cliente_telefono: [lead.countryCode, lead.phone].filter(Boolean).join(" ").trim(),
    desarrollo: lead.developmentName || lead.developmentNameText || "el desarrollo consultado",
    propietario_contacto: lead.assignedAgentName || "Barrera Brokers",
    estado_lead: lead.status,
  };

  return value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    return replacements[key] ?? "";
  });
}

export async function runLeadStatusWorkflows({
  lead,
  previousStatus,
  nextStatus,
  changedBy,
  baseUrl = "",
}: RunLeadStatusWorkflowsInput) {
  if (previousStatus === nextStatus) return [];

  const workflows = await getActiveCrmWorkflowsForLeadStatus(nextStatus);
  const results: { workflowId: string; sent: boolean; error?: string }[] = [];

  for (const workflow of workflows) {
    if (workflow.runOncePerLead) {
      const [alreadyExecuted, alreadyPending] = await Promise.all([
        hasSuccessfulCrmWorkflowExecution(workflow.id, lead.id),
        hasPendingCrmWorkflowJob(workflow.id, lead.id),
      ]);
      if (alreadyExecuted || alreadyPending) {
        results.push({ workflowId: workflow.id, sent: false, error: "Workflow ya ejecutado para este contacto." });
        continue;
      }
    }

    if (workflow.deliveryDelayHours > 0) {
      const scheduledFor = new Date(Date.now() + workflow.deliveryDelayHours * 60 * 60 * 1000).toISOString();
      const scheduled = await scheduleCrmWorkflowJob({
        workflowId: workflow.id,
        leadId: lead.id,
        previousStatus,
        nextStatus,
        executedBy: changedBy,
        scheduledFor,
      });
      results.push({
        workflowId: workflow.id,
        sent: false,
        error: scheduled.error || (scheduled.scheduled ? `Programado para ${scheduledFor}` : "Ya estaba programado."),
      });
      continue;
    }

    results.push(await executeCrmWorkflowEmail({ workflow, lead, previousStatus, nextStatus, changedBy, baseUrl }));
  }

  return results;
}

async function executeCrmWorkflowEmail({
  workflow,
  lead,
  previousStatus,
  nextStatus,
  changedBy,
  baseUrl = "",
}: {
  workflow: CrmWorkflow;
  lead: CrmLead;
  previousStatus: CrmLeadStatus;
  nextStatus: CrmLeadStatus;
  changedBy: string;
  baseUrl?: string;
}) {

    const template = await getCrmEmailTemplateById(workflow.templateId);
    if (!template || template.channel !== "email") {
      const message = "La plantilla de correo del workflow no está disponible.";
      await createCrmWorkflowExecution({
        workflowId: workflow.id,
        leadId: lead.id,
        previousStatus,
        nextStatus,
        templateId: workflow.templateId,
        success: false,
        error: message,
        executedBy: changedBy,
      });
      return { workflowId: workflow.id, sent: false, error: message };
    }

    const agentId = lead.assignedAgentId || changedBy;
    const subject = replaceTemplateVariables(template.subject, lead);
    const body = replaceTemplateVariables(template.body, lead);
    const contentBlocks = template.contentBlocks.map((block) => {
      if (block.type === "text") {
        return {
          ...block,
          text: replaceTemplateVariables(block.text, lead),
          html: block.html ? replaceTemplateVariables(block.html, lead) : block.html,
        };
      }
      if (block.type === "button") {
        return {
          ...block,
          label: replaceTemplateVariables(block.label, lead),
          url: replaceTemplateVariables(block.url, lead),
        };
      }
      if (block.type === "columns") {
        return {
          ...block,
          columns: block.columns.map((column) => column.type === "text" ? {
            ...column,
            text: replaceTemplateVariables(column.text, lead),
            html: column.html ? replaceTemplateVariables(column.html, lead) : column.html,
          } : column),
        };
      }
      return block;
    });

    const sendResult = await sendCrmEmail({
      lead,
      agentId,
      subject,
      body,
      imageUrls: template.imageUrls,
      contentBlocks,
      baseUrl,
      activityTitle: `Workflow: ${workflow.name}`,
      workflowName: workflow.name,
    });

    await createCrmWorkflowExecution({
      workflowId: workflow.id,
      leadId: lead.id,
      previousStatus,
      nextStatus,
      templateId: template.id,
      activityId: sendResult.activity?.id,
      success: sendResult.sent,
      error: sendResult.error || undefined,
      executedBy: changedBy,
    });

    if (!sendResult.sent) {
      await createCrmActivity({
        leadId: lead.id,
        type: "tarea",
        title: `Revisar workflow: ${workflow.name}`,
        body: sendResult.error || "No se pudo ejecutar el workflow automático.",
        createdBy: changedBy,
      });
    }

    return {
      workflowId: workflow.id,
      sent: sendResult.sent,
      error: sendResult.error || undefined,
    };
}

export async function processDueCrmWorkflowJobs(baseUrl = "") {
  const [jobs, workflows] = await Promise.all([claimDueCrmWorkflowJobs(), getCrmWorkflows()]);
  const workflowById = new Map(workflows.map((workflow) => [workflow.id, workflow]));
  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const workflow = workflowById.get(job.workflowId);
    const lead = await getCrmLeadById(job.leadId, { includeAll: true });
    if (!workflow || !workflow.active || !lead) {
      await completeCrmWorkflowJob(job.id, false, "Workflow inactivo o contacto no disponible.");
      failed += 1;
      continue;
    }
    if (workflow.repeatEnabled && lead.status !== workflow.triggerStatus) {
      await cancelCrmWorkflowJob(
        job.id,
        "Repetición detenida porque el contacto cambió de estado."
      );
      continue;
    }
    const result = await executeCrmWorkflowEmail({
      workflow,
      lead,
      previousStatus: job.previousStatus || job.nextStatus,
      nextStatus: job.nextStatus,
      changedBy: job.executedBy || lead.assignedAgentId || lead.createdBy || "",
      baseUrl,
    });
    await completeCrmWorkflowJob(job.id, result.sent, result.error || "");
    if (result.sent) {
      sent += 1;
      if (workflow.repeatEnabled && workflow.deliveryDelayHours > 0 && lead.status === workflow.triggerStatus) {
        await scheduleCrmWorkflowJob({
          workflowId: workflow.id,
          leadId: lead.id,
          previousStatus: job.previousStatus,
          nextStatus: job.nextStatus,
          executedBy: job.executedBy,
          scheduledFor: new Date(Date.now() + workflow.deliveryDelayHours * 60 * 60 * 1000).toISOString(),
        });
      }
    } else failed += 1;
  }

  return { processed: jobs.length, sent, failed };
}
