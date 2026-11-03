import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM,VirtualConsole} from 'jsdom';
import * as core from '../public/core.mjs';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
const app=source.replace(/^import[^\n]+\n/,'const {'+Object.keys(core).join(',')+'}=window.__core; const e=window.__core.escapeHtml;\n');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(t,{saved=null,url='http://127.0.0.1:4173/',fetcher}={}){
  const errors=[],virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',err=>errors.push(err));
  const dom=new JSDOM(html,{url,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
  const {window:w}=dom;
  const style=w.document.createElement('style');style.textContent=css;w.document.head.append(style);
  w.__core=core;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.HTMLElement.prototype.scrollIntoView=function(){};
  w.Element.prototype.setPointerCapture=function(){};
  w.Element.prototype.hasPointerCapture=function(){return false;};
  w.Element.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:1100,height:800};};
  Object.defineProperty(w.document.getElementById('canvas'),'clientWidth',{value:1100});
  Object.defineProperty(w.document.getElementById('canvas'),'clientHeight',{value:800});
  w.URL.createObjectURL=()=> 'blob:mock';w.URL.revokeObjectURL=()=>{};
  w.fetch=fetcher||(()=>{throw new Error('Unexpected external request');});
  if(saved)w.localStorage.setItem(core.STORAGE_KEY,saved);
  w.eval(app);
  await new Promise(resolve=>w.requestAnimationFrame(resolve));
  t.after(()=>{w.close();assert.deepEqual(errors,[]);});
  return {w,$:id=>w.document.getElementById(id),state:()=>JSON.parse(w.localStorage.getItem(core.STORAGE_KEY))};
}
function submit(w,form){form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));}
function pointer(w,target,type,{x=100,y=100,shift=false}={}){
  const event=new w.Event(type,{bubbles:true,cancelable:true});
  for(const [key,value]of Object.entries({button:0,pointerId:1,clientX:x,clientY:y,shiftKey:shift}))Object.defineProperty(event,key,{value});
  target.dispatchEvent(event);
}
test('page boots, creates a project and saves a real excerpt that survives reload',async t=>{
  const {w,$,state}=await setup(t);assert.equal(w.document.querySelectorAll('.card').length,6);
  $('newProject').click();$('projectName').value='电商起号';$('projectDescription').value='整理下周达人账号的内容思路';submit(w,$('projectForm'));
  assert.equal($('boardName').textContent,'电商起号');assert.equal($('emptyState').hidden,false);
  $('captureSecondary').click();$('cardQuote').value='原始内容：先验证观众的具体问题。';$('cardIntent').value='这对内容选题的用户需求很有启发。';$('cardOwner').value='运营同事';$('cardSource').value='Codex';
  $('localOrganize').click();assert.equal($('cardCategory').value,'idea');submit(w,$('cardForm'));
  assert.equal(w.document.querySelectorAll('.card').length,1);
  const p=state().projects.at(-1);assert.equal(p.cards[0].quote,'原始内容：先验证观众的具体问题。');assert.equal(p.cards[0].owner,'运营同事');
  const restored=await setup(t,{saved:JSON.stringify(state())});
  assert.equal(restored.$('boardName').textContent,'电商起号');assert.equal(restored.w.document.querySelectorAll('.card').length,1);
});
test('edit, selection, filtering and handoff use saved content',async t=>{
  const {w,$,state}=await setup(t);
  w.document.querySelector('.edit-card').click();$('cardTitle').value='新的交接标题';$('cardIntent').value='给产品同事做引导原型参考';$('cardDone').checked=true;submit(w,$('cardForm'));
  assert.equal(state().projects[0].cards[0].title,'新的交接标题');assert.equal(state().projects[0].cards[0].status,'done');
  $('search').value='新的交接标题';$('search').dispatchEvent(new w.Event('input'));assert.equal(w.document.querySelectorAll('.card').length,1);
  pointer(w,w.document.querySelector('.card'),'pointerdown');pointer(w,$('canvas'),'pointerup');
  assert.equal($('selectionBar').hidden,false);$('exportSelection').click();
  assert.equal(w.document.querySelectorAll('.handoff-article').length,1);
  assert.ok($('handoffContent').textContent.includes('给产品同事做引导原型参考'));assert.ok($('handoffContent').textContent.includes('已完成'));
});
test('drag, association, deletion and undo preserve graph integrity',async t=>{
  const {w,$,state}=await setup(t),before=state().projects[0].cards[0];
  let nodes=w.document.querySelectorAll('.card');
  pointer(w,nodes[0],'pointerdown',{x:100,y:100});pointer(w,$('canvas'),'pointermove',{x:160,y:140});pointer(w,$('canvas'),'pointerup',{x:160,y:140});
  assert.ok(state().projects[0].cards[0].x>before.x);$('undo').click();assert.equal(state().projects[0].cards[0].x,before.x);
  $('redo').click();assert.ok(state().projects[0].cards[0].x>before.x);
  nodes=w.document.querySelectorAll('.card');pointer(w,nodes[0],'pointerdown');pointer(w,$('canvas'),'pointerup');
  pointer(w,nodes[1],'pointerdown',{shift:true});pointer(w,$('canvas'),'pointerup');
  assert.equal($('connectCards').disabled,false);$('connectCards').click();assert.equal(state().projects[0].edges.length,2);
  w.document.querySelector('.edit-card').click();$('deleteCard').click();$('confirmDelete').click();
  assert.equal(state().projects[0].cards.length,5);assert.equal(state().projects[0].edges.length,0);
  $('undo').click();assert.equal(state().projects[0].cards.length,6);assert.equal(state().projects[0].edges.length,2);
});
test('JSON import appends a workspace and invalid JSON does not touch it',async t=>{
  const {w,$,state}=await setup(t),saved=JSON.stringify(state());
  Object.defineProperty($('importFile'),'files',{configurable:true,value:[{size:saved.length,text:async()=>saved}]});
  await $('importFile').onchange();assert.equal(state().projects.length,2);assert.ok($('boardName').textContent.endsWith('（导入）'));
  const current=JSON.stringify(state());
  Object.defineProperty($('importFile'),'files',{configurable:true,value:[{size:10,text:async()=>'{broken'}]});
  await $('importFile').onchange();assert.equal(JSON.stringify(state()),current);
});
test('AI suggestions are opt-in, reviewed before applying, and never persist keys or alter quotes',async t=>{
  let calls=0,request;
  const {w,$,state}=await setup(t,{fetcher:async(url,options)=>{
    calls++;request=JSON.parse(options.body);
    return {ok:true,json:async()=>({suggestion:{title:'模型建议标题',category:'solution',intent:'用于服务端实现',nextStep:'先做接口验证'}})};
  }});
  assert.equal(calls,0);$('modelSettings').click();$('baseUrl').value='https://model.example.com/v1';$('modelName').value='my-model';$('apiKey').value='test-secret-only';submit(w,$('settingsForm'));
  assert.ok(!JSON.stringify(Object.values(w.localStorage)).includes('test-secret-only'));
  $('captureSecondary').click();$('cardQuote').value='重要原文';$('cardIntent').value='我的用途';await $('aiOrganize').onclick();
  assert.equal(calls,1);assert.equal(request.quote,'重要原文');assert.equal($('cardIntent').value,'我的用途');assert.equal($('suggestionBox').hidden,false);
  $('applySuggestion').click();assert.equal($('cardQuote').value,'重要原文');assert.equal($('cardIntent').value,'用于服务端实现');
  submit(w,$('cardForm'));const p=state().projects[0];assert.equal(p.cards.at(-1).quote,'重要原文');assert.equal(p.cards.at(-1).title,'模型建议标题');
  for(let i=0;i<w.localStorage.length;i++)assert.ok(!w.localStorage.getItem(w.localStorage.key(i)).includes('test-secret-only'));
});
test('stale AI responses do not overwrite newer user edits',async t=>{
  let finish;const {w,$}=await setup(t,{fetcher:()=>new Promise(resolve=>finish=resolve)});
  $('modelSettings').click();$('baseUrl').value='http://127.0.0.1:11434/v1';$('modelName').value='local-model';submit(w,$('settingsForm'));
  $('captureSecondary').click();$('cardQuote').value='原文';$('cardIntent').value='之前用途';
  const pending=$('aiOrganize').onclick();$('cardIntent').value='用户新写的用途';
  finish({ok:true,json:async()=>({suggestion:{title:'旧建议',category:'idea',intent:'旧用途'}})});await pending;
  assert.equal($('cardIntent').value,'用户新写的用途');assert.equal($('suggestionBox').hidden,true);
});
test('bookmark capture carries the excerpt and safe source URL into a confirmation form',async t=>{
  const payload={quote:'这段是网页上选中的文字',source:'网页文章标题',sourceUrl:'https://example.com/article'};
  const url='http://127.0.0.1:4173/#capture='+encodeURIComponent(JSON.stringify(payload));
  const {w,$,state}=await setup(t,{url});
  assert.equal($('cardDialog').open,true);assert.equal($('cardQuote').value,payload.quote);assert.equal($('cardSourceUrl').value,payload.sourceUrl);
  assert.equal(state().projects[0].cards.length,6,'capture requires user confirmation');
  assert.equal(w.location.hash,'');submit(w,$('cardForm'));assert.equal(state().projects[0].cards.length,7);
});
test('another tab updating while editing blocks stale overwrites and keeps a backup path',async t=>{
  const {w,$,state}=await setup(t),before=JSON.stringify(state());
  $('captureSecondary').click();$('cardQuote').value='尚未提交的文字';
  w.dispatchEvent(new w.StorageEvent('storage',{key:core.STORAGE_KEY,newValue:before}));
  submit(w,$('cardForm'));
  assert.equal(JSON.stringify(state()),before);assert.equal($('storageWarning').hidden,false);
  assert.equal($('cardDialog').open,true);
});
test('corrupted saved data is not silently overwritten on boot',async t=>{
  const broken='this was not JSON';const {w,$}=await setup(t,{saved:broken});
  assert.equal(w.localStorage.getItem(core.STORAGE_KEY),broken);assert.equal($('storageWarning').hidden,false);
});
