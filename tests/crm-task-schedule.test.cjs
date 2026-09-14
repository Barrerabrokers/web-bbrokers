const { test } = require('node:test');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
const fs = require('node:fs');
const code = ts.transpileModule(fs.readFileSync('lib/crm-task-schedule.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture(overrides = {}, fetchOverride) {
  const row = { id: '12345678-1234-1234-1234-123456789abc', activity_id: 'task', agent_id: 'assigned-agent',
    email: 'agent@example.test', lead_id: 'contact', contact_name: 'Contacto de prueba', title: 'Llamar al cliente',
    body: 'Confirmar visita', scheduled_at: new Date(Date.now() + 30*60000).toISOString(), reminder_minutes: 60,
    ...overrides };
  const calls = [], updates = [];
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    if (query.includes('pg_try_advisory_lock')) return [{ acquired: true }];
    if (query.includes('SELECT s.*')) return [{ ...row }];
    updates.push({ query, values });
    for (const key of ['calendar_version','assignment_version','reminder_version']) {
      if (query.includes(`SET ${key}=?`)) row[key] = values[0];
    }
    if (query.includes('SET calendar_agent_id=?,calendar_event_id=?')) {
      row.calendar_agent_id = values[0]; row.calendar_event_id = values[1];
    }
    return [];
  };
  sql.end = async () => {};
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, Map, Boolean, String, Error, JSON, encodeURIComponent, AbortSignal,
    process: { env: { DATABASE_URL: 'test', RESEND_API_KEY: 'test', CONTACT_EMAIL_FROM: 'crm@example.test' } },
    require: name => name === 'postgres' ? { default: () => sql } : name === '@/lib/db' ? {
      getCrmEmailAccountWithSecret: async agentId => ({ provider: 'google-oauth', agentId }),
    } : name === '@/lib/google-oauth' ? { getAccessTokenForGoogleAccount: async ({ account }) => account.agentId } : require(name),
    fetch: async (url, options) => {
      calls.push({ url, ...options, body: options.body && JSON.parse(options.body) });
      if (fetchOverride) return fetchOverride(url, options);
      return { ok: true, status: 200 };
    },
  });
  return { api: module.exports, row, calls, updates };
}

test('all three reminder windows respect the exact boundary and skip past tasks', () => {
  const { api } = fixture();
  const start = '2030-01-01T15:00:00.000Z';
  for (const minutes of [60,720,1440]) {
    const due = Date.parse(start) - minutes*60000;
    assert.equal(api.taskReminderDue(start, minutes, due-1), false);
    assert.equal(api.taskReminderDue(start, minutes, due), true);
    assert.equal(api.taskReminderDue(start, minutes, Date.parse(start)), false);
  }
});

test('uses the assigned agent, internal event and chosen reminder; retries do not resend', async () => {
  const { api, calls } = fixture({ reminder_minutes: 720 });
  await api.processCrmTaskSchedules('task');
  const event = calls.find(c => c.url.includes('googleapis'));
  assert.equal(event.headers.Authorization, 'Bearer assigned-agent');
  assert.equal(event.body.reminders.overrides[0].minutes, 720);
  assert.equal(event.body.attendees.length, 0);
  assert.equal(calls.filter(c => c.url.includes('resend')).length, 2);
  calls.length = 0;
  await api.processCrmTaskSchedules('task');
  assert.equal(calls.length, 0);
});

test('404 creates a deterministic event; 409 recovers a timed-out insertion', async () => {
  let googleCalls = 0;
  const { api, calls } = fixture({}, async url => {
    const status = url.includes('googleapis') ? [404,409,200][googleCalls++] : 200;
    return { status, ok: status === 200 };
  });
  await api.processCrmTaskSchedules('task');
  const google = calls.filter(c => c.url.includes('googleapis'));
  assert.deepEqual(google.map(c => c.method), ['PATCH','POST','PATCH']);
  assert.equal(google[1].body.id, 'bb12345678123412341234123456789abc');
});

test('Google outage preserves the task and still delivers agent emails', async () => {
  const { api, calls, updates } = fixture({}, async url => ({ status: url.includes('googleapis') ? 503 : 200, ok: !url.includes('googleapis') }));
  const result = await api.processCrmTaskSchedules('task');
  assert.equal(result.pending, true);
  assert.equal(calls.filter(c => c.url.includes('resend')).length, 2);
  assert.equal(updates.some(u => u.query.includes('SET calendar_version=')), false);
});

test('rescheduling resynchronizes the event and replaces reminder timing', async () => {
  const { api, calls, row } = fixture();
  await api.processCrmTaskSchedules('task');
  calls.length = 0;
  row.scheduled_at = new Date(Date.now() + 48*60*60000).toISOString();
  await api.processCrmTaskSchedules('task');
  assert.equal(calls.filter(c => c.url.includes('googleapis')).length, 1);
  assert.equal(calls.filter(c => c.url.includes('resend')).length, 1);
  assert.equal(calls.find(c => c.url.includes('googleapis')).body.start.dateTime, row.scheduled_at);
});

test('deleted tasks remove their linked Google event without notifying anyone', async () => {
  const { api, calls, updates } = fixture({ activity_id: null, calendar_agent_id: 'assigned-agent', calendar_event_id: 'event' });
  await api.processCrmTaskSchedules('task');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'DELETE');
  assert.equal(updates.some(u => u.query.includes('DELETE FROM crm_task_schedules')), true);
});
