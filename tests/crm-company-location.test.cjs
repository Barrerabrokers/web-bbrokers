const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const box={exports:{},console,Date,require:name=>name in mocks?mocks[name]:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,box);return box.exports;}
const countries=load('lib/phone-countries.ts');
const origin=load('lib/argentina-phone-origin.ts',{'@/lib/argentina-phone-areas.json':JSON.parse(fs.readFileSync('lib/argentina-phone-areas.json','utf8'))});
const location=load('lib/crm-contact-location.ts',{'@/lib/phone-countries':countries,'@/lib/argentina-phone-origin':origin});
const birthDate=load('lib/crm-contact-birth-date.ts');
const company=load('lib/crm-contact-company.ts');
test('company is independent from the contact name, trims and can be cleared',()=>{assert.equal(company.getCrmContactCompany({crm_company_name:' Hidratissima '}),'Hidratissima');assert.equal(company.getCrmContactCompany({}), '');assert.equal(company.crmCompanyPatch(' ACME ').crm_company_name,'ACME');assert.equal(company.crmCompanyPatch('').crm_company_name,'');assert.equal(Object.keys(company.crmCompanyPatch()).length,0);});
test('official area data includes Pergamino and handles local, mobile and international numbers',()=>{
 for(const phone of ['247737571','2477123456','0247715123456','+54 9 2477 123456','005492477123456'])assert.equal(origin.getArgentinaPhoneProvince('+54',phone),'Buenos Aires',phone);
 assert.equal(origin.getArgentinaPhoneLocality('+54','247737571'),'Pergamino');
 assert.equal(origin.getArgentinaPhoneProvince('+54','3511234567'),'Córdoba');
 assert.equal(origin.getArgentinaPhoneProvince('+54','2641234567'),'San Juan');
 assert.equal(origin.getArgentinaPhoneProvince('+54','2901123456'),'Tierra del Fuego');
 for(const [code,phone] of [['+54','1123456789'],['+54','9991234567'],['+598','3411234567'],['+54','+34 911 234 567'],['+54','2477'],['+54','']])assert.equal(origin.getArgentinaPhoneProvince(code,phone),null,phone);
});
test('country uses international prefixes and leaves shared prefixes for confirmation',()=>{
 assert.equal(location.getPhoneCountryName('+54','247737571'),'Argentina');
 assert.equal(location.getPhoneCountryName('+598','99123456'),'Uruguay');
 assert.equal(location.getPhoneCountryName('+54','+59899123456'),'Uruguay');
 assert.equal(location.getPhoneCountryName('+54','0034911234567'),'España');
 assert.equal(location.getPhoneCountryName('+1','2125551234'),null);
 assert.equal(location.getPhoneCountryName('+999','1234567890'),null);
});
test('manual locations win over inferred province/country and patches preserve omitted data',()=>{
 const inferred=location.getCrmContactLocation({},'+54','247737571');assert.equal(inferred.province,'Buenos Aires');assert.equal(inferred.country,'Argentina');
 const manual=location.getCrmContactLocation({crm_province:'Córdoba',crm_country:'Uruguay',crm_address:' Calle 1 ',crm_locality:'Villa María'},'+54','2477123456');assert.equal(manual.province,'Córdoba');assert.equal(manual.country,'Uruguay');assert.equal(manual.address,'Calle 1');
 assert.equal(location.getCrmContactLocation({}).country,'');
 const cleared=location.crmLocationPatch({country:'',province:''});assert.equal(cleared.crm_country,'');assert.equal(cleared.crm_province,'');assert.equal(cleared.crm_address,undefined);
});
test('PATCH persists company and country independently, validates limits, and enforces ownership',async()=>{
 let saved,allowed=true;
 const current={id:'00000000-0000-0000-0000-000000000001',firstName:'Cliente',lastName:'Prueba',email:'',countryCode:'+54',phone:'247737571',status:'Nuevo'};
 const route=load('app/api/crm/leads/route.ts',{
  '@/lib/crm-contact-birth-date':birthDate,'@/lib/mia-sales-dispatch':{},'@/lib/whatsapp-inbox':{},'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},
  'next-auth':{getServerSession:async()=>({user:{id:'agent',role:'agent'}})},'@/lib/auth':{authOptions:{}},
  '@/lib/db':{getCrmLeadById:async()=>allowed?current:null,upsertCrmLead:async data=>{saved=data;return{lead:{...current,...data},error:null}}},
  '@/lib/crm-statuses':{isCrmLeadStatus:()=>true},'@/lib/crm-workflow-runner':{},
  '@/lib/roles':{canManageAdminPanel:()=>true,canManageListings:()=>true,canViewAllCrmContacts:()=>false},'@/lib/phone-countries':countries,'@/lib/meta-conversions':{},
 });
 const payload={id:current.id,companyName:' Hidratissima ',country:' Argentina ',province:'Buenos Aires',birthDate:'1990-10-23'};
 assert.equal((await route.PATCH({json:async()=>payload})).status,200);
 assert.equal(saved.birthDate,'1990-10-23');assert.equal(saved.companyName,'Hidratissima');assert.equal(saved.location.country,'Argentina');assert.equal(saved.location.province,'Buenos Aires');assert.equal(saved.firstName,'Cliente');
 assert.equal((await route.PATCH({json:async()=>({...payload,companyName:'x'.repeat(201)})})).status,400);
 assert.equal((await route.PATCH({json:async()=>({...payload,birthDate:'2001-02-29'})})).status,400);
 assert.equal((await route.PATCH({json:async()=>({...payload,birthDate:''})})).status,200);assert.equal(saved.birthDate,'');
 allowed=false;assert.equal((await route.PATCH({json:async()=>payload})).status,403);
});
test('contact form places company below names and suggests province and country below address',()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const component=load('components/admin/crm-lead-fields-editor.tsx',{
  '@/lib/crm-contact-birth-date':birthDate,'@/lib/crm-contact-company':company,'@/lib/crm-contact-location':location,'@/lib/crm-contact-dni':load('lib/crm-contact-dni.ts'),
  '@/lib/argentina-phone-origin':origin,'@/lib/phone-countries':countries,
  '@/lib/crm-statuses':{isMeetingStatus:()=>false,leadStatusOptionsForValue:()=>[{value:'Nuevo',label:'Nuevo'}]},
  'next/navigation':{useRouter:()=>({refresh(){}})},
 }).CrmLeadFieldsEditor;
 const lead={id:'lead',firstName:'Cliente',lastName:'Prueba',email:'',countryCode:'+54',phone:'247737571',status:'Nuevo',metaProperties:{crm_company_name:'Hidratissima'}};
 const html=render(React.createElement(component,{lead,developments:[]}));
 assert.ok(html.indexOf('>Empresa<')>html.indexOf('>Apellido'));
 assert.ok(html.indexOf('>Fecha de nacimiento<')>html.indexOf('>Número de DNI<'));
 assert.ok(html.includes('type="date"'));
 assert.ok(html.includes('value="Hidratissima"'));assert.ok(html.includes('value="Pergamino"'));assert.ok(html.includes('value="Buenos Aires"'));assert.ok(html.includes('value="Argentina"'));
 assert.ok(html.indexOf('>Provincia<')>html.indexOf('>Dirección<'));
 assert.ok(html.indexOf('>País<')>html.indexOf('>Provincia<'));
});

