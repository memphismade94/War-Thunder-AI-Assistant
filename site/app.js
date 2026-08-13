const WORKER_URL = "REPLACE_WITH_CLOUDFLARE_WORKER_URL";
const ids = ["nation","vehicle","br","map","position","enemy","range","ammo","situation"];
const $ = id => document.getElementById(id);
const saved = JSON.parse(localStorage.getItem("warthogContext") || "{}");
ids.forEach(id => { if (saved[id]) $(id).value = saved[id]; $(id).addEventListener("input", saveContext); });
function saveContext(){ const ctx={}; ids.forEach(id=>ctx[id]=$(id).value); localStorage.setItem("warthogContext",JSON.stringify(ctx)); }
function context(){ const c={}; ids.forEach(id=>c[id]=$(id).value.trim()); return c; }
async function status(){
  if(WORKER_URL.startsWith("REPLACE")){ $("status").textContent="Backend not configured yet."; return; }
  try{ const r=await fetch(WORKER_URL+"/status"); const j=await r.json(); $("status").textContent=`Knowledge: ${j.status||"unknown"} • ${j.updated_at||"not yet generated"}`; }catch(e){$("status").textContent="Backend unavailable.";}
}
async function ask(question, audioBase64=null, mimeType=null){
  if(WORKER_URL.startsWith("REPLACE")){ $("answer").textContent="The app is installed, but its Cloudflare Worker URL has not been configured yet."; return; }
  $("answer").textContent="Thinking…"; $("sources").textContent="";
  try{
    const body={question,context:context()};
    if(audioBase64){body.audio_base64=audioBase64;body.audio_mime_type=mimeType;}
    const r=await fetch(WORKER_URL+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json(); if(!r.ok) throw new Error(j.error||"Request failed");
    $("answer").textContent=j.answer||"No answer returned.";
    if(j.sources?.length) $("sources").innerHTML="Sources:<br>"+j.sources.map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${s.title||s.url}</a>`).join("<br>");
  }catch(e){$("answer").textContent="Error: "+e.message;}
}
$("askBtn").onclick=()=>ask($("situation").value.trim()||"Give me the best tactical recommendation for my current situation.");
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>ask(b.dataset.q));
$("speakBtn").onclick=()=>{const t=$("answer").textContent;if(t&&"speechSynthesis" in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t));}};
$("updateBtn").onclick=async()=>{if(WORKER_URL.startsWith("REPLACE")){status();return;} try{const r=await fetch(WORKER_URL+"/refresh",{method:"POST"});const j=await r.json();$("status").textContent=j.message||"Refresh requested.";}catch(e){$("status").textContent="Could not request refresh.";}};
let recorder=null,chunks=[];
$("talkBtn").onpointerdown=async()=>{
  try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});const reader=new FileReader();reader.onloadend=()=>ask("Answer the spoken question and use the provided match context.",reader.result.split(",")[1],blob.type);reader.readAsDataURL(blob);};recorder.start();$("talkBtn").classList.add("recording");$("talkBtn").textContent="Release to Send";}catch(e){$("answer").textContent="Microphone access failed: "+e.message;}};
$("talkBtn").onpointerup=()=>{if(recorder&&recorder.state!=="inactive"){recorder.stop();$("talkBtn").classList.remove("recording");$("talkBtn").textContent="Hold to Talk";}};
status();
