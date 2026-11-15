const normalize=(text:string)=>text.split(/\n\s*\[Origen del anuncio\]/)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export const MIA_THINKING_REPLY='Perfecto, me parece muy bien que quieras pensarlo; eso significa que estás interesado. Para ayudarte a tomar una decisión, ¿qué parte te gustaría pensar: la financiación o la unidad que querés elegir?';
/** Only a standalone hesitation: never replace a specific question, opt-out or callback request. */
export function miaThinkingReply(text:string,previousReplies:string[]=[]):string|null {
 const clean=normalize(text);
 if(!/^(?:(?:ok|okay|bueno|dale|perfecto|gracias|si) )*(?:lo voy a pensar|voy a pensarlo|lo pienso|lo veo|lo voy a ver|lo voy a evaluar|lo evaluo|dejame pensarlo|dejame que lo piense|tengo que pensarlo|necesito pensarlo|(?:quiero|quisiera|me gustaria|prefiero) pensar(?:lo)?|lo (?:quiero|quisiera|prefiero) pensar)(?: (?:gracias|un poco|bien|mejor|con calma|con tranquilidad|y te aviso|y te digo|despues te aviso))*$/.test(clean))return null;
 if(previousReplies.slice(-2).some(r=>normalize(r).includes('que parte te gustaria pensar la financiacion o la unidad')))
  return 'Claro, tomáte tu tiempo. Cuando quieras, podemos revisar las dudas sobre la financiación o la unidad.';
 return MIA_THINKING_REPLY;
}
