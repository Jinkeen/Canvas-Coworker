import {CATEGORIES,WIDTH,HEIGHT,STORAGE_KEY,clone,uid,safeUrl,escapeHtml as e,classify,makeCard,createProject,arrange,initialWorkspace,validateWorkspace,mergeWorkspace,handoffMarkdown,handoffHtml,validateSuggestion} from './core.mjs';

const $=id=>document.getElementById(id);
const paths={
plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
layers:'<path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5m-18 5 9 5 9-5"/>',
grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
document:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h6"/>',
presentation:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M12 17v4m-4 0h8M7 12l3-3 3 3 4-5"/>',
spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z"/>',
code:'<path d="m8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18"/>',
check:'<path d="m5 12 4 4L19 6"/>',
inbox:'<path d="M4 4h16v16H4zM4 13h5l2 3h2l2-3h5"/>',
close:'<path d="m6 6 12 12M6 18 18 6"/>',
edit:'<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14v6Z"/>',
search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
layout:'<rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/>',
cursor:'<path d="m4 3 15 8-7 2-3 7L4 3Z"/>',
sliders:'<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="16" cy="17" r="3" fill="currentColor" stroke="none"/>',
download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01"/>',
quote:'<path d="M4 11h6v8H3v-7c0-5 2-7 6-7m6 6h6v8h-7v-7c0-5 2-7 6-7"/>',
undo:'<path d="M3 10h10a7 7 0 0 1 0 14M3 10l5-5m-5 5 5 5" transform="translate(0 -3)"/>',
redo:'<path d="M21 10H11a7 7 0 0 0 0 14m10-14-5-5m5 5-5 5" transform="translate(0 -3)"/>',
fit:'<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/>',
link:'<path d="m10 13 4-4m-7 5-2 2a4 4 0 0 0 6 6l3-3m-1-9 2-2a4 4 0 0 1 6 6l-3 3" transform="translate(-1 -2)"/>',
lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2"/>',
copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v14h5"/>',
trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
print:'<path d="M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z"/>'
};
const icon=name=>'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.document)+'</svg>';
document.querySelectorAll('[data-icon]').forEach(node=>node.innerHTML=icon(node.dataset.icon));
let recoveryRaw=null, storageProtected=false, externalConflict=false;
let workspace;
try {
  const raw=localStorage.getItem(STORAGE_KEY);
  if(raw){recoveryRaw=raw;workspace=validateWorkspace(JSON.parse(raw));recoveryRaw=null;}
  else workspace=initialWorkspace();
} catch(err) {
  workspace=initialWorkspace();storageProtected=true;
  $('storageWarning').hidden=false;
  $('storageWarning').textContent='浏览器中的旧数据暂时无法读取。本次进入临时工作区，不会覆盖原数据；可先备份当前画布。';
  if(recoveryRaw){
    const button=document.createElement('button');button.textContent='下载原始数据';button.className='text-button';
    button.addEventListener('click',()=>download('coworker-recovery.txt',recoveryRaw,'text/plain'));$('storageWarning').append(' ',button);
  }
}
let selected=new Set(),filter='all',query='',view={x:0,y:0,scale:1};
let undoStack=[],redoStack=[],editingId=null,editingProject=false,handoffIds=null,pendingSuggestion=null,requestId=0,aiController=null;
let aiConfig={baseUrl:'',model:'',apiKey:''};
try {const saved=JSON.parse(localStorage.getItem('canvas-coworker.model.v1')||'{}');aiConfig.baseUrl=typeof saved.baseUrl==='string'?saved.baseUrl:'';aiConfig.model=typeof saved.model==='string'?saved.model:'';}catch{}
const project=()=>workspace.projects.find(item=>item.id===workspace.activeProjectId)||workspace.projects[0];
const visible=()=>project().cards.filter(card=>(filter==='all'||card.category===filter)&&(!query||[card.title,card.quote,card.intent,card.source,card.owner,card.nextStep].join(' ').toLowerCase().includes(query)));
let toastTimer;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}
function error(id,message){$(id).textContent=message;$(id).hidden=!message;}
function download(name,content,type='application/json'){
  const blob=new Blob([content],{type:type+';charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name.replace(/[<>:"/\\|?*]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function persist(){
  try {
    if(storageProtected||externalConflict) throw new Error('storage protected');
    const serialized=JSON.stringify(workspace);
    if(serialized.length>3500000) throw new Error('quota');
    localStorage.setItem(STORAGE_KEY,serialized);
    $('saveState').className='save-state';$('saveState').innerHTML='<span></span>已保存在此浏览器';return true;
  }catch{
    $('saveState').className='save-state error';$('saveState').innerHTML='<span></span>未能保存，请先备份';
    $('storageWarning').hidden=false;
    if(!storageProtected&&!externalConflict)$('storageWarning').textContent='浏览器存储不足或已被禁用，当前修改仅保留在页面内。请点击左下角「备份」保存文件。';
    return false;
  }
}
function remember(before){
  undoStack.push(before);if(undoStack.length>30)undoStack.shift();redoStack=[];
}
function mutate(change){
  if(externalConflict){toast('另一标签页已修改数据，请先备份当前画布，再刷新页面。');return false;}
  const before=JSON.stringify(workspace),next=clone(workspace);
  try{change(next,next.projects.find(p=>p.id===next.activeProjectId));}
  catch(err){toast(err.message);return false;}
  workspace=next;remember(before);persist();render();return true;
}
function syncView(){
  $('world').style.transform='translate('+view.x+'px,'+view.y+'px) scale('+view.scale+')';
  $('canvas').style.backgroundSize=20*view.scale+'px '+20*view.scale+'px';
  $('canvas').style.backgroundPosition=view.x+'px '+view.y+'px';
  $('zoomLevel').textContent=Math.round(view.scale*100)+'%';
}
function fit(readable=true){
  const cards=visible();const {width,height}=$('canvas').getBoundingClientRect();
  if(!cards.length){view={x:0,y:0,scale:1};syncView();return;}
  const left=Math.min(...cards.map(c=>c.x))-14,top=Math.min(...cards.map(c=>c.y))-58;
  const right=Math.max(...cards.map(c=>c.x+WIDTH))+14,bottom=Math.max(...cards.map(c=>c.y+HEIGHT))+24;
  const scale=readable?Math.max(.65,Math.min(1,(width-70)/(right-left))):Math.max(.15,Math.min(1,(width-70)/(right-left),(height-95)/(bottom-top)));
  view={scale,x:Math.max(24,(width-(right-left)*scale)/2)-left*scale,y:25-top*scale};syncView();
}
function zoom(factor,cx=$('canvas').clientWidth/2,cy=$('canvas').clientHeight/2){
  const next=Math.min(1.6,Math.max(.15,view.scale*factor)),ratio=next/view.scale;
  view.x=cx-(cx-view.x)*ratio;view.y=cy-(cy-view.y)*ratio;view.scale=next;syncView();
}
function renderEdges(){
  const cards=visible(),ids=new Set(cards.map(c=>c.id));
  const all=project().cards;
  const width=Math.max(8000,...all.map(c=>c.x+WIDTH+100)),height=Math.max(8000,...all.map(c=>c.y+HEIGHT+100));
  $('connections').setAttribute('width',String(width));$('connections').setAttribute('height',String(height));
  $('world').style.width=width+'px';$('world').style.height=height+'px';
  $('connections').innerHTML=project().edges.filter(edge=>ids.has(edge.from)&&ids.has(edge.to)).map(edge=>{
    const from=project().cards.find(c=>c.id===edge.from),to=project().cards.find(c=>c.id===edge.to);
    let x1=from.x+WIDTH,y1=from.y+HEIGHT/2,x2=to.x,y2=to.y+HEIGHT/2;
    if(from.x>to.x){x1=from.x;x2=to.x+WIDTH;}
    const curve=Math.max(60,Math.abs(x2-x1)*.45),direction=x2>=x1?1:-1;
    return '<path class="connection-path" d="M'+x1+' '+y1+' C'+(x1+curve*direction)+' '+y1+','+(x2-curve*direction)+' '+y2+','+x2+' '+y2+'"/><circle class="connection-point" cx="'+x1+'" cy="'+y1+'" r="3"/><circle class="connection-point" cx="'+x2+'" cy="'+y2+'" r="3"/>';
  }).join('');
}
function syncSelection(){
  const ids=new Set(project().cards.map(c=>c.id));selected=new Set([...selected].filter(id=>ids.has(id)));
  $('cards').querySelectorAll('.card').forEach(node=>{node.classList.toggle('selected',selected.has(node.dataset.id));node.setAttribute('aria-pressed',String(selected.has(node.dataset.id)));});
  $('selectionBar').hidden=!selected.size;$('selectedCount').textContent='已选 '+selected.size+' 张';
  $('connectCards').disabled=selected.size!==2;
  $('unlinkCards').disabled=!project().edges.some(edge=>selected.has(edge.from)||selected.has(edge.to));
  $('undo').disabled=!undoStack.length;$('redo').disabled=!redoStack.length;
}
function render(){
  const p=project(),cards=visible();
  $('boardName').textContent=p.name;$('breadcrumbName').textContent=p.name;
  $('boardDescription').textContent=p.description||'收集值得保留的对话，写下你想继续推进的事。';
  const list=workspace.projects.map(item=>'<button class="project-link '+(item.id===p.id?'active':'')+'" data-project="'+e(item.id)+'" title="'+e(item.name)+'">'+icon('layers')+'<span>'+e(item.name)+'</span><span class="count">'+item.cards.length+'</span></button>').join('');
  $('projectList').innerHTML=list;$('mobileProjects').innerHTML=list;
  $('categoryFilters').innerHTML='<button class="filter-chip '+(filter==='all'?'active':'')+'" data-filter="all">全部灵感 <span class="filter-count">'+p.cards.length+'</span></button>'+Object.entries(CATEGORIES).map(([key,cat])=>'<button class="filter-chip '+(filter===key?'active':'')+'" data-filter="'+key+'" style="--chip-color:'+cat.color+'"><i></i>'+cat.label+'<span class="filter-count">'+p.cards.filter(c=>c.category===key).length+'</span></button>').join('');
  $('cardCount').textContent=p.cards.length+' 张摘录';$('connectionCount').textContent=p.edges.length+' 条关联';
  $('cards').innerHTML=cards.map(card=>{
    const cat=CATEGORIES[card.category];
    return '<article class="card '+(selected.has(card.id)?'selected ':'')+(card.status==='done'?'done':'')+'" data-id="'+e(card.id)+'" style="left:'+card.x+'px;top:'+card.y+'px;--cat-bg:'+cat.background+';--cat-color:'+cat.color+'" tabindex="0" role="button" aria-pressed="'+selected.has(card.id)+'" aria-label="'+e(card.title)+'，双击或按 Enter 编辑"><div class="card-top"><span class="category-tag">'+icon(cat.icon)+cat.label+'</span><span>'+(card.status==='done'?'<span class="status-done">已完成</span>':'')+'<button class="icon-button edit-card" aria-label="编辑 '+e(card.title)+'" title="编辑摘录与用途">'+icon('more')+'</button></span></div><h3 title="'+e(card.title)+'">'+e(card.title)+'</h3><blockquote class="card-quote">'+e(card.quote)+'</blockquote><p class="card-intent"><b>用途</b>'+e(card.intent||'补一句：这段内容可以用来做什么？')+'</p><footer class="card-footer">'+icon('document')+'<span class="source-label" title="'+e(card.source)+'">'+e(card.source)+'</span>'+(card.owner?'<span class="card-owner"><i>'+e(card.owner.slice(0,1))+'</i>'+e(card.owner)+'</span>':'')+'</footer></article>';
  }).join('');
  let order=0;
  $('groupLabels').innerHTML=Object.entries(CATEGORIES).map(([key,cat])=>{
    const group=cards.filter(card=>card.category===key);if(!group.length)return '';
    const x=Math.min(...group.map(c=>c.x)),y=Math.max(22,Math.min(...group.map(c=>c.y))-39);
    order++;return '<div class="group-label" style="left:'+x+'px;top:'+y+'px"><span class="group-number">0'+order+'</span>'+cat.label+'<span class="group-line"></span></div>';
  }).join('');
  $('emptyState').hidden=!!p.cards.length;$('noResults').hidden=!p.cards.length||!!cards.length;
  $('modelState').classList.toggle('connected',!!aiConfig.baseUrl&&!!aiConfig.model);
  renderEdges();syncSelection();syncView();
}
function resetFilters(){filter='all';query='';$('search').value='';selected.clear();}
function newCard(prefill={}){
  editingId=null;pendingSuggestion=null;requestId++;aiController?.abort();
  $('cardForm').reset();$('suggestionBox').hidden=true;$('deleteCard').hidden=true;$('doneLabel').hidden=true;
  $('cardDialogTitle').textContent='让这段灵感，有个去处';
  for(const [key,value] of Object.entries(prefill)){const node=$('card'+key[0].toUpperCase()+key.slice(1));if(node)node.value=value;}
  error('cardError','');$('aiOrganize').disabled=false;$('aiButtonText').textContent='AI 提炼建议';
  $('cardDialog').showModal();$('cardDialog').scrollTop=0;$('cardQuote').focus();
}
function editCard(id){
  const card=project().cards.find(c=>c.id===id);if(!card)return;
  newCard(card);editingId=id;$('deleteCard').hidden=false;$('doneLabel').hidden=false;
  $('cardDone').checked=card.status==='done';$('cardDialogTitle').textContent='把这份灵感，再说清楚一点';
}
function formData(){
  return {title:$('cardTitle').value,quote:$('cardQuote').value,intent:$('cardIntent').value,category:$('cardCategory').value,source:$('cardSource').value,sourceUrl:$('cardSourceUrl').value,owner:$('cardOwner').value,nextStep:$('cardNextStep').value,status:$('cardDone').checked?'done':'open'};
}
function showProjectDialog(isEdit=false){
  editingProject=isEdit;$('projectForm').reset();error('projectError','');
  $('projectDialogTitle').textContent=isEdit?'编辑工作画布':'新建工作画布';
  if(isEdit){$('projectName').value=project().name;$('projectDescription').value=project().description;}
  $('projectDialog').showModal();$('projectName').focus();
}
function openSettings(){
  $('baseUrl').value=aiConfig.baseUrl;$('modelName').value=aiConfig.model;$('apiKey').value=aiConfig.apiKey;
  error('settingsError','');$('settingsDialog').showModal();
}
function openHandoff(ids=null){
  handoffIds=ids?.length?[...ids]:null;
  const p=project(),cards=handoffIds?p.cards.filter(c=>handoffIds.includes(c.id)):p.cards;
  if(!cards.length){toast('先收集一张卡片，再生成交接简报。');return;}
  $('handoffScope').textContent=(handoffIds?'选中内容':'整个画布')+' · '+cards.length+' 张摘录';
  $('handoffContent').innerHTML='<header class="handoff-cover"><small>CANVAS COWORKER / 交接简报</small><h1>'+e(p.name)+'</h1><p>'+e(p.description)+'</p><p>'+cards.length+' 张摘录 · 原话、用途、下一步，一起交接</p></header>'+Object.entries(CATEGORIES).map(([key,cat])=>{
    const group=cards.filter(c=>c.category===key);if(!group.length)return '';
    return '<section class="handoff-section"><h2>'+icon(cat.icon)+cat.label+'</h2>'+group.map(card=>{
      const linked=p.edges.filter(edge=>edge.from===card.id||edge.to===card.id).map(edge=>cards.find(c=>c.id===(edge.from===card.id?edge.to:edge.from))).filter(Boolean);
      return '<article class="handoff-article"><h3>'+e(card.title)+'</h3><label>用途说明</label><p>'+e(card.intent||'待补充用途说明')+'</p><details open><summary>原始摘录</summary><blockquote>'+e(card.quote)+'</blockquote></details><footer><span>来源：'+e(card.source)+'</span>'+(card.sourceUrl?'<a href="'+e(card.sourceUrl)+'" target="_blank" rel="noopener noreferrer">查看出处 ↗</a>':'')+(card.owner?'<span>对接人：'+e(card.owner)+'</span>':'')+'<span>'+(card.status==='done'?'已完成':'待推进')+'</span></footer>'+(card.nextStep?'<p class="next-step">下一步：'+e(card.nextStep)+'</p>':'')+(linked.length?'<p class="next-step">关联：'+linked.map(c=>e(c.title)).join('、')+'</p>':'')+'</article>';
    }).join('')+'</section>';
  }).join('');
  $('handoffDialog').showModal();$('handoffDialog').scrollTop=0;
}
document.addEventListener('click',event=>{
  const close=event.target.closest('[data-close]');if(close)$(close.dataset.close).close();
  const board=event.target.closest('[data-project]');
  if(board){const id=board.dataset.project;mutate(next=>{next.activeProjectId=id;});resetFilters();render();fit();if($('helpDialog').open)$('helpDialog').close();}
  const chip=event.target.closest('[data-filter]');if(chip){filter=chip.dataset.filter;selected.clear();render();fit();}
});
for(const id of ['capturePrimary','captureSecondary','emptyCapture'])$(id).addEventListener('click',()=>newCard());
for(const id of ['helpButton','captureHelp','mobileMenu'])$(id).addEventListener('click',()=>{$('helpDialog').showModal();});
$('newProject').onclick=()=>showProjectDialog();
$('renameProject').onclick=()=>showProjectDialog(true);
$('modelSettings').onclick=openSettings;
$('mobileNew').onclick=()=>{$('helpDialog').close();showProjectDialog();};
$('mobileSettings').onclick=()=>{$('helpDialog').close();openSettings();};
$('cardForm').addEventListener('submit',event=>{
  event.preventDefault();const input=formData();
  if(input.sourceUrl&&!safeUrl(input.sourceUrl)){error('cardError','原始链接仅支持 http 或 https。');return;}
  let card;try{card=makeCard(input);}catch(err){error('cardError',err.message);return;}
  const isEdit=!!editingId,focusId=editingId||card.id;
  if(mutate((next,p)=>{
    if(editingId){
      const old=p.cards.find(c=>c.id===editingId);if(!old)throw new Error('卡片已不存在，请重新打开。');
      Object.assign(old,{...card,id:old.id,x:old.x,y:old.y,createdAt:old.createdAt});
    }else{
      if(next.projects.reduce((n,p)=>n+p.cards.length,0)>=1000)throw new Error('当前工作空间已达到 1000 张卡片上限。');
      const group=p.cards.filter(c=>c.category===card.category);
      if(group.length){card.x=group[0].x;card.y=Math.min(1000000,Math.max(...group.map(c=>c.y))+HEIGHT+28);}
      else{card.x=p.cards.length?Math.min(1000000,Math.max(...p.cards.map(c=>c.x))+356):48;card.y=104;}
      p.cards.push(card);
    }
  })){
    $('cardDialog').close();resetFilters();selected.add(focusId);render();
    const focus=project().cards.find(c=>c.id===focusId),rect=$('canvas').getBoundingClientRect();
    view.scale=Math.max(.75,view.scale);view.x=(rect.width-WIDTH*view.scale)/2-focus.x*view.scale;view.y=Math.max(24,(rect.height-HEIGHT*view.scale)/2)-focus.y*view.scale;syncView();
    toast(isEdit?'摘录与用途说明已更新。':'灵感已收好，可以继续补充或生成交接简报。');
  }
});
$('projectForm').onsubmit=event=>{
  event.preventDefault();const name=$('projectName').value.trim();if(!name){error('projectError','请给画布取一个名字。');return;}
  if(mutate((next,p)=>{
    if(editingProject){p.name=name;p.description=$('projectDescription').value.trim();}
    else{if(next.projects.length>=50)throw new Error('最多支持 50 个工作画布。');const created=createProject(name);created.description=$('projectDescription').value.trim();next.projects.push(created);next.activeProjectId=created.id;}
  })){$('projectDialog').close();resetFilters();render();fit();toast(editingProject?'画布信息已更新。':'新画布已准备好。');}
};
$('settingsForm').onsubmit=event=>{
  event.preventDefault();let url;
  try{url=new URL($('baseUrl').value);if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(url.hostname))))throw new Error();}
  catch{error('settingsError','服务地址需要 HTTPS；本机服务可以使用 HTTP。');return;}
  const model=$('modelName').value.trim();if(!model){error('settingsError','请填写模型名称。');return;}
  aiConfig={baseUrl:url.href.replace(/\/+$/,''),model,apiKey:$('apiKey').value.trim()};
  try{localStorage.setItem('canvas-coworker.model.v1',JSON.stringify({baseUrl:aiConfig.baseUrl,model:aiConfig.model}));}catch{}
  $('apiKey').value='';$('settingsDialog').close();render();toast('配置已保存，点击「AI 提炼建议」才会连接模型。');
};
$('clearModel').onclick=()=>{aiConfig={baseUrl:'',model:'',apiKey:''};try{localStorage.removeItem('canvas-coworker.model.v1');}catch{}$('apiKey').value='';$('settingsDialog').close();render();toast('模型配置已清除，基础功能仍然可用。');};
$('settingsDialog').addEventListener('close',()=>{$('apiKey').value='';});
$('localOrganize').onclick=()=>{
  const data=formData();if(!data.quote.trim()){error('cardError','先粘贴一段原文，再进行整理。');return;}
  $('cardCategory').value=classify(data.quote,data.intent);
  if(!data.title.trim())$('cardTitle').value=(data.intent||data.quote).trim().replace(/\n/g,' ').slice(0,28);
  error('cardError','');toast('已按本地关键词规则推荐分类，仍可手动调整。');
};
$('aiOrganize').onclick=async()=>{
  if(!aiConfig.baseUrl||!aiConfig.model){openSettings();return;}
  const data=formData();if(!data.quote.trim()){error('cardError','先粘贴一段原文，再获取 AI 建议。');return;}
  const current=++requestId;aiController?.abort();aiController=new AbortController();
  const snapshot={quote:data.quote,intent:data.intent};
  $('aiOrganize').disabled=true;$('aiButtonText').textContent='正在提炼…';error('cardError','');$('suggestionBox').hidden=true;
  try{
    const response=await fetch('/api/organize',{method:'POST',headers:{'Content-Type':'application/json','X-Coworker-Request':'1'},signal:aiController.signal,body:JSON.stringify({...aiConfig,quote:data.quote,intent:data.intent})});
    const body=await response.json();if(!response.ok)throw new Error(body.error||'暂时没有获取到建议。');
    if(current!==requestId||!$('cardDialog').open)return;
    if(snapshot.quote!==$('cardQuote').value||snapshot.intent!==$('cardIntent').value){toast('你已修改摘录或用途，请为最新内容重新获取建议。');return;}
    pendingSuggestion={...validateSuggestion(body.suggestion),snapshot};
    $('suggestionText').textContent='标题：'+pendingSuggestion.title+'\n分类：'+CATEGORIES[pendingSuggestion.category].label+'\n用途：'+pendingSuggestion.intent+(pendingSuggestion.nextStep?'\n下一步：'+pendingSuggestion.nextStep:'');
    $('suggestionBox').hidden=false;$('suggestionBox').scrollIntoView({block:'nearest',behavior:'smooth'});
  }catch(err){if(current===requestId&&err.name!=='AbortError')error('cardError',err.message);}
  finally{if(current===requestId){$('aiOrganize').disabled=false;$('aiButtonText').textContent='AI 提炼建议';}}
};
$('applySuggestion').onclick=()=>{
  if(!pendingSuggestion)return;
  if(pendingSuggestion.snapshot.quote!==$('cardQuote').value||pendingSuggestion.snapshot.intent!==$('cardIntent').value){$('suggestionBox').hidden=true;pendingSuggestion=null;toast('内容已变化，请重新获取建议。');return;}
  $('cardTitle').value=pendingSuggestion.title;$('cardCategory').value=pendingSuggestion.category;$('cardIntent').value=pendingSuggestion.intent;
  if(pendingSuggestion.nextStep)$('cardNextStep').value=pendingSuggestion.nextStep;
  $('suggestionBox').hidden=true;pendingSuggestion=null;toast('建议已填入，原始摘录保持完整；保存后应用到画布。');
};
$('dismissSuggestion').onclick=()=>{$('suggestionBox').hidden=true;pendingSuggestion=null;};
$('cardDialog').addEventListener('close',()=>{requestId++;aiController?.abort();pendingSuggestion=null;});
$('cards').addEventListener('click',event=>{const button=event.target.closest('.edit-card');if(button)editCard(button.closest('.card').dataset.id);});
$('cards').addEventListener('dblclick',event=>{if(!event.target.closest('button')){const card=event.target.closest('.card');if(card)editCard(card.dataset.id);}});
$('cards').addEventListener('keydown',event=>{if(event.target.closest('button'))return;const card=event.target.closest('.card');if(card&&event.key==='Enter'){event.preventDefault();editCard(card.dataset.id);}});
$('deleteCard').onclick=()=>{$('confirmDialog').showModal();};
$('confirmDelete').onclick=()=>{
  const id=editingId;
  if(mutate((next,p)=>{p.cards=p.cards.filter(card=>card.id!==id);p.edges=p.edges.filter(edge=>edge.from!==id&&edge.to!==id);})){
    $('confirmDialog').close();$('cardDialog').close();selected.delete(id);syncSelection();toast('卡片已删除，可以撤销恢复。');
  }
};
$('search').oninput=()=>{query=$('search').value.trim().toLowerCase();selected.clear();render();fit();};
$('arrange').onclick=()=>{if(!project().cards.length)return;if(mutate((next,p)=>arrange(p))){fit();toast('已按用途分组排布，内容与分类保持不变。');}};
$('connectCards').onclick=()=>{
  if(selected.size!==2)return;const [from,to]=selected;
  if(project().edges.some(edge=>[edge.from,edge.to].includes(from)&&[edge.from,edge.to].includes(to))){toast('这两张卡已经有关联了。');return;}
  if(project().edges.length>=3000){toast('关联数量已达到上限。');return;}
  mutate((next,p)=>p.edges.push({id:uid(),from,to}));toast('已关联两张卡片，交接简报中也会保留关联。');
};
$('unlinkCards').onclick=()=>{mutate((next,p)=>{p.edges=p.edges.filter(edge=>!selected.has(edge.from)&&!selected.has(edge.to));});toast('选中卡片的关联已解除，可以撤销。');};
$('clearSelection').onclick=()=>{selected.clear();syncSelection();};
function undo(){if(!undoStack.length||externalConflict)return;redoStack.push(JSON.stringify(workspace));workspace=JSON.parse(undoStack.pop());selected.clear();persist();render();toast('已撤销上一步。');}
function redo(){if(!redoStack.length||externalConflict)return;undoStack.push(JSON.stringify(workspace));workspace=JSON.parse(redoStack.pop());selected.clear();persist();render();toast('已重做。');}
$('undo').onclick=undo;$('redo').onclick=redo;$('fit').onclick=fit;
$('zoomIn').onclick=()=>zoom(1.15);$('zoomOut').onclick=()=>zoom(1/1.15);
$('handoffTop').onclick=()=>openHandoff();$('handoffTab').onclick=()=>openHandoff();$('exportSelection').onclick=()=>openHandoff([...selected]);
$('copyHandoff').onclick=async()=>{try{await navigator.clipboard.writeText(handoffMarkdown(project(),handoffIds));toast('已复制 Markdown，可粘贴到团队文档。');}catch{toast('浏览器未允许复制，请使用「下载 .md」。');}};
$('downloadMarkdown').onclick=()=>download(project().name+'-交接.md',handoffMarkdown(project(),handoffIds),'text/markdown');
$('downloadHtml').onclick=()=>download(project().name+'-交接.html',handoffHtml(project(),handoffIds),'text/html');
$('printHandoff').onclick=()=>window.print();
function backup(){download('canvas-coworker-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(workspace,null,2));toast('备份已下载，包含全部画布、卡片和关联。');}
$('backup').onclick=backup;$('mobileBackup').onclick=backup;
$('importButton').onclick=()=>$('importFile').click();$('mobileImport').onclick=()=>$('importFile').click();
$('importFile').onchange=async()=>{
  const file=$('importFile').files[0];if(!file)return;
  try{if(file.size>4*1024*1024)throw new Error('文件超过 4 MB，请选择较小的备份。');const imported=JSON.parse(await file.text());const merged=mergeWorkspace(workspace,imported);
    if(mutate(next=>Object.assign(next,merged))){resetFilters();render();fit();if($('helpDialog').open)$('helpDialog').close();toast('备份已作为新画布导入，现有画布已保留。');}
  }catch(err){toast(err instanceof SyntaxError?'文件不是有效的 JSON，现有内容未修改。':err.message);}
  finally{$('importFile').value='';}
};
let drag=null;
$('canvas').addEventListener('pointerdown',event=>{
  if(event.button!==0||event.target.closest('button,a,.selection-bar,.canvas-controls,.empty-state'))return;
  const node=event.target.closest('.card');
  if(node){
    const card=project().cards.find(card=>card.id===node.dataset.id);if(!card)return;
    if(event.shiftKey){selected.has(card.id)?selected.delete(card.id):selected.add(card.id);}
    else if(!selected.has(card.id)||selected.size!==1){selected=new Set([card.id]);}
    syncSelection();
    drag={type:'card',id:card.id,node,pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:card.x,y:card.y,before:JSON.stringify(workspace),moved:false};
  }else{
    if(!event.shiftKey){selected.clear();syncSelection();}
    drag={type:'pan',pointer:event.pointerId,startX:event.clientX,startY:event.clientY,x:view.x,y:view.y,moved:false};
    $('canvas').classList.add('panning');
  }
  $('canvas').setPointerCapture(event.pointerId);
});
$('canvas').addEventListener('pointermove',event=>{
  if(!drag||drag.pointer!==event.pointerId)return;
  const dx=event.clientX-drag.startX,dy=event.clientY-drag.startY;
  if(!drag.moved&&Math.hypot(dx,dy)<4)return;drag.moved=true;
  if(drag.type==='pan'){view.x=drag.x+dx;view.y=drag.y+dy;syncView();}
  else{
    const card=project().cards.find(c=>c.id===drag.id);if(!card)return;
    card.x=Math.round(Math.max(24,Math.min(1000000,drag.x+dx/view.scale)));card.y=Math.round(Math.max(72,Math.min(1000000,drag.y+dy/view.scale)));
    drag.node.style.left=card.x+'px';drag.node.style.top=card.y+'px';drag.node.classList.add('dragging');renderEdges();
  }
});
function finishDrag(event){
  if(!drag||drag.pointer!==event.pointerId)return;
  const completed=drag;drag=null;$('canvas').classList.remove('panning');
  if(completed.type==='card'&&completed.moved){
    if(externalConflict){workspace=JSON.parse(completed.before);toast('其他标签页已有更新，请备份后刷新。');}
    else{remember(completed.before);persist();}
    render();
  }
  if($('canvas').hasPointerCapture(event.pointerId))$('canvas').releasePointerCapture(event.pointerId);
}
$('canvas').addEventListener('pointerup',finishDrag);$('canvas').addEventListener('pointercancel',finishDrag);
$('canvas').addEventListener('wheel',event=>{
  if(event.target.closest('.selection-bar,.canvas-controls'))return;event.preventDefault();
  if(event.ctrlKey||event.metaKey){const rect=$('canvas').getBoundingClientRect();zoom(Math.exp(-event.deltaY*.004),event.clientX-rect.left,event.clientY-rect.top);}
  else{view.x-=event.deltaX;view.y-=event.deltaY;syncView();}
},{passive:false});
document.addEventListener('keydown',event=>{
  if(document.querySelector('dialog[open]')||event.target.closest('input,textarea,select,[contenteditable]'))return;
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
  else if(!event.ctrlKey&&!event.metaKey&&!event.altKey&&event.key.toLowerCase()==='n'){event.preventDefault();newCard();}
  else if(event.key==='/'){event.preventDefault();$('search').focus();}
  else if(event.key==='Escape'){selected.clear();syncSelection();}
});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY)return;
  if(document.querySelector('dialog[open]')||drag){externalConflict=true;$('storageWarning').hidden=false;$('storageWarning').textContent='另一标签页已更新画布。为避免覆盖，请先复制未保存的文字并备份本页内容，然后刷新。';return;}
  try{workspace=validateWorkspace(JSON.parse(event.newValue));undoStack=[];redoStack=[];resetFilters();render();fit();toast('已同步此浏览器另一标签页的更新。');}
  catch{externalConflict=true;toast('其他标签页的数据发生变化，请先备份，再刷新。');}
});
const captureBase=location.origin+'/';
$('captureBookmark').href='javascript:'+encodeURIComponent('(()=>{const payload={quote:String(window.getSelection()).slice(0,16000),source:document.title.slice(0,100),sourceUrl:location.href.slice(0,2000)};window.open('+JSON.stringify(captureBase)+'+"#capture="+encodeURIComponent(JSON.stringify(payload)),"_blank","noopener,noreferrer");})()');
$('captureBookmark').addEventListener('click',event=>{event.preventDefault();toast('请把这枚按钮拖到独立浏览器的书签栏，再去网页中使用。');});
function readCapture(){
  if(!location.hash.startsWith('#capture='))return;
  const hash=location.hash;history.replaceState(null,'',location.pathname);
  try{
    if(hash.length>150000)throw new Error();
    const data=JSON.parse(decodeURIComponent(hash.slice(9)));
    newCard({quote:typeof data.quote==='string'?data.quote.slice(0,16000):'',source:typeof data.source==='string'?data.source.slice(0,100):'',sourceUrl:safeUrl(data.sourceUrl)});
  }catch{toast('这次网页摘录未能读取，可以直接复制文字后添加。');}
}
window.addEventListener('hashchange',readCapture);
render();persist();requestAnimationFrame(()=>{fit();readCapture();});
