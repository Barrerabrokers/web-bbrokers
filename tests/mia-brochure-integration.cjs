// Run from the repo root with POSTGRES_PRISMA_URL in the environment.
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const db = require('postgres')(process.env.POSTGRES_PRISMA_URL, {
  ssl: 'require', prepare: false, max: 1, connect_timeout: 8, onnotice() {},
});
const rollback = new Error('Rollback test');

function load(file, mocks) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  new Function('exports', 'require', source)(exports, name => mocks[name] ??
    (name.startsWith('.') ? load(path.join(path.dirname(file), name + '.ts'), mocks) : require(name)));
  return exports;
}

async function run() {
  await db.begin(async tx => {
    await tx.unsafe(fs.readFileSync('migrations/20261115_mia_brochure_state.sql', 'utf8'));
    tx.begin = callback => callback(tx);
    const mocks = {
      '@/lib/database-pool': {getSharedDatabase: () => tx, releaseSharedDatabase: async () => {}},
      '@/lib/whatsapp-ai-provider': {
        generateGroqCustomerReply: async () => {
          throw new Error('Brochure action must not call the language model');
        },
      },
    };
    const {generateMiaWhatsAppReply, markMiaBrochureSent} = load('mia/lib/whatsapp-flow.ts', mocks);
    const {questionIntent} = load('mia/lib/brochure.ts', mocks);
    assert.equal(questionIntent('¿Te parece bien si te envío el brochure?'),
      questionIntent('¿Querés recibir el folleto por acá?'));

    for (const url of ['https://example.invalid/folleto.pdf?version=2', null]) {
      const project = 'Proyecto de prueba ' + randomUUID();
      await tx`insert into developments(name,slug,description,location,address,visibility,brochure_url)
        values(${project},${'test-' + randomUUID()},'Sintético','Núñez','Sintética','public',${url})`;
      const contact = {phone: '54911' + String(BigInt('0x' + randomUUID().replace(/-/g, '')) % 10000000000n), contactName:'Sintético'};
      const history = [{direction:'inbound', content:'Estoy viendo ' + project, status:'received'}];
      const inbound = text => ({direction:'inbound', content:text, status:'received', whatsappMessageId:'wamid.test.' + randomUUID()});
      const request = inbound('Tenés brochure?');
      history.push(request);
      const response = await generateMiaWhatsAppReply(contact, history);
      assert.ok(response);
      if (url) {
        assert.ok(response.includes(url));
        await markMiaBrochureSent(request.whatsappMessageId, response);
      } else {
        assert.match(response, /agente comercial te lo manda/);
      }
      history.push({direction:'outbound', content:response, status:'sent'});
      assert.equal(await generateMiaWhatsAppReply(contact, history.slice(0,-1)), null);
      for (let i = 0; i < 3; i++) {
        history.push(inbound('Si'));
        assert.equal(await generateMiaWhatsAppReply(contact, history), null);
      }
      const [check] = await tx`select c.brochure_enviado, v.brochure_enviado as conversation_sent,
        (select count(*)::int from mia_messages m where m.conversation_id=v.id and m.direccion='outbound') as replies,
        (select count(*)::int from mia_observations o where o.client_id=c.id and o.estado='pendiente') as observations
        from mia_clients c join mia_conversations v on v.client_id=c.id where c.whatsapp=${contact.phone}`;
      assert.equal(check.replies, 1);
      assert.equal(check.brochure_enviado, !!url);
      assert.equal(check.conversation_sent, !!url);
      assert.equal(check.observations, url ? 0 : 1);
      console.log(url ? 'PASS URL verificada: un enlace, un envío y ningún loop.' : 'PASS sin URL: una derivación y una observación.');
    }
    throw rollback;
  });
}

run().catch(error => {
  if (error === rollback) console.log('Prueba revertida.');
  else {console.error(error.code ?? error.name, error.message); process.exitCode = 1;}
}).finally(() => db.end({timeout:1}));
