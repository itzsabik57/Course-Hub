const DATA_URL='https://raw.githubusercontent.com/itzsabik57/Course-Hub/main/course-hub-data.json';
let data={platforms:[]};
let route={repo:null,node:null};
let busy=false;
let adminLoggedIn=false;
let accessState={codes:[],activeCodes:[]};
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
function save(){return true}
function makeAccessCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let a='';for(let i=0;i<12;i++)a+=chars[Math.floor(Math.random()*chars.length)];return a.slice(0,4)+'-'+a.slice(4,8)+'-'+a.slice(8)}
function createAccess(btn){const platformId=document.getElementById('accessPlatform')?.value;const courseId=document.getElementById('accessCourse')?.value||'';const subjectId=document.getElementById('accessSubject')?.value||'';if(!platformId)return toast('Select a platform');const r=data.platforms.find(x=>x.id===platformId);if(!r)return toast('Invalid platform');if(courseId&&!r.children?.some(x=>x.id===courseId&&x.type==='course'))return toast('Invalid course');const course=courseId?r.children?.find(x=>x.id===courseId&&x.type==='course'):null;if(subjectId&&(!course||!course.children?.some(x=>x.id===subjectId&&x.type==='subject')))return toast('Invalid subject');if(subjectId&&!courseId)return toast('Select a course first');let code=makeAccessCode();while(accessState.codes.some(x=>x.code===code))code=makeAccessCode();const mode=document.getElementById('accessMode')?.value||'long-term';accessState.codes.push({id:uid(),code,platformId,courseId,subjectId,mode,used:false,createdAt:new Date().toISOString()});if(!saveAccessState()){accessState.codes.pop();return toast('Could not save access code')}openModal('Access Created',`<div class="code-box">${code}</div><div class="code-meta">${mode==='one-time'?'One-time code: it can be redeemed once on this browser/device.':'Long-term code: access stays saved on this browser/device.'}</div><div class="actions"><button class="btn primary" onclick="manageAccess()">Done</button></div>`)}
function deleteAccess(id){if(!confirm('Delete this access code?'))return;accessState.codes=accessState.codes.filter(x=>x.id!==id);if(Array.isArray(accessState.activeCodes))accessState.activeCodes=accessState.activeCodes.filter(x=>x!==id);saveAccessState();manageAccess();render()}
function activeAccessCodes(){return Array.isArray(accessState.activeCodes)?accessState.activeCodes:[]}
function hasNodeAccess(id){return true}
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
async function loadRemoteData(){
  const app=document.getElementById('app');
  app.innerHTML='<div class="loading-screen"><div class="spinner"></div><div>Loading Course Hub…</div></div>';
  try{
    const res=await fetch(DATA_URL+'?v='+Date.now(),{cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const x=await res.json();
    const d=x.data||x;
    if(!Array.isArray(d.platforms))throw new Error('Invalid JSON structure');
    normalize(d);data=d;route={repo:null,node:null};render();
  }catch(e){
    console.error(e);
    app.innerHTML='<div class="empty" style="margin:40px 0">Unable to load course data.<br><small>Check that course-hub-data.json exists in the GitHub repository.</small></div>';
  }
}
loadRemoteData();