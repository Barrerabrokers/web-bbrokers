import { notFound } from "next/navigation";
import { getBookedRanges, getMeetingLinkBySlug } from "@/lib/meeting-scheduler";
import { PublicMeetingScheduler } from "@/components/public-meeting-scheduler";
import { getCrmEmailAccountWithSecret } from "@/lib/db";
import { getAccessTokenForGoogleAccount } from "@/lib/google-oauth";

export const dynamic = "force-dynamic";

export default async function PublicMeetingPage({params}:{params:{slug:string}}) {
  const link=await getMeetingLinkBySlug(params.slug);
  if(!link) notFound();
  const from=new Date(),to=new Date(Date.now()+45*86400000);
  const busy=await getBookedRanges(link.agentId,from,to);
  const ranges=busy.map((x:any)=>({start:new Date(x.starts_at).toISOString(),end:new Date(x.ends_at).toISOString()}));
  try {
    const account=await getCrmEmailAccountWithSecret(link.agentId);
    if(account?.provider==="google-oauth") {
      const origin=process.env.NEXTAUTH_URL||"https://barrerabrokers.com";
      const token=await getAccessTokenForGoogleAccount({origin,account});
      const response=await fetch("https://www.googleapis.com/calendar/v3/freeBusy",{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({timeMin:from.toISOString(),timeMax:to.toISOString(),timeZone:"America/Argentina/Buenos_Aires",items:[{id:"primary"}]}),cache:"no-store"});
      const data=await response.json().catch(()=>null);
      if(response.ok&&data?.calendars?.primary?.busy) ranges.push(...data.calendars.primary.busy);
    }
  } catch {}
  return <PublicMeetingScheduler link={{...link,agentEmail:""}} initialBusy={ranges}/>;
}
