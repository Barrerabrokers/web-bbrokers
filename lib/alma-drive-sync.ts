import {createHash} from 'crypto';
import {getSharedDatabase,releaseSharedDatabase} from './database-pool';
import {readSalesResource} from './whatsapp-sales-catalog';
import {SOURCE_HIDDEN} from './vibe-price-list';
import {parseAlmaWorkbook,almaDescription,ALMA_SOURCE} from './alma-price-list';
type Asset={url:string;path:string};
export async function syncAlmaFromDrive(){
 const resource=await readSalesResource(ALMA_SOURCE,'xlsx',{maxBytes:4*1024*1024,timeoutMs:25000});
 const input=parseAlmaWorkbook(resource.buffer),hash=createHash('sha256').update(resource.buffer).digest('hex');
 const sql=getSharedDatabase();
 try{return await sql.begin(async tx=>{
  const [config]=await tx`SELECT * FROM development_drive_sync WHERE slug='alma-centenario' AND enabled=true FOR UPDATE`;
  if(!config)throw Error('Sincronización no configurada');
  const [dev]=await tx`SELECT id FROM developments WHERE id=${config.development_id} AND slug='alma-centenario' FOR UPDATE`;if(!dev)throw Error('Desarrollo no encontrado');
  const before=await tx`SELECT * FROM units WHERE development_id=${dev.id} FOR UPDATE`;
  const images=await tx`SELECT i.* FROM unit_images i JOIN units u ON u.id=i.unit_id WHERE u.development_id=${dev.id}`;
  await tx`INSERT INTO development_drive_sync_runs(development_id,source_hash,snapshot,source_rows) VALUES(${dev.id},${hash},${tx.json({units:before,images})},${tx.json(input)})`;
  const assets=config.assets as Record<string,Asset>;let inserted=0,updated=0,hidden=0;
  for(const u of input){
   const old=before.find(x=>x.unit_number===u.number);
   if(u.status!=='disponible'){
    if(old){await tx`UPDATE units SET status=${u.status},updated_at=now() WHERE id=${old.id}`;hidden++;}continue;
   }
   let id=old?.id;const features=[u.kind==='departamento'?`${u.rooms} ambientes`:u.kind,u.offer].filter(Boolean);
   const description=almaDescription(u);
   if(old){await tx`UPDATE units SET floor=${u.floor},bedrooms=${u.rooms},area=${u.area},balcony_area=${u.semi||null},total_area=${u.own||null},price=${u.price},down_payment=${u.down},installment_count=${u.count},installment_value=${u.payment},status='disponible',orientation=${u.orientation||null},description=${description},features=${features},updated_at=now() WHERE id=${id}`;updated++;}
   else {const [created]=await tx`INSERT INTO units(development_id,unit_number,floor,bedrooms,bathrooms,area,balcony_area,total_area,price,currency,status,description,features,down_payment,installment_count,installment_value,orientation) VALUES(${dev.id},${u.number},${u.floor},${u.rooms},${u.kind==='departamento'?(u.rooms===3?2:1):0},${u.area},${u.semi||null},${u.own||null},${u.price},'USD','disponible',${description},${features},${u.down},${u.count},${u.payment},${u.orientation||null}) RETURNING id`;id=created.id;inserted++;}
   if(!old){
    const render='interior'+u.rooms;
    const floor=Number(u.floor),plan=floor===1?'planta1':floor<=9?'planta2':floor<=12?'planta'+floor:null;
    for(const [index,key] of [render,plan].entries()){if(!key||!assets[key])continue;const a=assets[key];await tx`INSERT INTO unit_images(unit_id,url,storage_path,type,display_order,is_primary) VALUES(${id},${a.url},${a.path},${index===0?'render':'plano'},${index},${index===0})`;}
   }
  }
  for(const old of before.filter(x=>!input.some(u=>u.number===x.unit_number))){
   const features=[...(old.features||[]).filter((v:string)=>v!==SOURCE_HIDDEN),SOURCE_HIDDEN];
   await tx`UPDATE units SET features=${features},updated_at=now() WHERE id=${old.id}`;hidden++;
  }
  const residential=input.filter(u=>u.kind==='departamento'&&u.status==='disponible');
  const min=residential.length?Math.min(...residential.map(u=>u.price!)):null;
  await tx`UPDATE developments SET price_from=${min},updated_at=now() WHERE id=${dev.id}`;
  await tx`UPDATE development_drive_sync SET last_success=now(),last_hash=${hash} WHERE slug='alma-centenario'`;
  return {inserted,updated,hidden,available:input.filter(u=>u.status==='disponible').length};
 });}finally{await releaseSharedDatabase(sql);}
}
