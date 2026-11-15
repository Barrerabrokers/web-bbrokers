export const WHATSAPP_ATTACHMENT_MAX_BYTES=4*1024*1024;
export type WhatsAppAttachment={type:'image'|'document';mimeType:string;filename:string;size:number;storagePath:string;mediaId?:string;url?:string};
