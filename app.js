// ─── CDM 2026 · app.js ───

// Constants
const SBQ = [
  {id:'q1',label:'Vainqueur de la Coupe du Monde',icon:'ti-trophy'},
  {id:'q2',label:'Meilleur buteur du tournoi',icon:'ti-ball-football'},
  {id:'q3',label:'Meilleure équipe (style de jeu)',icon:'ti-star'}
];
const PHASES = ['Groupe A','Groupe B','Groupe C','Groupe D','Groupe E','Groupe F','Groupe G','Groupe H','Groupe I','Groupe J','Groupe K','Groupe L','16e de finale','Huitième de finale','Quart de finale','Demi-finale','3e place','Finale'];
const COLORS = ['#16a34a','#2563eb','#7c3aed','#dc2626','#0891b2','#d97706','#9333ea','#0369a1','#b45309','#0f766e'];
const TABS = [
  {id:'classement',href:'classement.html',icon:'ti-trophy',label:'Classement'},
  {id:'pronos',href:'pronos.html',icon:'ti-pencil',label:'Pronos'},
  {id:'bonus',href:'bonus.html',icon:'ti-star',label:'Bonus'},
  {id:'resultats',href:'resultats.html',icon:'ti-list-details',label:'Résultats'},
  {id:'admin',href:'admin.html',icon:'ti-shield-check',label:'Admin',adminOnly:true}
];

// State
let SB_URL='', SB_KEY='';
let user=null, admin=false, st={};
let pollTimer=null;
const POLL_MS=20000;

// Config/Auth
function loadConfig(){
  SB_URL=localStorage.getItem('cdm_sb_url')||'';
  SB_KEY=localStorage.getItem('cdm_sb_key')||'';
  const u=sessionStorage.getItem('cdm_user');
  if(u)try{user=JSON.parse(u)}catch{}
  admin=sessionStorage.getItem('cdm_admin')==='true';
}
function requireConfig(){
  loadConfig();
  if(!SB_URL||!SB_KEY){window.location.replace('index.html');return false}
  return true;
}
function requireUser(){
  if(!requireConfig())return false;
  if(!user){window.location.replace('login.html');return false}
  return true;
}
function setUser(u,isAdmin=false){
  user=u;admin=isAdmin;
  sessionStorage.setItem('cdm_user',JSON.stringify(u));
  sessionStorage.setItem('cdm_admin',isAdmin?'true':'false');
}
function logout(){
  sessionStorage.removeItem('cdm_user');
  sessionStorage.removeItem('cdm_admin');
  window.location.replace('login.html');
}

