type MetaProperties = Record<string, unknown> | null | undefined;

function readableText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  return raw.replaceAll("_", " ").replace(/\s+/g, " ").trim();
}

function readableLabel(key: string) {
  const label = key
    .replace(/^meta_field_/, "")
    .replaceAll("_", " ")
    .replace(/\s+/g, " ")
    .trim();
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : "Respuesta";
}

export function getCrmMetaFormFields(properties: MetaProperties) {
  return Object.entries(properties || {})
    .filter(([key, value]) => key.startsWith("meta_field_") && readableText(value))
    .map(([key, value]) => ({ key, label: readableLabel(key), value: readableText(value) }));
}

export function getCrmMetaFormName(properties: MetaProperties) {
  return readableText(properties?.meta_form_name);
}

export type CrmMetaFormSubmission = {
  leadId: string;
  formId: string;
  formName: string;
  createdTime: string;
  fields: Array<{ key: string; label: string; value: string }>;
};

export function getCrmMetaFormSubmissions(properties: MetaProperties): CrmMetaFormSubmission[] {
  const serialized = properties?.meta_submissions;
  if (typeof serialized === "string" && serialized.trim()) {
    try {
      const parsed = JSON.parse(serialized);
      if (Array.isArray(parsed)) {
        const submissions = parsed.flatMap((item): CrmMetaFormSubmission[] => {
          if (!item || typeof item !== "object" || Array.isArray(item)) return [];
          const record = item as Record<string, unknown>;
          const rawFields = record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
            ? record.fields as Record<string, unknown>
            : {};
          const fields = Object.entries(rawFields)
            .filter(([, value]) => readableText(value))
            .map(([key, value]) => ({ key, label: readableLabel(`meta_field_${key}`), value: readableText(value) }));
          if (fields.length === 0) return [];
          return [{
            leadId: readableText(record.leadId),
            formId: readableText(record.formId),
            formName: readableText(record.formName),
            createdTime: readableText(record.createdTime),
            fields,
          }];
        });
        if (submissions.length > 0) return submissions;
      }
    } catch {}
  }

  const fields = getCrmMetaFormFields(properties);
  if (fields.length === 0) return [];
  return [{
    leadId: readableText(properties?.meta_lead_id),
    formId: readableText(properties?.meta_form_id),
    formName: getCrmMetaFormName(properties),
    createdTime: readableText(properties?.meta_created_time),
    fields,
  }];
}
