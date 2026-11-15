/** Reservation requests are drafts, never confirmed sales or bank instructions. */
export const MIA_RESERVATION_FIELDS = {
  fullName:'nombre y apellido completos', dni:'DNI', cuit:'CUIT', birthDate:'fecha de nacimiento',
  address:'domicilio completo (calle, número, localidad y provincia)', email:'correo electrónico', phone:'teléfono', signingDate:'fecha en la que te gustaría firmar el boleto',
} as const;
export type MiaReservationField=keyof typeof MIA_RESERVATION_FIELDS;
export type MiaReservation=Partial<Record<MiaReservationField,string>> & {currency?:'ARS'|'USD'};
const clean=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function validMiaReservationField(key:MiaReservationField,raw:unknown):string|undefined {
  if(typeof raw!=='string')return;
  let value=raw.trim().replace(/\s+/g,' ').slice(0,400);if(!value)return;
  if(key==='email')return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&!/@.*(?:invalid|\.local)$/.test(value)?value:undefined;
  if(key==='phone'){if(!/^[+\d\s().-]+$/.test(value))return;const digits=value.replace(/\D/g,'');return digits.length>=8&&digits.length<=15?value:undefined;}
  if(key==='dni')return /^\d{7,8}$/.test(value.replace(/[.\s]/g,''))?value.replace(/[.\s]/g,''):undefined;
  if(key==='cuit'){
    const digits=value.replace(/[-\s]/g,'');if(!/^\d{11}$/.test(digits))return;
    const sum=[5,4,3,2,7,6,5,4,3,2].reduce((n,w,i)=>n+w*Number(digits[i]),0),check=(11-sum%11)%11;
    return check<10&&check===Number(digits[10])?digits:undefined;
  }
  if(key==='birthDate'||key==='signingDate'){
    const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const natural=clean(value).match(/^(\d{1,2})\s+(?:de\s+)?([a-z]+)\s+(?:de\s+)?(\d{4})$/);
    if(natural&&months.includes(natural[2]))value=`${natural[1]}/${months.indexOf(natural[2])+1}/${natural[3]}`;
    const match=value.match(/^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4}))$/);
    if(!match)return;
    const y=Number(match[1]||match[6]),m=Number(match[2]||match[5]),d=Number(match[3]||match[4]),date=new Date(Date.UTC(y,m-1,d));
    if(y<1900||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return;
    if(key==='birthDate'&&date.getTime()>=Date.now())return;
    if(key==='signingDate'&&date.getTime()<Date.now()-86400000)return;
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  if(key==='fullName'&&/\b(?:gracias|quiero|puedo|tengo|como|cuando|por que|no|hola|datos|reserva|nombre|correo|telefono)\b/.test(clean(value)))return;
  if(key==='fullName')return /^[\p{L}'’.-]+(?:\s+[\p{L}'’.-]+)+$/u.test(value)&&!/[?¿]/.test(value)?value:undefined;
  if(key==='address')return value.length>=12&&/\d/.test(value)&&/[\p{L}]/u.test(value)?value:undefined;
}
export function miaReservationMissing(data:MiaReservation={}) {return (Object.keys(MIA_RESERVATION_FIELDS) as MiaReservationField[]).filter(key=>!validMiaReservationField(key,data[key]));}
export function miaReservationPrompt(data:MiaReservation={},initial=false) {
  const missing=miaReservationMissing(data);
  return (initial?'¡Qué bueno que quieras avanzar! 😊 Voy a reunir los datos para preparar tu solicitud de reserva. Los usamos únicamente para gestionar la solicitud.':'¡Gracias! Voy guardando los datos que me compartís. 😊')+'\n\n'+(missing.length?'Me '+(missing.length===1?'falta':'faltan')+':\n'+missing.map(key=>'• '+MIA_RESERVATION_FIELDS[key]).join('\n')+'\n\nPodés pasármelos juntos o de a poco, como te resulte más cómodo. Para las fechas, indicame día, mes y año.':'Ya tengo los datos necesarios para preparar la solicitud.')+'\n\nLa disponibilidad y la aceptación de la reserva las confirma el equipo. Si preferís hablar con un asesor en cualquier momento, decímelo.';
}
const labels:Record<MiaReservationField,string>={fullName:'nombre(?: y apellido)?(?: completos?)?|me llamo|soy',dni:'dni|documento',cuit:'cuit|cuil',birthDate:'fecha de nacimiento|nacimiento|naci el',address:'domicilio(?: completo)?|direccion(?: completa)?|vivo en',email:'correo(?: electronico)?|e-?mail',phone:'telefono|celular|cel|tel',signingDate:'fecha (?:de firma|del boleto)|firma(?:r)?(?: el)?|boleto(?: el)?'};
export function extractMiaReservation(text:string,current:MiaReservation={}):MiaReservation {
  const found:MiaReservation={};
  for(const [key,label] of Object.entries(labels)) {
    const normalized=clean(text),match=normalized.match(new RegExp(`(?:^|[\\n,;]|\\b)(?:${label})\\s*(?:es\\s+)?\\:?\\s*([^\\n;]+)`,'i'));
    if(match){const offset=match.index!+match[0].indexOf(match[1]);let raw=text.slice(offset,offset+match[1].length).split(/,\s*(?:dni|cuit|correo|email|telefono|domicilio|nacimiento|firma)\b/i)[0];if(key==='dni'||key==='cuit')raw=raw.match(/^[\d.\s-]+/)?.[0]?.trim()||raw;const value=validMiaReservationField(key as MiaReservationField,raw);if(value)found[key as MiaReservationField]=value;}
  }
  const email=text.match(/[^\s,;:]+@[^\s,;]+\.[^\s,;]+/)?.[0];if(email&&validMiaReservationField('email',email))found.email=email;
  const missing=miaReservationMissing({...current,...found});
  // A standalone answer belongs only to the first field requested, never every numeric field.
  if(!Object.keys(found).length&&missing.length&&!/[?¿]/.test(text)){
    const key=missing[0],value=validMiaReservationField(key,text.replace(/^(?:mi nombre es|me llamo|soy)\s+/i,''));if(value)found[key]=value;
  }
  return found;
}
