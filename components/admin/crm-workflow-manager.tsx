"use client";

import { FormEvent, useMemo, useState } from "react";
import { Clock3, Mail, Loader2, Pencil, Plus, Power, Trash2, Workflow } from "lucide-react";
import type { CrmEmailTemplate, CrmLeadStatus, CrmWorkflow, CrmWorkflowDelayHours } from "@/lib/db";
import { leadStatusLabel } from "@/lib/crm-statuses";

type LeadStatusOption = {
  value: CrmLeadStatus;
  label: string;
};

type WorkflowFormState = {
  id: string;
  name: string;
  active: boolean;
  triggerStatus: CrmLeadStatus | "";
  templateId: string;
  runOncePerLead: boolean;
  deliveryDelayHours: CrmWorkflowDelayHours;
  repeatEnabled: boolean;
};

type CrmWorkflowManagerProps = {
  initialWorkflows: CrmWorkflow[];
  leadStatusOptions: LeadStatusOption[];
  emailTemplates: CrmEmailTemplate[];
};

const EMPTY_FORM: WorkflowFormState = {
  id: "",
  name: "",
  active: true,
  triggerStatus: "",
  templateId: "",
  runOncePerLead: true,
  deliveryDelayHours: 0,
  repeatEnabled: false,
};

const DELIVERY_OPTIONS: Array<{ value: CrmWorkflowDelayHours; label: string; detail: string }> = [
  { value: 0, label: "Al instante", detail: "En el momento del cambio" },
  { value: 24, label: "A las 24 horas", detail: "Un día después" },
  { value: 72, label: "A los 3 días", detail: "72 horas después" },
  { value: 168, label: "A la semana", detail: "7 días después" },
];

function deliveryLabel(hours: number) {
  return DELIVERY_OPTIONS.find((option) => option.value === hours)?.label || "Al instante";
}

