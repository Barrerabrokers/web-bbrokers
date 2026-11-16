const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}, globals = {}) {
  const module = {exports:{}};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions:{module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022, esModuleInterop:true},
  }).outputText;
  vm.runInNewContext(source, {
    module, exports:module.exports, Date, AbortSignal, console, ...globals,
    require(id) {
      if (id in mocks) return mocks[id];
      if (id.startsWith('@/')) return load(id.slice(2)+'.ts', mocks, globals);
      if (id.startsWith('.')) return load(path.join(path.dirname(file),id)+'.ts', mocks, globals);
      return require(id);
    },
  }, {filename:file});
  return module.exports;
}

const organizerId = '72114681-27f9-4bb0-980a-1a880a8b6d80';
const pabloId = 'fff14681-27f9-4bb0-980a-1a880a8b6d80';
const original = {start:'2026-11-16T14:00:00.000Z', end:'2026-11-16T15:00:00.000Z'};
const requested = {start:'2026-11-18T15:30:00.000Z', end:'2026-11-18T16:30:00.000Z'};
const link = 'https://meet.google.com/abc-defg-hij';
const config = {enabled:true, organizerId, location:'Oficina de prueba', weekdays:[1,2,3,4,5,6],
  startTime:'10:00', endTime:'20:00', duration:60, leadMinutes:60};
const profile = {lead_id:'lead', phone:'5491100000000', email:'piloto@example.com', first_name:'Ana'};

function harness({busyAfterSelection = false, loseResponse = false, pilot = true} = {}) {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ['2026-11-16T13:00:00Z'])); }
    static now() { return Date.parse('2026-11-16T13:00:00Z'); }
  }
  let version = 0;
  let state = {id:'session', phase:'booked', mode:'google_meet', selected:original,
    eventId:'existing-event', organizerId, organizerName:'Lucas Barrera', offers:[]};
  let event = {id:state.eventId, start:{dateTime:original.start}, end:{dateTime:original.end},
    etag:'"original"', hangoutLink:link, extendedProperties:{private:{miaBooking:state.id}}};
  let record = {estado:'confirmada', day:'2026-11-16', time:'11:00', agente:'Lucas Barrera'};
  const calls = [];
  const sql = async (strings, ...args) => {
    const query = strings.join('?');
    if (query.includes('mia-meeting-scheduling-v1')) return [{value:JSON.stringify(config)}];
    if (query.includes('SELECT c.lead_id')) return [profile];
    if (query.includes('SELECT version,state')) return [{state,version}];
    if (query.includes('SELECT id,name,email')) return [{id:pabloId},{id:organizerId}];
    if (query.includes('SELECT id FROM agents')) return [{id:args[0]}];
    if (query.includes('as ready')) return [{ready:true}];
    if (query.includes('UPDATE crm_mia_meeting_sessions SET state=')) {
      assert.equal(args[2], version);
      state = args[0];
      return [{version:++version}];
    }
    return [];
  };
  sql.json = value => value;
  const mocks = {
    '@/lib/database-pool':{getSharedDatabase:()=>sql,releaseSharedDatabase:async()=>{}},
    '@/lib/mia-learnings':{readMiaLearnings:async()=>{}},
    '@/lib/mia-deferred-contact':{miaContactDeferred:()=>false},
    '@/lib/mia-meeting-change':{meetingChangeIntent:text=>/cambiar/.test(text),recordMiaMeetingChange:async()=>calls.push('handoff')},
    '@/lib/db':{getCrmEmailAccountWithSecret:async id=>({id})},
    '@/lib/google-calendar-connection':{hasGoogleCalendarAccess:()=>true},
    '@/lib/google-oauth':{getAccessTokenForGoogleAccount:async ({account})=>account.id},
    '@/lib/crm-calendar-availability':{getCrmCalendarBusy:async token=>{
      calls.push(token === pabloId ? 'availability:Pablo' : 'availability:Lucas');
      return token === pabloId && busyAfterSelection && state.changeRequest?.selected ? [requested] : [];
    }},
    '@/lib/meeting-scheduler':{getBookedRanges:async()=>[]},
    '@/lib/mia-meeting-reconciliation':{},
    '@/lib/whatsapp-turn-lock':{claimWhatsAppAiSend:async()=> 'claimed', releaseWhatsAppSend:async()=>{}},
    '@/lib/database-worker-lease':{acquireWorkerLease:async()=> 'lease',releaseWorkerLease:async()=>{}},
    '@/lib/whatsapp-ai-provider':{generateGroqCustomerReply:async()=>JSON.stringify({
      intent:'availability',weekdays:[3],period:'any',time:'12:00',
    })},
    '@/mia/lib/meeting-record':{
      readMiaMeetingStatus:async()=>{calls.push('status');return record;},
      commitMiaReschedule:async (_, __, expectedVersion, next)=>{
        assert.equal(expectedVersion,version);
        assert.equal(next.selected.start,requested.start);
        assert.equal(next.selected.end,requested.end);
        calls.push('commit');
        state = next;
        version++;
        record = {...record, estado:'reprogramada', day:'2026-11-18', time:'12:30'};
      },
    },
  };
  const fetch = async (url, options) => {
    assert.match(url,/existing-event/);
    if (options.method === 'PATCH') {
      calls.push('patch');
      assert.equal(options.headers.Authorization, 'Bearer '+organizerId);
      assert.equal(options.headers['If-Match'], '"original"');
      const {start,end} = JSON.parse(options.body);
      assert.equal(start.timeZone, 'America/Argentina/Buenos_Aires');
      event = {...event,start,end};
      if (loseResponse) throw Error('Connection lost after write');
    }
    return {ok:true,status:200,json:async()=>event};
  };
  const env = {MIA_NEW_ENGINE_ENABLED:'true', MIA_TEST_NUMBERS:profile.phone,
    MIA_TEST_EMAILS:pilot ? profile.email : 'other@example.com'};
  const runtime = load('mia/lib/meetings.ts', mocks, {Date:FixedDate, fetch, process:{env}, console:{warn(){}}});
  const history = [];
  return {calls, async reply(content) {
    history.push({content, direction:'inbound', whatsappMessageId:String(history.length)});
    const reply = (await runtime.replyMiaMeeting('conversation',history)).reply;
    history.push({content:reply,direction:'outbound'});
    return reply;
  }};
}

