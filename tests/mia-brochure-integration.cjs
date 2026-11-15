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
    await tx.unsafe(fs.readFileSync('migrations/20261115_mia_options_state.sql', 'utf8'));
    await tx.unsafe(fs.readFileSync('migrations/20261115_mia_catalog_cache.sql', 'utf8'));
    await tx.unsafe(fs.readFileSync('migrations/20261115_mia_catalog_delivery_months.sql', 'utf8'));
    await tx.unsafe(fs.readFileSync('migrations/20261115_mia_option_selection.sql', 'utf8'));
    tx.begin = callback => callback(tx);
    let sourceProjects = [];
    let sourceOptions = [];
    const mocks = {
      './development-sheet': {deliveryMonths: value => value === '0 meses' ? 0 : null, getDevelopmentProjects: async () => sourceProjects, getVerifiedSheetOptions: async (_projects, _zone, _rooms, saveList) => {
        if (sourceOptions.length) await saveList(sourceOptions[0].project.id, sourceOptions);
        return sourceOptions;
      }},
      '@/lib/database-pool': {getSharedDatabase: () => tx, releaseSharedDatabase: async () => {}},
      '@/lib/whatsapp-ai-provider': {
        generateGroqCustomerReply: async () => {
          throw new Error('Brochure action must not call the language model');
        },
      },
    };
    const {generateMiaWhatsAppReply, markMiaBrochureSent, markMiaOptionsSent} = load('mia/lib/whatsapp-flow.ts', mocks);
    const {questionIntent} = load('mia/lib/brochure.ts', mocks);
    assert.equal(questionIntent('¿Te parece bien si te envío el brochure?'),
      questionIntent('¿Querés recibir el folleto por acá?'));

    for (const url of ['https://example.invalid/folleto.pdf?version=2', null]) {
      const project = 'Proyecto de prueba ' + randomUUID();
      sourceProjects = [{id:randomUUID(),name:project,address:'Prueba 100',location:'Núñez',
        brochure_url:url,delivery:'12 meses',listUrl:'https://example.invalid/lista'}];
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
    const {unverifiedCatalogClaim} = load('mia/lib/catalog-options.ts', mocks);
    assert.equal(unverifiedCatalogClaim('Te preparo dos opciones con disponibilidad inmediata.'), true);
    assert.equal(unverifiedCatalogClaim('¿Qué es lo más importante para vos?'), false);
    const project = {id:randomUUID(),name:'Prueba Parque de la Innovación',address:'Prueba 150',
      location:'Núñez',delivery:'0 meses',listUrl:'https://example.invalid/lista',brochure_url:null};
    sourceProjects = [project];
    sourceOptions = [
      {project,unit:'1-A',totalArea:'40',downPayment:'USD 36.000',installments:{count:24,amount:'USD 3.500',frequency:'mensuales'},originalType:'Studio',roomCount:1,price:'USD 120.000',currency:'USD',availability:'Disponible'},
      {project,unit:'2-B',totalArea:'58',downPayment:null,installments:null,originalType:'2 ambientes',roomCount:2,price:'USD 145.000',currency:'USD',availability:'Disponible'},
    ];
    const optionsContact = {phone:'549118' + String(Date.now()).slice(-7),contactName:'Sintético'};
    const inbound = content => ({direction:'inbound', content, status:'received', whatsappMessageId:'wamid.test.' + randomUUID()});
    const request = inbound('Pásame dos opciones 1 ambiente y dos ambientes');
    const history = [inbound('La ubicación por el parque de la innovación'), inbound('Si'), request];
    const options = await generateMiaWhatsAppReply(optionsContact, history);
    assert.match(options, /Opción 1: .*1 ambiente.*USD.*Disponible/);
    assert.match(options, /Opción 2: .*2 ambientes.*USD.*Disponible/);
    assert.doesNotMatch(options, /Reservado-test|Sin-precio-test|disponibilidad inmediata|te preparo/i);
    const cached = await tx`select moneda, entrega_meses from mia_catalog_cache where proyecto=${project.id}`;
    assert.deepEqual(cached.map(row => row.moneda), ['USD','USD']);
    assert.deepEqual(cached.map(row => row.entrega_meses), [0,0]);
    assert.equal((options.match(/Entrega inmediata/g) ?? []).length, 2);
    assert.equal((options.match(/brochure de este proyecto está pendiente/g) ?? []).length, 1);
    assert.doesNotMatch(options, /0 meses/);
    assert.doesNotMatch(options, /example\.invalid\/lista|Lista de precios/i);
    assert.match(options, /Unidad 1-A.*40 m² totales.*Anticipo USD 36.000.*24 cuotas mensuales de USD 3.500/);
    assert.equal(options.split('\n').length, 3);
    assert.equal((options.match(/\?/g) ?? []).length, 1);
    await markMiaOptionsSent(request.whatsappMessageId, options);
    history.push({direction:'outbound', content:options, status:'sent'}, inbound('Quiero ver las opciones'));
    assert.equal(await generateMiaWhatsAppReply(optionsContact, history), null);
    const [sent] = await tx`select c.opciones_enviadas, v.opciones_enviadas as conversation_sent,
      (select count(*)::int from mia_messages m where m.conversation_id=v.id and m.direccion='outbound') as replies
      from mia_clients c join mia_conversations v on v.client_id=c.id where c.whatsapp=${optionsContact.phone}`;
    assert.deepEqual({...sent}, {opciones_enviadas:true, conversation_sent:true, replies:1});
    const [pending] = await tx`select count(*)::int as n from mia_observations o join mia_clients c on c.id=o.client_id
      where c.whatsapp=${optionsContact.phone} and o.que_paso='Brochure pendiente' and o.propuesta like '%Prueba 150'`;
    assert.equal(pending.n, 1);
    history.push(inbound('Opción 1'));
    const selection = await generateMiaWhatsAppReply(optionsContact, history);
    assert.match(selection, /unidad 1-A/);
    history.push({direction:'outbound',content:selection,status:'sent'},inbound('Se puede financiar?'));
    const financing = await generateMiaWhatsAppReply(optionsContact, history);
    assert.match(financing, /Opción 1, unidad 1-A.*USD 36.000.*24 cuotas mensuales de USD 3.500/);
    history.push({direction:'outbound',content:financing,status:'sent'},inbound('Se puede financiar la Opción 2?'));
    assert.match(await generateMiaWhatsAppReply(optionsContact, history), /financiación de esa unidad está a confirmar/i);
    console.log('PASS financiación: usa la opción elegida, deriva solo la que carece de datos.');
    console.log('PASS opciones: dos unidades con precio y disponibilidad, un mensaje, ningún loop.');
    throw rollback;
  });
}

run().catch(error => {
  if (error === rollback) console.log('Prueba revertida.');
  else {console.error(error.code ?? error.name, error.message); process.exitCode = 1;}
}).finally(() => db.end({timeout:1}));
