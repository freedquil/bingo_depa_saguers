const $ = s => document.querySelector(s);
const views = Object.fromEntries(["home","playerLogin","player","adminLogin","admin"].map(id=>[id,$("#"+id)]));
let playerToken = localStorage.getItem("bingo_player_token") || "";
let adminKey = sessionStorage.getItem("bingo_admin_key") || "";
let playerTimer, adminTimer;

function show(name){
  Object.values(views).forEach(v=>v.classList.remove("active"));
  views[name].classList.add("active");
  if(name!=="player") clearInterval(playerTimer);
  if(name!=="admin") clearInterval(adminTimer);
}
function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(window.__toast); window.__toast=setTimeout(()=>t.classList.remove("show"),2200);
}
async function api(action,{method="GET",body,admin=false,token}={}){
  const headers={"Content-Type":"application/json"};
  if(admin && adminKey) headers["x-admin-key"]=adminKey;
  const ptoken = token !== undefined ? token : playerToken;
  if(ptoken) headers["x-player-token"]=ptoken;
  const res=await fetch(`/api/game?action=${encodeURIComponent(action)}`,{
    method,headers,body:body?JSON.stringify(body):undefined
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||"Ocurrió un error");
  return data;
}
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>{
  const x=b.dataset.go;
  if(x==="playerLogin" && playerToken) return openPlayer();
  if(x==="adminLogin" && adminKey) return openAdmin();
  show(x);
});

$("#joinForm").onsubmit=async e=>{
  e.preventDefault(); $("#joinError").textContent="";
  try{
    const d=await api("join",{method:"POST",body:{name:$("#playerName").value.trim()},token:""});
    playerToken=d.token; localStorage.setItem("bingo_player_token",playerToken); openPlayer();
  }catch(err){$("#joinError").textContent=err.message}
};
$("#adminForm").onsubmit=async e=>{
  e.preventDefault(); $("#adminError").textContent=""; adminKey=$("#adminKey").value;
  try{
    await api("admin-status",{admin:true});
    sessionStorage.setItem("bingo_admin_key",adminKey); openAdmin();
  }catch{adminKey="";$("#adminError").textContent="Clave incorrecta."}
};
$("#leavePlayer").onclick=()=>{localStorage.removeItem("bingo_player_token");playerToken="";show("home")};
$("#leaveAdmin").onclick=()=>{sessionStorage.removeItem("bingo_admin_key");adminKey="";show("home")};

async function openPlayer(){show("player");await refreshPlayer();playerTimer=setInterval(refreshPlayer,2200)}
async function refreshPlayer(){
  if(!playerToken)return;
  try{
    const s=await api("player-status");
    $("#helloPlayer").textContent=`Hola, ${s.player.name} 👋`;
    $("#lastDraw").textContent=s.lastDraw||"Esperando al admin…";
    $("#drawCount").textContent=`${s.draws.length} producto${s.draws.length===1?"":"s"} sorteado${s.draws.length===1?"":"s"}`;
    renderCard(s.card,s.draws);
    const bingo=hasBingo(s.card,s.draws);
    $("#bingoBanner").classList.toggle("hidden",!bingo);
    $("#claimBingo").disabled=!!s.player.claimed;
    $("#claimBingo").textContent=s.player.claimed?"Bingo avisado ✅":"Avisar al admin";
  }catch(err){
    if(/sesión|token|jugador/i.test(err.message)){
      localStorage.removeItem("bingo_player_token");playerToken="";show("playerLogin");
      $("#joinError").textContent="La partida fue reiniciada. Entra nuevamente.";
    }
  }
}
function renderCard(card,draws){
  const grid=$("#bingoGrid"), set=new Set(draws); grid.innerHTML="";
  card.forEach((item,i)=>{
    const d=document.createElement("div"); d.className="cell";
    if(i===12)d.classList.add("free","marked"); else if(set.has(item))d.classList.add("marked");
    d.textContent=item; grid.appendChild(d);
  });
}
function hasBingo(card,draws){
  const set=new Set(draws), hit=card.map((x,i)=>i===12||set.has(x)), lines=[];
  for(let r=0;r<5;r++)lines.push([0,1,2,3,4].map(c=>r*5+c));
  for(let c=0;c<5;c++)lines.push([0,1,2,3,4].map(r=>r*5+c));
  lines.push([0,6,12,18,24],[4,8,12,16,20]);
  return lines.some(line=>line.every(i=>hit[i]));
}
$("#claimBingo").onclick=async()=>{
  try{await api("claim",{method:"POST",body:{}});toast("¡Bingo enviado al admin! 🎉");refreshPlayer()}
  catch(err){toast(err.message)}
};

async function openAdmin(){show("admin");await refreshAdmin();adminTimer=setInterval(refreshAdmin,2200)}
async function refreshAdmin(){
  try{
    const s=await api("admin-status",{admin:true});
    $("#adminLast").textContent=s.lastDraw||"—";
    $("#playersCount").textContent=s.players.length;
    $("#drawsCount").textContent=s.draws.length;
    $("#remainingCount").textContent=s.remaining;
    $("#drawBtn").disabled=s.remaining===0;
    $("#drawBtn").textContent=s.remaining===0?"No quedan productos":"🎲 Sortear producto";
    const h=$("#history");h.innerHTML=s.draws.length?"":"<small>Aún no sale nada.</small>";
    [...s.draws].reverse().forEach(x=>{const c=document.createElement("span");c.className="chip";c.textContent=x;h.appendChild(c)});
    const p=$("#playersList");p.innerHTML=s.players.length?"":"<small>No hay jugadores todavía.</small>";
    s.players.forEach(x=>{
      const r=document.createElement("div");r.className="player-row"+(x.claimed?" winner":"");
      const left=document.createElement("span");left.textContent=x.name;
      const right=document.createElement("small");right.textContent=`Cartón ${x.cardId+1}${x.claimed?" · ¡BINGO! 🎉":""}`;
      r.append(left,right);p.appendChild(r);
    });
  }catch{sessionStorage.removeItem("bingo_admin_key");adminKey="";show("adminLogin")}
}
$("#drawBtn").onclick=async()=>{try{const r=await api("draw",{method:"POST",body:{},admin:true});toast(`Salió: ${r.draw}`);refreshAdmin()}catch(e){toast(e.message)}};
$("#resetBtn").onclick=async()=>{
  if(!confirm("¿Seguro? Esto borra jugadores, cartones y sorteos."))return;
  try{await api("reset",{method:"POST",body:{},admin:true});toast("Partida reiniciada");refreshAdmin()}catch(e){toast(e.message)}
};

if(playerToken) openPlayer(); else show("home");
