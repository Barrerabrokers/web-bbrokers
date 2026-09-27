const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

test("CRM identifies contacts by trimmed case-insensitive email", () => {
  const source = fs.readFileSync("lib/db.ts", "utf8");
  assert.match(source, /lower\(btrim\(email\)\) = \$\{email\}/);
  assert.match(source, /idx_crm_leads_email_normalized_unique/);
  assert.match(source, /lower\(btrim\(email\)\)/);
});

test("a repeated Meta campaign inquiry updates the contact and notifies its owner", () => {
  const source = fs.readFileSync("lib/meta-leads.ts", "utf8");
  assert.match(source, /if \(!result\.created\)/);
  assert.match(source, /notifyCrmCampaignRecontact/);
  assert.match(source, /campaignLeadId: lead\.id/);

  const db = fs.readFileSync("lib/db.ts", "utf8");
  assert.match(db, /campaign-recontact:\$\{options\.campaignLeadId\}/);
  assert.match(db, /lead\.assigned_agent_id/);
  assert.match(db, /volvió a contactarse/);
});
