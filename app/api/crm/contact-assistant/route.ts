import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { getCrmActivities, getCrmLeads, type CrmLead } from "@/lib/db";
import { leadStatusLabel } from "@/lib/crm-statuses";
import { canManageListings, canViewAllCrmContacts } from "@/lib/roles";
import { appendCrmAiExchange, createCrmAiConversation, deleteCrmAiConversation, getCrmAiConversation, listCrmAiConversations, type CrmAiContact } from "@/lib/crm-ai-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ question: z.string().trim().min(2).max(800), conversationId: z.string().uuid().optional(), contactId: z.string().uuid().optional() });

async function authorizedSession() {
  const session = await getServerSession(authOptions);
  return session && canManageListings(session.user.role) ? session : null;
}

export async function GET(request: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ conversations: await listCrmAiConversations(session.user.id) });
  const conversation = await getCrmAiConversation(conversationId, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function DELETE(request: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId || !(await deleteCrmAiConversation(conversationId, session.user.id))) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function searchable(lead: CrmLead) {
  return normalized([lead.firstName, lead.lastName, lead.email, lead.phone, lead.status, lead.temperature, lead.source, lead.developmentName, lead.developmentNameText, lead.assignedAgentName, lead.notes].filter(Boolean).join(" "));
}

function contactRecord(lead: CrmLead) {
  return {
    id: lead.id,
    nombre: `${lead.firstName} ${lead.lastName}`.trim(),
    email: lead.email,
    telefono: `${lead.countryCode || ""} ${lead.phone || ""}`.trim(),
    estado: leadStatusLabel(lead.status),
    temperatura: lead.temperature || "sin definir",
    desarrollo: lead.developmentName || lead.developmentNameText || "sin definir",
    propietario: lead.assignedAgentName || "sin asignar",
    origen: lead.source || "sin definir",
    notas: (lead.notes || "").slice(0, 500),
    creado: lead.createdAt,
    actualizado: lead.updatedAt,
  };
}

function counts(leads: CrmLead[], key: (lead: CrmLead) => string) {
  return Object.entries(leads.reduce<Record<string, number>>((result, lead) => {
    const value = key(lead) || "Sin definir";
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 25);
}

export async function POST(request: NextRequest) {
  const session = await authorizedSession();
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Escribí una consulta sobre tus contactos" }, { status: 400 });

  const includeAll = canViewAllCrmContacts(session.user.role);
  let conversationId = parsed.data.conversationId;
  let history: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (conversationId) {
    const existing = await getCrmAiConversation(conversationId, session.user.id);
    if (!existing) return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
    history = existing.messages.slice(-12).map(({ role, content }) => ({ role, content }));
  }
  const leads = await getCrmLeads({ agentId: session.user.id, includeAll });
  const focusedLead = parsed.data.contactId ? leads.find((lead) => lead.id === parsed.data.contactId) : undefined;
  if (parsed.data.contactId && !focusedLead) return NextResponse.json({ error: "Contacto no autorizado" }, { status: 403 });
  const focusedActivities = focusedLead ? await getCrmActivities([focusedLead.id]) : [];
  const tokens = normalized(parsed.data.question).split(/[^a-z0-9@.+-]+/).filter((token) => token.length >= 3);
  const ranked = leads.map((lead) => ({ lead, score: tokens.reduce((score, token) => score + (searchable(lead).includes(token) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || new Date(b.lead.updatedAt).getTime() - new Date(a.lead.updatedAt).getTime());
  const matches = ranked.filter((item) => item.score > 0).slice(0, 30).map((item) => item.lead);
  const contextLeads = focusedLead ? [focusedLead] : (matches.length ? matches : ranked.slice(0, 20).map((item) => item.lead));
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Falta configurar GROQ_API_KEY en el servidor" }, { status: 503 });

  const scope = includeAll ? "todos los contactos del CRM porque el usuario es administrador" : "únicamente los contactos asignados al agente autenticado";
  const dataset = {
    alcance: scope,
    totalContactosVisibles: leads.length,
    estados: counts(leads, (lead) => leadStatusLabel(lead.status)),
    desarrollos: counts(leads, (lead) => lead.developmentName || lead.developmentNameText || "Sin desarrollo"),
    propietarios: includeAll ? counts(leads, (lead) => lead.assignedAgentName || "Sin asignar") : undefined,
    contactosRelevantes: contextLeads.map(contactRecord),
    actividadContacto: focusedActivities.slice(0, 40).map((activity) => ({
      tipo: activity.type,
      titulo: activity.title,
      detalle: (activity.body || "").slice(0, 800),
      fecha: activity.createdAt,
      programado: activity.scheduledAt || undefined,
      responsable: activity.createdByName || undefined,
    })),
  };

  const instructions = `Sos el asistente interno de Contactos de Barrera Brokers. Respondé en español claro y breve usando exclusivamente los datos autorizados de la consulta actual. Tu alcance es ${scope}. La conversación anterior sirve para comprender referencias y preguntas de seguimiento, pero nunca prevalece sobre los permisos y datos actuales. No reveles información histórica de un contacto que no figure en los datos autorizados actuales. Nunca sugieras que podés ver contactos fuera de ese alcance. No inventes personas, cifras ni datos. Si la consulta pide un contacto, indicá nombre y los datos útiles disponibles. Si pide un análisis, explicá el resultado y la cantidad. Aclará cuando los contactos relevantes son una muestra y no un resultado exhaustivo. No realices cambios: solo consultas.`;
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_CRM_MODEL || "openai/gpt-oss-120b",
      max_completion_tokens: 700,
      messages: [
        { role: "system", content: instructions },
        ...history,
        { role: "user", content: `Consulta: ${parsed.data.question}\n\nDatos autorizados:\n${JSON.stringify(dataset)}` },
      ],
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    const rateLimited = response.status === 429;
    return NextResponse.json({ error: rateLimited ? "Se alcanzó temporalmente el límite gratuito de Groq. Probá nuevamente en unos minutos." : result?.error?.message || "No se pudo consultar el asistente con Groq" }, { status: rateLimited ? 429 : 502 });
  }
  const answer = result.choices?.[0]?.message?.content;
  if (!answer) return NextResponse.json({ error: "El asistente no devolvió una respuesta" }, { status: 502 });

  const cleanAnswer = String(answer).trim();
  const contacts: CrmAiContact[] = contextLeads.slice(0, 8).map((lead) => ({ id: lead.id, name: `${lead.firstName} ${lead.lastName}`.trim(), email: lead.email, development: lead.developmentName || lead.developmentNameText || "" }));
  if (!conversationId) conversationId = await createCrmAiConversation(session.user.id, parsed.data.question.slice(0, 72));
  await appendCrmAiExchange(conversationId, session.user.id, parsed.data.question, cleanAnswer, contacts);
  return NextResponse.json({ conversationId, answer: cleanAnswer, contacts, scope: includeAll ? "all" : "owned" });
}
