export const CRM_AGENDA = { weekdays: [0,1,2,3,4,5,6], startTime: "08:00", endTime: "21:00", slotInterval: 30, durations: [30,60] };
export function agendaTimes(duration = 60) {
  if (![30,60].includes(duration)) return [];
  return Array.from({length: (21*60-8*60-duration)/30+1},(_,i)=>agendaTime(8+i/2));
}
export function agendaTime(hour: number) {
  return `${String(Math.floor(hour)).padStart(2,"0")}:${hour % 1 ? "30" : "00"}`;
}
export function agendaHour(value: string) {
  const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(value));
  return Number(parts.find(p=>p.type==='hour')?.value)+Number(parts.find(p=>p.type==='minute')?.value)/60;
}
export function agendaScheduleError(value: string, duration = 60) {
  const date=new Date(value);
  if (!Number.isFinite(date.getTime())) return "Elegí una fecha y hora válidas.";
  if (![30,60].includes(duration)) return "Elegí una duración de 30 minutos o 1 hora.";
  const hour=agendaHour(value);
  if (date.getUTCSeconds() || date.getUTCMilliseconds() || hour*2 % 1 || hour<8 || hour+duration/60>21) return "Elegí un inicio cada media hora entre las 08:00 y las 21:00, con finalización hasta las 21:00 (Argentina).";
  return null;
}
