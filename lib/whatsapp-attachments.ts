import { randomUUID } from 'crypto';
import { getServerSupabase } from '@/lib/supabase';
import type { WhatsAppMessage } from '@/lib/whatsapp-inbox';
import { WHATSAPP_ATTACHMENT_MAX_BYTES, type WhatsAppAttachment } from '@/lib/whatsapp-attachment-policy';
export type { WhatsAppAttachment } from '@/lib/whatsapp-attachment-policy';
const bucket='crm-whatsapp-attachments';
let bucketReady:Promise<void>|undefined;
export async function validateWhatsAppAttachment(file:File) {
  if(!file.size||file.size>WHATSAPP_ATTACHMENT_MAX_BYTES)throw new Error('El archivo debe pesar hasta 4 MB.');
  const bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());
  const pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
  const png=[137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b);
  const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  const mimeType=pdf?'application/pdf':png?'image/png':jpeg?'image/jpeg':undefined;
  if(!mimeType || (file.type&&file.type!==mimeType))throw new Error('Adjuntá un PDF o una imagen JPG o PNG válida.');
  const filename=file.name.replace(/[\\/\u0000-\u001f]/g,'_').slice(0,180)|| (pdf?'documento.pdf':png?'imagen.png':'imagen.jpg');
  return {mimeType,filename,type:pdf?'document' as const:'image' as const};
}
async function ensureBucket() {
  if(!bucketReady)bucketReady=(async()=>{
    const storage=getServerSupabase().storage;
    const {data,error}=await storage.getBucket(bucket);
    if(data){if(data.public)throw new Error('El almacenamiento de adjuntos debe ser privado.');return;}
    if(error&&String((error as any).statusCode)!=='404'&&!/not found/i.test(error.message))throw error;
    const created=await storage.createBucket(bucket,{public:false,fileSizeLimit:WHATSAPP_ATTACHMENT_MAX_BYTES,allowedMimeTypes:['application/pdf','image/jpeg','image/png']});
    if(created.error&&!/already exists/i.test(created.error.message))throw created.error;
  })().catch(e=>{bucketReady=undefined;throw e;});
  await bucketReady;
}
export async function storeWhatsAppAttachment(conversationId:string,file:File):Promise<WhatsAppAttachment> {
  const info=await validateWhatsAppAttachment(file);await ensureBucket();
  const extension=info.type==='document'?'pdf':info.mimeType==='image/png'?'png':'jpg';
  const storagePath=`${conversationId}/${randomUUID()}.${extension}`;
  const {error}=await getServerSupabase().storage.from(bucket).upload(storagePath,await file.arrayBuffer(),{contentType:info.mimeType,upsert:false});
  if(error)throw new Error('No se pudo guardar el adjunto. Reintentá en unos segundos.');
  return {...info,storagePath,size:file.size};
}
export async function removeWhatsAppAttachment(attachment:WhatsAppAttachment) {
  const {error}=await getServerSupabase().storage.from(bucket).remove([attachment.storagePath]);
  if(error)throw error;
}
export async function withWhatsAppAttachmentUrls(messages:WhatsAppMessage[]) {
  if(!messages.some(m=>m.attachment))return messages;
  return Promise.all(messages.map(async m=>{
    if(!m.attachment?.storagePath)return m;
    try {const {data}=await getServerSupabase().storage.from(bucket).createSignedUrl(m.attachment.storagePath,3600);return {...m,attachment:{...m.attachment,url:data?.signedUrl}};}
    catch{return m;}
  }));
}
