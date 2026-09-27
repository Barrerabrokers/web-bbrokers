const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const ts = require("typescript");

function load(file) {
  const module = { exports: {} };
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    { module, exports: module.exports, require, console }
  );
  return module.exports;
}

test("Excel import creates only missing unassigned contacts and preserves every column", () => {
  const source = fs.readFileSync("app/api/crm/import-excel/route.ts", "utf8");
  assert.match(source, /existingEmails\.has\(email\)/);
  assert.match(source, /String\(lead\.email \|\| ""\)\.trim\(\)/);
  assert.match(source, /existingPhones\.has\(normalizedPhone\)/);
  assert.match(source, /const result = await upsertCrmLead\(/);
  assert.doesNotMatch(source, /upsertCrmLeadByEmail/);
  assert.match(source, /assignedAgentId: undefined/);
  assert.match(source, /excel_imports: JSON\.stringify/);
  assert.match(source, /Object\.entries\(row\)/);
  const ui = fs.readFileSync("components/admin/crm-board.tsx", "utf8");
  assert.match(ui, /existentes sin cambios/);
});

test("stored Excel columns are exposed as imported customer information", () => {
  const { getCrmImportedInquiries } = load("lib/crm-imported-inquiries.ts");
  const imports = getCrmImportedInquiries({
    excel_imports: JSON.stringify([
      {
        file: "contactos.xlsx",
        sheet: "Meta",
        row: 7,
        importedAt: "2026-09-17T12:00:00.000Z",
        fields: [
          { key: "email", label: "Email", value: "cliente@example.com" },
          { key: "presupuesto", label: "Cuál era tu presupuesto", value: "USD 50.000" },
        ],
      },
    ]),
  });
  assert.equal(imports.length, 1);
  assert.equal(imports[0].file, "contactos.xlsx");
  assert.equal(imports[0].section, "Meta");
  assert.deepEqual(JSON.parse(JSON.stringify(imports[0].fields)), [
    { label: "Email", value: "cliente@example.com" },
    { label: "Cuál era tu presupuesto", value: "USD 50.000" },
  ]);
});
