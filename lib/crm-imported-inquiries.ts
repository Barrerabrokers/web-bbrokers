type Properties = Record<string, unknown> | null | undefined;
function text(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value).normalize("NFKC").replaceAll("_", " ").replace(/\s+/g," ").trim() : "";
}
function readable(value: unknown) {
  const raw=text(value);
  const labels:Record<string,string>={
    ig:"Instagram",fb:"Facebook",whatsapp:"WhatsApp",
    "llamada telefoníca":"Llamada telefónica",
    "entre u$d 39.000 y u$d 60.000":"Entre USD 39.000 y USD 60.000",
    "menos de u$d 39.000":"Menos de USD 39.000",
    "más de u$d 60.000":"Más de USD 60.000","mas de 60.000":"Más de USD 60.000",
  };
  return labels[raw.toLowerCase()] || (raw ? raw[0].toUpperCase()+raw.slice(1) : "No informado");
}
type ImportedInquiry = {row:string;file:string;section:string;importedAt:string;origin:string;fields:{label:string;value:string}[]};
export function getCrmImportedInquiries(properties:Properties): ImportedInquiry[] {
  const raw=properties?.jbj_pablo_import;
  if(!raw)return [];
  try {
    const saved=typeof raw==="string"?JSON.parse(raw):raw;
    if(!saved || !Array.isArray(saved.rows))return [];
    return saved.rows.flatMap((row:unknown)=>{
      if(!row || typeof row!=="object")return [];
      const r=row as Record<string,unknown>,data=r.data;
      if(!data || typeof data!=="object" || Array.isArray(data))return [];
      const values=data as Record<string,unknown>;
      return [{row:text(r.row),file:text(saved.file),section:text(r.section),importedAt:text(saved.importedAt),
        origin:readable(values.Fuente),fields:[
          {label:"Objetivo",value:readable(values.Objetivo)},
          {label:"Presupuesto de anticipo",value:readable(values["Presupuesto anticipo"])},
          {label:"Horizonte de compra",value:readable(values["En cuanto tiempo compraria"])},
          {label:"Canal de contacto preferido",value:readable(values["Por donde quiere que lo contactemos"])},
        ]}];
    });
  }catch{return [];}
}
