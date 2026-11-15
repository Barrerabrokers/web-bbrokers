// Read-only deployment verification. Never creates events or sends invitations.
const fs=require('fs'),path=require('path'),Module=require('module'),ts=require('typescript'),assert=require('node:assert/strict');
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,parent,...rest){return resolve.call(this,id.startsWith('@/')?path.join(process.cwd(),id.slice(2)):id,parent,...rest);};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const {getSharedDatabase,releaseSharedDatabase}=require('../lib/database-pool.ts');
(async()=>{const sql=getSharedDatabase();let organizerId;try{const [p]=await sql`SELECT id FROM agents WHERE lower(email)='pablo@barrerabrokers.com' AND active=TRUE AND role='admin'`;assert(p,'Pablo account unavailable');organizerId=p.id;}finally{await releaseSharedDatabase(sql);}
 const {miaMeetingCalendar,parseMiaMeetingTurn}=require('../lib/mia-meetings.ts');const {getCrmCalendarBusy}=require('../lib/crm-calendar-availability.ts');
 const token=await miaMeetingCalendar({organizerId});const from=new Date(),to=new Date(Date.now()+14*86400000);const busy=await getCrmCalendarBusy(token,from,to);
 console.log('MIA_CALENDAR_SMOKE',JSON.stringify({connected:true,daysChecked:14,busyRanges:busy.length,calendarWrites:0,invitationsSent:0}));
 const parsed=await parseMiaMeetingTurn([{direction:'inbound',content:'Quiero una reunión virtual con Pablo. Me sirve el viernes por la mañana.'}],null);
 assert.equal(parsed.mode,'google_meet');assert.equal(parsed.period,'morning');assert(parsed.weekdays.includes(5)||parsed.date,'Missing Friday preference');
 console.log('MIA_CALENDAR_SMOKE: preferencia de modalidad y horario interpretada; sin reservas reales.');
})().catch(e=>{console.error('MIA_CALENDAR_SMOKE failed:',e.name);process.exitCode=1;});
