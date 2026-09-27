import { after } from 'next/server';

// The database trigger persists the event first. This is a fast-path only;
// the independent cron recovers interrupted requests, limits and non-HTTP writers.
export function scheduleSalesAnalysis() {
 if(process.env.AI_SALES_ENABLED!=='true')return;
 try {
  after(async()=>{
   try { const {processSales}=await import('./worker');await processSales({liveOnly:true}); }
   catch { console.error('AI Sales: evento conservado para el próximo ciclo.'); }
  });
 } catch { /* No request context (scripts): durable cron handles the event. */ }
}
