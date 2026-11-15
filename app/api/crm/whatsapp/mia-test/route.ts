import { runMiaValueFirst } from '@/lib/mia-value-first';
import { agentMemorySchema } from '@/lib/mia-agent-search';
import { replyMiaMeeting } from '@/lib/mia-meetings';
import { meetingStateSchema } from '@/lib/mia-meeting-policy';
import { splitMiaReplyMessages } from '@/lib/mia-reply-messages';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getMiaGuidance } from '@/lib/mia-guidance';
import { isMiaTestAdministrator } from '@/lib/mia-reset-runtime';
import { loadMiaPublicCatalog, getMiaTrialConfig, MIA_TRIAL_INDEX } from '@/lib/mia-project-trial';
export const dynamic='force-dynamic';
export const maxDuration=120;
async function allowed(){const session=await getServerSession(authOptions);return session?.user.role==='admin'&&await isMiaTestAdministrator(session.user.id);}
export async function GET(){
  if(!await allowed())return NextResponse.json({error:'Solo Pablo Barrera, administrador.'},{status:403});
  return NextResponse.json({enabled:(await getMiaTrialConfig()).enabled,projects:(await loadMiaPublicCatalog()).map(p=>p.name),source:MIA_TRIAL_INDEX},{headers:{'Cache-Control':'no-store'}});
}
const input=z.object({agentMemory:agentMemorySchema.nullable().optional(),meetingState:meetingStateSchema.nullable().optional(),messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(3500)})).min(1).max(32)});
// Isolated simulator: no WhatsApp send, contact update or CRM activity is performed.
export async function POST(request:NextRequest){
  if(!await allowed())return NextResponse.json({error:'Solo Pablo Barrera, administrador.'},{status:403});
  const parsed=input.safeParse(await request.json().catch(()=>null));
  if(!parsed.success||parsed.data.messages.at(-1)?.role!=='user'||JSON.stringify(parsed.data).length>40000)return NextResponse.json({error:'Conversación de prueba inválida.'},{status:400});
  const config=await getMiaTrialConfig();if(!config.enabled)return NextResponse.json({error:'La prueba todavía no está activa.'},{status:409});
  try {
    const guidance=await getMiaGuidance();
    const dialogue=parsed.data.messages.map(m=>({direction:m.role==='user'?'inbound':'outbound',content:m.content}));
    const meeting=dialogue.some(m=>m.direction==='outbound')?await replyMiaMeeting('preview',dialogue,{preview:true,state:parsed.data.meetingState}):null;
    const agent=meeting?null:await runMiaValueFirst(dialogue,config,guidance.instructions+'\n'+guidance.corrections.map(c=>c.instruction).join('\n'),{memory:parsed.data.agentMemory||undefined,offerMeeting:()=>replyMiaMeeting('preview',dialogue,{preview:true,state:parsed.data.meetingState,offerOnly:true})});
    const reply=meeting?.reply||agent!.reply;
    return NextResponse.json({reply:splitMiaReplyMessages(reply).join('\n\n'),messages:splitMiaReplyMessages(reply),meetingState:meeting?.state||agent?.meetingState||parsed.data.meetingState||null,agentMemory:agent?.memory||parsed.data.agentMemory||null},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'No se pudo consultar la prueba en este momento. Reintentá en unos segundos.'},{status:503});}
}
