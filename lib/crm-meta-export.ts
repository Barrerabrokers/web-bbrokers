import {z} from 'zod';
import {exportPhone} from './crm-export';
// Preserve the exact header sequence (including duplicate identifiers) of the supplied Meta template.
export const META_AUDIENCE_HEADERS=['email','email','email','phone','phone','phone','madid','fn','ln','zip','ct','st','country','dob','doby','gen','age','uid','value'];
type Contact={first_name?:string|null;last_name?:string|null;email?:string|null;phone?:string|null;country_code?:string|null};
function csvCell(value:string){const clean=value.replace(/[\r\n\t\u0000]/g,' ').trim();const safe=/^[=+@-]/.test(clean)?"'"+clean:clean;return /[",\r\n]/.test(safe)?'"'+safe.replace(/"/g,'""')+'"':safe;}
export function buildMetaAudience(rows:Contact[]){
 const data:string[][]=[],seen=new Set<string>();let omitted=0,duplicates=0;
 for(const r of rows){
  const candidate=(r.email||'').trim().toLowerCase();const email=z.string().email().safeParse(candidate).success?candidate:'';
  const international=exportPhone(r.phone||'',r.country_code||'');let phone=international.startsWith('+')?international.slice(1):'';
  if(!/^[1-9]\d{7,14}$/.test(phone))phone='';
  // A country prefix cannot replace a missing Argentine area code.
  if(phone.startsWith('54')&&!/^54(?:9\d{10}|\d{10})$/.test(phone))phone='';
  if(!email&&!phone){omitted++;continue;}
  const key=JSON.stringify([email,phone]);if(seen.has(key)){duplicates++;continue;}seen.add(key);
  data.push([email,'','',phone,'','','',r.first_name||'',r.last_name||'','','','','','','','','','','']);
 }
 return {csv:[META_AUDIENCE_HEADERS,...data].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n',count:data.length,omitted,duplicates};
}
