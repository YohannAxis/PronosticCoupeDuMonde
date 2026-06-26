// ─── CDM 2026 · app.js ───

// Constants
const SBQ = [
  {id:'q1',label:'Champion du monde',icon:'ti-trophy',pts:15},
  {id:'q2',label:'Finaliste (équipe 1)',icon:'ti-medal',pts:5},
  {id:'q3',label:'Finaliste (équipe 2)',icon:'ti-medal',pts:5},
  {id:'q4',label:'Meilleur buteur du tournoi',icon:'ti-ball-football',pts:10}
];
const PHASES = ['Groupe A','Groupe B','Groupe C','Groupe D','Groupe E','Groupe F','Groupe G','Groupe H','Groupe I','Groupe J','Groupe K','Groupe L','16e de finale','Huitième de finale','Quart de finale','Demi-finale','3e place','Finale'];
const COLORS = ['#16a34a','#2563eb','#7c3aed','#dc2626','#0891b2','#d97706','#9333ea','#0369a1','#b45309','#0f766e'];

const FLAGS = {
  'Mexique':'🇲🇽','Afrique du Sud':'🇿🇦','Corée du Sud':'🇰🇷','Tchéquie':'🇨🇿',
  'Canada':'🇨🇦','Bosnie-Herzégovine':'🇧🇦','Qatar':'🇶🇦','Suisse':'🇨🇭',
  'Brésil':'🇧🇷','Maroc':'🇲🇦','Haïti':'🇭🇹','Écosse':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'États-Unis':'🇺🇸','Paraguay':'🇵🇾','Australie':'🇦🇺','Turquie':'🇹🇷',
  'Allemagne':'🇩🇪','Curaçao':'🇨🇼',"Côte d'Ivoire":'🇨🇮','Équateur':'🇪🇨',
  'Pays-Bas':'🇳🇱','Japon':'🇯🇵','Suède':'🇸🇪','Tunisie':'🇹🇳',
  'Belgique':'🇧🇪','Égypte':'🇪🇬','Iran':'🇮🇷','Nouvelle-Zélande':'🇳🇿',
  'Espagne':'🇪🇸','Cap-Vert':'🇨🇻','Arabie Saoudite':'🇸🇦','Uruguay':'🇺🇾',
  'France':'🇫🇷','Sénégal':'🇸🇳','Irak':'🇮🇶','Norvège':'🇳🇴',
  'Argentine':'🇦🇷','Algérie':'🇩🇿','Autriche':'🇦🇹','Jordanie':'🇯🇴',
  'Portugal':'🇵🇹','Congo RD':'🇨🇩','Ouzbékistan':'🇺🇿','Colombie':'🇨🇴',
  'Angleterre':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croatie':'🇭🇷','Ghana':'🇬🇭','Panama':'🇵🇦'
};
// Retourne "🇫🇷 France" ou juste "France" si pas de drapeau connu
function teamDisplay(name){const f=FLAGS[name];return(f?f+' ':'')+esc(name)}
function isPH(name){return/^(V\.|1er |2e |3e |Perdant )/.test(name||'')}
function teamLabel(name){return isPH(name)?'<em style="color:var(--t2)">?</em>':teamDisplay(name)}
const TABS = [
  // Onglets joueurs
  {id:'classement',href:'classement.html',icon:'ti-trophy',label:'Classement'},
  {id:'pronos',href:'pronos.html',icon:'ti-pencil',label:'Pronos'},
  {id:'bonus',href:'bonus.html',icon:'ti-star',label:'Bonus'},
  {id:'resultats',href:'resultats.html',icon:'ti-list-details',label:'Résultats'},
  {id:'phase-finale',href:'phase-finale.html',icon:'ti-binary-tree',label:'Finale'},
  {id:'regles',href:'regles.html',icon:'ti-book',label:'Règles'},
  // Onglets admin uniquement
  {id:'admin',href:'admin.html',icon:'ti-settings-2',label:'Scores',adminOnly:true},
  {id:'admin-users',href:'admin-users.html',icon:'ti-users',label:'Joueurs',adminOnly:true}
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
async function sbGetAll(t){
  // Supabase caps at 1000 rows per request — paginate to fetch everything
  const sz=1000;let rows=[],off=0;
  while(true){
    const batch=await sbGet(t,`&limit=${sz}&offset=${off}&order=id.asc`);
    rows=rows.concat(batch);
    if(batch.length<sz)break;
    off+=sz;
  }
  return rows;
}
async function sbUpsert(t,data){
  const body=JSON.stringify(Array.isArray(data)?data:[data]);
  const r=await fetch(`${SB_URL}/rest/v1/${t}`,{
    method:'POST',
    headers:H({Prefer:'resolution=merge-duplicates,return=minimal'}),
    body,
    keepalive:true
  });
  if(!r.ok){const err=await r.text().catch(()=>'');throw new Error(`Écriture ${t}: ${r.status} ${err}`);}
}
async function sbPatch(t,id,data){const r=await fetch(`${SB_URL}/rest/v1/${t}?id=eq.${encodeURIComponent(id)}`,{method:'PATCH',headers:H({Prefer:'return=minimal'}),body:JSON.stringify(data)});if(!r.ok)throw new Error(`Patch ${t}: ${r.status}`)}

async function sbReadAll(){
  const [parts,matches,prons,bonus,br,settings]=await Promise.all([
    sbGet('participants'),sbGet('matches'),sbGetAll('pronostics'),sbGetAll('bonus'),sbGet('bonus_results'),sbGet('settings')
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

// Normalisation floue pour les noms : accents, casse, espaces
function normName(s){
  return(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
}
// Correspondance : exact OU nom partiel (prénom optionnel)
function nameMatch(a,b){
  const na=normName(a),nb=normName(b);
  if(!na||!nb)return false;
  if(na===nb)return true;
  const wa=na.split(' '),wb=nb.split(' ');
  if(wa.length===wb.length)return false; // même nb de mots, différents → pas un match partiel
  const short=wa.length<wb.length?wa:wb,long=wa.length<wb.length?wb:wa;
  return short.every(w=>long.includes(w));
}

// Points match : 5 pts score exact, 3 pts bon résultat (V/N/D), 0 pt sinon
function calcPts(p,m){
  if(m.homeScore==null)return null;
  if(!p||p.homeScore==null)return 0;
  const ph=+p.homeScore,pa=+p.awayScore,mh=+m.homeScore,ma=+m.awayScore;
  if(ph===mh&&pa===ma)return 5;
  const pw=ph>pa?'h':pa>ph?'a':'d',rw=mh>ma?'h':ma>mh?'a':'d';
  return pw===rw?3:0;
}
// Points bonus : champion 15pts, chaque finaliste trouvé 5pts, buteur 10pts
// Comparaison floue : accents, casse, prénom optionnel (nameMatch)
function calcBonusPts(pid){
  const br=getBR(),ub=getBonus()[pid]||{};
  let pts=0;
  // Champion (q1) → 15 pts
  if(nameMatch(ub.q1,br.q1))pts+=15;
  // Finalistes (q2, q3) → 5 pts chacun si trouvé parmi les 2 résultats (ordre indifférent)
  const resF=[br.q2,br.q3].filter(r=>r&&r.trim());
  const predF=[ub.q2,ub.q3].filter(p=>p&&p.trim());
  const used=new Set();
  predF.forEach(pred=>{
    const hit=resF.find(r=>!used.has(r)&&nameMatch(pred,r));
    if(hit){used.add(hit);pts+=5;}
  });
  // Buteur (q4) → 10 pts
  if(nameMatch(ub.q4,br.q4))pts+=10;
  return pts;
}
function calcTotal(pid){
  let t=0;const pr=getProns();
  getMatches().forEach(m=>{if(m.homeScore!=null){const pts=calcPts(pr[pid+'_'+m.id],m);if(pts)t+=pts}});
  return t+calcBonusPts(pid);
}
function isEditable(m){
  if(m.homeScore!=null)return false;
  if(!m.date)return true;
  if(m.time){
    const matchDT=new Date(m.date+'T'+m.time.slice(0,5)+':00');
    if(!isNaN(matchDT.getTime()))return new Date()<new Date(matchDT.getTime()-2*3600000);
  }
  // Pas d'heure connue : éditable jusqu'à la saisie du résultat
  return true;
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
  // Admin voit seulement les onglets admin, les joueurs voient seulement les onglets joueurs
  const visible=TABS.filter(t=>admin ? !!t.adminOnly : !t.adminOnly);
  nav.innerHTML=visible
    .map(t=>`<a class="nav-btn${t.id===currentId?' active':''}" href="${t.href}"><i class="ti ${t.icon}"></i><span>${t.label}</span></a>`)
    .join('');
}
function genId(){return 'p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function updateUserBadge(){
  const b=document.getElementById('user-badge');if(!b)return;
  if(admin){b.innerHTML='<i class="ti ti-shield-check"></i> Admin';b.className='badge b-admin'}
  else{b.textContent=user?.name||'';b.className='badge b-green'}
}
