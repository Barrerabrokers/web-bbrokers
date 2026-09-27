"use client";
import { useEffect, useState } from "react";
import { disableDevicePush, pushRequest } from "@/lib/crm-push-client";

type Preferences={email_opens:boolean;tasks:boolean;meetings:boolean;meeting_minutes:60|720|1440};
export function CrmPushSettings(){
  const [key,setKey]=useState("");
  const [endpoint,setEndpoint]=useState("");
  const [busy,setBusy]=useState(true);
  const [hint,setHint]=useState("");
  const [message,setMessage]=useState("");
  const [prefs,setPrefs]=useState<Preferences>({email_opens:true,tasks:true,meetings:true,meeting_minutes:60});
  useEffect(()=>{let mounted=true;
    async function load(){
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
      const standalone=matchMedia("(display-mode: standalone)").matches||(navigator as Navigator&{standalone?:boolean}).standalone;
      if(ios&&!standalone){setHint("En iPhone/iPad: abrí el CRM en Safari → Compartir → Agregar a inicio. Después abrí la app instalada y activá los avisos acá (iOS 16.4 o posterior).");return;}
      if(!("Notification" in window)||!("serviceWorker" in navigator)||!("PushManager" in window)){setHint("Este navegador no admite notificaciones push. Probá desde un navegador actualizado en tu celular.");return;}
      if(Notification.permission==="denied"){setHint("Las notificaciones están bloqueadas. Permitilas en la configuración del navegador o del celular y volvé a abrir la app.");return;}
      const response=await fetch("/api/crm/push",{cache:"no-store"});
      if(!response.ok)throw new Error("No se pudo preparar el dispositivo. Cerrá y volvé a abrir la campana.");
      const config=await response.json();
      await navigator.serviceWorker.register("/sw.js");
      const registration=await navigator.serviceWorker.ready;
      const sub=await registration.pushManager.getSubscription();
      if(!mounted)return;
      setKey(config.publicKey);
      if(sub){const status=await pushRequest({action:"status",endpoint:sub.endpoint});if(mounted&&status.subscribed){setEndpoint(sub.endpoint);setPrefs(status.settings);}}
    }
    void load().catch(e=>{if(mounted)setMessage(e.message);}).finally(()=>{if(mounted)setBusy(false);});
    return()=>{mounted=false;};
  },[]);
  async function run(action:()=>Promise<void>){setBusy(true);setMessage("");try{await action();}catch(e){setMessage(e instanceof Error?e.message:"No se pudo completar la operación.");}finally{setBusy(false);}}
  async function activate(){
    // Permission is requested directly from a user's click (required by iOS).
    const permission=await Notification.requestPermission();
    if(permission!=="granted")throw new Error("Para recibir avisos tenés que permitir las notificaciones del dispositivo.");
    const registration=await navigator.serviceWorker.ready;
    const old=await registration.pushManager.getSubscription();
    if(old)await old.unsubscribe();
    const bytes=Uint8Array.from(atob(key.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0));
    const sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
    try{await pushRequest({action:"subscribe",...sub.toJSON()});}catch(e){await sub.unsubscribe();throw e;}
    setEndpoint(sub.endpoint);setPrefs({email_opens:true,tasks:true,meetings:true,meeting_minutes:60});setMessage("Avisos activados. Podés enviar una prueba para comprobarlos.");
  }
  return <div className="border-b border-ink/10 bg-[#f2f8f7] px-4 py-3 text-xs text-ink">
    <strong className="block text-sm">Avisos en este dispositivo</strong>
    {hint?<p className="mt-2 leading-relaxed">{hint}</p>:endpoint?<>
      <p className="mt-1 text-ink/65">Activos para tu cuenta, incluso con la app cerrada.</p>
      <fieldset disabled={busy} className="mt-3 space-y-2 disabled:opacity-60">
        {([["email_opens","Correos abiertos"],["tasks","Recordatorios de tareas"],["meetings","Reuniones programadas"]] as const).map(([field,label])=><label key={field} className="flex min-h-8 items-center gap-2"><input type="checkbox" checked={prefs[field]} onChange={e=>setPrefs({...prefs,[field]:e.target.checked})}/>{label}</label>)}
        <label className="block">Avisar reuniones antes de
          <select className="mt-1 block min-h-10 w-full rounded border border-ink/20 bg-white px-2" value={prefs.meeting_minutes} onChange={e=>setPrefs({...prefs,meeting_minutes:Number(e.target.value) as Preferences["meeting_minutes"]})}><option value={60}>1 hora</option><option value={720}>12 horas</option><option value={1440}>1 día</option></select>
        </label>
        <p className="text-ink/60">Las tareas usan el aviso elegido al programarlas. Los avisos se revisan cada 5 minutos.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="min-h-10 rounded bg-[#006b6b] px-3 text-white" onClick={()=>void run(async()=>{await pushRequest({action:"settings",endpoint,settings:prefs});setMessage("Preferencias guardadas.");})}>Guardar</button>
          <button type="button" className="min-h-10 rounded border border-ink/20 px-3" onClick={()=>void run(async()=>{await pushRequest({action:"test",endpoint});setMessage("Prueba aceptada por el servicio. Comprobá que apareció en tu dispositivo.");})}>Enviar prueba</button>
          <button type="button" className="min-h-10 px-1 underline" onClick={()=>void run(async()=>{await disableDevicePush();setEndpoint("");setMessage("Avisos desactivados en este dispositivo.");})}>Desactivar</button>
        </div>
      </fieldset>
    </>:<><p className="mt-1 leading-relaxed text-ink/65">Correos abiertos, tareas y reuniones, sin mostrar datos de clientes en la pantalla bloqueada.</p><button type="button" disabled={busy||!key} onClick={()=>void run(activate)} className="mt-2 min-h-10 rounded bg-[#006b6b] px-3 text-white disabled:opacity-50">{busy?"Preparando…":"Activar notificaciones"}</button></>}
    {message&&<p role="status" aria-live="polite" className="mt-2 leading-relaxed">{message}</p>}
  </div>;
}
