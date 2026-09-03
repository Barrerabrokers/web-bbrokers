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
