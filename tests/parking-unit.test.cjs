const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,deps={}) {const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!(n in deps))throw Error(n);return deps[n]}});return exports;}
const kind=load('lib/unit-kind.ts');
const {buildDevelopmentDetailModel}=load('lib/development-detail-view-model.ts',{'@/lib/unit-kind':kind,'@/types':{DEVELOPMENT_STATUS_LABELS:{en_construccion:'En construcción'}}});
test('parking is explicit and does not reinterpret existing studios',()=>{
 assert.equal(kind.isParkingUnit({unitNumber:'Cochera 9'}),true);
 assert.equal(kind.isParkingUnit({unitNumber:' COCHERA 9 '}),true);
 assert.equal(kind.isParkingUnit({unitNumber:'102',bedrooms:0}),false);
});
test('mixed inventory exposes parking separately and excludes unknown surface from ranges',()=>{
 const model=buildDevelopmentDetailModel({sessionCanSeePrices:true,development:{name:'Feel Palermo',slug:'feel-palermo',address:'Santa Fe 5022',status:'en_construccion',images:[],features:[],amenities:[],priceFrom:106500,minPriceAvailable:106500,units:[{unitNumber:'102',bedrooms:1,area:31.38,totalArea:37.93,status:'disponible',price:106500},{unitNumber:'Cochera 9',bedrooms:0,bathrooms:0,area:0,status:'disponible',price:31600}]}});
 assert.equal(model.typologies.join(','),'1 ambiente,Cocheras');
 assert.equal(model.minArea,37.93);assert.equal(model.maxArea,37.93);
 assert.equal(model.priceFrom,106500);assert.equal(model.availableUnits.length,2);
});

test('accessories never become residential typologies',()=>{
 assert.equal(kind.accessoryUnitLabel({unitNumber:'Baulera 01'}),'Baulera');
 assert.equal(kind.accessoryUnitLabel({unitNumber:'CABANA 03'}),'Cabana privada');
 assert.equal(kind.isAccessoryUnit({unitNumber:'VARIANTE 603'}),false);
});
