import { supabase } from "@/lib/supabase";
export async function uploadCrmEmailAttachment(file: File): Promise<string> {
  if (!file.size || file.size > 10 * 1024 * 1024) throw new Error("Cada adjunto debe tener contenido y pesar como máximo 10 MB.");
  const response = await fetch("/api/crm/email/attachments", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:file.name,size:file.size})});
  const data = await response.json().catch(() => null) as {path?:string;token?:string;url?:string;error?:string} | null;
  if (!response.ok || !data?.path || !data.token || !data.url) throw new Error(data?.error || "No se pudo preparar la carga del adjunto.");
  const {error} = await supabase.storage.from("properties").uploadToSignedUrl(data.path,data.token,file,{contentType:file.type || "application/octet-stream",upsert:false});
  if (error) throw new Error(`No se pudo subir ${file.name}. Volvé a intentar.`);
  return data.url;
}