async function chooseSlot(h) {
  const offers = await h.reply('Me surgió un imprevisto, podemos cambiar la reunión para el miércoles al mediodía');
  assert.match(offers,/miércoles 18 de noviembre, 12:00/);
  assert.match(offers,/miércoles 18 de noviembre, 12:30/);
  assert.match(await h.reply('12:30hs está bien'),/¿Confirmás cambiar la reunión al miércoles 18 de noviembre, 12:30/);
  assert(!h.calls.includes('patch'));
}

test('pilot confirmation moves the existing Meet after both calendars are checked and answers from mia_meetings', async () => {
  const h = harness();
  await chooseSlot(h);
  assert.match(await h.reply('Si'),/reprogramada para miércoles 18 de noviembre, 12:30, hora Argentina, con Lucas Barrera/);
  assert.deepEqual(h.calls.slice(-4),['availability:Pablo','availability:Lucas','patch','commit']);
  assert.match(await h.reply('Ya está confirmada la reunión?'),/^Sí, quedó confirmada para miércoles 18 de noviembre, 12:30/);
  assert.equal(h.calls.at(-1),'status');
  assert(!h.calls.includes('handoff'));
});

test('a conflict in either calendar offers the next free slot and retains the original confirmation', async () => {
  const h = harness({busyAfterSelection:true});
  await chooseSlot(h);
  assert.match(await h.reply('Si'),/horario ya no está libre.*13:30/);
  assert.match(await h.reply('¿Ya está confirmada la reunión?'),/Sigue confirmada para lunes 16 de noviembre, 11:00.*horario elegido ya no está disponible/);
  assert(!h.calls.includes('patch'));
});

test('a lost Calendar response is recovered without moving the event twice', async () => {
  const h = harness({loseResponse:true});
  await chooseSlot(h);
  assert.match(await h.reply('Si'),/Todavía no pude verificar/);
  assert.match(await h.reply('Si'),/reprogramada para miércoles/);
  assert.equal(h.calls.filter(call=>call==='patch').length,1);
  assert.equal(h.calls.filter(call=>call==='commit').length,1);
});

test('the global switch does not grant the pilot reschedule to a contact outside the allowlist', async () => {
  const h = harness({pilot:false});
  await h.reply('Podemos cambiar la reunión para el miércoles al mediodía');
  assert(h.calls.includes('handoff'));
  assert(!h.calls.includes('patch'));
});

test('WhatsApp routes the requested turns and the reminder template uses a human date', () => {
  const routing = load('mia/lib/meeting-routing.ts');
  assert(routing.routesToMiaMeeting('12:30hs está bien', 'Para cambiar la reunión, ¿te sirve el miércoles?'));
  assert(routing.routesToMiaMeeting('Si', '¿Confirmás cambiar la reunión al miércoles?'));
  assert(routing.asksMeetingStatus('Ya está confirmada la reunión?'));
  const template = load('mia/lib/meeting-reminder-templates.ts').meetingReminderTemplates['1h'].cliente.whatsapp;
  const {meetingDayLabel} = load('mia/lib/meeting-date.ts');
  const values = {nombre_cliente:'Ana', agente:'Lucas Barrera', dia:meetingDayLabel(new Date(original.start)),
    hora:'11:00', modalidad:'Google Meet', link_meet_o_direccion:link};
  assert.equal(template.replace(/\{\{(\w+)\}\}/g, (_,key)=>values[key]),
    'Hola Ana, en 1 hora tenés tu reunión con Lucas Barrera el lunes 16 de noviembre a las 11:00, hora Argentina, por Google Meet. Link: '+link+'. ¿Llegás bien?');
});

test('the reschedule transaction replaces reminder jobs before updating the lead and session', async () => {
  const statements = [];
  const tx = async (parts, ...params) => {
    const query = parts.join('?').replace(/\s+/g,' ').trim();
    statements.push({query,params});
    if (query.includes('returning id, client_id')) return [{id:'meeting',client_id:'client'}];
    if (query.includes('returning id')) return [{id:'activity'}];
    if (query.includes('returning activity_id')) return [{activity_id:'activity'}];
    if (query.includes('returning version')) return [{version:2}];
    return [];
  };
  tx.json = value => value;
  const {commitMiaReschedule} = load('mia/lib/meeting-record.ts', {'@/lib/database-pool':{}});
  await commitMiaReschedule({begin:task=>task(tx)}, 'chat', 1,
    {eventId:'existing-event', selected:requested, meetUrl:link}, 'lead');
  assert.match(statements[0].query,/estado = 'reprogramada'/);
  assert.equal(statements[0].params[0], requested.start);
  assert.match(statements[1].query,/mia_reminders set estado = 'cancelado'/);
  assert.match(statements[2].query,/'1_dia_antes'.*interval '1 day'.*'1_hora_antes'.*interval '1 hour'/);
  assert.equal(statements[2].params.filter(param=>param === requested.start).length, 2);
  assert.match(statements[5].query,/crm_leads set status = 'Reunion'/);
  assert.match(statements.at(-1).query,/crm_mia_meeting_sessions.*version = \?/);
});
