import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createServer,request as httpRequest} from 'node:http';
import {CATEGORIES,clone,classify,makeCard,initialWorkspace,validateWorkspace,mergeWorkspace,arrange,handoffHtml,handoffMarkdown,validateSuggestion,safeUrl,WIDTH,HEIGHT} from '../public/core.mjs';
import {createAppServer,endpoint} from '../server.mjs';

test('an excerpt and its intent remain separate through save, restore and handoff',()=>{
  const ws=initialWorkspace(),p=ws.projects[0];
  const quote='用缓存减少重复模型请求。\n需要先验证缓存的失效条件。';
  const intent='用于我们的接口方案评审，先由开发验证缓存策略。';
  p.cards=[makeCard({title:'缓存策略',quote,intent,category:'solution',owner:'开发',source:'Codex',sourceUrl:'https://example.com/chat',nextStep:'补充失效策略',status:'done'})];p.edges=[];
  const restored=validateWorkspace(JSON.parse(JSON.stringify(ws)));
  assert.equal(restored.projects[0].cards[0].quote,quote);
  assert.equal(restored.projects[0].cards[0].intent,intent);
  assert.equal(restored.projects[0].cards[0].status,'done');
  const md=handoffMarkdown(restored.projects[0]);
  assert.ok(md.includes(intent));assert.ok(md.includes('> 需要先验证'));assert.ok(md.includes('https://example.com/chat'));assert.ok(md.includes('补充失效策略'));
  const html=handoffHtml(restored.projects[0]);assert.ok(html.includes(quote));assert.ok(html.includes('用途说明'));assert.ok(html.includes('已完成'));
});
test('grouping prefers the stated use over keywords in the quoted text',()=>{
  assert.equal(classify('数据库、接口、API 技术实现','用于新用户引导的体验设计'),'idea');
  assert.equal(classify('产品体验','这是算法接口的技术方案'),'solution');
  assert.equal(classify('界面灵感','下一步安排负责人跟进'),'action');
  assert.equal(classify('随手记下的一句话',''),'inbox');
  assert.throws(()=>makeCard({quote:'  '}),/原文/);
});
test('layout creates non-overlapping cards without changing the original content',()=>{
  const p=initialWorkspace().projects[0],original=p.cards.map(c=>[c.quote,c.intent,c.category]);
  arrange(p);
  assert.deepEqual(p.cards.map(c=>[c.quote,c.intent,c.category]),original);
  for(let i=0;i<p.cards.length;i++)for(let j=i+1;j<p.cards.length;j++){
    const a=p.cards[i],b=p.cards[j];
    assert.ok(a.x+WIDTH<=b.x||b.x+WIDTH<=a.x||a.y+HEIGHT<=b.y||b.y+HEIGHT<=a.y);
  }
});
test('imports append copies and remap all card relations instead of overwriting work',()=>{
  const original=initialWorkspace(),saved=JSON.stringify(original);
  const merged=mergeWorkspace(original,JSON.parse(saved));
  assert.equal(JSON.stringify(original),saved);
  assert.equal(merged.projects.length,2);
  const a=merged.projects[0],b=merged.projects[1];
  assert.notEqual(a.id,b.id);assert.notEqual(a.cards[0].id,b.cards[0].id);
  assert.equal(b.edges[0].from,b.cards[0].id);
  assert.equal(b.edges[0].to,b.cards[4].id);
  assert.equal(merged.activeProjectId,b.id);
  assert.doesNotThrow(()=>validateWorkspace(merged));
});
test('malformed or unsupported imports are rejected without changing current data',()=>{
  const ws=initialWorkspace(),saved=JSON.stringify(ws);
  for(const value of [null,{},[],{version:2,projects:[]},{version:1,projects:[]}]){
    assert.throws(()=>mergeWorkspace(ws,value));assert.equal(JSON.stringify(ws),saved);
  }
  const broken=clone(ws);broken.projects[0].cards.push({...broken.projects[0].cards[0]});
  assert.throws(()=>validateWorkspace(broken),/重复/);
  const invalid=clone(ws);invalid.projects[0].cards[0].quote='';assert.throws(()=>validateWorkspace(invalid));
  const large=clone(ws);large.projects=Array.from({length:51},(_,i)=>({...large.projects[0],id:'p'+i}));
  assert.throws(()=>validateWorkspace(large));
});
test('imports remove dangling and duplicate relations and unsafe links',()=>{
  const ws=initialWorkspace(),p=ws.projects[0];
  p.cards[0].sourceUrl='javascript:alert(1)';
  p.edges.push({...p.edges[0]},{id:'bad',from:'missing',to:p.cards[0].id},{id:'self',from:p.cards[0].id,to:p.cards[0].id});
  const restored=validateWorkspace(ws).projects[0];
  assert.equal(restored.cards[0].sourceUrl,'');assert.equal(restored.edges.length,1);
  assert.equal(safeUrl('data:text/html,<script>'), '');
});
test('handoff exports respect the selection and escape untrusted text',()=>{
  const p=initialWorkspace().projects[0];
  p.name='<script>broken()</script>';p.cards[0].title='<img src=x onerror=alert(1)>';
  p.cards[0].intent='Hello <iframe src="evil"></iframe>';
  const selected=[p.cards[0].id],md=handoffMarkdown(p,selected),html=handoffHtml(p,selected);
  assert.ok(md.includes(p.cards[0].quote));assert.ok(!md.includes(p.cards[1].quote));
  assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<iframe'));
  assert.ok(!html.includes(p.cards[1].quote));
  const all=handoffHtml(p);assert.ok(all.includes('关联：'));assert.ok(handoffMarkdown(p).includes('**关联**'));
});
test('AI suggestions require supported fields and cannot replace the original excerpt',()=>{
  assert.throws(()=>validateSuggestion({title:'x',category:'unknown',intent:'x'}));
  assert.throws(()=>validateSuggestion({title:'x',category:'idea'}));
  const s=validateSuggestion({title:'t',category:'idea',intent:'i',quote:'模型改写原文',extra:'x'});
  assert.ok(!('quote' in s));assert.ok(!('extra' in s));
  assert.equal(s.title,'t');assert.equal(Object.keys(CATEGORIES).length,4);
});
test('provider endpoint validation accepts compatible paths and rejects unsafe configurations',()=>{
  assert.equal(endpoint('https://example.com/v1/'),'https://example.com/v1/chat/completions');
  assert.equal(endpoint('http://127.0.0.1:11434/v1/chat/completions'),'http://127.0.0.1:11434/v1/chat/completions');
  assert.throws(()=>endpoint('http://example.com/v1'));
  assert.throws(()=>endpoint('https://user:password@example.com/v1'));
  assert.throws(()=>endpoint('https://example.com/v1?key=secret'));
});
test('all application controls exist in HTML and runtime modules are local',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,'duplicate HTML ids');
  for(const match of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(match[1]),'missing control '+match[1]);
  assert.ok(!/<script[^>]+src="https?:/i.test(html));
  assert.ok(!/apiKey\s*:\s*aiConfig\.apiKey[^;]*localStorage/s.test(app));
});

