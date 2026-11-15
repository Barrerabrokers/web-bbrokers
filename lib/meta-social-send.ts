/** Facebook Login uses the linked Page's messaging endpoint and Page token. */
export async function deliverMetaSocialText(channel: 'instagram' | 'facebook', credentials: {token:string;pageId:string;instagramId?:string}, recipientId:string, text:string, version='v26.0') {
  if(channel==='instagram'&&!credentials.instagramId)throw new Error('Falta vincular la cuenta profesional de Instagram.');
  if(!/^\d+$/.test(credentials.pageId)||!/^\d+$/.test(recipientId||''))throw new Error('El identificador del contacto de Meta no es válido. Sincronizá la conversación nuevamente.');
  if(!/^v\d+\.\d+$/.test(version))throw new Error('La versión de Meta no es válida.');
  let response:Response;
  try {response=await fetch(`https://graph.facebook.com/${version}/${credentials.pageId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${credentials.token}`,'Content-Type':'application/json'},body:JSON.stringify({recipient:{id:recipientId},messaging_type:'RESPONSE',message:{text}}),signal:AbortSignal.timeout(20000)});}
  catch {throw new Error('No se pudo confirmar el envío en Meta. Revisá Instagram antes de reintentarlo para evitar duplicados.');}
  const result=await response.json().catch(()=>null);
  if(!result)throw new Error(`Meta devolvió una respuesta inesperada (HTTP ${response.status}). No se pudo confirmar el envío; revisá Instagram antes de reintentarlo.`);
  if(!response.ok||result.error){
    const code=Number(result.error?.code),subcode=Number(result.error?.error_subcode);
    if(code===190)throw new Error('Meta rechazó el token de la cuenta. Volvé a autorizar Instagram y Facebook desde Marketing.');
    if(code===10||code===200)throw new Error(`Meta no autoriza responder este chat (código ${code}). Revisá los permisos de mensajes y la ventana de respuesta de Instagram.`);
    if(subcode===2018278)throw new Error('La ventana para responder este chat en Instagram está cerrada. El cliente debe volver a escribir.');
    throw new Error(`Meta rechazó el mensaje de ${channel} (código ${code||response.status}${subcode?`/${subcode}`:''}). Revisá la conexión y los permisos de mensajes.`);
  }
  if(typeof result.message_id!=='string'||!result.message_id)throw new Error('Meta no confirmó un identificador de envío. Revisá Instagram antes de reintentarlo.');
  return result.message_id;
}
