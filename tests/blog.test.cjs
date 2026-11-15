const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,mocks={}){const box={exports:{},console,URL,Date,Intl,process,require:name=>name.endsWith('.css')?{}:name in mocks?mocks[name]:name.startsWith('@/')?{}:require(name)};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,box);return box.exports;}
const blog=load('lib/blog.ts');
const valid={title:'Un proyecto en Belgrano',excerpt:'Una mirada de Barrera Brokers.',image:'https://images.example.com/project.jpg',body:'Contenido propio del artículo.',status:'published',featured:true};
test('drafts can be incomplete; publication requires headline, image, excerpt and content',()=>{
 assert.equal(blog.blogInputSchema.parse({...valid,status:'draft',excerpt:'',image:'',body:''}).status,'draft');
 for(const field of ['title','excerpt','image','body'])assert.throws(()=>blog.blogInputSchema.parse({...valid,[field]:''}));
 for(const image of ['javascript:alert(1)','data:image/png,abc','http://images.example.com/photo.jpg','https://user:pass@example.com/image.jpg'])assert.throws(()=>blog.blogInputSchema.parse({...valid,image}));
 assert.equal(blog.blogSlug('Alpha Place: Belgrano y Núñez'),'alpha-place-belgrano-y-nunez');
 assert.throws(()=>blog.blogInputSchema.parse({...valid,title:'💥💥💥'}));
});
test('article rendering escapes HTML and executable links while keeping safe internal links',()=>{
 const {BlogBody}=load('components/blog-body.tsx',{'@/lib/blog':blog,'@/components/blog-video':load('components/blog-video.tsx',{'@/lib/blog':blog})});
 const html=require('react-dom/server').renderToStaticMarkup(require('react').createElement(BlogBody,{body:'## Un barrio\n\n<script>alert(1)</script>\n\n[Proyecto](/desarrollos/alpha-place-belgrano)\n\n[Abrir](javascript:alert)\n\n- Una opción\n- Otra opción'}));
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('href="javascript:'));assert.ok(html.includes('href="/desarrollos/alpha-place-belgrano"'));assert.equal((html.match(/<li>/g)||[]).length,2);
 assert.equal(blog.safeBlogHref('//evil.example'),null);assert.equal(blog.safeBlogHref('/\\evil.example'),null);
});
test('blog editing is restricted to settings managers and validation precedes persistence',async()=>{
 let role='agent',writes=0;
 const route=load('app/api/admin/blog/route.ts',{'next/server':{NextResponse:{json:(body,options={})=>({body,status:options.status||200})}},'next-auth':{getServerSession:async()=>({user:{role}})},'@/lib/auth':{},'@/lib/roles':{canManageSiteSettings:role=>['admin','marketing'].includes(role)},'@/lib/blog':blog,'@/lib/blog-store':{listBlogPosts:async()=>[],saveBlogPost:async input=>{writes++;return {...input,slug:'belgrano'}}},'next/cache':{revalidatePath(){}}});
 assert.equal((await route.POST({json:async()=>valid})).status,401);assert.equal(writes,0);
 role='marketing';assert.equal((await route.POST({json:async()=>({...valid,image:''})})).status,400);assert.equal(writes,0);
 assert.equal((await route.POST({json:async()=>valid})).status,200);assert.equal(writes,1);
 assert.equal((await route.GET()).status,200);
 role='agent';assert.equal((await route.GET()).status,401);
});
test('home carousel routes published posts to internal blog pages in the same tab',async()=>{
 const React=require('react'),render=require('react-dom/server').renderToStaticMarkup;
 const layout=load('lib/stage-carousel-layout.ts'),carousel=load('components/home/press-carousel.tsx',{'@/lib/stage-carousel-layout':layout});
 const section=load('components/home/press-section.tsx',{'next/link':({children,...props})=>React.createElement('a',props,children),'@/lib/blog-store':{listBlogPosts:async()=>[{...valid,slug:'un-proyecto',id:'1'}]},'@/lib/db':{getFullSiteSettings:async()=>({pressLinks:''})},'@/lib/press-links':load('lib/press-links.ts'),'@/components/home/press-carousel':carousel}).PressSection;
 const html=render(await section());assert.ok(html.includes('href="/blog/un-proyecto"'));assert.ok(!html.includes('target="_blank"'));assert.ok(html.includes(valid.title));
});
test('draft and missing article URLs return notFound and noindex metadata',async()=>{
 const page=load('app/blog/[slug]/page.tsx',{'@/lib/blog-store':{getPublishedBlogPost:async()=>null},'next/navigation':{notFound:()=>{throw Error('NOT_FOUND')}}});
 assert.equal((await page.generateMetadata({params:Promise.resolve({slug:'draft'})})).robots.index,false);
 await assert.rejects(()=>page.default({params:Promise.resolve({slug:'draft'})}),/NOT_FOUND/);
});
test('database lifecycle: drafts stay private, URL remains stable, stale edits fail and unpublishing hides content',{skip:process.env.RUN_BLOG_DB_TESTS!=='1'},async()=>{
 require('@next/env').loadEnvConfig(process.cwd());
 const sql=load('lib/database-pool.ts').getSharedDatabase();
 try{await sql.begin(async tx=>{
  await tx.unsafe('CREATE TEMP TABLE blog_posts (LIKE public.blog_posts INCLUDING ALL) ON COMMIT DROP');
  const store=load('lib/blog-store.ts',{'react':{...require('react'),cache:fn=>fn},'@/lib/blog':blog,'@/lib/database-pool':{getSharedDatabase:()=>tx,releaseSharedDatabase:async()=>{}}});
  const draft=await store.saveBlogPost({...valid,status:'draft',sourceUrl:'https://medio.example/original',sourceName:'Medio original',gallery:['https://images.example.com/gallery.jpg']});assert.equal((await store.listBlogPosts()).length,0);assert.equal(await store.getPublishedBlogPost(draft.slug),null);
  const published=await store.saveBlogPost(valid,draft.id,draft.updatedAt);assert.equal((await store.listBlogPosts()).length,1);assert.ok(published.publishedAt);assert.equal(published.sourceUrl,'https://medio.example/original');assert.equal(published.gallery.length,1);
  const edited=await store.saveBlogPost({...valid,title:'Otro título en Núñez'},published.id,published.updatedAt);assert.equal(edited.slug,draft.slug);assert.ok(Date.parse(edited.updatedAt)>Date.parse(published.updatedAt));
  await assert.rejects(()=>store.saveBlogPost(valid,draft.id,draft.updatedAt),/BLOG_CONFLICT/);
  const unpublished=await store.saveBlogPost({...valid,status:'draft'},edited.id,edited.updatedAt);assert.equal(await store.getPublishedBlogPost(edited.slug),null);assert.equal((await store.listBlogPosts()).length,0);
  await store.saveBlogPost({...valid,status:'archived'},unpublished.id,unpublished.updatedAt);assert.equal((await store.listBlogPosts(true)).length,1);assert.equal((await store.listBlogPosts()).length,0);
 });}finally{await sql.end()}
});

