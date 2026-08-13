const MODEL = 'gemini-3.6-flash';
const MAX_REQUEST_BYTES = 8 * 1024 * 1024;
const MAX_EVIDENCE_CHARS = 36000;
const SYSTEM_PROMPT = `You are WARTHOG, an elite War Thunder Ground Realistic Battles tactical assistant and protégé tank commander.

MISSION: Give the player the best actionable decision supported by retrieved current official War Thunder knowledge and the player's supplied match context. Survival and immediate action come first.

EVIDENCE ORDER: (1) retrieved current official War Thunder Wiki/game documentation, (2) current official War Thunder updates/news, (3) player-provided match information, (4) general tactical reasoning. Never invent vehicle statistics, armor values, penetration, reloads, ammunition properties, BRs, or map facts. If exact information is unavailable, say so and give the best defensible recommendation.

COMBAT STYLE: Put the action first. During an emergency use a short command such as BACK UP NOW, HOLD FIRE, FIRE — TURRET RING, BREAK LEFT, or DISENGAGE, followed by no more than three short supporting points. Normal combat answers should usually be 1–6 short bullets or a compact paragraph.

VEHICLE MATCHUPS: Consider gun, ammunition, effective armor, angle, range, mobility, turret behavior, stabilizer/optics, shot geometry, and escape options. Distinguish reliable, likely, situational, unlikely, and non-viable shots. Do not recommend a merely theoretical penetration if practical kill probability is poor.

AMMUNITION: Recommend the best round for the specific target and engagement. Consider penetration, slope, range, post-penetration effect, fuse behavior, spalling, overpressure where applicable, ERA, composite protection, and spaced armor. Raw penetration is not the same as reliable target destruction.

ARMOR: Consider armor type, angle, slope, spaced armor, ERA, composite protection, ammunition characteristics, and impact geometry rather than nominal thickness alone.

MAPS: Consider firing lanes, cover, concealment, hull-down opportunities, crossfires, escape routes, flanking routes, likely enemy approaches, capture-point pressure, artillery, CAS, SPAA, terrain, and whether a position can actually be exited safely.

CONTEXT: Use supplied nation, vehicle, BR, map, position, enemy, range, direction, ammunition, damage, crew state, team numbers, capture status, spawn points, CAS/SPAA activity, and objective situation. Missing information is unknown. Ask only for one missing fact if it would materially change the recommendation.

HONEST LIMITS: Never claim to see the player's match unless an image is actually supplied. Never claim live server access, game-memory access, hidden client-state access, or automatic identification unless explicitly provided through supported input.

FAIR PLAY: Provide external tactical advice only. Do not automate gameplay, aim, fire, steer, spot, read game memory, inject code, modify game files, or retrieve hidden game state.

DECISION RULE: State the actionable answer first. If avoiding the engagement is best, say so plainly.`;

