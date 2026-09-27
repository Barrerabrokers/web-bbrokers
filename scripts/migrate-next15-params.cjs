// Mechanical migration of typed Next.js entry-point props; preserves function bodies.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk('app').filter(f=>/\/(page|route)\.tsx?$/.test(f))){
 const source=fs.readFileSync(file,'utf8'),sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),edits=[];
 const client=/^["']use client["'];/.test(source);
 let clientImport=false;
 for(const fn of sf.statements.filter(ts.isFunctionDeclaration)){
  if(!fn.body||!fn.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))continue;
  for(const p of fn.parameters){
   if(!ts.isObjectBindingPattern(p.name)||!p.type||!ts.isTypeLiteralNode(p.type))continue;
   const bindings=p.name.elements.filter(b=>['params','searchParams'].includes(b.name.getText(sf))&&!b.propertyName);
   if(!bindings.length)continue;
   if(client){
    if(bindings.length!==1||bindings[0].name.getText(sf)!=='params'||fn.parameters.length!==1)throw new Error('Review client props: '+file);
    const prop=p.type.members.find(m=>m.name?.getText(sf)==='params');
    edits.push({start:p.getStart(sf),end:p.end,text:''},{start:fn.body.getStart(sf)+1,end:fn.body.getStart(sf)+1,text:`\n  const params = useRouteParams<${prop.type.getText(sf)}>();`});clientImport=true;
   }else{
    if(!fn.modifiers?.some(m=>m.kind===ts.SyntaxKind.AsyncKeyword))throw new Error('Review non-async entry: '+file);
    let declarations='';
    for(const b of bindings){
      const name=b.name.getText(sf),prop=p.type.members.find(m=>m.name?.getText(sf)===name);
      if(!prop?.type)throw new Error('Missing prop type: '+file);
      edits.push({start:b.name.getStart(sf),end:b.name.end,text:`${name}: pending${name}`});
      edits.push({start:prop.type.getStart(sf),end:prop.type.end,text:`Promise<${prop.type.getText(sf)}>`});
      declarations+=`\n  const ${name} = await pending${name};`;
    }
    edits.push({start:fn.body.getStart(sf)+1,end:fn.body.getStart(sf)+1,text:declarations});
   }
  }
 }
 if(!edits.length)continue;
 let result=source;
 for(const edit of edits.sort((a,b)=>b.start-a.start))result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
 if(clientImport)result=result.replace(/(^["']use client["'];)/,'$1\nimport { useParams as useRouteParams } from "next/navigation";');
 fs.writeFileSync(file,result);console.log(file);
}
