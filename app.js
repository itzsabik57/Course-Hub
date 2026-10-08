
const KEY='course_hub_platform_v3';
const GITHUB_CONFIG_KEY='course_hub_github_sync_v1';
const GITHUB_RAW_URL='https://raw.githubusercontent.com/itzsabik57/Course-Hub/main/course-hub-data.json';
const GITHUB_API_BASE='https://api.github.com/repos/itzsabik57/Course-Hub/contents/course-hub-data.json';
let githubReady=false, githubSyncTimer=null, githubSyncBusy=false, githubSyncQueued=false;
let data=readStore();
function githubConfig(){try{return JSON.parse(localStorage.getItem(GITHUB_CONFIG_KEY)||'{}')}catch(e){return {}}}
function setGithubConfig(c){localStorage.setItem(GITHUB_CONFIG_KEY,JSON.stringify(c))}
function utf8ToBase64(str){const bytes=new TextEncoder().encode(str);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(bin)}
function base64ToUtf8(b64){const bin=atob((b64||'').replace(/\s/g,''));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return new TextDecoder().decode(bytes)}
function githubPayload(){return {app:'Course Hub',version:7,exportedAt:new Date().toISOString(),data,accessState:{codes:accessState.codes||[]}}}
function queueGithubSync(){if(!githubReady)return;clearTimeout(githubSyncTimer);githubSyncTimer=setTimeout(()=>syncToGithub(),900)}
async function loadGithubData(){
  try{
    const r=await fetch(GITHUB_RAW_URL+'?t='+Date.now(),{cache:'no-store'});
    if(!r.ok)throw new Error('GitHub JSON HTTP '+r.status);
    const x=await r.json(), d=x.data||x;
    if(!Array.isArray(d.platforms))throw new Error('Invalid Course Hub JSON');
    normalize(d);data=d;
    if(x.accessState&&Array.isArray(x.accessState.codes)){
      const active=Array.isArray(accessState.activeCodes)?accessState.activeCodes:[];
      accessState={codes:x.accessState.codes,activeCodes:active.filter(id=>x.accessState.codes.some(c=>c.id===id))};
    }
    localStorage.setItem(KEY,JSON.stringify(data));localStorage.setItem('course_hub_access_v1',JSON.stringify(accessState));
    return true;
  }catch(e){console.warn('GitHub data load failed:',e);return false}
}
async function syncToGithub(){
  const c=githubConfig();
  if(!c.token||!c.owner||!c.repo||!c.path)return;
  if(githubSyncBusy){githubSyncQueued=true;return}
  githubSyncBusy=true;githubSyncQueued=false;
  try{
    const api=`https://api.github.com/repos/${encodeURIComponent(c.owner)}/${encodeURIComponent(c.repo)}/contents/${c.path.split('/').map(encodeURIComponent).join('/')}`;
    const headers={'Accept':'application/vnd.github+json','Content-Type':'application/json','Authorization':'Bearer '+c.token,'X-GitHub-Api-Version':'2022-11-28'};
    const get=await fetch(api+'?ref='+encodeURIComponent(c.branch||'main'),{headers});
    let sha;
    if(get.ok){const info=await get.json();sha=info.sha}
    const body={message:'Update Course Hub data',content:utf8ToBase64(JSON.stringify(githubPayload(),null,2)),branch:c.branch||'main'};
    if(sha)body.sha=sha;
    const put=await fetch(api,{method:'PUT',headers,body:JSON.stringify(body)});
    if(!put.ok){const msg=await put.text();throw new Error(msg.slice(0,180))}
    toast('GitHub JSON updated');
  }catch(e){console.error('GitHub sync failed:',e);toast('GitHub sync failed')}
  finally{githubSyncBusy=false;if(githubSyncQueued)queueGithubSync()}
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));queueGithubSync();return true}catch(e){console.error(e);return false}}
let route={repo:null,node:null};
let busy=false;
let adminLoggedIn=localStorage.getItem('course_hub_admin')==='1';
let accessState=readAccessState();
function readStore(){
  try{
    let x=JSON.parse(localStorage.getItem(KEY)||'null');
    if(x&&Array.isArray(x.platforms))return x;
    let current=JSON.parse(localStorage.getItem('course_hub_repository_v2')||'null');
    if(current&&Array.isArray(current.repositories))return migrateRepositories(current);
    let old=JSON.parse(localStorage.getItem('course_hub_repository_v1')||'null');
    if(old&&Array.isArray(old.repositories))return migrateRepositories(old);
    let legacy=JSON.parse(localStorage.getItem('course_hub_platform_v2')||'null');
    return legacy&&Array.isArray(legacy.platforms)?migrateLegacy(legacy):{platforms:[]};
  }catch(e){return {platforms:[]}}
}
function migrateRepositories(x){
  const platforms=[];
  (x.repositories||[]).forEach(r=>{
    // Old repositories contained Platform nodes. Flatten those into the new Platform list.
    (r.children||[]).forEach(n=>{if(n.type==='platform')platforms.push(n)});
  });
  return {platforms};
}
function uid(){return 'n_'+Date.now().toString(36)+Math.random().toString(36).slice(2,9)}
function node(type,name=''){return {id:uid(),type,name,image:'',youtube:'',children:[]}}
function migrateLegacy(x){const r={id:uid(),name:'Imported Courses',image:'',children:[]};(x.platforms||[]).forEach(p=>{const pn=node('platform',p.name);pn.image=p.image||'';r.children.push(pn);(p.courses||[]).forEach(c=>{const cn=node('course',c.name);cn.image=c.image||'';pn.children.push(cn);(c.subjects||[]).forEach(s=>{const sn=node('subject',s.name);sn.image=s.image||'';cn.children.push(sn);(s.chapters||[]).forEach(ch=>{const hn=node('chapter',ch.name);sn.children.push(hn);(ch.parts||[]).forEach(pt=>{const pn2=node('chapter-part',pt.name);hn.children.push(pn2);(pt.lectures||[]).forEach(l=>{const ln=node('lecture',l.name);ln.youtube=l.youtube||'';pn2.children.push(ln)})});(ch.lectures||[]).forEach(l=>{const ln=node('lecture',l.name);ln.youtube=l.youtube||'';hn.children.push(ln)})})})})});return {platforms:r.children||[]}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));return true}catch(e){console.error(e);return false}}
function esc(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function toast(t){const e=document.getElementById('toast');e.textContent=t;e.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>e.classList.remove('show'),1900)}
function typeLabel(t){return ({platform:'Platform',course:'Course',subject:'Subject / Cycle',chapter:'Chapter','chapter-part':'Chapter Part',lecture:'Lecture'}[t]||t)}
function icon(t){return ({platform:'▣',course:'▤',subject:'◈',chapter:'☰','chapter-part':'└',lecture:'▶'}[t]||'•')}
function find(root,id){if(root?.id===id)return root;for(const c of(root?.children||[])){const x=find(c,id);if(x)return x}return null}
function parentOf(root,id){if((root.children||[]).some(x=>x.id===id))return root;for(const c of(root.children||[])){const p=parentOf(c,id);if(p)return p}return null}
function repo(){return data.platforms.find(x=>x.id===route.repo)}
function goHome(){route={repo:null,node:null};render();closeModal()}
function goBack(){if(route.node){const r=repo(),p=parentOf(r,route.node);route.node=p&&p.id!==r.id?p.id:null;render()}else if(route.repo)goHome()}
function openRepo(id){route={repo:id,node:null};render()}
function openNode(id){const r=repo(),n=find(r,id);if(!n)return;if(n.type==='lecture'&&n.youtube){window.location.href=n.youtube;return}route.node=id;render()}
function render(){const a=document.getElementById('app');document.getElementById('backBtn').textContent=(route.repo||route.node)?'‹':'⌂';if(!route.repo)return renderHome(a);if(!route.node)return renderRepo(a,repo());return renderNode(a,repo(),find(repo(),route.node))}
function renderHome(a){const visible=isAdmin()?data.platforms:data.platforms.filter(subtreeHasAccess);const cards=visible.map(r=>`<button class="tile" onclick="openRepo('${r.id}')">${r.image?`<img class="tile-img" src="${r.image}" alt="">`:'<div class="tile-img" style="display:grid;place-items:center;font-size:30px;color:#747985">▣</div>'}<div class="tile-shade"></div><div class="tile-body"><div class="tile-title">${esc(r.name)}</div></div></button>`).join('');a.innerHTML=`<div class="page">${visible.length?`<div class="grid">${cards}</div>`:`<div class="empty">${isAdmin()?'No platforms yet.':'Enter an access code to continue.'}</div>`}</div>`}
function renderRepo(a,r){const kids=isAdmin()?(r.children||[]):(r.children||[]).filter(subtreeHasAccess);a.innerHTML=`<div class="page"><div class="page-head"><div><h1 class="title">${esc(r.name)}</h1></div></div>${kids.length?contentHTML(kids):'<div class="empty">No accessible content yet.</div>'}</div>`}
function renderNode(a,r,n){if(!n)return goHome();if(!isAdmin()&&!hasNodeAccess(n.id)&&!subtreeHasAccess(n))return goHome();const kids=isAdmin()?(n.children||[]):(n.children||[]).filter(subtreeHasAccess);const header=(n.type==='course'||n.type==='subject')?`<div class="media-hero"><div class="media-hero-img">${n.image?`<img src="${n.image}" alt="">`:'<div class="media-placeholder">'+(n.type==='course'?'▤':'◈')+'</div>'}<div class="media-hero-shade"></div><div class="media-hero-title">${esc(n.name)}</div></div></div>`:`<div class="hero">${n.image?`<img class="hero-img" src="${n.image}" alt="">`:''}<div><h1 class="hero-title">${esc(n.name)}</h1></div></div>`;a.innerHTML=`<div class="page">${header}${kids.length?contentHTML(kids):'<div class="empty">Nothing has been added here yet.</div>'}</div>`}
function contentHTML(list){if(!list.length)return '<div class="empty">Nothing has been added here yet.</div>';const t=list[0]?.type;if(t==='course')return courseListHTML(list);if(t==='subject')return '<div class="subject-list">'+list.map(n=>`<button class="subject-item" onclick="openNode('${n.id}')">${n.image?`<img class="subject-thumb" src="${n.image}" alt="">`:'<div class="subject-placeholder">◈</div>'}<span class="subject-copy"><span class="subject-title">${esc(n.name)}</span></span><span class="subject-arrow">›</span></button>`).join('')+'</div>';if(t==='lecture')return listHTML(list);if(t==='chapter'||t==='chapter-part')return '<div class="box-grid">'+list.map(n=>`<button class="box-card" onclick="openNode('${n.id}')">${esc(n.name)}</button>`).join('')+'</div>';return '<div class="card-grid">'+list.map(n=>`<button class="content-card" onclick="openNode('${n.id}')">${n.image?`<img src="${n.image}" alt="">`:''}<div class="content-shade"></div><div class="content-name">${esc(n.name)}</div></button>`).join('')+'</div>'}
function courseListHTML(list){return '<div class="course-list">'+list.map(n=>`<button class="course-item" onclick="openNode('${n.id}')">${n.image?`<img class="course-thumb" src="${n.image}" alt="">`:'<div class="course-placeholder">▤</div>'}<span class="course-copy"><span class="course-title">${esc(n.name)}</span></span><span class="course-arrow">›</span></button>`).join('')+'</div>'}
function listHTML(list){return '<div class="list">'+list.map(n=>`<button class="item-card" onclick="openNode('${n.id}')"><span class="item-icon">▶</span><span class="item-copy"><span class="item-name">${esc(n.name)}</span></span><span class="chev">›</span></button>`).join('')+'</div>'}
function openModal(title,html){document.getElementById('modalTitle').textContent=title;document.getElementById('modalContent').innerHTML=html;document.getElementById('modal').classList.add('show');setTimeout(()=>document.querySelector('#modalContent input,#modalContent select')?.focus(),60)}
function closeModal(){document.getElementById('modal').classList.remove('show')}
function readAccessState(){try{const x=JSON.parse(localStorage.getItem('course_hub_access_v1')||'null');if(!x||!Array.isArray(x.codes))return {codes:[],activeCodes:[]};if(!Array.isArray(x.activeCodes))x.activeCodes=[];x.codes=x.codes.filter(c=>c.platformId||Array.isArray(c.nodeIds));return x}catch(e){return {codes:[],activeCodes:[]}}}
function saveAccessState(){try{localStorage.setItem('course_hub_access_v1',JSON.stringify(accessState));queueGithubSync();return true}catch(e){return false}}
function isAdmin(){return adminLoggedIn}
function accessLogin(){const active=activeAccessCodes().length;openModal('Access',`<div class="field"><label>Enter Access Code</label><input id="accessCodeInput" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters"></div><div class="actions"><button class="btn secondary" onclick="adminLogin()">Admin Login</button><button class="btn primary" onclick="redeemAccess(this)">Unlock</button></div>${active?'<button class="btn danger" style="width:100%;margin-top:9px" onclick="removeAccess()">Remove Access</button>':''}<div class="hint">Enter an access code provided by the administrator.</div>`)}
function adminLogin(){openModal('Admin Login',`<div class="field"><label>Username</label><input id="adminUser" value="" autocomplete="username"></div><div class="field"><label>Password</label><input id="adminPass" type="password" autocomplete="current-password"></div><div class="actions"><button class="btn secondary" onclick="accessLogin()">Cancel</button><button class="btn primary" onclick="doAdminLogin()">Login</button></div>`)}
function doAdminLogin(){const u=document.getElementById('adminUser')?.value||'',p=document.getElementById('adminPass')?.value||'';if(u==='admin'&&p==='admin'){adminLoggedIn=true;localStorage.setItem('course_hub_admin','1');adminPanel();toast('Admin login successful')}else toast('Invalid admin login')}
function adminLogout(){adminLoggedIn=false;localStorage.removeItem('course_hub_admin');closeModal();toast('Admin logged out')}
function showSettings(){if(!isAdmin()){accessLogin();return}adminPanel()}
function adminPanel(){openModal('Admin Panel',`<div class="list"><div class="admin-badge">● Admin access</div>
<button class="item-card" onclick="manageRepos()"><span class="item-icon">▣</span><span class="item-copy"><span class="item-name">Edit Platforms & Courses</span></span><span class="chev">›</span></button>
<button class="item-card" onclick="exportData()"><span class="item-icon">↓</span><span class="item-copy"><span class="item-name">Export Course Data</span></span><span class="chev">›</span></button>
<button class="item-card" onclick="document.getElementById('importFile').click()"><span class="item-icon">↑</span><span class="item-copy"><span class="item-name">Import Course Data</span></span><span class="chev">›</span></button>
<input id="importFile" type="file" accept=".json,application/json" hidden onchange="importData(this.files[0])">
<button class="item-card" onclick="manageAccess()"><span class="item-icon">⌁</span><span class="item-copy"><span class="item-name">Access Codes</span></span><span class="chev">›</span></button>
<button class="item-card" onclick="githubSettings()"><span class="item-icon">↻</span><span class="item-copy"><span class="item-name">GitHub JSON Sync</span></span><span class="chev">›</span></button>
<button class="btn danger" style="width:100%;margin-top:5px" onclick="resetAll()">Reset All Data</button><button class="btn secondary" style="width:100%" onclick="adminLogout()">Log Out</button></div>`)}
function githubSettings(){
  if(!isAdmin())return accessLogin();
  const c=githubConfig();
  openModal('GitHub JSON Sync',`<div class="field"><label>GitHub Owner</label><input id="ghOwner" value="${esc(c.owner||'itzsabik57')}" autocomplete="off"></div><div class="field"><label>Repository</label><input id="ghRepo" value="${esc(c.repo||'Course-Hub')}" autocomplete="off"></div><div class="field"><label>Branch</label><input id="ghBranch" value="${esc(c.branch||'main')}" autocomplete="off"></div><div class="field"><label>JSON File Path</label><input id="ghPath" value="${esc(c.path||'course-hub-data.json')}" autocomplete="off"></div><div class="field"><label>GitHub Fine-grained Token</label><input id="ghToken" type="password" value="${esc(c.token||'')}" autocomplete="off" placeholder="Paste token here"></div><div class="actions"><button class="btn secondary" onclick="adminPanel()">Cancel</button><button class="btn primary" onclick="saveGithubSettings()">Save & Sync</button></div>`)
}
async function saveGithubSettings(){
  const c={owner:document.getElementById('ghOwner')?.value.trim(),repo:document.getElementById('ghRepo')?.value.trim(),branch:document.getElementById('ghBranch')?.value.trim()||'main',path:document.getElementById('ghPath')?.value.trim()||'course-hub-data.json',token:document.getElementById('ghToken')?.value.trim()};
  if(!c.owner||!c.repo||!c.path)return toast('Fill in the GitHub settings');
  setGithubConfig(c);closeModal();toast('GitHub settings saved');githubReady=true;queueGithubSync();
}

