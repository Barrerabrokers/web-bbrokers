const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const read=file=>fs.readFileSync(file,'utf8');

test('email and WhatsApp template editors expose the agent phone variable',()=>{
  const manager=read('components/admin/crm-template-manager.tsx');
  assert.match(manager,/\{\{telefono_agente\}\}[^\n]*Teléfono del agente/);
  assert.match(manager,/replaceAll\("\{\{telefono_agente\}\}"/);
  const board=read('components/admin/crm-board.tsx');
  assert.match(board,/"\{\{telefono_agente\}\}": lead\.assignedAgentPhone/);
  const composer=read('components/admin/crm-email-composer.tsx');
  assert.match(composer,/"\{\{telefono_agente\}\}": lead\.assignedAgentPhone/);
});

test('agent phone travels with leads and is resolved in automated and extension messages',()=>{
  const db=read('lib/db.ts');
  assert.match(db,/assignedAgentPhone\?: string/);
  assert.match(db,/a\.phone AS assigned_agent_phone/);
  assert.match(read('lib/crm-workflow-runner.ts'),/telefono_agente: lead\.assignedAgentPhone/);
  assert.match(read('chrome-extension/whatsapp.js'),/replaceAll\("\{\{telefono_agente\}\}"/);
  assert.match(read('lib/crm-client-campaigns.ts'),/replaceAll\("\{\{telefono_agente\}\}"/);
});
