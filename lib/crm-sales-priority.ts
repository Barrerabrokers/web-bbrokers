import type { CrmLead } from "./db";

export type SalesEvent = { id:string; tipo:string; titulo:string; detalle:string; fecha:string; programado?:string; responsable?:string; direccion:string; resultado?:string };
export type SalesEvidence = { id:string; total:number; events:SalesEvent[]; next:SalesEvent[]; lastInbound?:string; lastOutbound?:string; lastContact?:string; communications:number };
export function normalizedSalesText(value:string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
const day = (value:string) => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Argentina/Buenos_Aires", year:"numeric", month:"2-digit", day:"2-digit"}).format(new Date(value));
export function salesPriority(lead:CrmLead, evidence:SalesEvidence, now=new Date()) {
  const status=normalizedSalesText(lead.status), reasons:string[]=[];
  let score=0;
  const inactive=["vendido","perdido","no interesado","no existe","unqualified"].includes(status);
  if (inactive) return {score:0, nivel:"Fuera del seguimiento comercial activo", motivos:["Estado actual: "+lead.status]};
  if(evidence.lastInbound && (!evidence.lastOutbound || Date.parse(evidence.lastInbound)>Date.parse(evidence.lastOutbound))) {
    score+=60; reasons.push(`Respuesta entrante del ${evidence.lastInbound} sin respuesta saliente posterior registrada; verificar antes de contactar.`);
  }
  const today=day(now.toISOString());
  for(const event of evidence.next) {
    if(event.programado && day(event.programado)===today) {
      score+=50; reasons.push(`Agendado hoy: ${event.titulo} (${event.programado}). Confirmar vigencia/completado.`); break;
    }
  }
  if(["new","nuevo"].includes(status) && !evidence.communications) {score+=35;reasons.push("Lead nuevo sin comunicaciones registradas; no prueba que nunca haya sido contactado.");}
  if(lead.temperature==="caliente") {score+=15;reasons.push("Temperatura caliente registrada por el equipo.");}
  if(["calificado","interesado","propuesta","reservado","open_deal"].includes(status)) {score+=10;reasons.push("Estado comercial con interés o avance registrado: "+lead.status);}
  if(evidence.lastContact && Date.parse(evidence.lastContact)<=now.getTime()-7*86400000) {score+=10;reasons.push("Sin comunicación registrada en los últimos 7 días; evaluar seguimiento.");}
  if(!reasons.length) reasons.push("Sin señal urgente en los registros consultados; completar calificación y próximo paso.");
  return {score,nivel:score>=50?"Alta":score>=25?"Media":"Baja",motivos:reasons};
}