function manageAccess(){
  if(!isAdmin())return accessLogin();
  openModal('Access Codes',`<button class="btn primary" style="width:100%" onclick="newAccess()">＋ Create New Access</button><div class="divider"></div>${accessState.codes.length?accessState.codes.map(c=>{const r=data.platforms.find(x=>x.id===c.platformId);const course=r?.children?.find(x=>x.id===c.courseId);const subject=course?.children?.find(x=>x.id===c.subjectId);const target=subject?esc(r?.name||'Platform')+' · '+esc(course?.name||'Course')+' · '+esc(subject.name):course?esc(r?.name||'Platform')+' · '+esc(course.name):esc(r?.name||'Platform')+' · Entire Platform';return `<div class="editor"><div class="editor-head"><div class="editor-name">${esc(c.code)}<div class="code-meta">${c.mode==='one-time'?'One-time':'Long-term'} · ${c.used?'Used':'Active'} · ${target}</div></div><div class="editor-actions"><button class="del" onclick="deleteAccess('${c.id}')">Delete</button></div></div></div>`}).join(''):'<div class="empty">No access codes yet.</div>'}`)
}
function accessCourses(){const pid=document.getElementById('accessPlatform')?.value;const r=data.platforms.find(x=>x.id===pid);return r?.children?.filter(x=>x.type==='course')||[]}
function updateAccessCourses(){const list=accessCourses();const el=document.getElementById('accessCourse');const sub=document.getElementById('accessSubject');if(!el)return;el.innerHTML='<option value="">Entire Platform</option>'+list.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');if(sub)sub.innerHTML='<option value="">Entire Course</option>'}
function updateAccessSubjects(){const courseId=document.getElementById('accessCourse')?.value;const platformId=document.getElementById('accessPlatform')?.value;const r=data.platforms.find(x=>x.id===platformId);const c=r?.children?.find(x=>x.id===courseId&&x.type==='course');const el=document.getElementById('accessSubject');if(!el)return;if(!courseId){el.innerHTML='<option value="">Entire Course</option>';return}el.innerHTML='<option value="">Entire Course</option>'+(c?.children||[]).filter(x=>x.type==='subject').map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('')}
function newAccess(){
  if(!isAdmin())return accessLogin();
  const platforms=data.platforms;
  openModal('Create New Access',`<div class="field"><label>Access Type</label><select id="accessMode"><option value="long-term">Long-term</option><option value="one-time">One-time</option></select></div><div class="field"><label>Platform</label><select id="accessPlatform" onchange="updateAccessCourses()"><option value="">Select Platform</option>${platforms.map(r=>`<option value="${r.id}">${esc(r.name)}</option>`).join('')}</select></div><div class="field"><label>Course</label><select id="accessCourse" onchange="updateAccessSubjects()"><option value="">Select a platform first</option></select></div><div class="field"><label>Subject / Cycle</label><select id="accessSubject"><option value="">Select a course first</option></select></div><div class="actions"><button class="btn secondary" onclick="manageAccess()">Cancel</button><button class="btn primary" onclick="createAccess(this)">Create Code</button></div>`)
}
function makeAccessCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let a='';for(let i=0;i<12;i++)a+=chars[Math.floor(Math.random()*chars.length)];return a.slice(0,4)+'-'+a.slice(4,8)+'-'+a.slice(8)}
function createAccess(btn){const platformId=document.getElementById('accessPlatform')?.value;const courseId=document.getElementById('accessCourse')?.value||'';const subjectId=document.getElementById('accessSubject')?.value||'';if(!platformId)return toast('Select a platform');const r=data.platforms.find(x=>x.id===platformId);if(!r)return toast('Invalid platform');if(courseId&&!r.children?.some(x=>x.id===courseId&&x.type==='course'))return toast('Invalid course');const course=courseId?r.children?.find(x=>x.id===courseId&&x.type==='course'):null;if(subjectId&&(!course||!course.children?.some(x=>x.id===subjectId&&x.type==='subject')))return toast('Invalid subject');if(subjectId&&!courseId)return toast('Select a course first');let code=makeAccessCode();while(accessState.codes.some(x=>x.code===code))code=makeAccessCode();const mode=document.getElementById('accessMode')?.value||'long-term';accessState.codes.push({id:uid(),code,platformId,courseId,subjectId,mode,used:false,createdAt:new Date().toISOString()});if(!saveAccessState()){accessState.codes.pop();return toast('Could not save access code')}openModal('Access Created',`<div class="code-box">${code}</div><div class="code-meta">${mode==='one-time'?'One-time code: it can be redeemed once on this browser/device.':'Long-term code: access stays saved on this browser/device.'}</div><div class="actions"><button class="btn primary" onclick="manageAccess()">Done</button></div>`)}
function deleteAccess(id){if(!confirm('Delete this access code?'))return;accessState.codes=accessState.codes.filter(x=>x.id!==id);if(Array.isArray(accessState.activeCodes))accessState.activeCodes=accessState.activeCodes.filter(x=>x!==id);saveAccessState();manageAccess();render()}
function activeAccessCodes(){return Array.isArray(accessState.activeCodes)?accessState.activeCodes:[]}
function hasNodeAccess(id){if(isAdmin())return true;const active=activeAccessCodes();for(const codeId of active){const c=accessState.codes.find(x=>x.id===codeId);if(!c)continue;const r=data.platforms.find(x=>x.id===c.platformId);if(!r)continue;if(r.id===id)return true;if(c.courseId){const course=r.children?.find(x=>x.id===c.courseId&&x.type==='course');if(!course)continue;if(course.id===id)return true;if(c.subjectId){const subject=course.children?.find(x=>x.id===c.subjectId&&x.type==='subject');if(subject&&(subject.id===id||find(subject,id)))return true}else if(find(course,id))return true}else if(find(r,id))return true}return false}
function subtreeHasAccess(n){if(hasNodeAccess(n.id))return true;return (n.children||[]).some(subtreeHasAccess)}
function redeemAccess(btn){const raw=document.getElementById('accessCodeInput')?.value.trim().toUpperCase();if(!raw)return toast('Enter an access code');const c=accessState.codes.find(x=>x.code===raw);if(!c)return toast('Invalid access code');if(c.mode==='one-time'&&c.used)return toast('This one-time code has already been used');accessState.activeCodes=activeAccessCodes();if(!accessState.activeCodes.includes(c.id))accessState.activeCodes.push(c.id);if(c.mode==='one-time')c.used=true;if(!saveAccessState())return toast('Could not save access');closeModal();render();toast('Access unlocked')}
function removeAccess(){const active=activeAccessCodes();if(!active.length)return toast('No active access');if(!confirm('Remove your current access?'))return;accessState.activeCodes=[];if(!saveAccessState())return toast('Could not remove access');closeModal();route={repo:null,node:null};render();toast('Access removed')}
function manageRepos(){openModal('Platforms',`<button class="btn primary" onclick="newRepo()">＋ Add Platform</button><div class="divider"></div>${data.platforms.length?data.platforms.map(r=>`<div class="editor"><div class="editor-head"><div class="editor-name">${icon('platform')} ${esc(r.name)}</div><div class="editor-actions"><button onclick="editRepo('${r.id}')">Edit</button><button onclick="manageRepo('${r.id}')">Open</button><button class="del" onclick="delRepo('${r.id}')">Delete</button></div></div></div>`).join(''):'<div class="empty">No platforms yet.</div>'}`)}
function newRepo(){openModal('Add Platform',`<div class="field"><label>Platform Name</label><input id="repoName" placeholder="e.g. My Academy" autocomplete="off"></div><div class="field"><label>Platform Image</label><input id="repoImg" type="file" accept="image/*"></div><div class="actions"><button class="btn secondary" onclick="manageRepos()">Cancel</button><button class="btn primary" onclick="createRepo(this)">Create</button></div>`)}
async function createRepo(btn){if(busy)return;const v=document.getElementById('repoName')?.value.trim();if(!v){toast('Enter a platform name');return}busy=true;btn.disabled=true;btn.textContent='Creating…';try{const file=document.getElementById('repoImg')?.files?.[0];const img=file?await compressImage(file):'';data.platforms.push({id:uid(),type:'platform',name:v,image:img,youtube:'',children:[]});if(!save())throw new Error('storage full');manageRepos();render();toast('Platform created')}catch(e){data.platforms.pop();toast('Could not save. Try a smaller image.')}finally{busy=false}}
function editRepo(id){const r=data.platforms.find(x=>x.id===id);openModal('Edit Platform',`<div class="field"><label>Platform Name</label><input id="repoName" value="${esc(r.name)}"></div><div class="field"><label>Replace Platform Image</label><input id="repoImg" type="file" accept="image/*"></div><div class="actions"><button class="btn secondary" onclick="manageRepos()">Cancel</button><button class="btn primary" onclick="updateRepo('${id}')">Save</button></div>`)}
async function updateRepo(id){const r=data.platforms.find(x=>x.id===id),v=document.getElementById('repoName')?.value.trim();if(!v)return toast('Enter a platform name');try{const file=document.getElementById('repoImg')?.files?.[0];r.name=v;if(file)r.image=await compressImage(file);if(!save())throw 0;manageRepos();render()}catch(e){toast('Could not save. Try a smaller image.')}}
function delRepo(id){if(!confirm('Delete this platform and everything inside it?'))return;data.platforms=data.platforms.filter(r=>r.id!==id);if(save()){if(route.repo===id)goHome();else manageRepos()}}
function allowedChildren(type){return ['course','subject','chapter','chapter-part','lecture']}
function childButtons(rid,n){return allowedChildren(n.type).map(t=>`<button onclick="newNode('${rid}','${n.id}','${t}')">＋ ${typeLabel(t)}</button>`).join('')}
function manageRepo(id){const r=data.platforms.find(x=>x.id===id);openModal('Platform · '+esc(r.name),`<div>
<div class="toolbar add-toolbar">
<button class="mini-btn primary" onclick="newNode('${id}','${id}','course')">＋ Course</button>
<button class="mini-btn" onclick="newNode('${id}','${id}','subject')">＋ Subject / Cycle</button>
<button class="mini-btn" onclick="newNode('${id}','${id}','chapter')">＋ Chapter</button>
<button class="mini-btn" onclick="newNode('${id}','${id}','chapter-part')">＋ Chapter Part</button>
<button class="mini-btn" onclick="newNode('${id}','${id}','lecture')">＋ Lecture</button>
</div>

<div class="divider"></div><button class="mini-btn" onclick="arrange('${id}','${id}')">↕ Arrange</button><div class="divider"></div>${editorTree(r,r.children||[],id)}</div>`)}
function editorTree(r,list,rid){if(!list.length)return '<div class="empty">Nothing here yet.</div>';return list.map(n=>`<div class="editor"><div class="editor-head"><div class="editor-name">${icon(n.type)} ${esc(n.name)}</div><div class="editor-actions">${childButtons(rid,n)}<button onclick="editNode('${rid}','${n.id}')">Edit</button><button onclick="arrange('${rid}','${n.id}')">Move</button><button class="del" onclick="delNode('${rid}','${n.id}')">Delete</button></div></div>${n.children?.length?'<div class="tree">'+editorTree(r,n.children,rid)+'</div>':''}</div>`).join('')}
function parentOptions(r,current,type){
  if(type==='platform')return '';
  const currentNode=current===r.id?r:find(r,current);
  const rootLabel=currentNode===r?`Platform root · ${esc(r.name)}`:`${esc(currentNode?.name||r.name)} (${typeLabel(currentNode?.type||'platform')})`;
  let s=`<option value="${r.id}" ${current===r.id?'selected':''}>${rootLabel}</option>`;
  const walk=list=>{for(const n of list){if(n.id===current){} s+=`<option value="${n.id}" ${n.id===current?'selected':''}>${esc(n.name)} (${typeLabel(n.type)})</option>`;walk(n.children||[])}};
  walk(r.children||[]);
  return s;
}
function newNode(rid,parentId,type){const r=data.platforms.find(x=>x.id===rid);openModal('Add '+typeLabel(type),`<div class="field"><label>${typeLabel(type)} Name</label><input id="nodeName" placeholder="Enter a name" autocomplete="off"></div>${type==='lecture'?'<div class="field"><label>YouTube Link</label><input id="nodeUrl" type="url" placeholder="https://youtube.com/..." autocomplete="off"></div>':''}${['course','subject'].includes(type)?'<div class="field"><label>Image (optional)</label><input id="nodeImg" type="file" accept="image/*"></div>':''}<div class="field"><label>Put inside</label><select id="nodeParent">${parentOptions(r,parentId,type)}</select></div><div class="actions"><button class="btn secondary" onclick="manageRepo('${rid}')">Cancel</button><button class="btn primary" onclick="createNode('${rid}','${type}',this)">Add</button></div>`)}
async function createNode(rid,type,btn){if(busy)return;const r=data.platforms.find(x=>x.id===rid),name=document.getElementById('nodeName')?.value.trim();if(!name){toast('Enter a name');document.getElementById('nodeName')?.focus();return}const n=node(type,name);if(type==='lecture'){const u=document.getElementById('nodeUrl')?.value.trim();if(!u||!/^https?:\/\//i.test(u)){toast('Enter a valid YouTube URL');return}n.youtube=u}const file=document.getElementById('nodeImg')?.files?.[0];const pid=document.getElementById('nodeParent')?.value||rid;const p=pid===r.id?r:find(r,pid);if(!p)return toast('Invalid parent');busy=true;btn.disabled=true;btn.textContent=file?'Processing image…':'Adding…';try{if(file)n.image=await compressImage(file);p.children=p.children||[];p.children.push(n);if(!save()){p.children.pop();throw new Error('storage full')}manageRepo(rid);render();toast('Added successfully')}catch(e){console.error(e);toast('Could not save. Try a smaller image.')}finally{busy=false}}
function editNode(rid,id){const r=data.platforms.find(x=>x.id===rid),n=find(r,id);openModal('Edit '+typeLabel(n.type),`<div class="field"><label>Name</label><input id="nodeName" value="${esc(n.name)}"></div>${n.type==='lecture'?`<div class="field"><label>YouTube Link</label><input id="nodeUrl" value="${esc(n.youtube||'')}"></div>`:''}${['course','subject'].includes(n.type)?'<div class="field"><label>Replace Image (optional)</label><input id="nodeImg" type="file" accept="image/*"></div>':''}<div class="actions"><button class="btn secondary" onclick="manageRepo('${rid}')">Cancel</button><button class="btn primary" onclick="updateNode('${rid}','${id}',this)">Save</button></div>`)}
async function updateNode(rid,id,btn){if(busy)return;const r=data.platforms.find(x=>x.id===rid),n=find(r,id),name=document.getElementById('nodeName')?.value.trim();if(!name)return toast('Enter a name');const old={name:n.name,image:n.image,youtube:n.youtube};if(n.type==='lecture'){const u=document.getElementById('nodeUrl')?.value.trim();if(!u||!/^https?:\/\//i.test(u)){toast('Enter a valid YouTube URL');return}n.youtube=u}const file=document.getElementById('nodeImg')?.files?.[0];busy=true;btn.disabled=true;btn.textContent=file?'Processing image…':'Saving…';try{n.name=name;if(file)n.image=await compressImage(file);if(!save())throw new Error('storage full');manageRepo(rid);render();toast('Saved successfully')}catch(e){n.name=old.name;n.image=old.image;n.youtube=old.youtube;toast('Could not save. Try a smaller image.')}finally{busy=false}}
function compressImage(file){return new Promise((resolve,reject)=>{if(file.size>15*1024*1024)return reject(new Error('too large'));const fr=new FileReader();fr.onerror=()=>reject(new Error('read'));fr.onload=()=>{const im=new Image();im.onerror=()=>reject(new Error('image'));im.onload=()=>{const max=1200,scale=Math.min(1,max/Math.max(im.naturalWidth,im.naturalHeight)),w=Math.max(1,Math.round(im.naturalWidth*scale)),h=Math.max(1,Math.round(im.naturalHeight*scale)),c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);resolve(c.toDataURL('image/jpeg',.72))};im.src=fr.result};fr.readAsDataURL(file)})}
function delNode(rid,id){const r=data.platforms.find(x=>x.id===rid),p=parentOf(r,id);if(!p)return;if(confirm('Delete this item and everything inside it?')){p.children=p.children.filter(x=>x.id!==id);if(save()){manageRepo(rid);render()}}}
function arrange(rid,id){const r=data.platforms.find(x=>x.id===rid),p=id===r?.id?r:(id?parentOf(r,id):r),list=p?.children||[];openModal(id===r?.id?'Arrange Platform':'Arrange Item',`${list.map(n=>`<div class="editor"><div class="editor-head"><div class="editor-name">${esc(n.name)}</div><div class="editor-actions"><button onclick="shift('${rid}','${p.id}','${n.id}',-1)">↑</button><button onclick="shift('${rid}','${p.id}','${n.id}',1)">↓</button></div></div></div>`).join('')}`)}
function shift(rid,pid,id,d){const r=data.platforms.find(x=>x.id===rid),p=find(r,pid)||r,a=p.children||[],i=a.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=a.length)return;[a[i],a[j]]=[a[j],a[i]];save();arrange(rid,pid===r.id?null:pid);render()}
function exportData(){if(!isAdmin())return accessLogin();const blob=new Blob([JSON.stringify({app:'Course Hub',version:7,exportedAt:new Date().toISOString(),data,accessState},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='course-hub-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);toast('JSON exported')}
function importData(file){if(!isAdmin())return accessLogin();if(!file)return;const fr=new FileReader();fr.onload=()=>{try{const x=JSON.parse(fr.result),d=x.data||x;if(Array.isArray(d.repositories))d=migrateRepositories(d);if(!Array.isArray(d.platforms))throw 0;normalize(d);data=d;if(x.accessState&&Array.isArray(x.accessState.codes))accessState=x.accessState;else accessState={codes:[]};if(!save()||!saveAccessState())throw 0;closeModal();goHome();toast('JSON imported')}catch(e){toast('Invalid Course Hub JSON')}};fr.readAsText(file)}
function normalize(d){(d.platforms||[]).forEach(r=>{r.id=r.id||uid();r.type='platform';r.children=Array.isArray(r.children)?r.children:[];walk(r.children)});function walk(a){a.forEach(n=>{n.id=n.id||uid();n.children=Array.isArray(n.children)?n.children:[];n.image=n.image||'';n.youtube=n.youtube||'';walk(n.children)})}}
function resetAll(){if(!isAdmin())return accessLogin();if(!confirm('Delete ALL course data?'))return;data={platforms:[]};accessState={codes:[]};save();saveAccessState();goHome();toast('All data reset')}
async function boot(){
  normalize(data);
  const loaded=await loadGithubData();
  githubReady=true;
  if(!loaded)save();
  render();
}
boot();
