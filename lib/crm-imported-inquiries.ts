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
  const inquiries: ImportedInquiry[] = [];
  const excelRaw=properties?.excel_imports;
  if(excelRaw){
    try{
      const saved=typeof excelRaw==="string"?JSON.parse(excelRaw):excelRaw;
      if(Array.isArray(saved)){
        for(const item of saved){
          if(!item || typeof item!=="object" || Array.isArray(item))continue;
          const record=item as Record<string,unknown>;
          const fields=Array.isArray(record.fields)?record.fields.flatMap((field:unknown)=>{
            if(!field || typeof field!=="object" || Array.isArray(field))return [];
            const value=field as Record<string,unknown>;
            const label=text(value.label || value.key);
            const fieldValue=text(value.value);
            return label && fieldValue ? [{label,value:fieldValue}] : [];
          }):[];
          if(fields.length){
            inquiries.push({
              row:text(record.row),
              file:text(record.file),
              section:text(record.sheet) || "Excel",
              importedAt:text(record.importedAt),
              origin:"Excel",
              fields,
            });
          }
        }
      }
    }catch{}
  }

  const raw=properties?.jbj_pablo_import;
  if(!raw)return inquiries;
  try {
    const saved=typeof raw==="string"?JSON.parse(raw):raw;
    if(!saved || !Array.isArray(saved.rows))return inquiries;
    inquiries.push(...saved.rows.flatMap((row:unknown)=>{
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
    }));
  }catch{}
  return inquiries;
}
