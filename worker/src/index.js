const MODEL = 'gemini-3.6-flash';
const SYSTEM_PROMPT = `You are WARTHOG, an elite War Thunder Ground Realistic Battles tactical assistant. Give the player the best actionable decision supported by retrieved official knowledge and supplied match context. Put urgent actions first, keep combat answers concise, never invent stats, and never claim to see hidden game state. External tactical advice only; do not automate gameplay.`;

function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'}})}
async function githubRefresh(env){
  if(!env.GITHUB_TOKEN || !env.GITHUB_OWNER || !env.GITHUB_REPO) return {ok:false,message:'GitHub refresh is not configured.'};
  const branch=env.GITHUB_BRANCH||'main'; const workflow=env.GITHUB_WORKFLOW||'update-kb.yml';
  const r=await fetch(`https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/actions/workflows/${workflow}/dispatches`,{method:'POST',headers:{'Authorization':`Bearer ${env.GITHUB_TOKEN}`,'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:JSON.stringify({ref:branch})});
  return {ok:r.ok,message:r.ok?'Knowledge refresh requested.':'GitHub refused the refresh request.',status:r.status};
}
async function callGemini(env,input){
  const r=await fetch('https://generativelanguage.googleapis.com/v1/interactions',{method:'POST',headers:{'x-goog-api-key':env.GEMINI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,system_instruction:SYSTEM_PROMPT,input})});
  const j=await r.json(); if(!r.ok) throw new Error(j?.error?.message||'Gemini request failed');
  return j.output_text || j?.outputs?.map(x=>x.text||'').join('') || 'No answer returned.';
}
function retrieval(kb,question,context){
  const q=(question+' '+Object.values(context||{}).join(' ')).toLowerCase();
  const terms=q.split(/[^a-z0-9.+-]+/).filter(x=>x.length>2);
  return (kb?.chunks||[]).map(c=>{const hay=(c.title+' '+c.category+' '+c.text).toLowerCase();let score=c.priority||0;for(const t of terms) if(hay.includes(t)) score+=2;return {...c,score}}).sort((a,b)=>b.score-a.score).slice(0,8);
}
async function answerRequest(env,body){
  const context=body.context||{}; let kb={chunks:[]};
  if(env.PUBLIC_KB_URL){const r=await fetch(env.PUBLIC_KB_URL,{cf:{cacheTtl:300}});if(r.ok) kb=await r.json();}
  const question=body.question||'Answer the spoken question.';
  const hits=retrieval(kb,question,context);
  const contextText=Object.entries(context).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`).join('\n')||'No structured match context supplied.';
  const sources=hits.map(x=>({title:x.title,url:x.source}));
  const evidence=hits.map((x,i)=>`[${i+1}] ${x.title}\n${x.text}\nSOURCE: ${x.source}`).join('\n\n');
  const text=`MATCH CONTEXT:\n${contextText}\n\nPLAYER QUESTION:\n${question}\n\nRETRIEVED OFFICIAL KNOWLEDGE:\n${evidence}\n\nAnswer as Warthog. Put the action first. Use only supported facts; label uncertainty.`;
  const input=[{type:'text',text}];
  if(body.audio_base64){let mime=body.audio_mime_type||'audio/opus';if(mime.includes(';')) mime=mime.split(';')[0];input.push({type:'audio',data:body.audio_base64,mime_type:mime});}
  const answer=await callGemini(env,input); return {answer,sources};
}
export default {async fetch(req,env){
  if(req.method==='OPTIONS') return json({ok:true}); const u=new URL(req.url);
  try{
    if(u.pathname==='/health') return json({ok:true,model:MODEL});
    if(u.pathname==='/status'){
      const base=env.PUBLIC_MANIFEST_URL; if(!base) return json({status:'not_configured'});
      const r=await fetch(base,{cf:{cacheTtl:60}}); if(!r.ok) return json({status:'unavailable'}); return json(await r.json());
    }
    if(u.pathname==='/refresh' && req.method==='POST') return json(await githubRefresh(env));
    if(u.pathname==='/chat' && req.method==='POST') return json(await answerRequest(env,await req.json()));
    return json({error:'Not found'},404);
  }catch(e){return json({error:e.message||String(e)},500)}
}};
