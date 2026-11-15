import { argentinaHour } from "./argentina-time";

export const MIA_PILOT_LIMIT=5;
export function miaSalesOptOut(text:string) {
  const value=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return /\b(no contactar|no me (?:escribas|contactes|llames|mandes)|no quiero (?:recibir|mas mensajes|que me contacten)|deja de (?:escribirme|contactarme|llamarme|escribir|contactar|llamar)|darme de baja|dame de baja|no volver a contactar|unsubscribe|stop)\b/.test(value)||/^\s*(?:baja|stop)[.!\s]*$/.test(value);
}
export function miaSalesHours(now=new Date()) {
  const day=new Intl.DateTimeFormat('en-US',{timeZone:'America/Argentina/Buenos_Aires',weekday:'short'}).format(now);
  return day!=='Sun'&&day!=='Sat'&&argentinaHour(now)>=10&&argentinaHour(now)<18;
}
export function miaSalesOpening(name:string,project:string) {
  const clean=(v:string)=>v.replace(/[\r\n<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,100);
  const first=clean(name).split(' ')[0]||'¿cómo estás?';
  return `Hola ${first}, soy MIA, la asistente virtual de Barrera Brokers. Retomo tu consulta${project?` sobre ${clean(project)}`:''}. ¿Seguís buscando una propiedad o preferís que no volvamos a contactarte?`;
}
export function miaSalesTerminal(status:string) {
  return /^(vendido|reservado|perdido|no contactar)$/i.test(status.trim());
}
export function miaSalesTextWindow(lastInbound?:string|null,now=Date.now()) {
  const at=lastInbound?Date.parse(lastInbound):NaN;
  return Number.isFinite(at)&&at<=now&&at>now-23*60*60*1000;
}

export function miaSalesDecline(text:string){return miaSalesOptOut(text)||/^\s*(?:no gracias|no me interesa|no estoy interesad[oa]|ya no busco|ya compre)\b/i.test(text.normalize("NFD").replace(/[\u0300-\u036f]/g,""));}
