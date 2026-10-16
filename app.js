const API_URL="https://iiqcgmflllmquclpsutm.supabase.co/functions/v1/perhetreeni-api";
const names={mina:"Minä",jenni:"Jenni",rianna:"Rianna"};
let familyPin=sessionStorage.getItem("perhetreeni_pin")||"";
let programs={},active="mina",mode="view",draft=null,workouts=[],cardioSessions=[];
const view=document.getElementById("view");
const loginView=document.getElementById("loginView");
const appView=document.getElementById("appView");
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]))}
function setStatus(ok,text){document.getElementById("statusDot").classList.toggle("ok",ok);document.getElementById("statusText").textContent=text}
function setActiveButton(){document.querySelectorAll(".profile").forEach(x=>x.classList.toggle("active",x.dataset.id===active))}
function showLogin(msg=""){
  appView.hidden=true;
  loginView.hidden=false;
  document.getElementById("pinInput").value="";
  document.getElementById("pinError").textContent=msg;
  setTimeout(()=>document.getElementById("pinInput").focus(),50);
}
async function unlock(){
  const input=document.getElementById("pinInput");
  const err=document.getElementById("pinError");
  familyPin=(input.value||"").trim();
  if(!familyPin){err.textContent="Syötä PIN.";return}
  err.textContent="Tarkistetaan…";
  try{
    const data=await api("getPrograms");
    programs={};for(const p of data.programs)programs[p.profile_key]=p;
    sessionStorage.setItem("perhetreeni_pin",familyPin);
    loginView.hidden=true;appView.hidden=false;
    setStatus(true,"Yhteinen tietokanta käytössä");
    mode="view";render();
  }catch(e){
    familyPin="";sessionStorage.removeItem("perhetreeni_pin");
    err.textContent=e.message;
  }
}
async function api(action,payload={}){
  const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pin:familyPin,action,...payload})});
  let data={};try{data=await res.json()}catch{}
  if(!res.ok)throw new Error(data.error||"Yhteysvirhe");
  return data;
}
document.getElementById("pinBtn").onclick=unlock;
document.getElementById("pinInput").onkeydown=e=>{if(e.key==="Enter")unlock()};
document.getElementById("lockBtn").onclick=()=>{familyPin="";sessionStorage.removeItem("perhetreeni_pin");programs={};workouts=[];cardioSessions=[];showLogin()};
document.querySelectorAll(".profile").forEach(btn=>btn.onclick=()=>{active=btn.dataset.id;mode="view";setActiveButton();render()});
document.getElementById("editBtn").onclick=()=>{mode="edit";draft=JSON.parse(JSON.stringify(programs[active]));render()};
document.getElementById("workoutBtn").onclick=()=>{mode="workout";render()};
document.getElementById("historyBtn").onclick=async()=>{mode="history";view.innerHTML='<div class="card">Ladataan historiaa…</div>';await loadHistory();render()};
document.getElementById("cardioBtn").onclick=async()=>{mode="cardio";view.innerHTML='<div class="card">Ladataan kardioita…</div>';await loadCardio();render()};

