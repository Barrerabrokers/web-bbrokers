const assert = require('node:assert/strict');
const fs = require('node:fs');
const {test} = require('node:test');
const ts = require('typescript');
const xlsx = require('xlsx');

const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('mia/lib/development-sheet.ts','utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText;
new Function('exports','require',code)(exportsObject,require);
const {parseDevelopmentProjects,parseDevelopmentUnits,normalizedRooms} = exportsObject;

test('all index tabs are read and Ugarte addresses are kept separate', () => {
  const workbook=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook,xlsx.utils.aoa_to_sheet([
    ['Edificio','Dirección','Barrio','','Lista','Brochure','Entrega'],
    ['Belgrano','Manuel Ugarte 1576','Belgrano','','','','24 meses'],
    ['Libertador','Manuel Ugarte 1524','Belgrano','','','','30 meses'],
  ]),'Español');
  xlsx.utils.book_append_sheet(workbook,xlsx.utils.aoa_to_sheet([
    ['Building','Address','Neighborhood','','List','Brochure','Delivery'],
    ['Belgrano','Manuel Ugarte 1576','Belgrano','','','','30 months'],
    ['Third','Otra 100','Núñez','','','','20 months'],
  ]),'English');
  const projects=parseDevelopmentProjects(workbook);
  assert.equal(projects.length,3);
  assert.equal(projects.find(p=>p.address.endsWith('1576')).delivery,null);
  assert.equal(projects.find(p=>p.address.endsWith('1524')).delivery,'30 meses');
  assert.equal(projects.find(p=>p.name==='Third').delivery,'20 meses');
});

test('unit lists preserve original typology and missing facts', () => {
  const workbook=xlsx.utils.book_new();
  for (const [tab,rows] of [
    ['Uno',[['Unidad','Tipología','Estado','Precio (USD)'],['1','Studio','Disponible',110000]]],
    ['Dos',[['Unidad','Ambientes','Precio'],['2',2,150000]]],
  ]) xlsx.utils.book_append_sheet(workbook,xlsx.utils.aoa_to_sheet(rows),tab);
  const project={name:'P',address:'A 1',location:'Núñez'};
  const units=parseDevelopmentUnits(workbook,project);
  assert.deepEqual(units.map(u=>[u.roomCount,u.price,u.availability]),[[1,'USD 110.000','Disponible'],[2,'USD 150.000',null]]);
  assert.equal(normalizedRooms('Monoambiente'),1);
  assert.equal(normalizedRooms('1 dormitorio'),1);
});

test('zero delivery and generic Drive URLs are handled without inventing a brochure', () => {
  const {deliveryMonths}=exportsObject;
  assert.equal(deliveryMonths('0 meses'),0);
  assert.equal(deliveryMonths('0'),0);
  assert.equal(deliveryMonths('24 months'),24);
  assert.equal(deliveryMonths(null),null);
  const workbook=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook,xlsx.utils.aoa_to_sheet([
    ['Edificio','Dirección','Barrio','','Lista','Brochure','Entrega'],
    ['Alpha Núñez','Vuelta de Obligado 3928','Núñez','','','https://drive.google.com/drive/u/2/home','0 meses'],
    ['Otro','Prueba 100','Núñez','','','https://drive.google.com/drive/folders/example','12 meses'],
    ['Otro más','Prueba 200','Núñez','','','https://drive.google.com/file/d/example/view','15 meses'],
  ]),'Español');
  const projects=parseDevelopmentProjects(workbook);
  assert.deepEqual(projects.map(p=>p.brochure_url),[null,null,'https://drive.google.com/file/d/example/view']);
});

test('financing is read from the same unit row and omitted if missing', () => {
  const w=xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(w,xlsx.utils.aoa_to_sheet([
    ['Piso','Unidad','Tipología','Estado','M² Totales','Precio','Anticipo','Cuota (x24)','Frecuencia'],
    [1,'A','Studio','Disponible',55.5,130900,40000,3000,'mensual'],
    [2,'B','2 amb','Disponible',75,274400,'','',''],
  ]),'Lista');
  const [first,second]=parseDevelopmentUnits(w,{});
  assert.equal(first.unit,'1-A');
  assert.equal(first.totalArea,'55,5');
  assert.equal(first.price,'USD 130.900');
  assert.equal(first.downPayment,'USD 40.000');
  assert.deepEqual(first.installments,{count:24,amount:'USD 3.000',frequency:'mensuales'});
  assert.equal(second.downPayment,null);
  assert.equal(second.installments,null);
});