test('pasted URLs become links and videos render only from supported safe URLs',()=>{
 const {BlogBody}=load('components/blog-body.tsx',{'@/lib/blog':blog,'@/components/blog-video':load('components/blog-video.tsx',{'@/lib/blog':blog})});
 const render=body=>require('react-dom/server').renderToStaticMarkup(require('react').createElement(BlogBody,{body}));
 const html=render('Visitá https://example.com/nota. También www.example.com y [Proyecto](/desarrollos).');
 assert.match(html,/href="https:\/\/example.com\/nota"/);
 assert.match(html,/href="https:\/\/www.example.com\/"/);
 assert.match(html,/href="\/desarrollos"/);
 assert.match(render('[video](https://youtu.be/abcdefghijk)'),/src="https:\/\/www.youtube-nocookie.com\/embed\/abcdefghijk"/);
 assert.match(render('https://vimeo.com/123456'),/src="https:\/\/player.vimeo.com\/video\/123456"/);
 assert.match(render('https://example.com/clip.mp4?token=abc'),/<video[^>]+controls=""/);
 for(const url of ['javascript:alert(1)','https://youtube.com.evil.com/watch?v=abcdefghijk','https://user:pass@youtube.com/watch?v=abcdefghijk','http://example.com/clip.mp4']) assert.equal(blog.blogVideo(url),null);
 assert.doesNotMatch(render('[video](https://evil.com/player)'),/<iframe/);
});


test('the first video opens the article once and subsequent videos stay in the text',()=>{
 const body='Introducción.\n\n[video](https://youtu.be/abcdefghijk)\n\nSegundo párrafo.\n\nhttps://vimeo.com/123456';
 const content=blog.blogArticleContent(body);
 assert.equal(content.videoUrl,'https://youtu.be/abcdefghijk');
 assert.equal(content.body,'Introducción.\n\nSegundo párrafo.\n\nhttps://vimeo.com/123456');
 assert.equal(blog.blogArticleContent('Sin videos.').body,'Sin videos.');
 assert.equal(blog.blogArticleContent('Sin videos.').videoUrl,null);
 assert.equal(blog.blogVideoUrl('Mirá https://youtu.be/abcdefghijk acá'),null);
});