const CORS = {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'};
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json',...CORS}})}

async function githubRefresh(env,request){
  if(!env.REFRESH_SECRET) return {ok:false,message:'Knowledge refresh is disabled until REFRESH_SECRET is configured.',status:503};
  const supplied=request.headers.get('x-warthog-refresh-secret');
  if(!supplied || supplied!==env.REFRESH_SECRET) return {ok:false,message:'Unauthorized.',status:401};
  if(!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) return {ok:false,message:'GitHub refresh is not configured.',status:503};
  const branch=env.GITHUB_BRANCH||'main';
  const workflow=env.GITHUB_WORKFLOW||'update-kb.yml';
  const r=await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,{method:'POST',headers:{'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:branch})});
  return {ok:r.ok,message:r.ok?'Knowledge refresh requested.':'GitHub refused the refresh request.',status:r.status};
}

function termsFor(question,context){
  return (question+' '+Object.values(context||{}).join(' ')).toLowerCase().split(/[^a-z0-9.+-]+/).filter(x=>x.length>2);
}
function retrieval(kb,question,context){
  const terms=termsFor(question,context);
  const vehicle=(context?.vehicle||'').toLowerCase();
  const enemy=(context?.enemy||'').toLowerCase();
  const map=(context?.map||'').toLowerCase();
  return (kb?.chunks||[]).map(c=>{
    const hay=(c.title+' '+c.category+' '+c.text).toLowerCase();
    let score=(c.priority||0)/10;
    for(const t of terms){ if(hay.includes(t)) score+=1; }
    if(vehicle && hay.includes(vehicle)) score+=18;
    if(enemy && hay.includes(enemy)) score+=18;
    if(map && hay.includes(map)) score+=8;
    if((question||'').toLowerCase().match(/armor|armour|penetrat|pen|weak|shoot|aim/)&&/armor|armour|ammunition|unit\//.test(c.category+' '+c.source)) score+=4;
    if((question||'').toLowerCase().match(/ammo|round|shell|reload/)&&/ammunition|unit\//.test(c.category+' '+c.source)) score+=4;
    if((question||'').toLowerCase().match(/map|position|push|retreat|flank|lane|capture/)&&/location|map|ground|gamemode/.test(c.category+' '+c.source)) score+=4;
    return {...c,score};
  }).sort((a,b)=>b.score-a.score).slice(0,10);
}

function buildInput(body,hits){
  const context=body.context||{};
  const contextText=Object.entries(context).filter(([,v])=>v).map(([k,v])=>`${k}: ${String(v).slice(0,500)}`).join('\n')||'No structured match context supplied.';
  let used=0;
  const evidence=hits.map((x,i)=>{
    const text=String(x.text||'').slice(0,6000);
    const block=`[${i+1}] ${x.title}\n${text}\nSOURCE: ${x.source}`;
    if(used+block.length>MAX_EVIDENCE_CHARS) return '';
    used+=block.length;
    return block;
  }).filter(Boolean).join('\n\n');
  const question=String(body.question||'Answer the spoken question using the supplied audio.').slice(0,3000);
  return {contextText,evidence,question};
}

async function callGemini(env,body,hits){
  if(!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured on the Worker.');
  const built=buildInput(body,hits);
  const input=[{type:'text',text:`MATCH CONTEXT:\n${built.contextText}\n\nPLAYER QUESTION:\n${built.question}\n\nRETRIEVED OFFICIAL KNOWLEDGE:\n${built.evidence}\n\nAnswer as Warthog. Put the action first. Use only supported facts and label uncertainty.`}];
  if(body.audio_base64){
    const mime=(body.audio_mime_type||'audio/webm').split(';')[0].toLowerCase();
    const allowed=['audio/wav','audio/mp3','audio/aiff','audio/aac','audio/ogg','audio/flac','audio/mpeg','audio/m4a','audio/l16','audio/opus','audio/alaw','audio/mulaw','audio/webm'];
    if(!allowed.includes(mime)) throw new Error(`Unsupported audio type: ${mime}`);
    input.push({type:'audio',data:body.audio_base64,mime_type:mime});
  }
  const r=await fetch('https://generativelanguage.googleapis.com/v1/interactions',{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,system_instruction:SYSTEM_PROMPT,input})});
  const j=await r.json();
  if(!r.ok) throw new Error(j?.error?.message||'Gemini request failed');
  return j.output_text || j?.outputs?.filter(x=>x.type==='text').map(x=>x.text||'').join('') || 'No answer returned.';
}

export default {async fetch(req,env){
  if(req.method==='OPTIONS') return json({ok:true});
  if(req.method==='POST'){
    const length=Number(req.headers.get('content-length')||0);
    if(length && length>MAX_REQUEST_BYTES) return json({error:'Request is too large.'},413);
  }
  const u=new URL(req.url);
  try{
    if(u.pathname==='/health') return json({ok:true,model:MODEL,audio_input:true,max_request_mb:MAX_REQUEST_BYTES/1024/1024,refresh_enabled:Boolean(env.REFRESH_SECRET)});
    if(u.pathname==='/status'){
      const base=env.PUBLIC_MANIFEST_URL;
      if(!base) return json({status:'not_configured'});
      const r=await fetch(base,{cf:{cacheTtl:60}}); if(!r.ok) return json({status:'unavailable'});
      return json(await r.json());
    }
    if(u.pathname==='/refresh' && req.method==='POST'){
      const result=await githubRefresh(env,req);
      return json({ok:result.ok,message:result.message},result.status||200);
    }
    if(u.pathname==='/chat' && req.method==='POST'){
      const body=await req.json();
      let kb={chunks:[]};
      if(env.PUBLIC_KB_URL){const r=await fetch(env.PUBLIC_KB_URL,{cf:{cacheTtl:300}});if(r.ok) kb=await r.json();}
      const hits=retrieval(kb,body.question||'spoken question',body.context||{});
      const sources=hits.map(x=>({title:x.title,url:x.source}));
      const answer=await callGemini(env,body,hits);
      return json({answer,sources,knowledge_hits:hits.length});
    }
    return json({error:'Not found'},404);
  }catch(e){return json({error:e.message||String(e)},500)}
}};