export function CrmWorkflowManager({
  initialWorkflows,
  leadStatusOptions,
  emailTemplates,
}: CrmWorkflowManagerProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [form, setForm] = useState<WorkflowFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const availableEmailTemplates = useMemo(
    () => emailTemplates.filter((template) => (template.channel || "email") === "email"),
    [emailTemplates]
  );

  const activeCount = workflows.filter((workflow) => workflow.active).length;

  const updateForm = (patch: Partial<WorkflowFormState>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setError("");
    setNotice("");
  };

  const editWorkflow = (workflow: CrmWorkflow) => {
    setForm({
      id: workflow.id,
      name: workflow.name,
      active: workflow.active,
      triggerStatus: workflow.triggerStatus,
      templateId: workflow.templateId,
      runOncePerLead: workflow.runOncePerLead,
      deliveryDelayHours: workflow.deliveryDelayHours,
      repeatEnabled: workflow.repeatEnabled,
    });
    setError("");
    setNotice("");
  };

  const saveWorkflow = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/crm/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          active: form.active,
          triggerStatus: form.triggerStatus,
          templateId: form.templateId,
          runOncePerLead: form.runOncePerLead,
          deliveryDelayHours: form.deliveryDelayHours,
          repeatEnabled: form.repeatEnabled,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { workflow?: CrmWorkflow; error?: string }
        | null;

      if (!response.ok || !data?.workflow) {
        throw new Error(data?.error || "No se pudo guardar el workflow");
      }

      const template = availableEmailTemplates.find((item) => item.id === data.workflow!.templateId);
      const nextWorkflow = {
        ...data.workflow,
        templateName: template?.name || data.workflow.templateName,
        templateSubject: template?.subject || data.workflow.templateSubject,
      };
      setWorkflows((current) => [
        nextWorkflow,
        ...current.filter((workflow) => workflow.id !== nextWorkflow.id),
      ]);
      setForm(EMPTY_FORM);
      setNotice("Workflow guardado. Se ejecutará automáticamente cuando cambie el estado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el workflow");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleWorkflow = async (workflow: CrmWorkflow) => {
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/crm/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: workflow.id,
          name: workflow.name,
          active: !workflow.active,
          triggerStatus: workflow.triggerStatus,
          templateId: workflow.templateId,
          runOncePerLead: workflow.runOncePerLead,
          deliveryDelayHours: workflow.deliveryDelayHours,
          repeatEnabled: workflow.repeatEnabled,
        }),
      });
      const data = (await response.json().catch(() => null)) as
        | { workflow?: CrmWorkflow; error?: string }
        | null;

      if (!response.ok || !data?.workflow) {
        throw new Error(data?.error || "No se pudo actualizar el workflow");
      }

      setWorkflows((current) =>
        current.map((item) =>
          item.id === workflow.id
            ? {
                ...item,
                active: data.workflow!.active,
                updatedAt: data.workflow!.updatedAt,
              }
            : item
        )
      );
      setNotice(data.workflow.active ? "Workflow activado." : "Workflow pausado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el workflow");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteWorkflow = async (workflow: CrmWorkflow) => {
    if (deletingId) return;
    const confirmed = window.confirm(`¿Eliminar el workflow "${workflow.name}"?`);
    if (!confirmed) return;

    setDeletingId(workflow.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/crm/workflows?id=${encodeURIComponent(workflow.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error || "No se pudo eliminar el workflow");
      setWorkflows((current) => current.filter((item) => item.id !== workflow.id));
      if (form.id === workflow.id) setForm(EMPTY_FORM);
      setNotice("Workflow eliminado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el workflow");
    } finally {
      setDeletingId("");
    }
  };

  return (
    <main className="bg-cream-100 px-4 py-6 sm:px-6">
      <div className="mx-auto grid max-w-[1600px] gap-6 xl:grid-cols-[440px_minmax(0,1fr)]">
        <section className="rounded-md border border-ink/12 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <Workflow className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-ink/45">
                CRM / Workflows
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
                Automatizaciones por estado
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/62">
                Cuando un agente cambia el estado de un lead, el CRM puede enviar una plantilla
                de correo automáticamente desde la cuenta conectada del propietario del contacto.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-ink/10 bg-cream-50 p-3">
              <p className="text-2xl font-semibold text-ink">{workflows.length}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/48">
                Workflows
              </p>
            </div>
            <div className="rounded-md border border-ink/10 bg-cream-50 p-3">
              <p className="text-2xl font-semibold text-ink">{activeCount}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/48">
                Activos
              </p>
            </div>
          </div>

          <form onSubmit={saveWorkflow} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Nombre del workflow
              </span>
              <input
                value={form.name}
                onChange={(event) => updateForm({ name: event.target.value })}
                placeholder="Ej. Enviar bienvenida cuando pasa a Interesado"
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-accent"
              />
            </label>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Momento del envío
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DELIVERY_OPTIONS.map((option) => {
                  const selected = form.deliveryDelayHours === option.value;
                  return (
                    <label
                      key={option.value}
                      className={`cursor-pointer rounded-md border p-3 transition-colors ${
                        selected ? "border-ink bg-ink text-white" : "border-ink/14 bg-white text-ink hover:bg-cream-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="deliveryDelayHours"
                        value={option.value}
                        checked={selected}
                        onChange={() => updateForm({
                          deliveryDelayHours: option.value,
                          repeatEnabled: option.value === 0 ? false : form.repeatEnabled,
                        })}
                        className="sr-only"
                      />
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <Clock3 className="h-4 w-4" />
                        {option.label}
                      </span>
                      <span className={`mt-1 block text-xs ${selected ? "text-white/65" : "text-ink/50"}`}>
                        {option.detail}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <label className={`flex items-start gap-3 rounded-md border p-3 text-sm ${
              form.deliveryDelayHours === 0
                ? "cursor-not-allowed border-ink/8 bg-ink/[0.03] text-ink/38"
                : "border-ink/10 bg-cream-50 text-ink/68"
            }`}>
              <input
                type="checkbox"
                checked={form.repeatEnabled}
                disabled={form.deliveryDelayHours === 0}
                onChange={(event) => updateForm({ repeatEnabled: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-ink/20 text-accent focus:ring-accent/30 disabled:opacity-40"
              />
              <span>
                <strong className="block font-semibold text-current">Repetir workflow</strong>
                {form.deliveryDelayHours === 0
                  ? "Elegí 24 horas, 3 días o una semana para activar la repetición."
                  : `Volver a enviar ${deliveryLabel(form.deliveryDelayHours).toLowerCase()} mientras el lead permanezca en este estado.`}
              </span>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Cuando el estado cambie a
              </span>
              <select
                value={form.triggerStatus}
                onChange={(event) => updateForm({ triggerStatus: event.target.value as CrmLeadStatus })}
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">Seleccionar estado</option>
                {leadStatusOptions.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-ink/52">
                Enviar plantilla de correo
              </span>
              <select
                value={form.templateId}
                onChange={(event) => updateForm({ templateId: event.target.value })}
                className="mt-2 h-11 w-full rounded-md border border-ink/16 bg-white px-3 text-sm text-ink outline-none focus:border-accent"
              >
                <option value="">Seleccionar plantilla</option>
                {availableEmailTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-start gap-3 rounded-md border border-ink/10 bg-cream-50 p-3 text-sm text-ink/68">
              <input
                type="checkbox"
                checked={form.runOncePerLead}
                onChange={(event) => updateForm({ runOncePerLead: event.target.checked })}
                className="mt-1 h-4 w-4 rounded border-ink/20 text-accent focus:ring-accent/30"
              />
              <span>
                Ejecutar una sola vez por contacto. Recomendado para evitar que un cliente reciba
                el mismo correo si el estado vuelve a cambiar.
              </span>
            </label>

            <label className="flex items-center gap-3 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => updateForm({ active: event.target.checked })}
                className="h-4 w-4 rounded border-ink/20 text-accent focus:ring-accent/30"
              />
              Workflow activo
            </label>

            {error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {notice && (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {notice}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/88 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {form.id ? "Guardar cambios" : "Crear workflow"}
              </button>
              {form.id && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-11 items-center justify-center rounded-md border border-ink/16 px-4 text-sm font-semibold text-ink transition-colors hover:bg-cream-50"
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-md border border-ink/12 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-ink">Reglas activas y pausadas</h3>
              <p className="mt-1 text-sm text-ink/58">
                El correo se envía usando la cuenta conectada del propietario asignado al contacto.
              </p>
            </div>
            <span className="rounded-full border border-ink/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/52">
              {availableEmailTemplates.length} plantillas
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-md border border-ink/10">
            {workflows.length === 0 ? (
              <div className="p-8 text-center">
                <Mail className="mx-auto h-8 w-8 text-ink/32" />
                <p className="mt-3 text-base font-semibold text-ink">Todavía no hay workflows.</p>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/58">
                  Creá una regla simple: estado del lead, plantilla y si se ejecuta una sola vez.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-ink/10">
                {workflows.map((workflow) => (
                  <article
                    key={workflow.id}
                    className="grid gap-4 bg-white p-4 transition-colors hover:bg-cream-50 lg:grid-cols-[minmax(0,1fr)_220px_160px]"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            workflow.active
                              ? "bg-emerald-50 text-emerald-800"
                              : "bg-ink/8 text-ink/50"
                          }`}
                        >
                          {workflow.active ? "Activo" : "Pausado"}
                        </span>
                        <span className="rounded-full bg-cream-100 px-2.5 py-1 text-xs font-semibold text-ink/58">
                          {workflow.runOncePerLead ? "Una vez por contacto" : "Siempre que cambie"}
                        </span>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
                          {workflow.repeatEnabled ? `Repite ${deliveryLabel(workflow.deliveryDelayHours).toLowerCase()}` : deliveryLabel(workflow.deliveryDelayHours)}
                        </span>
                      </div>
                      <h4 className="mt-3 text-lg font-semibold text-ink">{workflow.name}</h4>
                      <p className="mt-2 text-sm leading-6 text-ink/60">
                        Cuando el estado cambie a{" "}
                        <strong className="font-semibold text-ink">
                          {leadStatusLabel(workflow.triggerStatus) || workflow.triggerStatus}
                        </strong>
                        , enviar{" "}
                        <strong className="font-semibold text-ink">
                          {workflow.templateName || "plantilla seleccionada"}
                        </strong>
                        {workflow.deliveryDelayHours === 0
                          ? ", al instante."
                          : `, ${deliveryLabel(workflow.deliveryDelayHours).toLowerCase()} desde el cambio de estado.`}
                      </p>
                      {workflow.templateSubject && (
                        <p className="mt-1 text-xs text-ink/45">Asunto: {workflow.templateSubject}</p>
                      )}
                    </div>

                    <div className="text-sm text-ink/58">
                      <p className="font-semibold text-ink">Disparador</p>
                      <p className="mt-1">Estado del lead</p>
                      <p className="mt-3 font-semibold text-ink">Última edición</p>
                      <p className="mt-1">
                        {new Date(workflow.updatedAt).toLocaleDateString("es-AR")}
                      </p>
                    </div>

                    <div className="flex items-start justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => toggleWorkflow(workflow)}
                        disabled={isSaving}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-ink/12 text-ink transition-colors hover:bg-white disabled:opacity-50"
                        title={workflow.active ? "Pausar workflow" : "Activar workflow"}
                      >
                        <Power className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => editWorkflow(workflow)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-ink/12 text-ink transition-colors hover:bg-white"
                        title="Editar workflow"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWorkflow(workflow)}
                        disabled={deletingId === workflow.id}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50"
                        title="Eliminar workflow"
                      >
                        {deletingId === workflow.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