test('local HTTP app serves the page, protects the AI proxy and handles real provider responses',async t=>{
  let mode='ok',received=null,receivedKey=null;
  const provider=createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    received=JSON.parse(Buffer.concat(chunks).toString('utf8'));receivedKey=req.headers.authorization;
    if(mode==='unauthorized'){res.writeHead(401);res.end('no');return;}
    if(mode==='redirect'){res.writeHead(302,{Location:'http://127.0.0.1:1/private'});res.end();return;}
    if(mode==='badjson'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'不是 JSON'}}]}));return;}
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:JSON.stringify({title:'优化第一次体验',category:mode==='badcategory'?'invalid':'idea',intent:'用于引导改版',nextStep:'补一个原型',quote:'不能覆盖原文'})}}]}));
  });
  provider.listen(0,'127.0.0.1');await once(provider,'listening');
  const server=createAppServer();server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>{server.closeAllConnections();server.close();provider.closeAllConnections();provider.close();});
  const base='http://127.0.0.1:'+server.address().port;
  const headers={'Content-Type':'application/json','X-Coworker-Request':'1',Origin:base};
  const payload={baseUrl:'http://127.0.0.1:'+provider.address().port+'/v1',model:'test-model',apiKey:'test-only-placeholder',quote:'原始摘录',intent:'用途说明'};
  const page=await fetch(base);assert.equal(page.status,200);assert.ok((await page.text()).includes('让这段灵感'));
  const script=await fetch(base+'/app.js');assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/javascript/);
  const denied=await fetch(base+'/server.mjs');assert.equal(denied.status,404);
  const secretFile=await fetch(base+'/.git/config');assert.equal(secretFile.status,404);
  const wrongHost=await new Promise((resolve,reject)=>{const req=httpRequest(base,{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();});assert.equal(wrongHost,403);
  const noHeader=await fetch(base+'/api/organize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  assert.equal(noHeader.status,403);assert.equal(received,null);
  const otherOrigin=await fetch(base+'/api/organize',{method:'POST',headers:{...headers,Origin:'https://example.com'},body:JSON.stringify(payload)});
  assert.equal(otherOrigin.status,403);
  const empty=await fetch(base+'/api/organize',{method:'POST',headers,body:JSON.stringify({...payload,quote:''})});assert.equal(empty.status,400);
  const malformed=await fetch(base+'/api/organize',{method:'POST',headers,body:'{broken'});assert.equal(malformed.status,400);
  const good=await fetch(base+'/api/organize',{method:'POST',headers,body:JSON.stringify(payload)});
  assert.equal(good.status,200);const result=await good.json();assert.equal(result.suggestion.title,'优化第一次体验');assert.ok(!('quote' in result.suggestion));
  assert.equal(received.model,'test-model');assert.equal(receivedKey,'Bearer test-only-placeholder');
  assert.deepEqual(JSON.parse(received.messages[1].content),{quote:'原始摘录',intent:'用途说明'});
  mode='badcategory';const badSchema=await fetch(base+'/api/organize',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(badSchema.status,502);
  mode='badjson';const bad=await fetch(base+'/api/organize',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(bad.status,502);
  mode='unauthorized';const auth=await fetch(base+'/api/organize',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(auth.status,502);assert.ok((await auth.json()).error.includes('401'));
  mode='redirect';const redir=await fetch(base+'/api/organize',{method:'POST',headers,body:JSON.stringify(payload)});assert.equal(redir.status,400);
});

test('unrecognized inherited categories are rejected and long canvases survive restore',()=>{
  assert.throws(()=>validateSuggestion({title:'x',category:'__proto__',intent:'x'}));
  assert.throws(()=>validateSuggestion({title:'x',category:'toString',intent:'x'}));
  const p=initialWorkspace().projects[0];p.cards=Array.from({length:30},(_,i)=>makeCard({title:'Card '+i,quote:'原文 '+i,intent:'   ',category:'solution'}));p.edges=[];arrange(p);
  const ws={version:1,activeProjectId:p.id,projects:[p]};
  const restored=validateWorkspace(ws);
  assert.equal(restored.projects[0].cards[29].y,p.cards[29].y);
  assert.equal(makeCard({quote:'默认标题',intent:'   '}).title,'默认标题');
});