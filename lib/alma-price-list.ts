import * as XLSX from 'xlsx';
import type {VibeUnit} from './vibe-price-list';
export const ALMA_SOURCE='https://docs.google.com/spreadsheets/d/1yY_unsLS2LtWcqlQwNubMvCMttQWOKeiaDRa6dIZdfs/edit?gid=80735267';
const text=(x:unknown)=>String(x??'').trim();
function num(x:unknown){if(typeof x==='number')return x;const s=text(x).replace(/USD|\s/g,'').replace(/\./g,'').replace(',','.');const n=Number(s);if(!Number.isFinite(n)||n<0)throw Error('Importe inválido');return n;}
export function parseAlmaWorkbook(buffer:Buffer):VibeUnit[]{
 const w=XLSX.read(buffer,{type:'buffer'}),s=w.Sheets['Alma Centenario'];if(!s)throw Error('Hoja Alma no encontrada');
 const rows=XLSX.utils.sheet_to_json<unknown[]>(s,{header:1,defval:null});
 if(!rows.some(r=>text(r[2]).toUpperCase()==='AMBIENTES')||!rows.some(r=>text(r[10])==='40%'&&num(r[11])===36))throw Error('Financiación o columnas modificadas');
 const out:VibeUnit[]=[];
 for(const r of rows){const m=text(r[1]).match(/^UF\s*(\d{3,4})$/i);if(!m)continue;
 const number=m[1],rooms=num(r[2]),states:Record<string,VibeUnit['status']>={LIBRE:'disponible',VENDIDO:'vendida',RESERVADO:'reservada'};
 const status=states[text(r[12]).toUpperCase()];if(!status||![1,2,3].includes(rooms))throw Error('Estado o tipología desconocida');
 const price=status==='disponible'?num(r[8]):null,down=status==='disponible'?num(r[10]):null,payment=status==='disponible'?num(r[11]):null;
 if(price!==null&&(!price||Math.abs(down!-price*.4)>.02||Math.abs(down!+36*payment!-price)>18.01))throw Error('Financiación inconsistente');
 out.push({number,floor:String(Math.floor(Number(number)/100)),rooms,area:num(r[4]),semi:num(r[5]),outside:num(r[6]),own:num(r[7]),commercial:num(r[7]),amenities:0,price,down,count:36,payment,status,orientation:text(r[3]),offer:'',kind:'departamento'});
 }
 if(out.length<10||new Set(out.map(x=>x.number)).size!==out.length)throw Error('Lista incompleta o duplicada');return out;
}
export function almaDescription(u:VibeUnit){return `${u.rooms} ambientes. ${u.area} m² cubiertos; ${u.semi} m² semicubiertos; ${u.outside} m² descubiertos. Total según lista: ${u.own} m². Anticipo 40%: USD ${u.down} + 36 cuotas de USD ${u.payment} de referencia, pesificadas al tipo de cambio de la fecha del boleto y ajustadas por CAC según lista. Importes redondeados de origen. Imagen interior ilustrativa generada: distribución, mobiliario y vistas orientativos; no representa la unidad exacta. Plano original de planta del brochure: identificar la unidad por su número. Superficies y financiación según lista, sujetas a confirmación comercial.`;}
