import type { CrmActivity, CrmEmailTracking } from "@/lib/db";

export function emailOpenDestination(leadId: string, eventKey: string, fallback: string) {
  const id = /^email-open:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(eventKey)?.[1];
  return id ? `/admin/crm/${leadId}?activity=correo&email=${id}` : fallback;
}

export function findTrackedEmailActivity(tracking: CrmEmailTracking, activities: CrmActivity[]) {
  const exact = activities.find(activity => activity.type === "correo" && activity.externalId === `email-tracking:${tracking.id}`);
  if (exact) return exact;
  // Older messages did not store the tracking ID. Only use an unambiguous match.
  const legacy = activities.filter(activity => activity.type === "correo" && !activity.externalId
    && activity.title.replace(/^Correo enviado:\s*/i, "").trim() === tracking.subject.trim()
    && Math.abs(+new Date(activity.createdAt) - +new Date(tracking.createdAt)) < 10 * 60 * 1000);
  return legacy.length === 1 ? legacy[0] : undefined;
}
