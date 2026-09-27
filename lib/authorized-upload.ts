import { supabase } from "@/lib/supabase";

// Large files still go directly to Storage, using an authorized, path-bound token.
export async function uploadPublicFile(path:string,file:File,options:{contentType?:string;cacheControl?:string;upsert?:boolean;sessionId?:string}={}) {
  try {
    const response=await fetch('/api/upload/authorize',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({path,size:file.size,sessionId:options.sessionId})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||'No se autorizó la carga.');
    const {sessionId:_,...storageOptions}=options;
    const uploaded=await supabase.storage.from('properties').uploadToSignedUrl(result.path,result.token,file,{...storageOptions,upsert:false});
    return {error:uploaded.error};
  }catch(error){return {error:{message:error instanceof Error?error.message:'No se pudo subir el archivo.'}};}
}
