import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const PRODUCTS = [
  "Arroz","Fideos","Aceite","Sal","Azúcar","Harina","Atún","Legumbres",
  "Salsa de tomate","Café","Té","Papel higiénico","Toalla nova","Servilletas",
  "Bolsas de basura","Lavaloza","Esponjas","Paños de cocina","Cloro","Limpiapisos",
  "Detergente","Suavizante","Jabón de manos","Pasta de dientes","Film plástico",
  "Papel aluminio","Desinfectante","Limpiavidrios","Escobillón","Pala",
  "Basurero","Guantes de aseo","Fósforos","Velas","Orégano","Cubos de caldo",
  "Mayonesa","Ketchup","Mostaza","Shampoo","Acondicionador","Jabón en barra",
  "Toallitas húmedas","Ambientador","Limpiador multiuso","Paño microfibra",
  "Bicarbonato","Vinagre"
];

const TOTAL_CARDS=20, STORE_NAME="bingo-depa-saguerssss", STATE_KEY="game-state";
const headers={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const out=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const fail=(error,status=400)=>out({error},status);
const empty=()=>({version:1,draws:[],players:[],createdAt:Date.now()});

function rng(seed){let x=seed>>>0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return(x>>>0)/4294967296}}
function shuffleSeeded(arr,seed){const a=[...arr],r=rng(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function card(cardId){const a=shuffleSeeded(PRODUCTS,0x51a9c0+cardId*7919).slice(0,24);a.splice(12,0,"LIBRE 🏠");return a}
function bingo(c,draws){
  const s=new Set(draws), hit=c.map((x,i)=>i===12||s.has(x)), lines=[];
  for(let r=0;r<5;r++)lines.push([0,1,2,3,4].map(col=>r*5+col));
  for(let col=0;col<5;col++)lines.push([0,1,2,3,4].map(r=>r*5+col));
  lines.push([0,6,12,18,24],[4,8,12,16,20]);
  return lines.some(line=>line.every(i=>hit[i]));
}

export default async req=>{
  const url=new URL(req.url), action=url.searchParams.get("action")||"";
  const store=getStore({name:STORE_NAME,consistency:"strong"});
  let state=(await store.get(STATE_KEY,{type:"json",consistency:"strong"}))||empty();
  const save=()=>store.setJSON(STATE_KEY,state);
  const isAdmin=()=>!!process.env.ADMIN_PASSWORD && req.headers.get("x-admin-key")===process.env.ADMIN_PASSWORD;

  if(action==="join" && req.method==="POST"){
    const body=await req.json().catch(()=>({})), name=String(body.name||"").trim().slice(0,30);
    if(name.length<2)return fail("Escribe un nombre válido.");
    if(state.players.length>=TOTAL_CARDS)return fail("Ya se ocuparon los 20 cartones 😭",409);
    const used=new Set(state.players.map(p=>p.cardId));
    const free=[...Array(TOTAL_CARDS).keys()].filter(i=>!used.has(i));
    const cardId=free[Math.floor(Math.random()*free.length)];
    const token=crypto.randomBytes(24).toString("hex");
    state.players.push({id:crypto.randomUUID(),name,cardId,token,joinedAt:Date.now(),claimed:false,claimedAt:null});
    await save();return out({token,cardId});
  }

  if(action==="player-status" && req.method==="GET"){
    const token=req.headers.get("x-player-token"), p=state.players.find(x=>x.token===token);
    if(!p)return fail("Sesión de jugador no válida.",401);
    return out({player:{name:p.name,cardId:p.cardId,claimed:p.claimed},card:card(p.cardId),draws:state.draws,lastDraw:state.draws.at(-1)||null});
  }

  if(action==="claim" && req.method==="POST"){
    const token=req.headers.get("x-player-token"), p=state.players.find(x=>x.token===token);
    if(!p)return fail("Sesión de jugador no válida.",401);
    if(!bingo(card(p.cardId),state.draws))return fail("Todavía no tienes una línea completa 👀");
    p.claimed=true;p.claimedAt=Date.now();await save();return out({ok:true});
  }

  if(action==="admin-status" && req.method==="GET"){
    if(!isAdmin())return fail("No autorizado.",401);
    return out({draws:state.draws,lastDraw:state.draws.at(-1)||null,remaining:PRODUCTS.length-state.draws.length,
      players:state.players.map(p=>({name:p.name,cardId:p.cardId,claimed:p.claimed,claimedAt:p.claimedAt}))});
  }

  if(action==="draw" && req.method==="POST"){
    if(!isAdmin())return fail("No autorizado.",401);
    const remaining=PRODUCTS.filter(x=>!state.draws.includes(x));
    if(!remaining.length)return fail("No quedan productos por sortear.",409);
    const draw=remaining[Math.floor(Math.random()*remaining.length)];
    state.draws.push(draw);await save();return out({draw,count:state.draws.length});
  }

  if(action==="reset" && req.method==="POST"){
    if(!isAdmin())return fail("No autorizado.",401);
    state=empty();await save();return out({ok:true});
  }

  return fail("Ruta no encontrada.",404);
};
