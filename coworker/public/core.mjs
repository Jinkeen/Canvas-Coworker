export const CATEGORIES = {
  idea: { label: '产品启发', short: '启发', color: '#aa683b', background: '#fcf2e6', icon: 'spark' },
  solution: { label: '技术方案', short: '方案', color: '#3d7892', background: '#edf5fa', icon: 'code' },
  action: { label: '行动待办', short: '行动', color: '#5a7b61', background: '#edf5ee', icon: 'check' },
  inbox: { label: '待整理', short: '收集', color: '#7c7291', background: '#f3eff9', icon: 'inbox' },
};
export const WIDTH = 300;
export const HEIGHT = 276;
export const STORAGE_KEY = 'canvas-coworker.workspace.v1';
export const clone = value => JSON.parse(JSON.stringify(value));
export const uid = () => crypto.randomUUID();
const text = (value, max = 16000) => typeof value === 'string' ? value.slice(0, max) : '';
export const safeUrl = value => {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; }
  catch { return ''; }
};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function classify(quote, intent) {
  const content = (intent || quote).toLowerCase();
  const rules = {
    action: /待办|下一步|跟进|安排|截止|负责人|需要确认|验证|测试一下|todo|deadline/g,
    solution: /算法|接口|架构|数据库|缓存|代码|技术|实现|性能|api|debug|token|rag|服务端/g,
    idea: /需求|交互|体验|产品|用户|启发|引导|灵感|设计|内容|文案|选题|营销/g,
  };
  const scores = Object.entries(rules).map(([key, rule]) => [key, [...content.matchAll(rule)].length]);
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] ? scores[0][0] : 'inbox';
}
export function makeCard(input) {
  if (!text(input.quote).trim()) throw new Error('请先粘贴一段原文。');
  return {
    id: uid(), title: text(input.title, 100).trim() || text(text(input.intent).trim() || text(input.quote).trim(), 28).replace(/\n/g, ' '),
    quote: text(input.quote).trim(), intent: text(input.intent).trim(),
    category: Object.hasOwn(CATEGORIES, input.category) ? input.category : classify(input.quote, input.intent),
    source: text(input.source, 100).trim() || '手动摘录', sourceUrl: safeUrl(input.sourceUrl),
    owner: text(input.owner, 60).trim(), nextStep: text(input.nextStep, 2000).trim(),
    status: input.status === 'done' ? 'done' : 'open',
    x: Number.isFinite(input.x) ? Math.max(24, Math.min(1000000, input.x)) : 48,
    y: Number.isFinite(input.y) ? Math.max(72, Math.min(1000000, input.y)) : 104,
    createdAt: typeof input.createdAt === 'string' ? input.createdAt : new Date().toISOString(),
  };
}
export function createProject(name = '未命名画布') {
  return { id: uid(), name: text(name, 80).trim() || '未命名画布', description: '', cards: [], edges: [] };
}
export function arrange(project) {
  let column = 0;
  for (const category of Object.keys(CATEGORIES)) {
    const cards = project.cards.filter(card => card.category === category);
    if (!cards.length) continue;
    cards.forEach((card, row) => { card.x = 48 + column * 356; card.y = 104 + row * (HEIGHT + 28); });
    column++;
  }
  return project;
}
export function initialWorkspace() {
  const project = createProject('新用户引导 · 体验优化');
  project.description = '示例画布 · 把散落在 AI 对话里的想法，变成团队可以接着做的事。';
  const samples = [
    {title:'把第一次使用，变成一次小成功',quote:'与其在首页介绍所有功能，可以先让用户完成一个最小任务，让价值在第一次操作中被感知。',intent:'用于新用户引导改版。把功能介绍改成「创建第一张摘录卡」，让用户直接体验到价值。',category:'idea',source:'AI 对话 · 产品讨论',owner:'产品同事',nextStep:'画一版首次进入的引导流程。'},
    {title:'保留原话，也保留你的判断',quote:'团队交接需要保留信息来源和结论形成的依据，否则接收者只能看到结果，难以判断适用边界。',intent:'交接卡片需要同时呈现摘录和用途说明；在导出的材料里，也要能回到原始出处。',category:'idea',source:'AI 对话 · 协作探索',owner:'设计同事'},
    {title:'先在本地保存，降低使用门槛',quote:'小型原型可以先使用 localStorage 保存结构化数据，以 JSON 导入导出实现基础迁移，后续再考虑服务端同步。',intent:'这是第一版的数据方案。先把单人整理到文件交接的链路做通，减少部署与账号依赖。',category:'solution',source:'Codex · 技术讨论',owner:'开发同事',nextStep:'验证刷新恢复、导入导出和异常文件处理。'},
    {title:'规则整理先走通，再接模型',quote:'先使用有限的类别和确定的排列规则，能够让画布整理结果稳定、可解释，并降低模型输出异常的影响。',intent:'按用途整理为产品启发、技术方案和行动待办。AI 提炼以建议形式出现，确认后再应用。',category:'solution',source:'AI 对话 · 实现思路',owner:'开发同事'},
    {title:'用一次真实交接来验证',quote:'找一位没有参与前期讨论的同事，让他只阅读交接材料，再复述目标、结论和下一步，以验证信息是否足够。',intent:'下次需求评审前做一次小测试，看看同事能否在两分钟内理解这张画布。',category:'action',source:'AI 对话 · 验证方法',owner:'我',nextStep:'收集一份真实对话，做成三张卡后给同事看。'},
    {title:'确认哪些内容需要补证据',quote:'模型提出的判断可以作为候选假设，但重要的用户结论和性能数据应回到访谈记录或实际测试中确认。',intent:'交接前标记待验证项，避免把 AI 推测写成已验证的产品结论。',category:'action',source:'AI 对话 · 评审清单',owner:'我',nextStep:'为关键结论补充原始记录或测试结果。'},
  ];
  project.cards = samples.map(makeCard);
  project.edges = [{id:uid(),from:project.cards[0].id,to:project.cards[4].id}];
  arrange(project);
  return { version: 1, activeProjectId: project.id, projects: [project] };
}
export function validateWorkspace(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.projects) || !input.projects.length || input.projects.length > 50)
    throw new Error('文件格式不受支持，请选择本应用导出的 JSON 备份。');
  let total = 0;
  const projectIds = new Set();
  const projects = input.projects.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id || projectIds.has(item.id) || !Array.isArray(item.cards) || !Array.isArray(item.edges))
      throw new Error('备份中的画布结构不完整。');
    projectIds.add(item.id);
    total += item.cards.length;
    if (total > 1000) throw new Error('备份最多支持 1000 张卡片。');
    const ids = new Set();
    const cards = item.cards.map(card => {
      if (!card || typeof card.id !== 'string' || !card.id || ids.has(card.id) || typeof card.quote !== 'string' || !card.quote.trim())
        throw new Error('备份中有无效或重复的卡片。');
      ids.add(card.id);
      return { ...makeCard(card), id: card.id };
    });
    if (item.edges.length > 3000) throw new Error('备份中的关联过多。');
    const pairs = new Set();
    const edges = item.edges.flatMap(edge => {
      if (!edge || !ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) return [];
      const pair = [edge.from, edge.to].sort().join('|');
      if (pairs.has(pair)) return [];
      pairs.add(pair);
      return [{id:uid(),from:edge.from,to:edge.to}];
    });
    return {id:item.id,name:text(item.name,80).trim() || '导入的画布',description:text(item.description,400),cards,edges};
  });
  return {version:1,activeProjectId:projects.some(p=>p.id===input.activeProjectId)?input.activeProjectId:projects[0].id,projects};
}
export function mergeWorkspace(current, imported) {
  const incoming = validateWorkspace(imported);
  if (current.projects.length + incoming.projects.length > 50 ||
      [...current.projects,...incoming.projects].reduce((n,p)=>n+p.cards.length,0)>1000)
    throw new Error('导入后将超过 50 个画布或 1000 张卡片的上限。');
  const projects = incoming.projects.map(project => {
    const ids = new Map(project.cards.map(card => [card.id,uid()]));
    return {...project,id:uid(),name:project.name+'（导入）',cards:project.cards.map(card=>({...card,id:ids.get(card.id)})),
      edges:project.edges.map(edge=>({...edge,id:uid(),from:ids.get(edge.from),to:ids.get(edge.to)}))};
  });
  return {...clone(current),activeProjectId:projects[0].id,projects:[...current.projects,...projects]};
}
export function handoffMarkdown(project, selectedIds) {
  const cards = selectedIds?.length ? project.cards.filter(c=>selectedIds.includes(c.id)) : project.cards;
  let result = '# '+project.name+'\n\n'+(project.description?project.description+'\n\n':'')+
    '> 共 '+cards.length+' 张摘录卡。用途说明为整理者的判断，原文保留供核对。\n\n';
  for (const [key,cat] of Object.entries(CATEGORIES)) {
    const group = cards.filter(card=>card.category===key);
    if (!group.length) continue;
    result += '## '+cat.label+'\n\n';
    for (const card of group) {
      result += '### '+card.title+'\n\n';
      result += '**用途说明**\n\n'+(card.intent||'待补充用途说明')+'\n\n';
      result += '**原始摘录**\n\n'+card.quote.split('\n').map(line=>'> '+line).join('\n')+'\n\n';
      result += '**来源**：'+card.source+(card.sourceUrl?' '+card.sourceUrl:'')+'\n\n';
      if(card.owner) result+='**对接人**：'+card.owner+'\n\n';
      if(card.nextStep) result+='**下一步**：'+card.nextStep+'\n\n';
      result+='**状态**：'+(card.status==='done'?'已完成':'待推进')+'\n\n';
      const linked=project.edges.filter(e=>e.from===card.id||e.to===card.id).map(e=>cards.find(c=>c.id===(e.from===card.id?e.to:e.from))).filter(Boolean);
      if(linked.length) result+='**关联**：'+linked.map(c=>c.title).join('、')+'\n\n';
    }
  }
  return result;
}
export function handoffHtml(project, selectedIds) {
  const cards = selectedIds?.length ? project.cards.filter(c=>selectedIds.includes(c.id)) : project.cards;
  const e=escapeHtml;
  const groups=Object.entries(CATEGORIES).map(([key,cat])=>{
    const group=cards.filter(c=>c.category===key);
    return group.length?'<section><h2>'+e(cat.label)+'</h2>'+group.map(card=>'<article><h3>'+e(card.title)+'</h3><label>用途说明</label><p>'+e(card.intent||'待补充用途说明')+'</p><details open><summary>原始摘录</summary><blockquote>'+e(card.quote)+'</blockquote></details><footer>来源：'+e(card.source)+(card.sourceUrl?' · <a target="_blank" rel="noopener noreferrer" href="'+e(card.sourceUrl)+'">查看原始出处 ↗</a>':'')+(card.owner?' · 对接人：'+e(card.owner):'')+' · '+(card.status==='done'?'已完成':'待推进')+'</footer>'+(card.nextStep?'<p class="next">下一步：'+e(card.nextStep)+'</p>':'')+(()=>{const linked=project.edges.filter(edge=>edge.from===card.id||edge.to===card.id).map(edge=>cards.find(c=>c.id===(edge.from===card.id?edge.to:edge.from))).filter(Boolean);return linked.length?'<p class="next">关联：'+linked.map(c=>e(c.title)).join('、')+'</p>':'';})()+'</article>').join('')+'</section>':'';
  }).join('');
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+e(project.name)+' · 交接简报</title><style>body{margin:0;background:#f7f8f7;color:#243c35;font:15px/1.8 system-ui,sans-serif}main{max-width:840px;margin:50px auto;padding:40px}h1{font-size:34px;line-height:1.4}h2{margin-top:40px;font-size:18px}h3{margin:0 0 20px;font-size:21px}label,summary{font-size:12px;color:#71837a}article{padding:28px;margin:16px 0;background:white;border:1px solid #dde5df;border-radius:16px;break-inside:avoid}p,blockquote{white-space:pre-wrap;overflow-wrap:anywhere}blockquote{margin:12px 0;padding:12px 16px;border-left:3px solid #d9e5de;background:#f8faf8;color:#627269}footer{font-size:12px;color:#71837a}.next{font-size:14px;color:#416957}a{color:#426f5b}@media print{body{background:white}main{margin:0;padding:0}article{border-color:#ddd}h2{break-after:avoid}}</style><main><small>CANVAS COWORKER / 交接简报</small><h1>'+e(project.name)+'</h1><p>'+e(project.description)+'</p><p>'+cards.length+' 张摘录卡 · 用途说明与原始出处一并保留</p>'+groups+'</main></html>';
}
export function validateSuggestion(input) {
  if (!input || typeof input !== 'object' || !Object.hasOwn(CATEGORIES, input.category) || typeof input.title!=='string' ||
      !input.title.trim() || typeof input.intent!=='string' || !input.intent.trim())
    throw new Error('模型返回的建议格式不完整，原卡片未修改。');
  return {title:input.title.slice(0,100),category:input.category,intent:input.intent.slice(0,4000),nextStep:text(input.nextStep,2000)};
}
