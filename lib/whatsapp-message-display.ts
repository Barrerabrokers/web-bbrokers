export function displayWhatsAppMessage(content: string) {
 const marker='\n\n[Origen del anuncio]\n';const index=content.lastIndexOf(marker);
 if(index<0)return {text:content};
 try {const data=JSON.parse(content.slice(index+marker.length));const title=typeof data.headline==='string'?data.headline:'';const description=typeof data.body==='string'?data.body:'';let url='';try{const parsed=new URL(data.source_url);if(parsed.protocol==='https:')url=parsed.href;}catch{}
 return {text:content.slice(0,index),ad:{title,description,url}};
 }catch{return {text:content};}
}

/** Strip formatting accidentally attached to a Barrera Brokers brochure URL. */
export function whatsAppClickableUrl(value:string) {
  const brochure=value.match(/^(https:\/\/(?:www\.)?barrerabrokers\.com\/desarrollos\/[a-zA-Z0-9_%\-]+\/brochure)[)\].,;!*]*$/);
  return brochure ? brochure[1] : value;
}