function render(){if(mode==="edit")return renderEditor();if(mode==="workout")return renderWorkout();if(mode==="history")return renderHistory();if(mode==="cardio")return renderCardio();renderProgram()}
function renderProgram(){
  const p=programs[active];if(!p){view.innerHTML='<div class="card">Ohjelmaa ei löytynyt.</div>';return}
  const rows=(p.exercises||[]).length?p.exercises.map(e=>`<div class="exercise"><div class="name">${esc(e[0])}</div><div class="badges"><span class="badge">${esc(e[1])}</span>${e[2]?`<span class="badge load">${esc(e[2])}</span>`:""}</div></div>`).join(""):'<div class="empty">Ei vielä liikkeitä.</div>';
  view.innerHTML=`<div class="card"><h2>${esc(p.title)}</h2>${rows}</div>`;
}
function renderEditor(){
  const p=draft;
  view.innerHTML=`<div class="card"><h2>Muokkaa: ${esc(names[active])}</h2><input id="titleInput" value="${esc(p.title)}"><div id="editorRows"></div><button id="addEx" class="btn primary full">+ Lisää liike</button><button id="saveProgram" class="btn primary full">💾 Tallenna yhteiseen tietokantaan</button><button id="cancelEdit" class="btn full">Peruuta</button></div>`;
  document.getElementById("titleInput").oninput=e=>draft.title=e.target.value;
  document.getElementById("addEx").onclick=()=>{draft.exercises.push(["Uusi liike","3 × 10",""]);render()};
  document.getElementById("cancelEdit").onclick=()=>{mode="view";render()};
  document.getElementById("saveProgram").onclick=saveProgram;
  const rows=document.getElementById("editorRows");
  (p.exercises||[]).forEach((e,i)=>{
    const row=document.createElement("div");row.className="editor-row";
    row.innerHTML=`<div class="editor-grid"><input class="exname" value="${esc(e[0])}" placeholder="Liike"><input class="exsets" value="${esc(e[1])}" placeholder="Sarjat/toistot"><input class="exload" value="${esc(e[2]||"")}" placeholder="Kuorma"></div><div class="row-actions"><button class="up">↑ Ylös</button><button class="down">↓ Alas</button><button class="del">Poista</button></div>`;
    row.querySelector(".exname").oninput=ev=>draft.exercises[i][0]=ev.target.value;
    row.querySelector(".exsets").oninput=ev=>draft.exercises[i][1]=ev.target.value;
    row.querySelector(".exload").oninput=ev=>draft.exercises[i][2]=ev.target.value;
    row.querySelector(".up").onclick=()=>move(i,-1);row.querySelector(".down").onclick=()=>move(i,1);
    row.querySelector(".del").onclick=()=>{draft.exercises.splice(i,1);render()};rows.appendChild(row)
  });
}
function move(i,d){const j=i+d;if(j<0||j>=draft.exercises.length)return;[draft.exercises[i],draft.exercises[j]]=[draft.exercises[j],draft.exercises[i]];render()}
async function saveProgram(){
  try{const data=await api("saveProgram",{program:{profile_key:active,title:draft.title,exercises:draft.exercises}});programs[active]=data.program;mode="view";setStatus(true,"Ohjelma tallennettu – näkyy kaikille");render()}catch(e){alert("Tallennus epäonnistui: "+e.message)}
}
function renderWorkout(){
  const p=programs[active],today=new Date().toISOString().slice(0,10);
  const rows=(p.exercises||[]).map((e,i)=>`<div class="work-row"><div class="name">${esc(e[0])}</div><div class="muted">Tavoite: ${esc(e[1])}${e[2]?" · "+esc(e[2]):""}</div><div class="work-grid"><input id="load${i}" value="${esc(e[2]||"")}" placeholder="Kuorma / paino"><input id="reps${i}" placeholder="Tehdyt toistot / sarjat"></div></div>`).join("");
  view.innerHTML=`<div class="card"><h2>Kirjaa treeni: ${esc(names[active])}</h2><input id="workDate" type="date" value="${today}">${rows}<textarea id="workNotes" placeholder="Huomiot"></textarea><button id="saveWorkout" class="btn primary full">✅ Tallenna treeni</button><button id="cancelWorkout" class="btn full">Peruuta</button></div>`;
  document.getElementById("saveWorkout").onclick=saveWorkout;document.getElementById("cancelWorkout").onclick=()=>{mode="view";render()}
}
async function saveWorkout(){
  const p=programs[active];
  const entries=(p.exercises||[]).map((e,i)=>({name:e[0],target:e[1],load:document.getElementById("load"+i).value,reps:document.getElementById("reps"+i).value})).filter(x=>x.load||x.reps);
  try{await api("saveWorkout",{workout:{profile_key:active,workout_date:document.getElementById("workDate").value,title:p.title,entries,notes:document.getElementById("workNotes").value}});mode="history";await loadHistory();setStatus(true,"Treeni tallennettu – näkyy kaikille");render()}catch(e){alert("Tallennus epäonnistui: "+e.message)}
}
async function loadHistory(){try{const data=await api("listWorkouts");workouts=data.workouts||[]}catch(e){workouts=[];alert("Historiaa ei saatu ladattua: "+e.message)}}
function renderHistory(){
  const rows=workouts.length?workouts.map(w=>{const entries=(w.entries||[]).map(e=>`<div class="history-entry">• ${esc(e.name)}: ${esc(e.load||"–")}${e.reps?" · "+esc(e.reps):""}</div>`).join("");return `<div class="history-item"><div class="history-user">${esc(names[w.profile_key]||w.profile_key)}</div><div class="history-date">${esc(w.workout_date)} · ${esc(w.title)}</div><div style="margin-top:7px">${entries||'<div class="muted">Ei kirjattuja liikkeitä.</div>'}</div>${w.notes?`<div class="muted" style="margin-top:7px">${esc(w.notes)}</div>`:""}</div>`}).join(""):'<div class="empty">Ei vielä tallennettuja treenejä.</div>';
  view.innerHTML=`<div class="card"><h2>📚 Yhteinen treenihistoria</h2>${rows}</div>`;
}

