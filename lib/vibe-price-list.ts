import * as XLSX from "xlsx";
export const VIBE_SOURCE = "https://docs.google.com/spreadsheets/d/12kpRGnq790xOWcEZaJApwnzm8hKyqvWV/edit";
export const SOURCE_HIDDEN = "No disponible en lista de origen";
export type VibeUnit = { number:string; floor:string; rooms:number; area:number; semi:number; outside:number; amenities:number; commercial:number; own:number; price:number|null; down:number|null; count:number|null; payment:number|null; status:"disponible"|"reservada"|"vendida"; orientation:string; offer:string; kind:string };
const text=(v:unknown)=>String(v??"").trim();
function numeric(v:unknown,required=false):number {if(v==null||v===""){if(required)throw Error("Falta importe obligatorio");return 0;}if(typeof v!=="number"||!Number.isFinite(v)||v<0)throw Error("Valor numérico inválido");return v;}
export function parseVibeWorkbook(buffer:Buffer):VibeUnit[]{
 const w=XLSX.read(buffer,{type:"buffer"});const sheet=w.Sheets[w.SheetNames[0]];
 const rows=XLSX.utils.sheet_to_json<unknown[]>(sheet,{header:1,defval:null});
 const header=rows.findIndex(r=>r[0]==="PISO"&&r[1]==="UNIDAD");
 const required=["TIPOLOGÍA","ORIENTACIÓN","CUBIERTO","SEMI CUB","DESC","AMENITIES","TOTAL","VALOR","VALOR m²","ANTICIPO 40%","CUOTAS 10","ESTADO","OFERTA"];
 if(header<0||!required.every((h,i)=>rows[header][i+2]===h))throw Error("Formato de lista modificado: revisar columnas");
 const units:VibeUnit[]=[];let floor="";
 for(const r of rows.slice(header+1)){
  if(text(r[0])==="COCHERAS")break;
  if(!text(r[1]))continue;
  const number=text(r[1]);if(!/^(\d+|VARIANTE \d+|CABANA \d+)$/.test(number))throw Error("Identidad de unidad desconocida");
  if(r[0])floor=text(r[0]).match(/^\d+/)?.[0]||"";
  if(!floor)throw Error("Falta piso");
  const states:Record<string,VibeUnit['status']>={DISPONIBLE:"disponible",RESERVADO:"reservada",RESERVADA:"reservada",VENDIDO:"vendida",VENDIDA:"vendida"};const status=states[text(r[13])];if(!status)throw Error("Estado desconocido");
  const rooms=Number(text(r[2]).match(/^(\d) AMB$/)?.[1]||0),kind=number.startsWith("CABANA")?"cabana":"departamento";
  if(kind==='departamento'&&![1,2,3].includes(rooms))throw Error("Tipología desconocida");
  const price=status==='disponible'?numeric(r[9],true):null,down=status==='disponible'?numeric(r[11],true):null,payment=status==='disponible'?numeric(r[12],true):null;
  if(price!==null&&(!price||Math.abs(down!-price*.4)>.02||Math.abs(down!+10*payment!-price)>.02))throw Error("Financiación inconsistente");
  const area=numeric(r[4]),semi=numeric(r[5]),outside=numeric(r[6]);
  units.push({number,floor,rooms,area,semi,outside,own:Math.round((area+semi+outside)*100)/100,amenities:numeric(r[7]),commercial:numeric(r[8]),price,down,count:status==='disponible'?10:null,payment,status,orientation:text(r[3]),offer:text(r[14]),kind});
 }
 // Ancillary rows have no status column; owner confirmed all listed are available.
 const aux=rows.findIndex(r=>r[0]==='TIPO'&&r[1]==='COCHERA');if(aux<0)throw Error('Falta cuadro complementario');
 for(const r of rows.slice(aux+1)){
  if(text(r[0]).startsWith('*'))break;
  for(const kind of ['cochera','baulera']){
   const name=kind==='cochera'?text(r[1]):text(r[9]);if(!name)continue;
   if(!(kind==='cochera'?/^Cochera \d+$/:/^(PB|Piso 10) · Baulera \d+$/).test(name))continue;
   const number=kind==='cochera'?name:name.split(' · ')[1],area=kind==='baulera'?numeric(r[10],true):0;
   units.push({number,floor:kind==='cochera'||name.startsWith('PB')?'PB':'10',rooms:0,area,semi:0,outside:0,own:area,amenities:0,commercial:area,price:numeric(r[kind==='cochera'?3:11],true),down:null,count:null,payment:null,status:'disponible',orientation:'',offer:kind==='cochera'?text(r[0]):'',kind});
  }
 }
 if(units.length<2||units.length>300||new Set(units.map(u=>u.number)).size!==units.length)throw Error('Lista vacía, incompleta o duplicada');
 return units;
}
export function vibeDescription(u:VibeUnit){return [u.kind==='departamento'?`${u.rooms} ambiente${u.rooms>1?'s':''}.`:u.kind==='cabana'?'Cabana privada de uso exclusivo; no es una vivienda.':u.kind==='cochera'?`Cochera ${u.offer.toLowerCase()}.`:'Baulera.',u.kind==='departamento'?`${u.area} m² cubiertos; ${u.semi} m² semicubiertos; ${u.outside} m² descubiertos. Superficie propia: ${u.own} m². Total comercial de lista: ${u.commercial} m², incluye ${u.amenities} m² de amenities comunes, no propios.`:'',u.down!==null?`Anticipo 40%: USD ${u.down} y 10 cuotas de USD ${u.payment}.`:'Financiación a consultar: el cuadro complementario no informa anticipo ni cuotas.',u.offer.includes('cochera')?'Oferta con cochera descubierta incluida, según lista.':'',u.number.startsWith('VARIANTE')?'Unidad independiente según confirmación del propietario. Plano específico a consultar.':'Planos de planta y renders ilustrativos del brochure; identificar la unidad por su numeración.','Valores en USD según lista vinculada. Superficies y disponibilidad sujetas a confirmación comercial.'].filter(Boolean).join(' ');}
