const DATA_URL='https://raw.githubusercontent.com/itzsabik57/Course-Hub/main/course-hub-data.json';
let data={platforms:[]};
let route={repo:null,node:null};
let currentAccount=null;
let allowedIds=new Set();

function toast(t){const e=document.getElementById('toast');if(!e)return;e.textContent=t;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),1900)}
function showError(t){const e=document.getElementById('loginError');if(e)e.textContent=t}
async function sha256(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}

async function login(){
  const id=document.getElementById('loginId')?.value.trim()||'';
  const p=document.getElementById('loginPass')?.value||'';
  if(!id||!p)return showError('Enter your ID and password.');
  try{
    const x=window.__courseData||await loadData();
    const accounts=Array.isArray(x.accounts)?x.accounts:[];
    const hash=await sha256(p);
    const u=accounts.find(a=>String(a.id||'').trim()===id&&a.enabled!==false&&(String(a.password||'')===p||String(a.passwordHash||'').toLowerCase()===hash));
    if(!u)return showError('Invalid ID or password.');
    currentAccount=u;
    allowedIds=new Set(Array.isArray(u.access)?u.access.map(String):[]);
    data=normalizeData(x.data||x);
    if(!allowedIds.size) return showError('No course access has been assigned to this account.');
    sessionStorage.setItem('course_hub_logged_in','1');
    sessionStorage.setItem('course_hub_account',String(u.id));
    document.getElementById('loginScreen').classList.add('public-hide');
    document.getElementById('site').classList.remove('public-hide');
    showError('');
    route={repo:null,node:null};
    render();
  }catch(e){console.error(e);showError('Unable to load course data.')}
}

async function loadData(){
  if(window.__courseData)return window.__courseData;
  const r=await fetch(DATA_URL+'?v='+Date.now(),{cache:'no-store'});
  if(!r.ok)throw new Error('HTTP '+r.status);
  window.__courseData=await r.json();
  return window.__courseData;
}

function normalizeData(x){
  if(Array.isArray(x?.platforms))return {platforms:x.platforms};
  if(Array.isArray(x?.repositories))return {platforms:x.repositories};
  return {platforms:[]};
}
function logout(){sessionStorage.removeItem('course_hub_logged_in');sessionStorage.removeItem('course_hub_account');location.reload()}
function hasDirectAccess(id){return allowedIds.has('*')||allowedIds.has(String(id))}
function subtreeHasAccess(n){if(!n)return false;if(hasDirectAccess(n.id))return true;return (n.children||[]).some(subtreeHasAccess)}
function visibleChildren(n){return (n?.children||[]).filter(subtreeHasAccess)}
function parentAccessVisible(r,n){return subtreeHasAccess(n)}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function find(root,id){if(!root)return null;if(root.id===id)return root;for(const c of(root.children||[])){const x=find(c,id);if(x)return x}return null}
function parentOf(root,id){if(!root)return null;if((root.children||[]).some(x=>x.id===id))return root;for(const c of(root.children||[])){const p=parentOf(c,id);if(p)return p}return null}
function repo(){return data.platforms.find(x=>String(x.id)===String(route.repo))}
function goHome(){route={repo:null,node:null};render()}
function goBack(){if(route.node){const r=repo();const p=parentOf(r,route.node);route.node=p&&p.id!==r.id?p.id:null;render()}else if(route.repo)goHome()}
function openRepo(id){const r=data.platforms.find(x=>String(x.id)===String(id));if(!r)return toast('Platform not found');route={repo:r.id,node:null};render()}
function openNode(id){const r=repo();const n=find(r,id);if(!n)return toast('Content not found');if(!subtreeHasAccess(n))return toast('You do not have access to this content');if(n.type==='lecture'&&n.youtube){window.location.href=n.youtube;return}route.node=n.id;render()}

function render(){
  const a=document.getElementById('app');
  if(!a)return;
  const hasRoute=route.repo||route.node;
  document.getElementById('backBtn').textContent=hasRoute?'‹':'⌂';
  if(!route.repo)return renderHome(a);
  const r=repo();
  if(!r){route={repo:null,node:null};return renderHome(a)}
  if(!route.node)return renderRepo(a,r);
  const n=find(r,route.node);
  if(!n){route.node=null;return renderRepo(a,r)}
  renderNode(a,r,n);
}