async function loadCardio(){
  try{
    const data=await api("listCardio");
    cardioSessions=data.cardio||[];
  }catch(e){
    cardioSessions=[];
    alert("Kardiohistoriaa ei saatu ladattua: "+e.message);
  }
}

function paceText(distance,duration){
  const d=Number(distance),m=Number(duration);
  if(!d||!m||d<=0||m<=0)return "";
  const pace=m/d;
  const min=Math.floor(pace);
  const sec=Math.round((pace-min)*60);
  return min+":"+String(sec).padStart(2,"0")+" min/km";
}

function renderCardio(){
  const today=new Date().toISOString().slice(0,10);
  const recent=cardioSessions.length?cardioSessions.slice(0,12).map(c=>{
    const p=paceText(c.distance_km,c.duration_minutes);
    const details=[
      c.distance_km!=null?Number(c.distance_km).toFixed(2)+" km":"",
      c.duration_minutes!=null?c.duration_minutes+" min":"",
      p,
      c.avg_heart_rate!=null?"❤️ "+c.avg_heart_rate:""
    ].filter(Boolean).join(" · ");
    return `<div class="history-item">
      <div class="history-user">${esc(names[c.profile_key]||c.profile_key)} · ${esc(c.activity_type)}</div>
      <div class="history-date">${esc(c.session_date)}</div>
      <div class="history-entry">${esc(details||"Ei mittaustietoja")}</div>
      ${c.notes?`<div class="muted" style="margin-top:5px">${esc(c.notes)}</div>`:""}
    </div>`;
  }).join(""):'<div class="empty">Ei vielä kirjattuja kardioita tai lenkkejä.</div>';

  view.innerHTML=`
    <div class="card">
      <h2>🏃 Kirjaa kardio / lenkki: ${esc(names[active])}</h2>
      <div class="work-grid">
        <select id="cardioType">
          <option>Juoksu</option>
          <option>Kävely</option>
          <option>Pyöräily</option>
          <option>Crosstrainer</option>
          <option>Soutulaite</option>
          <option>Portaat</option>
          <option>Muu kardio</option>
        </select>
        <input id="cardioDate" type="date" value="${today}">
        <input id="cardioDistance" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Matka km">
        <input id="cardioDuration" type="number" inputmode="numeric" step="1" min="0" placeholder="Aika min">
        <input id="cardioHr" type="number" inputmode="numeric" step="1" min="20" max="250" placeholder="Keskisyke">
      </div>
      <div id="pacePreview" class="muted" style="margin-top:8px"></div>
      <textarea id="cardioNotes" placeholder="Huomiot"></textarea>
      <button id="saveCardio" class="btn primary full">✅ Tallenna kardio</button>
    </div>
    <div class="card">
      <h2>Viimeisimmät kardiot</h2>
      ${recent}
    </div>`;

  const updatePace=()=>{
    const p=paceText(document.getElementById("cardioDistance").value,document.getElementById("cardioDuration").value);
    document.getElementById("pacePreview").textContent=p?"Keskivauhti: "+p:"";
  };
  document.getElementById("cardioDistance").oninput=updatePace;
  document.getElementById("cardioDuration").oninput=updatePace;
  document.getElementById("saveCardio").onclick=saveCardio;
}

async function saveCardio(){
  const payload={
    profile_key:active,
    activity_type:document.getElementById("cardioType").value,
    session_date:document.getElementById("cardioDate").value,
    distance_km:document.getElementById("cardioDistance").value,
    duration_minutes:document.getElementById("cardioDuration").value,
    avg_heart_rate:document.getElementById("cardioHr").value,
    notes:document.getElementById("cardioNotes").value
  };
  try{
    await api("saveCardio",{cardio:payload});
    await loadCardio();
    setStatus(true,"Kardio tallennettu – näkyy kaikille");
    renderCardio();
  }catch(e){
    alert("Kardion tallennus epäonnistui: "+e.message);
  }
}

async function start(){
  if(!familyPin){showLogin();return}
  loginView.hidden=true;appView.hidden=false;
  setStatus(false,"Yhdistetään yhteiseen tietokantaan…");
  try{
    const data=await api("getPrograms");
    programs={};for(const p of data.programs)programs[p.profile_key]=p;
    setStatus(true,"Yhteinen tietokanta käytössä");render();
  }catch(e){
    familyPin="";sessionStorage.removeItem("perhetreeni_pin");
    showLogin("PIN pitää syöttää uudelleen.");
  }
}
start();