export function reactivationEligibility(input:{businessPhoneNumberId?:string;primaryPhoneId:string;status:string;leadStatus?:string;lastInbound?:string;customerTexts:string[];lockedUntil?:string},now=Date.now()) {
 if(input.businessPhoneNumberId!==input.primaryPhoneId)return 'wrong_number';
 if(input.status==='closed'||/^(vendido|perdido|no interesado|no contactar)$/i.test(input.leadStatus||''))return 'closed';
 if(input.lockedUntil&&Date.parse(input.lockedUntil)>now)return 'agent_busy';
 if(input.customerTexts.some(t=>/\b(no me (?:escribas|contactes|mandes)|no quiero (?:recibir|mensajes)|dej[aá] de (?:escribir|contactar)|baja|stop)\b/i.test(t)))return 'opt_out';
 if(!input.lastInbound)return 'unverified_inbound';
 return Date.parse(input.lastInbound)>now-23*60*60*1000?'text':'template';
}