function renderHome(a){
  const platforms=data.platforms.filter(subtreeHasAccess);
  a.innerHTML='<div class="page">'+(platforms.length?'<div class="grid">'+platforms.map(r=>`<button type="button" class="tile" data-action="open-repo" data-id="${esc(r.id)}">${r.image?`<img class="tile-img" src="${esc(r.image)}" alt="">`:'<div class="tile-img" style="display:grid;place-items:center;font-size:30px;color:#747985">▣</div>'}<div class="tile-shade"></div><div class="tile-body"><div class="tile-title">${esc(r.name)}</div></div></button>`).join('')+'</div>':'<div class="empty">No platforms yet.</div>')+'</div>';
}
function renderRepo(a,r){const kids=visibleChildren(r);a.innerHTML=`<div class="page"><div class="hero hero-wide">${r.image?`<img class="hero-wide-img" src="${esc(r.image)}" alt="">`:''}<div class="hero-wide-shade"></div><div class="hero-wide-title">${esc(r.name)}</div></div>${kids.length?contentHTML(kids):'<div class="empty">No course access assigned here.</div>'}</div>`}
function renderNode(a,r,n){
  const kids=visibleChildren(n);
  a.innerHTML=`<div class="page"><div class="hero hero-wide">${n.image?`<img class="hero-wide-img" src="${esc(n.image)}" alt="">`:''}<div class="hero-wide-shade"></div><div class="hero-wide-title">${esc(n.name)}</div></div>${kids.length?contentHTML(kids):'<div class="empty">No accessible content here.</div>'}</div>`;
}
function contentHTML(list){
  if(!list.length)return '<div class="empty">Nothing has been added here yet.</div>';
  const visible=list.filter(subtreeHasAccess);
  if(!visible.length)return '<div class="empty">No accessible content here.</div>';
  const t=visible[0]?.type;
  if(t==='lecture')return listHTML(visible);
  if(t==='chapter'||t==='chapter-part')return '<div class="box-grid">'+visible.map(n=>`<button type="button" class="box-card" data-action="open-node" data-id="${esc(n.id)}">${esc(n.name)}</button>`).join('')+'</div>';
  if(t==='course')return '<div class="course-list">'+visible.map(n=>`<button type="button" class="course-item" data-action="open-node" data-id="${esc(n.id)}">${n.image?`<img class="course-thumb" src="${esc(n.image)}" alt="">`:'<div class="course-placeholder">▤</div>'}<span class="course-copy"><span class="course-title">${esc(n.name)}</span></span><span class="course-arrow">›</span></button>`).join('')+'</div>';
  if(t==='subject')return '<div class="subject-list">'+visible.map(n=>`<button type="button" class="subject-item" data-action="open-node" data-id="${esc(n.id)}">${n.image?`<img class="subject-thumb" src="${esc(n.image)}" alt="">`:'<div class="subject-placeholder">◈</div>'}<span class="item-copy"><span class="item-name">${esc(n.name)}</span></span><span class="chev">›</span></button>`).join('')+'</div>';
  return '<div class="card-grid">'+visible.map(n=>`<button type="button" class="content-card" data-action="open-node" data-id="${esc(n.id)}">${n.image?`<img src="${esc(n.image)}" alt="">`:''}<div class="content-shade"></div><div class="content-name">${esc(n.name)}</div><span class="content-arrow">›</span></button>`).join('')+'</div>';
}
function listHTML(list){return '<div class="list">'+list.map(n=>`<button type="button" class="item-card" data-action="open-node" data-id="${esc(n.id)}"><span class="item-icon">▶</span><span class="item-copy"><span class="item-name">${esc(n.name)}</span></span><span class="chev">›</span></button>`).join('')+'</div>'}

// Use event delegation instead of inline onclick handlers so IDs/images/content can never break navigation.
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-action]');
  if(!el)return;
  const action=el.dataset.action,id=el.dataset.id;
  if(action==='open-repo')openRepo(id);
  else if(action==='open-node')openNode(id);
});

document.addEventListener('keydown',e=>{if(e.key==='Enter'&&document.activeElement?.id==='loginPass')login()});

async function boot(){
  try{
    await loadData();
    const savedId=sessionStorage.getItem('course_hub_account');
    if(sessionStorage.getItem('course_hub_logged_in')==='1'&&savedId){
      const accounts=Array.isArray(window.__courseData.accounts)?window.__courseData.accounts:[];
      const u=accounts.find(a=>String(a.id||'').trim()===savedId&&a.enabled!==false);
      if(!u){logout();return;}
      currentAccount=u;allowedIds=new Set(Array.isArray(u.access)?u.access.map(String):[]);
      if(!allowedIds.size){logout();return;}
      data=normalizeData(window.__courseData.data||window.__courseData);
      document.getElementById('loginScreen').classList.add('public-hide');
      document.getElementById('site').classList.remove('public-hide');
      render();
    }
  }catch(e){console.error(e);showError('Unable to load course data from GitHub.')}
}
boot();