test('specific phone localities fill empty fields while manual localities and ambiguous areas are preserved',()=>{
 assert.equal(origin.getArgentinaPhoneLocalitySuggestion('+54','2314123456'),'Bolívar');
 assert.equal(location.getCrmContactLocation({},'+54','2314123456').locality,'Bolívar');
 assert.equal(location.getCrmContactLocation({crm_locality:'La Plata'},'+54','2314123456').locality,'La Plata');
 assert.equal(origin.getArgentinaPhoneLocalitySuggestion('+54','1123456789'),null);
 assert.equal(origin.getArgentinaPhoneLocalitySuggestion('+598','2314123456'),null);
});

test('birth dates validate calendar dates and support clearing without changing omitted data',()=>{
 assert.equal(birthDate.isValidBirthDate('2000-02-29'),true);
 for(const value of ['2001-02-29','2020-04-31','23/10/1990','2999-01-01','0000-01-01']) assert.equal(birthDate.isValidBirthDate(value),false,value);
 assert.equal(birthDate.getCrmContactBirthDate({crm_birth_date:'1990-10-23'}),'1990-10-23');
 assert.equal(birthDate.crmBirthDatePatch('').crm_birth_date,'');
 assert.equal(Object.keys(birthDate.crmBirthDatePatch()).length,0);
});
