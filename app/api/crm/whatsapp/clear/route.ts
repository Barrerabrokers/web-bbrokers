import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getWhatsAppConversation } from '@/lib/whatsapp-inbox';
import { firstContactWhatsAppPhoneId } from '@/lib/whatsapp-inbox-scope';
import { claimWhatsAppHumanSend, releaseWhatsAppSend } from '@/lib/whatsapp-turn-lock';
import { clearWhatsAppChat } from '@/lib/whatsapp-clear-chat';
import { removeWhatsAppAttachment } from '@/lib/whatsapp-attachments';
export const dynamic='force-dynamic';
export const runtime='nodejs';
export const maxDuration=60;
export async function DELETE(request:NextRequest) {
  const session=await getServerSession(authOptions);
  if(session?.user.role!=='admin')return NextResponse.json({error:'Solo administración puede borrar los mensajes.'},{status:403});
  const parsed=z.object({conversationId:z.string().uuid(),confirmation:z.literal('Borrar')}).safeParse(await request.json().catch(()=>null));
  if(!parsed.success)return NextResponse.json({error:'Escribí Borrar para confirmar.'},{status:400});
  const {conversationId}=parsed.data;
  const conversation=await getWhatsAppConversation(conversationId);
  if(!conversation||conversation.channel!=='whatsapp'||conversation.businessPhoneNumberId!==firstContactWhatsAppPhoneId())return NextResponse.json({error:'No podés borrar este chat.'},{status:403});
  let token:string|undefined;
  try {
    token=await claimWhatsAppHumanSend(conversationId,session.user.id);
    const result=await clearWhatsAppChat(conversationId,token);
    const cleanup=await Promise.allSettled(result.attachments.map(removeWhatsAppAttachment));
    if(cleanup.some(r=>r.status==='rejected'))console.error('crm-cleared-attachment-cleanup-failed');
    return NextResponse.json({cleared:true,message:result.message});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'No se pudieron borrar los mensajes.'},{status:409});}
  finally{if(token)await releaseWhatsAppSend(conversationId,token).catch(()=>console.error('crm-clear-lock-release-failed'));}
}
