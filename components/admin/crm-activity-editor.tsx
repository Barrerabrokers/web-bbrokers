"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CrmActivity } from "@/lib/db";
import { argentinaLocalDateTimeToIso } from "@/lib/argentina-time";

function localDate(value?:string) {
  if (!value) return "";
  return new Date(new Date(value).getTime()-3*60*60*1000).toISOString().slice(0,16);
}
export function CrmActivityEditor({activity}:{activity:CrmActivity}) {
  const router=useRouter();
  const [editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [title,setTitle]=useState(activity.title),[body,setBody]=useState(activity.body),[date,setDate]=useState(localDate(activity.scheduledAt)),[outcome,setOutcome]=useState(activity.meetingOutcome || "");
  const [now,setNow]=useState(0);
  const [reminderMinutes,setReminderMinutes]=useState(activity.reminderMinutes || 60);
  useEffect(()=>{setNow(Date.now());const t=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(t);},[]);
  const meeting=activity.type==='reunion';
  if (!['nota','tarea','reunion'].includes(activity.type)||!activity.editVersion) return null;
  const allowed=!meeting || Boolean(activity.meetingEndsAt && now>=new Date(activity.meetingEndsAt).getTime());
  const start=()=>{setTitle(activity.title);setBody(activity.body);setDate(localDate(activity.scheduledAt));setOutcome(activity.meetingOutcome || "");setError("");setEditing(true);};
  async function save(event:React.FormEvent) {
    event.preventDefault();setBusy(true);setError("");
    try {
      const payload=meeting ? {outcome} : {title,body,...(activity.type==='tarea'?{scheduledAt:date?argentinaLocalDateTimeToIso(date):"",reminderMinutes}:{})};
      const res=await fetch('/api/crm/activities',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:activity.id,version:activity.editVersion,...payload})});
      const data=await res.json();if(!res.ok)throw Error(data.error || 'No se pudo guardar.');
      setEditing(false);router.refresh();
    }catch(e){setError(e instanceof Error?e.message:'No se pudo guardar.');}finally{setBusy(false);}
  }
  const field="mt-1 w-full rounded-lg border border-ink/25 bg-white px-3 py-2 text-sm font-normal text-ink focus:outline-none focus:ring-2 focus:ring-[#006b6b]";
  return <div className="mt-3">
    {meeting && activity.meetingOutcome && <div className="border-l-2 border-[#006b6b] pl-3"><p className="text-sm font-semibold">Resultado de la reunión</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink/80">{activity.meetingOutcome}</p></div>}
    {activity.editedAt && <p className="mt-2 text-xs text-ink/70">Editado{activity.editedByName?` por ${activity.editedByName}`:''} · {new Date(activity.editedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'})}</p>}
    {!editing ? allowed ? <button onClick={start} className="mt-2 min-h-11 rounded-lg px-3 text-sm font-semibold text-[#006b6b] hover:bg-[#e7f4f2]">{meeting?(activity.meetingOutcome?'Editar resultado':'Registrar resultado'):activity.type==='nota'?'Editar nota':'Editar tarea'}</button> : <p className="mt-2 text-xs text-ink/70">{activity.meetingEndsAt?'Podrás registrar el resultado al finalizar la reunión.':'No figura la hora de finalización en la agenda.'}</p> :
      <form onSubmit={save} className="mt-3 space-y-3">
        {meeting ? <label className="block text-sm font-semibold">Resultado de la reunión<textarea autoFocus required maxLength={10000} value={outcome} onChange={e=>setOutcome(e.target.value)} rows={5} className={field} placeholder="Qué se conversó, interés del cliente y próximos pasos" /></label> : <>
          <label className="block text-sm font-semibold">Título<input autoFocus required maxLength={500} value={title} onChange={e=>setTitle(e.target.value)} className={field}/></label>
          <label className="block text-sm font-semibold">{activity.type==='nota'?'Nota':'Detalle de la tarea'}<textarea maxLength={50000} value={body} onChange={e=>setBody(e.target.value)} rows={5} className={field}/></label>
          {activity.type==='tarea'&&<label className="block text-sm font-semibold">Fecha y hora (Argentina)<input required type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} className={field}/></label>}
          {activity.type==='tarea'&&<label className="block text-sm font-semibold">Avisar al agente<select className={field} value={reminderMinutes} onChange={e=>setReminderMinutes(Number(e.target.value))}><option value={1440}>1 día antes</option><option value={720}>12 horas antes</option><option value={60}>1 hora antes</option></select><span className="text-xs font-normal">Los cambios se sincronizan con Google en los próximos minutos.</span></label>}
        </>}
        {error&&<p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2"><button disabled={busy} className="min-h-11 rounded-lg bg-[#006b6b] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy?'Guardando…':'Guardar cambios'}</button><button type="button" disabled={busy} onClick={()=>setEditing(false)} className="min-h-11 rounded-lg border border-ink/20 px-4 text-sm">Cancelar</button></div>
      </form>}
  </div>;
}