// Supabase API
function H(ex={}){return{apikey:SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json',...ex}}
async function sbGet(t,q=''){const r=await fetch(`${SB_URL}/rest/v1/${t}?select=*${q}`,{headers:H()});if(!r.ok)throw new Error(`${t}: ${r.status}`);return r.json()}
async function sbUpsert(t,data){const r=await fetch(`${SB_URL}/rest/v1/${t}`,{method:'POST',headers:H({Prefer:'resolution=merge-duplicates,return=minimal'}),body:JSON.stringify(Array.isArray(data)?data:[data])});if(!r.ok)throw new Error(`Écriture ${t}: ${r.status}`)}
async function sbPatch(t,id,data){const r=await fetch(`${SB_URL}/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:H({Prefer:'return=minimal'}),body:JSON.stringify(data)});if(!r.ok)throw new Error(`Patch ${t}: ${r.status}`)}

async function sbReadAll(){
  const [parts,matches,prons,bonus,br,settings]=await Promise.all([
    sbGet('participants'),sbGet('matches'),sbGet('pronostics'),sbGet('bonus'),sbGet('bonus_results'),sbGet('settings')
  ]);
  const s={};
  s.participants=Object.fromEntries(parts.map(p=>[p.id,p]));
  s.matches=Object.fromEntries(matches.map(m=>[m.id,{...m,homeScore:m.homescore,awayScore:m.awayscore}]));
  s.pronostics=Object.fromEntries(prons.map(p=>[p.id,{...p,participantId:p.participantid,matchId:p.matchid,homeScore:p.homescore,awayScore:p.awayscore}]));
  s.bonus={};
  bonus.forEach(b=>{
    if(!s.bonus[b.participantid])s.bonus[b.participantid]={};
    if(b.questionid==='_locked')s.bonus[b.participantid]._locked=(b.answer==='true');
    else s.bonus[b.participantid][b.questionid]=b.answer;
  });
  s.bonusResults=Object.fromEntries(br.map(r=>[r.id,r.answer]));
  s.settings={adminPwd:(settings.find(x=>x.key==='adminpwd')||{}).value||''};
  return s;
}

// Getters
function getParts(){return Object.values(st.participants||{}).sort((a,b)=>a.name.localeCompare(b.name))}
function getMatches(){return Object.values(st.matches||{}).sort((a,b)=>a.id.localeCompare(b.id))}
function getProns(){return st.pronostics||{}}
function getBonus(){return st.bonus||{}}
function getBR(){return st.bonusResults||{}}

// Points
function calcPts(p,m){
  if(m.homeScore==null)return null;
  if(!p||p.homeScore==null)return 0;
  const ph=+p.homeScore,pa=+p.awayScore,mh=+m.homeScore,ma=+m.awayScore;
  if(ph===mh&&pa===ma)return 3;
  const pw=ph>pa?'h':pa>ph?'a':'d',rw=mh>ma?'h':ma>mh?'a':'d';
  if(pw===rw){if(pw==='d')return 1;if((ph-pa)===(mh-ma))return 2;return 1}
  return 0;
}
function calcTotal(pid){
  let t=0;const pr=getProns(),br=getBR(),bd=getBonus();
  getMatches().forEach(m=>{if(m.homeScore!=null){const pts=calcPts(pr[pid+'_'+m.id],m);if(pts)t+=pts}});
  const ub=bd[pid]||{};
  SBQ.forEach(q=>{const r=br[q.id];if(r&&ub[q.id]&&ub[q.id].trim().toLowerCase()===r.trim().toLowerCase())t+=5});
  return t;
}
function isEditable(m){
  if(m.homeScore!=null)return false;
  if(!m.date)return true;
  const [y,mo,d]=m.date.split('-').map(Number);
  const lk=new Date(y,mo-1,d-1);
  return today()<lk.getFullYear()+'-'+S2(lk.getMonth()+1)+'-'+S2(lk.getDate());
}
function isBonusLocked(){return(!user||user.id==='admin')?false:(getBonus()[user.id]||{})._locked===true}
function isBonusEditable(){
  const fd=getMatches().filter(m=>m.date).sort((a,b)=>a.date.localeCompare(b.date))[0]?.date;
  if(fd&&today()>=fd)return false;
  return!isBonusLocked();
}

// Utils
function today(){const d=new Date();return d.getFullYear()+'-'+S2(d.getMonth()+1)+'-'+S2(d.getDate())}
function S2(n){return String(n).padStart(2,'0')}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function getColor(idx){return COLORS[idx%COLORS.length]}
function getInitials(name){return name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2)}
function toast(msg,type=''){
  const t=document.getElementById('toast');
  if(!t)return;
  t.textContent=msg;t.className='toast'+(type?' '+type:'');t.style.display='block';
  clearTimeout(t._t);t._t=setTimeout(()=>{t.style.display='none'},2500);
}

// Polling
function startPolling(cb){
  if(pollTimer)clearInterval(pollTimer);
  pollTimer=setInterval(async()=>{try{st=await sbReadAll();setSyncBadge(true);cb()}catch{setSyncBadge(false)}},POLL_MS);
}
function stopPolling(){clearInterval(pollTimer);pollTimer=null}
function setSyncBadge(ok){
  const b=document.getElementById('sync-badge');if(!b)return;
  if(ok){const t=new Date().toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'});b.innerHTML=`<i class="ti ti-refresh"></i> ${t}`;b.className='badge b-sync'}
  else{b.innerHTML='<i class="ti ti-wifi-off"></i>';b.className='badge b-red'}
}

// Nav
function buildNav(currentId){
  const nav=document.getElementById('bottom-nav');if(!nav)return;
  nav.innerHTML=TABS.filter(t=>!t.adminOnly||admin)
    .map(t=>`<a class="nav-btn${t.id===currentId?' active':''}" href="${t.href}"><i class="ti ${t.icon}"></i><span>${t.label}</span></a>`)
    .join('');
}
function updateUserBadge(){
  const b=document.getElementById('user-badge');if(!b)return;
  if(admin){b.innerHTML='<i class="ti ti-shield-check"></i> Admin';b.className='badge b-admin'}
  else{b.textContent=user?.name||'';b.className='badge b-green'}
}
