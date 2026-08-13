const WORKER_URL = "https://warthog-ground-rb.memphismade94.workers.dev";
const ids = ["nation","vehicle","br","map","position","enemy","range","ammo","situation"];
const $ = id => document.getElementById(id);
const saved = JSON.parse(localStorage.getItem("warthogContext") || "{}");
ids.forEach(id => { if (saved[id]) $(id).value = saved[id]; $(id).addEventListener("input", saveContext); });
function saveContext(){ const ctx={}; ids.forEach(id=>ctx[id]=$(id).value); localStorage.setItem("warthogContext",JSON.stringify(ctx)); }
function context(){ const c={}; ids.forEach(id=>c[id]=$(id).value.trim()); return c; }
async function status(){
  try{ const r=await fetch(WORKER_URL+"/status"); const j=await r.json(); $("status").textContent=`Knowledge: ${j.status||"unknown"} • ${j.updated_at||"not yet generated"}`; }catch(e){$("status").textContent="Backend unavailable.";}
}
function speak(text){ if(text && "speechSynthesis" in window){ speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } }
async function ask(question){
  $("answer").textContent="Thinking…"; $("sources").textContent="";
  try{
    const body={question,context:context()};
    const r=await fetch(WORKER_URL+"/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const j=await r.json(); if(!r.ok) throw new Error(j.error||"Request failed");
    $("answer").textContent=j.answer||"No answer returned.";
    if(j.sources?.length) $("sources").innerHTML="Sources:<br>"+j.sources.map(s=>`<a href="${s.url}" target="_blank" rel="noopener">${s.title||s.url}</a>`).join("<br>");
    speak(j.answer||"");
  }catch(e){$("answer").textContent="Error: "+e.message;}
}
$("askBtn").onclick=()=>ask($("situation").value.trim()||"Give me the best tactical recommendation for my current situation.");
document.querySelectorAll(".quick button").forEach(b=>b.onclick=()=>ask(b.dataset.q));
$("speakBtn").onclick=()=>speak($("answer").textContent);
$("updateBtn").onclick=async()=>{ $("status").textContent="Checking for knowledge updates…"; try{const r=await fetch(WORKER_URL+"/refresh",{method:"POST"});const j=await r.json();$("status").textContent=j.message||"Refresh requested.";}catch(e){$("status").textContent="Could not request refresh.";}};

// Voice-first input: use the browser's speech recognition when available. This avoids
// sending browser-specific WebM recordings to Gemini; Google's current supported audio
// formats are WAV, MP3, AIFF, AAC, OGG Vorbis and FLAC.
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition=null, listening=false;
if(SpeechRecognition){
  recognition=new SpeechRecognition();
  recognition.lang="en-US";
  recognition.interimResults=true;
  recognition.continuous=false;
  recognition.maxAlternatives=1;
  recognition.onstart=()=>{listening=true;$("talkBtn").classList.add("recording");$("talkBtn").textContent="Listening… Release to Send";};
  recognition.onresult=e=>{
    let finalText="", interim="";
    for(let i=e.resultIndex;i<e.results.length;i++){
      const t=e.results[i][0].transcript;
      if(e.results[i].isFinal) finalText+=t; else interim+=t;
    }
    $("situation").value=(finalText||interim).trim();
  };
  recognition.onerror=e=>{
    listening=false;
    $("talkBtn").classList.remove("recording");
    $("talkBtn").textContent="Hold to Talk";
    if(e.error!=="aborted") $("answer").textContent=`Voice input error: ${e.error}. You can still type your question.`;
  };
  recognition.onend=()=>{
    if(!listening) return;
    listening=false;
    $("talkBtn").classList.remove("recording");
    $("talkBtn").textContent="Hold to Talk";
    const q=$("situation").value.trim();
    if(q) ask(q);
  };
  $("talkBtn").onpointerdown=e=>{e.preventDefault(); if(!listening){$("situation").value="";try{recognition.start();}catch(_){}}};
  $("talkBtn").onpointerup=e=>{e.preventDefault(); if(listening){listening=false;try{recognition.stop();}catch(_){}}};
  $("talkBtn").onpointercancel=()=>{if(listening){listening=false;try{recognition.stop();}catch(_){} }};
}else{
  $("talkBtn").textContent="Voice Not Supported";
  $("talkBtn").title="Use a browser with SpeechRecognition support, or type your question.";
}
status();
