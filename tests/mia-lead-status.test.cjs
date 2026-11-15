const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
const box={exports:{},require};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/mia-lead-status.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,box);
const decide=box.exports.decideMiaLeadStatus;
const sent={id:'sent',direction:'outbound',content:'Hola, soy MIA',at:'2026-10-28T10:00:00Z',successful:true};
const msg=(content,n=1)=>({id:'in'+n,direction:'inbound',content,at:`2026-10-28T11:0${n}:00Z`});
test('outreach without human response is No contesta; failed/unsent contacts stay Nuevo',()=>{
 assert.equal(decide('Nuevo',[sent]).status,'No contesta');assert.equal(decide('Nuevo',[]),null);
 assert.equal(decide('Nuevo',[{...sent,successful:false}]),null);
 assert.equal(decide('Nuevo',[sent,msg('Gracias por tu mensaje. En este momento no estoy disponible, pero te responderé tan pronto sea posible.')]).status,'No contesta');
});
test('replies distinguish greeting, ongoing interaction, and commercial interest',()=>{
 assert.equal(decide('Nuevo',[sent,msg('Hola')]).status,'Contactado');
 assert.equal(decide('No contesta',[sent,msg('Donde se encuentran?')]).status,'En curso');
 assert.equal(decide('Nuevo',[sent,msg('Pasame los precios')]).status,'Interesado');
 assert.equal(decide('Nuevo',[sent,msg('[El cliente envió un audio sin transcripción]')]).status,'En curso');
});
test('latest explicit refusal overrides older interest; quoted emails are not new intent',()=>{
 for(const text of ['No deseo recibir mas mensajes! Gracias','No ya compre gracias','Suspender la búsqueda. O','No estoy interesado'])assert.equal(decide('Interesado',[msg(text)]).status,'No interesado / no califica');
 assert.equal(decide('Nuevo',[msg('Pasame los precios'),msg('Suspender busqueda\n\nEl dom, 25 de oct de 2026, MIA escribió:\n> Quiero invertir',2)]).status,'No interesado / no califica');
 assert.equal(decide('Nuevo',[msg('Hola\n\n> Me interesa invertir')]).status,'Contactado');
});
test('acknowledgments and silence do not erase established interest or rejection',()=>{
 assert.equal(decide('Interesado',[sent]),null);assert.equal(decide('Interesado',[msg('Gracias')]),null);
 assert.equal(decide('No interesado / no califica',[msg('Hola')]),null);
 assert.equal(decide('No interesado / no califica',[msg('Ahora busco dos ambientes')]).status,'Interesado');
 assert.equal(decide('Nuevo',[msg('No quiero reservar')]).status,'En curso');
});
test('closed operations and meetings retain their CRM states',()=>{
 for(const status of ['Vendido','Reservado','Reunion'])assert.equal(decide(status,[sent,msg('Pasame los precios')]),null);
});
test('database reconciliation scopes ownership, ignores failed/history, audits and isolates meeting guards',async()=>{
 require('@next/env').loadEnvConfig(process.cwd());const url=process.env.POSTGRES_PRISMA_URL||process.env.POSTGRES_URL||process.env.DATABASE_URL;if(!url)return;
 const sql=require('postgres')(url,{ssl:'require',max:1,prepare:false,onnotice:()=>{}});
 const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
 const ids=Array.from({length:6},(_,i)=>`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
 try{await sql.begin(async tx=>{
  const sql=tx;sql.begin=fn=>tx.savepoint(fn);
  await sql.unsafe("DROP TABLE IF EXISTS pg_temp.crm_leads,pg_temp.crm_mia_sales_enrollments,pg_temp.crm_whatsapp_conversations,pg_temp.crm_whatsapp_messages,pg_temp.crm_activities,pg_temp.crm_mia_sales_jobs CASCADE");
  await sql.unsafe("DROP FUNCTION IF EXISTS pg_temp.block_mia_status_test()");
  await sql`CREATE TEMP TABLE crm_leads(id uuid primary key,assigned_agent_id uuid,status text,updated_at timestamptz default now()) ON COMMIT DROP`;
  await sql`CREATE TEMP TABLE crm_mia_sales_enrollments(lead_id uuid primary key,started_at timestamptz) ON COMMIT DROP`;
  await sql`CREATE TEMP TABLE crm_whatsapp_conversations(id uuid,lead_id uuid,channel text) ON COMMIT DROP`;
  await sql`CREATE TEMP TABLE crm_whatsapp_messages(id uuid,conversation_id uuid,direction text,content text,created_at timestamptz,status text,sender_type text) ON COMMIT DROP`;
  await sql`CREATE TEMP TABLE crm_activities(id uuid,lead_id uuid,type text,title text,body text,created_by uuid,external_source text,external_id text,scheduled_at timestamptz,created_at timestamptz default now()) ON COMMIT DROP`;
  await sql`CREATE TEMP TABLE crm_mia_sales_jobs(id uuid,lead_id uuid,channel text,state text,sent_at timestamptz,content text) ON COMMIT DROP`;
  await sql.unsafe(`CREATE FUNCTION pg_temp.block_mia_status_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id='${ids[1]}'::uuid THEN RAISE EXCEPTION 'reunión pendiente'; END IF; RETURN NEW; END $$`);
  await sql`CREATE TRIGGER test_guard BEFORE UPDATE OF status ON crm_leads FOR EACH ROW EXECUTE FUNCTION pg_temp.block_mia_status_test()`;
  for(let i=0;i<ids.length;i++){
   await sql`INSERT INTO crm_leads(id,assigned_agent_id,status) VALUES(${ids[i]},${i===2?other:owner},'Nuevo')`;
   await sql`INSERT INTO crm_mia_sales_enrollments VALUES(${ids[i]},'2026-10-28T10:00:00Z')`;
   await sql`INSERT INTO crm_whatsapp_conversations VALUES(${ids[i]},${ids[i]},'whatsapp')`;
   await sql`INSERT INTO crm_whatsapp_messages VALUES(${ids[i]},${ids[i]},'outbound','Hola','2026-10-28T11:00:00Z',${i===3?'failed':'delivered'},'ai')`;
  }
  await sql`INSERT INTO crm_whatsapp_messages VALUES(gen_random_uuid(),${ids[4]},'inbound','Pasame precios','2026-10-28T11:01:00Z','historical','customer')`;
  await sql`INSERT INTO crm_activities(id,lead_id,body,external_source,scheduled_at) VALUES(gen_random_uuid(),${ids[5]},'Pasame los precios','gmail_inbound','2026-10-28T11:02:00Z')`;
  const dry=await box.exports.reconcileMiaLeadStatuses(sql,{agentId:owner,dryRun:true});assert.equal(dry.changed.length,4);
  assert.equal((await sql`SELECT count(*)::int n FROM crm_leads WHERE status<>'Nuevo'`)[0].n,0);
  const done=await box.exports.reconcileMiaLeadStatuses(sql,{agentId:owner});assert.equal(done.changed.length,3);assert.equal(done.blocked.length,1);
  const states=await sql`SELECT id,status FROM crm_leads ORDER BY id`;assert.deepEqual(states.map(r=>r.status),['No contesta','Nuevo','Nuevo','Nuevo','No contesta','Interesado']);
  assert.equal((await sql`SELECT count(*)::int n FROM crm_activities WHERE external_source='mia_status_reconciliation'`)[0].n,3);
  assert.equal((await box.exports.reconcileMiaLeadStatuses(sql,{agentId:owner})).changed.length,0);
  await sql.unsafe("DROP FUNCTION pg_temp.block_mia_status_test() CASCADE");
 });}finally{await sql.end();}
});
