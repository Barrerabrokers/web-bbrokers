export async function pushRequest(body: object) {
  const response=await fetch("/api/crm/push",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  const data=await response.json();
  if(!response.ok)throw new Error(data.error||"No se pudo completar la operación.");
  return data;
}

export async function disableDevicePush() {
  if(!("serviceWorker" in navigator))return;
  const registration=await navigator.serviceWorker.getRegistration("/");
  const subscription=await registration?.pushManager?.getSubscription();
  if(!subscription)return;
  let removed=false;
  try {await pushRequest({action:"delete",endpoint:subscription.endpoint});removed=true;}
  finally {
    const unsubscribed=await subscription.unsubscribe();
    if(!removed&&!unsubscribed)throw new Error("No se pudo desactivar este dispositivo.");
  }
}
