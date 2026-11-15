import { createHmac, timingSafeEqual } from 'crypto';
function secret(){const key=process.env.NEXTAUTH_SECRET||process.env.AUTH_SECRET;if(!key)throw Error('Falta el secreto de autenticación.');return key;}
export function signMiaMailTarget(actor:string,target:string,email:string,state:string,now=Date.now()){
 const body=Buffer.from(JSON.stringify({actor,target,email,state,expires:now+10*60000})).toString('base64url');
 return body+'.'+createHmac('sha256',secret()).update(body).digest('hex');
}
export function readMiaMailTarget(value:string,actor:{id:string;role:string},state:string,now=Date.now()){
 const [body,signature]=value.split('.'),expected=createHmac('sha256',secret()).update(body||'').digest('hex');
 if(!signature||signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))throw Error('Conexión no válida.');
 const data=JSON.parse(Buffer.from(body,'base64url').toString());
 if(actor.role!=='admin'||data.actor!==actor.id||data.state!==state||data.expires<now)throw Error('Conexión no autorizada o vencida.');
 return data as {actor:string;target:string;email:string};
}
