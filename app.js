(() => {
  "use strict";

  const CFG = window.BUILDER_CONFIG || {};
  const CONFIGURED = Boolean(CFG.SUPABASE_URL && !String(CFG.SUPABASE_URL).includes("YOUR_") && CFG.SUPABASE_PUBLISHABLE_KEY && !String(CFG.SUPABASE_PUBLISHABLE_KEY).includes("YOUR_"));
  const sb = CONFIGURED && window.supabase ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_PUBLISHABLE_KEY) : null;
  const STORE_KEY = "builder_universal_v14";
  const V13_VERSION = "13.0.1";
  const ENGINE_VERSION = "13.0.1";
  const uid = () => crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now();
  const now = () => Date.now();
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const safePath = p => typeof p === "string" && p && !p.startsWith("/") && !p.includes("..") && !p.includes("\\");
  const clone = x => JSON.parse(JSON.stringify(x));

  const AGENTS = {
    orchestrator:{label:"Orchestrator",desc:"Coordinates the right specialists, resources, tools and safeguards.",icon:"◎"},
    interviewer:{label:"Interviewer",desc:"Asks only the questions needed to understand the outcome.",icon:"?"},
    planner:{label:"Planner",desc:"Turns intent into a blueprint, requirements and milestones.",icon:"⌘"},
    coding:{label:"Coding",desc:"Builds and refactors software, APIs and technical systems.",icon:"<>"},
    design:{label:"Design",desc:"Shapes interfaces, visual systems, accessibility and responsive behavior.",icon:"✦"},
    commerce:{label:"Commerce",desc:"Understands shops, products, orders, inventory, customers and growth.",icon:"▣"},
    data:{label:"Data",desc:"Designs data models, transformations, analytics and dashboards.",icon:"◫"},
    research:{label:"Research",desc:"Gathers evidence, compares approaches and turns research into decisions.",icon:"⌕"},
    automation:{label:"Automation",desc:"Creates triggers, branching workflows, schedules and durable jobs.",icon:"↻"},
    security:{label:"Security",desc:"Scans secrets, permissions, auth, APIs, dependencies and risky changes.",icon:"◇"},
    qa:{label:"QA",desc:"Tests real user flows, regressions, responsive behavior and edge cases.",icon:"✓"},
    performance:{label:"Performance",desc:"Finds slow paths and optimizes runtime, network, assets and queries.",icon:"↗"},
    marketing:{label:"Growth",desc:"Handles SEO, conversion, content strategy and launch growth loops.",icon:"⌁"},
    deploy:{label:"Ship",desc:"Prepares environments, deployment, domains, releases and rollback.",icon:"→"}
  };

  const CREATION_TYPES = [
    ["App","Full-stack applications, portals and internal tools"],["Website","Marketing sites, portfolios and content experiences"],["Mobile","Mobile-first product experiences and apps"],
    ["Game","Playable projects, scenes, logic, assets and progression"],["Agent","AI agents with memory, tools, triggers and permissions"],["Automation","Operational workflows, schedules and integrations"],
    ["API","Headless services, APIs and backend products"],["Data","Dashboards, analytics apps and data systems"],["Document","Specs, policies, reports and structured documents"],
    ["Presentation","Decks, story-driven slides and visual reports"],["Research","Research projects, analysis and evidence packs"],["Business system","CRM, booking, inventory, operations and business software"],
    ["Creative project","Brand, content, interactive and experimental work"],["Custom","Anything else"],
  ];

  const DEFAULT_STATE = {
    route:"home", projectId:null, panel:"overview", mode:"interview", mobilePreview:false,
    projects:[], activity:[], providers:[], models:[], agentModels:{}, autoRouting:true, requestCount:0,
    defaults:{fast:"auto",balanced:"auto",powerful:"auto",selected:"balanced"}, autonomy:"mostly", demoSession:null, workspaceId:null
  };

  const load = () => {
    try {
      return {...clone(DEFAULT_STATE), ...JSON.parse(localStorage.getItem(STORE_KEY)||"{}")};
    } catch {
      return clone(DEFAULT_STATE);
    }
  };

  let state = load();
  let session = CONFIGURED ? null : state.demoSession;
  let modal = null;

  let ui = {
    motionLevel:"cinematic",
    authMode:"signin",
    authError:"",
    auth:{name:"",email:"",password:""},
    composer:"",
    thinking:false,
    sidebarOpen:false,
    search:"",
    settingsTab:"general",
    resourceTab:"all",
    pendingProvider:null,
    pendingAgent:null,
    interviewStep:0
  };

  function saveLocal(){
    try{
      localStorage.setItem(STORE_KEY,JSON.stringify({...state,demoSession:session}));
    }catch{}
  }

  function toast(message,type="info"){
    const host=$("#toast");
    if(!host)return;
    const el=document.createElement("div");
    el.className=`toast ${type}`;
    el.textContent=message;
    host.appendChild(el);
    setTimeout(()=>el.remove(),3000);
  }

  function formatTime(ts){
    const d=Math.floor((Date.now()-ts)/1000);
    if(d<10)return"just now";
    if(d<60)return`${d}s ago`;
    if(d<3600)return`${Math.floor(d/60)}m ago`;
    if(d<86400)return`${Math.floor(d/3600)}h ago`;
    return`${Math.floor(d/86400)}d ago`;
  }

  function patch(next){
    state={...state,...(typeof next==='function'?next(state):next)};
    saveLocal();
    render();
  }

  function project(){
    return state.projects.find(p=>p.id===state.projectId)||null;
  }

  function updateProject(id,fn){
    const next=state.projects.map(p=>p.id===id?fn(clone(p)):p);
    state={...state,projects:next};
    saveLocal();
    const changed=next.find(p=>p.id===id);
    if(changed)queueCloudSave(changed);
    render();
  }

  function logActivity(line){
    state.activity=[{id:uid(),line,ts:now()},...state.activity].slice(0,80);
    saveLocal();
  }

  const CAPABILITIES = {
    web_building:{label:"Web experience",tests:["build","responsive","navigation"]},
    mobile_building:{label:"Mobile experience",tests:["build","responsive","navigation"]},
    game_runtime:{label:"Interactive runtime",tests:["runtime","input","loop"]},
    document_generation:{label:"Document generation",tests:["structure","export"]},
    spreadsheet_processing:{label:"Spreadsheet/data processing",tests:["schema","mapping","export"]},
    image_generation:{label:"Image/visual assets",tests:["asset","format"]},
    audio_generation:{label:"Audio",tests:["asset","format"]},
    video_workflows:{label:"Video workflow",tests:["asset","timeline"]},
    database_design:{label:"Database",tests:["schema","permissions"]},
    api_creation:{label:"API/service",tests:["endpoints","auth","contract"]},
    browser_automation:{label:"Browser automation",tests:["workflow","permissions"]},
    research:{label:"Research",tests:["sources","evidence"]},
    simulation:{label:"Simulation",tests:["scenario","outcome"]},
    data_analysis:{label:"Data analysis",tests:["quality","analysis"]},
    workflow_automation:{label:"Automation",tests:["trigger","retry"]},
    agent_creation:{label:"AI agent",tests:["tools","permissions","memory"]},
    deployment:{label:"Deployment",tests:["build","health"]},
    export:{label:"Export",tests:["artifact","download"]},
    auth:{label:"Authentication",tests:["auth","permissions"]},
    storage:{label:"File storage",tests:["upload","access"]},
    payments:{label:"Payments",tests:["checkout","webhook"]},
    realtime:{label:"Realtime",tests:["sync"]},
    accessibility:{label:"Accessibility",tests:["keyboard","contrast"]},
    seo:{label:"SEO",tests:["metadata","links"]},
    observability:{label:"Observability",tests:["errors","metrics"]}
  };

  function inferCapabilities(text){
    const x=(text||"").toLowerCase(), out=new Set(["export","accessibility","observability"]);
    const add=(...names)=>names.forEach(n=>out.add(n));

    if(/\b(game|playable|flappy|platformer|rpg|arcade|scene|level)\b/.test(x))
      add("game_runtime","image_generation","audio_generation");

    if(/\b(website|landing|site|portfolio|web page)\b/.test(x))
      add("web_building","seo");

    if(/\b(app|saas|platform|portal|dashboard|crm|booking|store|shop)\b/.test(x))
      add("web_building","database_design","auth","storage");

    if(/\b(shop|store|ecommerce|checkout|cart|inventory|orders|products)\b/.test(x))
      add("payments","realtime");

    if(/\b(mobile|ios|android|phone)\b/.test(x))
      add("mobile_building","api_creation","storage");

    if(/\b(api|endpoint|backend|service|webhook)\b/.test(x))
      add("api_creation","auth","database_design");

    if(/\b(agent|assistant|copilot|autonomous)\b/.test(x))
      add("agent_creation","research","workflow_automation");

    if(/\b(workflow|automation|trigger|schedule|zap|notify)\b/.test(x))
      add("workflow_automation","browser_automation");

    if(/\b(research|study|paper|literature|evidence|competitor|market)\b/.test(x))
      add("research","data_analysis","document_generation");

    if(/\b(dataset|csv|xlsx|spreadsheet|data|analytics|forecast)\b/.test(x))
      add("spreadsheet_processing","data_analysis","database_design");

    if(/\b(pdf|document|report|policy|proposal|resume|contract)\b/.test(x))
      add("document_generation","export");

    if(/\b(slides|presentation|deck)\b/.test(x))
      add("document_generation","image_generation","export");

    if(/\b(video|animation|short film)\b/.test(x))
      add("video_workflows","image_generation","audio_generation");

    return [...out];
  }

  function classify(text){
    return inferCapabilities(text)
      .map(x=>CAPABILITIES[x]?.label||x)
      .slice(0,7);
  }

  function detectType(text){
    const x=(text||"").toLowerCase();

    if(/\b(game|flappy|playable|platformer|rpg|arcade)\b/.test(x))return"Game";
    if(/\b(shop|store|ecommerce|checkout|inventory|orders)\b/.test(x))return"Business system";
    if(/\b(agent|copilot|assistant|autonomous)\b/.test(x))return"Agent";
    if(/\b(workflow|automation)\b/.test(x))return"Automation";
    if(/\b(presentation|slides|deck)\b/.test(x))return"Presentation";
    if(/\b(pdf|document|report|policy)\b/.test(x))return"Document";
    if(/\b(api|endpoint|backend service)\b/.test(x))return"API";
    if(/\b(dataset|spreadsheet|analytics|data)\b/.test(x))return"Data";
    if(/\b(website|landing page|portfolio|site)\b/.test(x))return"Website";
    if(/\b(mobile|ios|android)\b/.test(x))return"Mobile";

    return"App";
  }

  function capabilityPlan(text,type){
    const caps=inferCapabilities(text);
    const required=[...new Set([type,caps.map(c=>CAPABILITIES[c]?.label||c)].flat())];

    return {
      required,
      capabilities:caps.map(id=>({
        id,
        label:CAPABILITIES[id].label,
        tests:CAPABILITIES[id].tests,
        status:"ready"
      }))
    };
  }

  const GAME_RUNTIME = "(()=>{const c=document.getElementById('game'),ctx=c.getContext('2d'),o=document.getElementById('overlay'),start=document.getElementById('start'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best');let bird,pipes,score,best=Number(localStorage.getItem('builder-best')||0),running=false,last=0;bestEl.textContent=best;function reset(){bird={x:115,y:300,vy:0,r:16};pipes=[];score=0;scoreEl.textContent='0';for(let i=0;i<4;i++)pipes.push({x:520+i*155,gap:170+Math.random()*60,top:90+Math.random()*280,passed:false})}function flap(){if(!running){startGame();return}bird.vy=-7}function startGame(){reset();running=true;o.hidden=true;last=performance.now();requestAnimationFrame(loop)}function end(){running=false;o.hidden=false;o.querySelector('h1').textContent='Game over';o.querySelector('p').textContent='Press Start or Space to try again';start.textContent='Restart';if(score>best){best=score;localStorage.setItem('builder-best',best);bestEl.textContent=best}}function loop(t){if(!running)return;const dt=Math.min(32,t-last)/16.67;last=t;bird.vy+=.42*dt;bird.y+=bird.vy*dt;pipes.forEach(p=>{p.x-=2.7*dt;if(!p.passed&&p.x+58<bird.x){p.passed=true;score++;scoreEl.textContent=score}});while(pipes.length&&pipes[0].x<-80)pipes.shift();if(pipes[pipes.length-1].x<360)pipes.push({x:520,gap:170+Math.random()*60,top:70+Math.random()*300,passed:false});draw();const hit=bird.y-bird.r<0||bird.y+bird.r>c.height||pipes.some(p=>{const bottom=p.top+p.gap;return bird.x+bird.r>p.x&&bird.x-bird.r<p.x+58&&(bird.y-bird.r<p.top||bird.y+bird.r>bottom)});if(hit)return end();requestAnimationFrame(loop)}function draw(){ctx.clearRect(0,0,c.width,c.height);const g=ctx.createLinearGradient(0,0,0,c.height);g.addColorStop(0,'#8fd8ff');g.addColorStop(1,'#eef8ff');ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#72c66d';pipes.forEach(p=>{ctx.fillRect(p.x,0,58,p.top);ctx.fillRect(p.x,p.top+p.gap,58,c.height-(p.top+p.gap));ctx.fillStyle='#4d9c4a';ctx.fillRect(p.x-4,p.top-12,66,12);ctx.fillRect(p.x-4,p.top+p.gap,66,12);ctx.fillStyle='#72c66d'});ctx.fillStyle='#f4c542';ctx.beginPath();ctx.arc(bird.x,bird.y,bird.r,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(bird.x+6,bird.y-5,5,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111';ctx.beginPath();ctx.arc(bird.x+8,bird.y-5,2,0,Math.PI*2);ctx.fill()}start.addEventListener('click',startGame);c.addEventListener('pointerdown',flap);addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();flap()}});reset();draw()})()";

  function starterFiles(title,type){
    const safeTitle=esc(title);
    const isGame=type==="Game";

    if(isGame){
      return {
        "index.html":`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><link rel="stylesheet" href="styles.css"></head><body><main class="game-shell"><header><b>${safeTitle}</b><span>PLAYTEST</span></header><div class="game-wrap"><canvas id="game" width="480" height="720" aria-label="Playable game"></canvas><div class="game-overlay" id="overlay"><h1>${safeTitle}</h1><p>Press Space, click or tap to flap.</p><button id="start">Start</button></div></div><p class="hint">Best score: <span id="best">0</span> · Score: <span id="score">0</span></p></main><script src="app.js"></script></body></html>`,
        "styles.css":`:root{font-family:Inter,system-ui,sans-serif;color:#111;background:#eeeae1}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center}.game-shell{width:min(560px,94vw);text-align:center}.game-shell header{display:flex;justify-content:space-between;align-items:center;margin:0 0 14px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.game-wrap{position:relative;display:grid;place-items:center;overflow:hidden;border-radius:24px;border:1px solid #c8c1b5;background:#bde7ff;box-shadow:0 30px 90px #0002}.game-wrap canvas{display:block;width:100%;height:auto;max-height:78vh}.game-overlay{position:absolute;inset:0;display:grid;place-content:center;gap:12px;background:#0d172933;backdrop-filter:blur(4px);color:#fff}.game-overlay h1{font-size:clamp(30px,7vw,58px);margin:0}.game-overlay p{margin:0;opacity:.86}.game-overlay button{border:0;border-radius:999px;padding:13px 22px;font-weight:800;cursor:pointer}.hint{font-size:12px;color:#6e6a62}`,
        "app.js":GAME_RUNTIME
      };
    }

    const body=`<main class="starter"><span>BUILDER / LIVE ARTIFACT</span><h1>${safeTitle}</h1><p>This is an executable project workspace. Describe the next change and Builder will update the artifact, test it, and verify the result.</p><button id="cta">Continue</button></main>`;

    return {
      "index.html":`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><link rel="stylesheet" href="styles.css"></head><body>${body}<script src="app.js"></script></body></html>`,
      "styles.css":"body{margin:0;font-family:Inter,system-ui,sans-serif;background:#f4f1e9;color:#171816}.starter{min-height:100vh;display:grid;place-content:center;gap:16px;padding:48px;max-width:960px;margin:auto}.starter span{font-size:12px;letter-spacing:.18em;color:#315cff}.starter h1{font-size:clamp(46px,9vw,92px);line-height:.95;margin:0;letter-spacing:-.07em}.starter p{max-width:650px;color:#6d6a63;font-size:18px;line-height:1.55}.starter button{border:0;border-radius:999px;padding:13px 18px;background:#171816;color:#fff;font-weight:800;width:max-content}",
      "app.js":"document.getElementById(\"cta\")?.addEventListener(\"click\",()=>alert(\"Artifact running.\"))"
    };
  }

  function blueprintFor(type,intention,capabilities){
    const base=[
      {title:"Understand the outcome",detail:"Confirm audience, scope, constraints and success criteria.",status:"in-progress"},
      {title:"Create the foundation",detail:"Set up the right structure, data, resources and project settings.",status:"queued"},
      {title:"Build the experience",detail:"Create the core creation with specialist agents and controlled tools.",status:"queued"},
      {title:"Test and verify",detail:"Run automated checks and realistic user-flow tests.",status:"queued"},
      {title:"Secure and optimize",detail:"Review permissions, secrets, performance and reliability.",status:"queued"},
      {title:"Ship and operate",detail:"Publish the correct artifact and keep improving it safely.",status:"queued"}
    ];

    if(type==="Business system"||capabilities.includes("E-commerce"))
      base.splice(2,0,{title:"Configure domain operations",detail:"Products, inventory, customers, orders, payments, fulfillment and analytics.",status:"queued"});

    if(type==="Game")
      base.splice(2,0,{title:"Playtest loop",detail:"Scenes, assets, gameplay systems, input, progression and test builds.",status:"queued"});

    if(type==="Agent")
      base.splice(2,0,{title:"Define agent boundaries",detail:"Knowledge, tools, memory, triggers, permissions and human approvals.",status:"queued"});

    if(type==="Automation")
      base.splice(2,0,{title:"Define workflow graph",detail:"Triggers, branches, waits, actions, retries, approvals and run history.",status:"queued"});

    return base;
  }

  function assembleAgents(type,text){
    const ids=new Set(["orchestrator","interviewer","planner","security","qa"]);
    const x=(text||"").toLowerCase();

    if(["App","Website","Mobile","API"].includes(type))
      ["coding","design","data","performance","deploy"].forEach(id=>ids.add(id));

    if(type==="Business system"||/shop|store|commerce|checkout|inventory/.test(x))
      ["coding","design","commerce","data","marketing","performance","deploy"].forEach(id=>ids.add(id));

    if(type==="Game")
      ["coding","design","performance","deploy"].forEach(id=>ids.add(id));

    if(type==="Agent")
      ["research","coding","data","automation","deploy"].forEach(id=>ids.add(id));

    if(type==="Automation")
      ["automation","data","deploy"].forEach(id=>ids.add(id));

    if(type==="Research")
      ids.add("research");

    if(type==="Data")
      ["data","research","design","performance"].forEach(id=>ids.add(id));

    if(type==="Document"||type==="Presentation")
      ["research","design"].forEach(id=>ids.add(id));

    if(type==="Creative project")
      ["design","research"].forEach(id=>ids.add(id));

    return [...ids].filter(id=>AGENTS[id]);
  }

  function inferredTools(type){
    const map={
      "Business system":["products","inventory","orders","customers","analytics","payments","email"],
      Website:["pages","components","preview","seo","assets","analytics"],
      App:["screens","code","database","auth","preview","apis"],
      Mobile:["screens","navigation","assets","api","testing"],
      Game:["scenes","assets","game logic","playtest","build"],
      Agent:["knowledge","tools","memory","triggers","permissions"],
      Automation:["triggers","conditions","actions","webhooks","schedules","runs"],
      API:["endpoints","schema","auth","webhooks","tests"],
      Data:["datasets","schema","queries","charts","analytics"],
      Research:["browser","sources","evidence","notes","citations"],
      Document:["resources","outline","editor","export"],
      Presentation:["research","slides","assets","export"]
    };

    return ["project context","resources","tasks","testing",...(map[type]||["files","browser","data"])];
  }

  function makeProject(text,mode="interview"){
    const type=detectType(text);
    const capIds=inferCapabilities(text);
    const caps=classify(text);
    const agents=assembleAgents(type,text);
    const ts=now();
    const cp=capabilityPlan(text,type);

    const p={
      id:uid(),
      title:text.length<60?text:"New creation",
      intention:text,
      type,
      capabilities:caps,
      capabilityIds:capIds,
      capabilityPlan:cp,
      stage:"Understanding",
      progress:4,
      readiness:10,
      plan:blueprintFor(type,text,caps),
      resources:[],
      agents,
      enabledTools:[...new Set([...inferredTools(type),...capIds])],
      integrations:[],
      requirements:[{id:uid(),text:"Define the desired outcome and success criteria",status:"open"}],
      decisions:[],
      assumptions:[],
      risks:[],
      brain:{
        goal:text,
        confidence:72,
        domain:type,
        successCriteria:["Working outcome","Validated against intent","Safe to ship"],
        lastUpdated:ts
      },
      graph:{
        nodes:cp.capabilities.map(c=>({id:c.id,label:c.label})),
        edges:[]
      },
      runtime:{
        kind:type==="Game"?"interactive":"artifact",
        status:"ready",
        supportsPreview:true,
        supportsExport:true
      },
      delivery:{
        formats:type==="Game"?["source","zip","web"]:["source","zip"]
      },
      files:starterFiles(text,type),
      activeFile:"index.html",
      chat:[],
      versions:[],
      tests:[],
      security:[],
      runs:[],
      createdAt:ts,
      updatedAt:ts,
      health:94
    };

    state.projects=[p,...state.projects];
    state.projectId=p.id;
    state.route="project";
    state.mode=mode;
    state.panel="overview";

    logActivity(`Created “${p.title}” as ${type} with ${agents.length} specialists`);
    saveLocal();
    render();
    toast("Creation workspace ready");

    if(mode==="interview")openModal("interview");
  }

  function makeGreat(){
    const p=project();
    if(!p)return;

    updateProject(p.id,x=>({
      ...x,
      stage:"Improvement pass",
      progress:Math.max(x.progress,58),
      readiness:Math.max(x.readiness,62),
      health:Math.min(100,x.health+3),
      runs:[
        {id:uid(),kind:"Make it Great",status:"completed",ts:now()},
        ...x.runs
      ].slice(0,20)
    }));

    logActivity(`Ran Make it Great on ${p.title}`);
    toast("Improvement pass prepared","success");
  }

  function addSmartDecision(){
    const p=project();
    if(!p)return;

    const d={
      id:uid(),
      title:"Outcome-first architecture",
      detail:`Use ${p.type.toLowerCase()}-appropriate specialists and validate against the original intent before shipping.`,
      confidence:86,
      ts:now()
    };

    updateProject(p.id,x=>({
      ...x,
      decisions:[d,...(x.decisions||[])],
      brain:{
        ...(x.brain||{}),
        confidence:Math.min(99,(x.brain?.confidence||72)+3),
        lastUpdated:now()
      }
    }));

    logActivity(`Recorded an architecture decision for ${p.title}`);
    toast("Decision recorded","success");
  }

  function simulateOutcome(){
    const p=project();
    if(!p)return;

    const readiness=Math.min(
      100,
      Math.round(
        p.progress*.45+
        p.health*.35+
        (p.tests?.length?15:0)+
        (p.security?.length?15:0)
      )
    );

    ui.outcome={
      readiness,
      quality:Math.round((p.health+p.progress)/2),
      risk:Math.max(4,100-readiness),
      recommendation:
        readiness>78
        ?"Safe to move toward release review"
        :"Strengthen the highest-risk gaps before release"
    };

    openModal("outcome");
  }

  function transformProject(target){
    const p=project();
    if(!p)return;

    ui.composer=
      `Transform this ${p.type} creation into a ${target}. `+
      `Preserve intent, reuse resources, identify incompatibilities, `+
      `create a migration plan, then verify the result.`;

    state.mode="plan";
    saveLocal();
    render();
    toast(`Transformation plan loaded: ${target}`);
  }

  async function sessionHeaders(){
    if(!sb)throw new Error("Supabase is not configured.");

    const {data:{session:s}}=await sb.auth.getSession();

    if(!s)
      throw new Error("Your session expired. Sign in again.");

    return {
      "Content-Type":"application/json",
      "Authorization":`Bearer ${s.access_token}`,
      "apikey":CFG.SUPABASE_PUBLISHABLE_KEY
    };
  }

  async function api(action,payload={}){
    const headers=await sessionHeaders();

    const res=await fetch(
      `${CFG.SUPABASE_URL}/functions/v1/ai`,
      {
        method:"POST",
        headers,
        body:JSON.stringify({action,...payload})
      }
    );

    const data=await res.json().catch(()=>({}));

    if(!res.ok||data.ok===false)
      throw new Error(data.error||`Request failed (${res.status})`);

    return data;
  }

  async function refreshProviderState(silent=false){
    if(!CONFIGURED)return;

    try{
      const [creds,models]=await Promise.all([
        api("listCredentials"),
        api("listModels",{task:"chat"})
      ]);

      state.providers=creds.providers||[];
      state.models=models.models||[];

      saveLocal();

      if(!silent)render();
    }catch(e){
      if(!silent)toast(e.message,"error");
    }
  }

  function selectedModel(agent){
    return state.agentModels[agent]||"auto";
  }

  function modelLabel(id){
    const m=state.models.find(x=>x.id===id);
    return m?`${m.name||m.id} · ${m.provider}`:id;
  }

  async function sendMessage(){
    const p=project();
    const text=ui.composer.trim();

    if(!p||!text||ui.thinking)return;

    const mode=state.mode;

    const user={
      id:uid(),
      role:"user",
      mode,
      text,
      ts:now()
    };

    updateProject(p.id,proj=>({
      ...proj,
      chat:[...proj.chat,user],
      updatedAt:now()
    }));

    ui.composer="";
    ui.thinking=true;
    render();

    try{
      const history=p.chat
        .slice(-12)
        .map(m=>({role:m.role,text:m.text}));

      const result=await api("chat",{
        mode,
        message:text,
        history,
        model:selectedModel(mode),
        project:{
          id:p.id,
          title:p.title,
          intention:p.intention,
          type:p.type,
          plan:p.plan,
          resources:p.resources,
          files:p.files,
          requirements:p.requirements,
          agents:p.agents
        }
      });

      const response=
        result.text||
        result.result?.reply||
        "Done.";

      if(result.result?.operations){
        const ops=result.result.operations;

        updateProject(p.id,proj=>{
          const files={...proj.files};

          for(const op of ops){
            if(!safePath(op.path))continue;

            if(op.op==="write_file")
              files[op.path]=String(op.content??"");

            if(op.op==="delete_file")
              delete files[op.path];
          }

          return {
            ...proj,
            files,
            progress:Math.min(100,proj.progress+8),
            readiness:Math.min(100,proj.readiness+5),
            health:Math.min(100,proj.health+1),
            tests:computeTests(files),
            security:computeSecurity(files),
            versions:[
              {
                id:uid(),
                label:`${AGENTS[mode]?.label||"AI"} change`,
                ts:now(),
                files
              },
              ...proj.versions
            ],
            chat:[
              ...proj.chat,
              {
                id:uid(),
                role:"assistant",
                mode,
                text:response,
                model:result.model,
                ts:now()
              }
            ],
            updatedAt:now()
          };
        });
      }else{
        updateProject(p.id,proj=>({
          ...proj,
          chat:[
            ...proj.chat,
            {
              id:uid(),
              role:"assistant",
              mode,
              text:response,
              model:result.model,
              ts:now()
            }
          ],
          updatedAt:now()
        }));
      }

      state.requestCount++;
      logActivity(`${AGENTS[mode]?.label||"AI"} worked on ${p.title}`);
      saveLocal();

    }catch(e){
      updateProject(p.id,proj=>({
        ...proj,
        chat:[
          ...proj.chat,
          {
            id:uid(),
            role:"assistant",
            mode,
            error:true,
            text:e.message||"Request failed",
            ts:now()
          }
        ]
      }));

      toast(e.message,"error");

    }finally{
      ui.thinking=false;
      saveLocal();
      render();
    }
  }

  function computeTests(files){
    const html=!!files["index.html"];
    const css=!!files["styles.css"];
    const js=!!files["app.js"];
    const source=Object.values(files).join("\n");

    const braces=
      (source.match(/\{/g)||[]).length===
      (source.match(/\}/g)||[]).length;

    return [
      ["Entry file exists",html?"passed":"failed"],
      ["Stylesheet available",css?"passed":"warn"],
      ["Script available",js?"passed":"warn"],
      ["Basic delimiter sanity",braces?"passed":"warn"],
      ["Document title",html&&/<title>[^<]+<\/title>/i.test(files["index.html"])?"passed":"warn"]
    ];
  }

  function computeSecurity(files){
    const all=Object.values(files).join("\n");

    const secret=
      /(sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|service_role|sb_(secret|service_role)_[A-Za-z0-9_-]{20,}|BEGIN (RSA|EC|OPENSSH)? ?PRIVATE KEY)/i
      .test(all);

    const dangerous=
      /\b(eval|Function|child_process|execSync|spawn)\s*\(/
      .test(all);

    return [
      ["No obvious secrets",secret?"failed":"passed"],
      ["No dynamic code execution",dangerous?"warn":"passed"],
      ["Safe relative paths",Object.keys(files).every(safePath)?"passed":"failed"],
      ["No insecure HTTP",/http:\/\//i.test(all)?"warn":"passed"]
    ];
  }

  function runTests(){
    const p=project();
    if(!p)return;

    const tests=computeTests(p.files);
    const status=
      tests.some(x=>x[1]==="failed")
      ?"failed"
      :tests.some(x=>x[1]==="warn")
        ?"warning"
        :"passed";

    updateProject(p.id,x=>({
      ...x,
      tests,
      runs:[
        {
          id:uid(),
          kind:"Tests",
          status,
          ts:now()
        },
        ...x.runs
      ].slice(0,20)
    }));

    toast(
      status==="passed"
        ?"Test suite passed"
        :"Test suite completed with issues",
      status==="passed"
        ?"success"
        :"error"
    );
  }

  function runSecurity(){
    const p=project();
    if(!p)return;

    const security=computeSecurity(p.files);

    const status=
      security.some(x=>x[1]==="failed")
      ?"failed"
      :security.some(x=>x[1]==="warn")
        ?"warning"
        :"passed";

    updateProject(p.id,x=>({
      ...x,
      security,
      runs:[
        {
          id:uid(),
          kind:"Security",
          status,
          ts:now()
        },
        ...x.runs
      ].slice(0,20)
    }));

    toast(
      status==="passed"
        ?"Security scan passed"
        :"Security scan completed with issues",
      status==="passed"
        ?"success"
        :"error"
    );
  }

  function autonomousRun(){
    const p=project();
    if(!p)return;

    updateProject(p.id,x=>({
      ...x,
      stage:"Autonomous run",
      progress:Math.min(100,x.progress+14),
      readiness:Math.min(100,x.readiness+9),
      runs:[
        {
          id:uid(),
          kind:"Autonomous build",
          status:"completed",
          ts:now()
        },
        ...x.runs
      ]
    }));

    setTimeout(runTests,50);
    setTimeout(runSecurity,120);

    logActivity(`Ran autonomous build loop for ${p.title}`);
    toast("Autonomous build loop started");
  }

  function snapshot(){
    const p=project();
    if(!p)return;

    updateProject(p.id,x=>({
      ...x,
      versions:[
        {
          id:uid(),
          label:"Manual snapshot",
          ts:now(),
          files:{...x.files}
        },
        ...x.versions
      ]
    }));

    toast("Snapshot saved");
  }

  function restoreVersion(id){
    const p=project();
    const v=p?.versions.find(x=>x.id===id);

    if(!v)return;

    updateProject(p.id,x=>({
      ...x,
      files:{...v.files},
      activeFile:Object.keys(v.files)[0]||null,
      tests:computeTests(v.files),
      security:computeSecurity(v.files)
    }));

    toast("Version restored");
  }

  function exportProject(){
    const p=project();
    if(!p)return;

    const blob=new Blob(
      [JSON.stringify(p,null,2)],
      {type:"application/json"}
    );

    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=(p.title||"creation")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g,"-")+".json";

    a.click();

    setTimeout(()=>URL.revokeObjectURL(a.href),500);

    toast("Project exported");
  }

  async function exportSourceZip(){
    const p=project();
    if(!p)return;

    const files=p.files||{};
    const lines=[];

    for(const [path,content] of Object.entries(files))
      lines.push(`===== ${path} =====\n${content}`);

    const blob=new Blob(
      [lines.join("\n\n")],
      {type:"text/plain"}
    );

    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=(p.title||"creation")
      .replace(/[^a-z0-9]+/gi,"-")
      .toLowerCase()+"-source.txt";

    a.click();

    setTimeout(()=>URL.revokeObjectURL(a.href),500);

    toast("Source package downloaded");
  }

  function renderPreview(){
    const p=project();
    const frame=$("#previewFrame");

    if(!p||!frame)return;

    let html=
      p.files["index.html"]||
      "<html><body><h1>No preview yet.</h1></body></html>";

    const css=p.files["styles.css"]||"";
    const js=p.files["app.js"]||"";

    html=html
      .replace(
        /<link[^>]+href=["']styles\.css["'][^>]*>/i,
        `<style>${css}</style>`
      )
      .replace(
        /<script[^>]+src=["']app\.js["'][^>]*><\/script>/i,
        `<script>${js.replace(/<\/script/gi,"<\\/script")}</script>`
      );

    frame.srcdoc=html;
  }

  function authHTML(){
    const sign=ui.authMode==="signup";

    return `
      <div class="auth-screen">
        <div class="auth-wrap">
          <div class="auth-brand">
            <span class="brand-mark">✦</span>
            <div>
              <strong>Builder</strong>
              <small>Universal creation engine</small>
            </div>
          </div>

          <div class="auth-card">
            <div class="eyebrow">WORKSPACE</div>

            <h1>${sign?"Create your workspace":"Welcome back"}</h1>

            <p>
              ${sign
                ?"Turn any ambition into a working creation."
                :"Continue building where you left off."}
            </p>

            ${!CONFIGURED?`
              <div class="notice">
                Demo mode is active.
                Connect Supabase in <b>config.js</b>
                for real accounts and secure AI.
              </div>
            `:""}

            ${sign
              ?`<input id="authName" class="input" placeholder="Full name" value="${esc(ui.auth.name)}">`
              :""
            }

            <input
              id="authEmail"
              class="input"
              placeholder="Email"
              value="${esc(ui.auth.email)}"
            >

            <input
              id="authPassword"
              class="input"
              type="password"
              placeholder="Password"
              value="${esc(ui.auth.password)}"
            >

            ${ui.authError
              ?`<div class="error-text">${esc(ui.authError)}</div>`
              :""
            }

            <button id="authSubmit" class="primary wide">
              ${sign?"Create account":"Sign in"}
            </button>

            <button id="authToggle" class="text-button">
              ${sign
                ?"Already have an account? Sign in"
                :"New here? Create an account"}
            </button>
          </div>

          <p class="auth-foot">
            Your AI provider keys are intended for secure server-side storage,
            never browser storage.
          </p>
        </div>
      </div>`;
  }

  function bindAuth(){
    [
      ["#authName","name"],
      ["#authEmail","email"],
      ["#authPassword","password"]
    ].forEach(([s,k])=>
      $(s)?.addEventListener(
        "input",
        e=>ui.auth[k]=e.target.value
      )
    );

    $("#authSubmit")?.addEventListener("click",authSubmit);

    $("#authToggle")?.addEventListener("click",()=>{
      ui.authMode=
        ui.authMode==="signup"
          ?"signin"
          :"signup";

      ui.authError="";
      render();
    });
  }

  async function authSubmit(){
    const {name,email,password}=ui.auth;

    ui.authError="";

    if(!/^\S+@\S+\.\S+$/.test(email.trim())){
      ui.authError="Enter a valid email address.";
      return render();
    }

    if(password.length<6){
      ui.authError="Password needs at least 6 characters.";
      return render();
    }

    if(ui.authMode==="signup"&&!name.trim()){
      ui.authError="Enter your name.";
      return render();
    }

    if(!CONFIGURED){
      session={
        name:ui.authMode==="signup"
          ?name.trim()
          :email.split("@")[0],
        email:email.trim()
      };

      state.demoSession=session;
      saveLocal();
      toast(`Welcome, ${session.name}`);
      return render();
    }

    try{
      if(ui.authMode==="signup"){
        const {data,error}=await sb.auth.signUp({
          email:email.trim(),
          password,
          options:{
            data:{
              name:name.trim()
            }
          }
        });

        if(error)throw error;

        if(data.user&&!data.session){
          ui.authError=
            "Check your email to confirm your account, then sign in.";

          ui.authMode="signin";

          return render();
        }
      }else{
        const {error}=await sb.auth.signInWithPassword({
          email:email.trim(),
          password
        });

        if(error)throw error;
      }
    }catch(e){
      ui.authError=e.message||"Authentication failed.";
      render();
    }
  }

  async function signOut(){
    if(sb)await sb.auth.signOut();

    session=null;
    state.demoSession=null;

    saveLocal();
    toast("Signed out");
    render();
  }

  async function initAuth(){
  /*
   * Render immediately.
   *
   * The UI must never depend on Supabase network latency.
   * This prevents a completely blank page while auth is loading.
   */
  render();

  if(!sb){
    if(session)
      refreshProviderState(true);

    return;
  }

  try{
    const {
      data:{session:s},
      error
    }=await sb.auth.getSession();

    if(error){
      console.warn(
        "Supabase session initialization failed:",
        error
      );

      /*
       * Keep the authentication screen visible.
       * Do not turn a backend/network problem into
       * a white screen.
       */
      session=null;
      render();

      return;
    }

    session=s?.user
      ?{
        name:
          s.user.user_metadata?.name ||
          s.user.email?.split("@")[0] ||
          "Builder",
        email:s.user.email || ""
      }
      :null;

    render();

    sb.auth.onAuthStateChange((_event,s2)=>{
      session=s2?.user
        ?{
          name:
            s2.user.user_metadata?.name ||
            s2.user.email?.split("@")[0] ||
            "Builder",
          email:s2.user.email || ""
        }
        :null;

      render();
    });

  }catch(error){
    console.error(
      "Supabase auth initialization failed:",
      error
    );

    /*
     * Auth failure must never prevent the application
     * from rendering.
     */
    session=null;
    render();
  }

  if(session && CONFIGURED){
    refreshProviderState(true);
  }
}

  const ICONS={
    home:'⌂',
    projects:'▦',
    activity:'◷',
    research:'⌕',
    agents:'✦',
    integrations:'↗',
    resources:'▤',
    templates:'◇',
    analytics:'⌁',
    settings:'⚙',
    setup:'⚡',
    signOut:'↪'
  };

  function sidebar(){
    return `
      <aside id="sidebar" class="sidebar">
        <div class="brand">
          <div class="logo"><span>✦</span></div>

          <div>
            <b>Builder</b>
            <span>Universal creation engine</span>
          </div>

          <button
            class="icon mobile-close"
            aria-label="Close navigation"
            data-action="toggleSidebar"
          >×</button>
        </div>

        <button class="new-project magnetic" data-action="newProject">
          <span class="btn-icon">＋</span>
          <span>New creation</span>
          <kbd>N</kbd>
        </button>

        <nav class="nav">
          <button class="nav-item" data-view="home">
            <i>${ICONS.home}</i><span>Home</span>
          </button>

          <button class="nav-item" data-view="projects">
            <i>${ICONS.projects}</i><span>Projects</span>
          </button>

          <button class="nav-item" data-view="activity">
            <i>${ICONS.activity}</i><span>Activity</span>
          </button>

          <button class="nav-item" data-view="research">
            <i>${ICONS.research}</i><span>Research</span>
          </button>
        </nav>

        <div class="label">Workspace</div>

        <nav class="nav">
          <button class="nav-item" data-view="agents">
            <i>${ICONS.agents}</i><span>Agents</span>
          </button>

          <button class="nav-item" data-view="integrations">
            <i>${ICONS.integrations}</i><span>Integrations</span>
          </button>

          <button class="nav-item" data-view="resources">
            <i>${ICONS.resources}</i><span>Resources</span>
          </button>

          <button class="nav-item" data-view="templates">
            <i>${ICONS.templates}</i><span>Templates</span>
          </button>
        </nav>

        <div class="label">Account</div>

        <nav class="nav">
          <button class="nav-item" data-view="analytics">
            <i>${ICONS.analytics}</i><span>Analytics</span>
          </button>

          <button class="nav-item" data-view="settings">
            <i>${ICONS.settings}</i><span>Settings</span>
          </button>

          <button
            class="nav-item setup-nav ${CONFIGURED?"hidden":"needs-setup"}"
            data-view="setup"
          >
            <i>${ICONS.setup}</i>
            <span>Connect backend</span>
          </button>
        </nav>

        <div class="label">Recent</div>
        <div id="recent" class="recent"></div>

        <div class="sidebar-bottom">
          <div class="usage">
            <div class="usage-head">
              <b>Engine</b>
              <span class="status-pill">
                <i></i>Ready
              </span>
            </div>

            <div class="usage-line">
              <span>AI operations</span>
              <b id="requestCount">0</b>
            </div>

            <div class="bar">
              <span id="requestBar"></span>
            </div>

            <div class="usage-foot">
              Routing, specialists and infrastructure stay behind the scenes.
            </div>
          </div>

          <button class="account" data-view="settings">
            <div class="avatar" id="sidebarAvatar">?</div>

            <div>
              <b id="sidebarName">Account</b>
              <span>Personal workspace</span>
            </div>

            <strong>›</strong>
          </button>

          <button class="account signout" data-action="signOut">
            <span class="btn-icon">${ICONS.signOut}</span>
            <div><b>Sign out</b></div>
          </button>
        </div>
      </aside>`;
  }

  function render(){
    if(!session){
      $("#appRoot").classList.add("hidden");
      $("#authRoot").innerHTML=authHTML();
      bindAuth();
      return;
    }

    $("#authRoot").innerHTML="";
    $("#appRoot").classList.remove("hidden");

    const root=$("#appRoot");

    root.innerHTML=
      sidebar()+
      `<main class="main">
        <header class="topbar">
          <div class="left">
            <button class="icon mobile-open" data-action="toggleSidebar">☰</button>
            <div id="crumbs"></div>
          </div>

          <div class="right">
            <button class="top-btn command-top" data-action="command">
              <span>⌘K</span><b>Command</b>
            </button>

            <button class="top-btn" data-action="search">
              <span>⌕</span><b>Search</b>
            </button>

            <button class="ship-top magnetic" data-action="ship">
              <span>Ship</span><b>→</b>
            </button>
          </div>
        </header>

        <section id="root" class="root"></section>
      </main>`;

    $("#mobileCta")?.classList.toggle("hidden",false);

    renderShell();
    renderModal();
    bindEvents();
  }

  function renderShell(){
    const initials=(session.name||"?").slice(0,2).toUpperCase();

    $("#sidebarAvatar").textContent=initials;
    $("#sidebarName").textContent=session.name;
    $("#requestCount").textContent=state.requestCount;
    $("#requestBar").style.width=
      Math.min(100,state.requestCount%100)+"%";

    $("#sidebar").classList.toggle("open",ui.sidebarOpen);

    $$('.nav-item[data-view]').forEach(b=>
      b.classList.toggle(
        'active',
        state.route===b.dataset.view&&!state.projectId
      )
    );

    $("#recent").innerHTML=
      state.projects.slice(0,7)
      .map(p=>`
        <button
          class="recent-item ${state.projectId===p.id?"active":""}"
          data-open-project="${p.id}"
        >
          <span>${esc(p.title)}</span>
          <small>${formatTime(p.updatedAt||p.createdAt)}</small>
        </button>`)
      .join("")
      ||
      `<div class="recent-empty">No creations yet</div>`;

    const p=project();

    $("#crumbs").innerHTML=
      p
        ?`<span>Builder</span><em>/</em><span>${esc(p.title)}</span><em>/</em><b>${esc(state.panel)}</b>`
        :`<span>Builder</span><em>/</em><b>${esc(state.route[0].toUpperCase()+state.route.slice(1))}</b>`;

    $("#root").innerHTML=
      p
        ?projectView(p)
        :routeHTML();
  }

  function routeHTML(){
    switch(state.route){
      case"home":return homeHTML();
      case"projects":return projectsHTML();
      case"activity":
        return infoPage(
          "Activity",
          "Everything the workspace has done.",
          state.activity.map(a=>`
            <div class="timeline-row">
              <span>${esc(a.line)}</span>
              <small>${formatTime(a.ts)}</small>
            </div>`
          ).join("")||emptyHTML("No activity yet.")
        );
      case"research":return researchPage();
      case"agents":return agentsPage();
      case"integrations":return integrationsPage();
      case"resources":return resourcesPage();
      case"templates":return templatesPage();
      case"analytics":return analyticsPage();
      case"settings":return settingsPage();
      case"setup":return setupPage();
      default:return homeHTML();
    }
  }

  function homeHTML(){
    return `
      <div class="home v13-home">
        <div class="hero-shell">
          <div class="hero-orbit" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>

          <div class="eyebrow reveal">
            UNIVERSAL CREATION ENGINE · V13
          </div>

          <h1 class="hero-title reveal">
            Make something real<span>.</span>
          </h1>

          <p class="hero-sub reveal">
            Describe the outcome. Builder figures out what needs to exist,
            asks what matters, assembles the right specialists,
            uses your resources and gets the creation ready to ship.
          </p>

          ${!CONFIGURED?`
            <div class="setup-banner reveal">
              <div>
                <span class="section-label">SETUP REQUIRED</span>
                <b>The workspace is running in local demo mode.</b>
                <p>
                  GitHub Pages hosts the interface, but Supabase must be
                  connected before accounts, provider keys and live AI can work.
                </p>
              </div>

              <button class="secondary" data-view="setup">
                Connect Supabase →
              </button>
            </div>
          `:""}

          <div class="create-box cinematic-box reveal">
            <div class="create-glow"></div>

            <textarea
              id="homeInput"
              rows="4"
              placeholder="I want to create…"
            >${esc(ui.composer)}</textarea>

            <div class="create-bottom">
              <div class="create-hints">
                <button
                  class="chip magnetic"
                  data-example="A premium online sneaker shop with products, inventory and checkout"
                >Shop</button>

                <button
                  class="chip magnetic"
                  data-example="A SaaS dashboard for tracking customer feedback"
                >SaaS</button>

                <button
                  class="chip magnetic"
                  data-example="An AI support agent trained on my documentation"
                >Agent</button>

                <button
                  class="chip magnetic"
                  data-example="A playable 2D game with levels and progression"
                >Game</button>
              </div>

              <button
                class="primary hero-action magnetic"
                data-action="createFromHome"
              >
                <span>Understand</span> <b>→</b>
              </button>
            </div>
          </div>

          <div class="command-strip reveal">
            <span>QUICK CREATE</span>

            <button data-example="Build a premium website">Website</button>
            <button data-example="Build a full-stack app">App</button>
            <button data-example="Create an AI agent">Agent</button>
            <button data-example="Automate this workflow">Automation</button>
            <button data-example="Turn my spreadsheet into a dashboard">Data</button>
          </div>

          <div class="home-grid reveal">
            <div class="home-card feature-card">
              <span class="section-label">The loop</span>

              <h3>
                Understand → Plan → Create → Verify → Ship
              </h3>

              <p>
                The AI doesn't have to know everything up front.
                It asks what's missing, builds a blueprint,
                then brings in the right tools and specialist agents.
              </p>

              <div class="loop-rail">
                <span>01 Understand</span>
                <span>02 Plan</span>
                <span>03 Create</span>
                <span>04 Verify</span>
                <span>05 Ship</span>
              </div>
            </div>

            <div class="home-card feature-card">
              <span class="section-label">Bring context</span>

              <h3>Resources are first-class</h3>

              <p>
                Upload documents, spreadsheets, images, source code,
                requirements or research. Resources become searchable
                project knowledge.
              </p>

              <button class="inline-action" data-view="resources">
                Open Resources ↗
              </button>
            </div>
          </div>

          <div class="v13-capability-grid">
            <div>
              <span class="section-label">INTELLIGENCE</span>
              <b>Project brain</b>
              <small>
                Goals, requirements, dependencies and decisions stay connected.
              </small>
            </div>

            <div>
              <span class="section-label">AGENTS</span>
              <b>Dynamic specialists</b>
              <small>
                Only the agents needed for the outcome are assembled.
              </small>
            </div>

            <div>
              <span class="section-label">QUALITY</span>
              <b>Verify before ship</b>
              <small>
                Test, security, UX and launch readiness are visible.
              </small>
            </div>

            <div>
              <span class="section-label">UI ENGINE</span>
              <b>Component intelligence</b>
              <small>
                Polished reusable interfaces instead of generic generated UI.
              </small>
            </div>
          </div>
        </div>

        <div class="home-bottom reveal">
          <div>
            <span class="section-label">Recent creations</span>

            <div class="mini-projects">
              ${
                state.projects.slice(0,4)
                .map(p=>`
                  <button data-open-project="${p.id}">
                    <b>${esc(p.title)}</b>
                    <small>${esc(p.type)} · ${p.progress}% built</small>
                  </button>
                `)
                .join("")
                ||
                emptyHTML("Your recent creations will appear here.")
              }
            </div>
          </div>

          <div class="north-star">
            <span>ONE ENGINE</span>
            <b>
              Web. Apps. Games. Agents. Data. Documents. Whatever you need.
            </b>

            <button class="secondary" data-action="command">
              Explore the command center →
            </button>
          </div>
        </div>
      </div>`;
  }

  function projectsHTML(){
    return `
      <div class="page">
        <div class="page-head">
          <div>
            <div class="eyebrow">WORKSPACE</div>
            <h2>Creations</h2>
            <p>
              Every outcome, resource, agent, workflow and release in one place.
            </p>
          </div>

          <button class="primary" data-action="newProject">
            ＋ New creation
          </button>
        </div>

        <div class="project-grid">
          ${
            state.projects
            .map(p=>`
              <button
                class="project-card"
                data-open-project="${p.id}"
              >
                <div class="card-strip">
                  <span>${esc(p.type)}</span>
                  <span>${p.health}% health</span>
                </div>

                <h3>${esc(p.title)}</h3>
                <p>${esc(p.intention)}</p>

                <div class="card-meta">
                  <span>${p.progress}% built</span>
                  <span>${p.plan.length} phases</span>
                  <span>${p.stage}</span>
                </div>
              </button>
            `)
            .join("")
            ||
            emptyHTML("No creations yet.")
          }
        </div>
      </div>`;
  }

  function infoPage(title,sub,body){
    return `
      <div class="page narrow">
        <div class="page-head">
          <div>
            <div class="eyebrow">WORKSPACE</div>
            <h2>${esc(title)}</h2>
            <p>${esc(sub)}</p>
          </div>
        </div>

        <div class="panel">
          ${body||emptyHTML("Nothing here yet.")}
        </div>
      </div>`;
  }

  function researchPage(){
    return infoPage(
      "Research",
      "Evidence-focused work that can feed any creation.",
      `
        <div class="resource-banner">
          <div class="big-icon">⌕</div>

          <div>
            <b>
              Research is a project capability, not a separate universe.
            </b>

            <p>
              Gather evidence, compare options, save sources as Resources,
              then send the findings into a blueprint or creation.
            </p>
          </div>

          <button class="secondary" data-action="newResearch">
            Start research
          </button>
        </div>

        <div class="three-grid">
          <div class="mini-panel">
            <b>Research briefs</b>
            <p>
              Generate structured questions, assumptions and evidence requirements.
            </p>
          </div>

          <div class="mini-panel">
            <b>Evidence packs</b>
            <p>
              Keep source notes, files and decisions attached to the project.
            </p>
          </div>

          <div class="mini-panel">
            <b>Research → Build</b>
            <p>
              Turn findings into requirements and implementation tasks.
            </p>
          </div>
        </div>`
    );
  }

  function agentsPage(){
    return `
      <div class="page">
        <div class="page-head">
          <div>
            <div class="eyebrow">INTELLIGENCE</div>
            <h2>Agent system</h2>
            <p>
              Specialists are dynamically assembled around the creation,
              not hard-coded to one app type.
            </p>
          </div>

          <button
            class="secondary"
            data-action="openAgentBuilder"
          >
            ＋ Add specialist
          </button>
        </div>

        <div class="agent-grid">
          ${
            Object.entries(AGENTS)
            .map(([id,a])=>`
              <div class="agent-card">
                <div class="agent-symbol">${a.icon}</div>

                <div>
                  <b>${a.label}</b>
                  <p>${a.desc}</p>
                </div>

                <span class="agent-status">
                  ${
                    state.projects.some(p=>p.agents.includes(id))
                    ?"Used"
                    :"Available"
                  }
                </span>
              </div>
            `)
            .join("")
          }
        </div>
      </div>`;
  }

  function integrationsPage(){
    return infoPage(
      "Integrations",
      "Connect services when the creation actually needs them.",
      `
        <div class="integration-toolbar">
          <div>
            <b>Connections</b>
            <p>
              Prefer OAuth/connectors; use BYOK only when you need your own credentials.
            </p>
          </div>

          <button class="primary" data-action="advancedAI">
            Advanced AI
          </button>
        </div>

        ${providerListHTML()}

        <div class="callout">
          <b>Adaptive integrations</b>
          <span>
            Once a creation is understood, Builder can recommend payment,
            email, calendar, storage, analytics and other connectors based
            on actual requirements.
          </span>
        </div>`
    );
  }

  function resourcesPage(){
    return infoPage(
      "Resources",
      "One library for files, knowledge, references and generated research.",
      resourceCenterHTML(null,true)
    );
  }

  function templatesPage(){
    const cards=[
      ["Shop","Catalog, cart, checkout, inventory and admin"],
      ["SaaS","Auth, subscriptions, dashboard, billing and roles"],
      ["AI agent","Knowledge, tools, memory, approvals and activity"],
      ["Game","Scenes, assets, gameplay loop and playtest"],
      ["Internal tool","Forms, tables, permissions and workflows"],
      ["Research","Evidence pack, notes, analysis and report"]
    ];

    return `
      <div class="page">
        <div class="page-head">
          <div>
            <div class="eyebrow">STARTING POINTS</div>
            <h2>Templates & blueprints</h2>
            <p>
              Skip blank pages without locking the creation into a fixed category.
            </p>
          </div>
        </div>

        <div class="template-grid">
          ${
            cards
            .map(([t,d])=>`
              <button class="template-card" data-template="${esc(t)}">
                <span>${esc(t)}</span>
                <b>${esc(d)}</b>
                <small>Use blueprint →</small>
              </button>
            `)
            .join("")
          }
        </div>
      </div>`;
  }

  function analyticsPage(){
    return `
      <div class="page">
        <div class="page-head">
          <div>
            <div class="eyebrow">OPERATIONS</div>
            <h2>Analytics</h2>
            <p>
              Creation health and AI activity—not provider plumbing.
            </p>
          </div>

          <button
            class="secondary"
            data-action="refreshAnalytics"
          >
            Refresh
          </button>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <small>Creations</small>
            <strong>${state.projects.length}</strong>
          </div>

          <div class="stat-card">
            <small>AI operations</small>
            <strong>${state.requestCount}</strong>
          </div>

          <div class="stat-card">
            <small>Connected AI sources</small>
            <strong>${state.providers.length}</strong>
          </div>

          <div class="stat-card">
            <small>Tracked models</small>
            <strong>${state.models.length}</strong>
          </div>
        </div>

        <div class="analytics-split">
          <div class="panel">
            <b>Creation health</b>

            ${
              state.projects
              .map(p=>`
                <div class="list-row">
                  <span>${esc(p.title)}</span>
                  <strong>${p.health}%</strong>
                </div>
              `)
              .join("")
              ||
              emptyHTML("Create something to see health data.")
            }
          </div>

          <div class="panel">
            <b>Engine principles</b>

            <div class="principles">
              <span>Deterministic work before AI</span>
              <span>Task-based routing</span>
              <span>Sandbox before destructive edits</span>
              <span>Test → fix → test</span>
              <span>Human approval for sensitive actions</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function setupPage(){
    const steps=[
      ["1","Create or open your Supabase project","You need a Supabase project for Auth, Postgres, Storage and Edge Functions."],
      ["2","Put the public project settings in config.js","Set SUPABASE_URL to your project URL and SUPABASE_PUBLISHABLE_KEY to the browser-safe publishable/anon key. Never add service-role keys here."],
      ["3","Deploy the database and Edge Function","Run the SQL in supabase/schema.sql plus migrations, then deploy supabase/functions/ai. The browser should only call the Edge Function."],
      ["4","Add AI provider secrets server-side","Connect Gemini, NVIDIA NIM or another supported provider through Advanced AI after Auth is working. Keys are encrypted server-side."],
      ["5","Add your GitHub Pages URL to Auth redirects","Use https://pushlabs-tech.github.io/projectx/ as the site/redirect URL for this deployment."]
    ];

    return `
      <div class="page setup-page">
        <div class="page-head">
          <div>
            <div class="eyebrow">CONTROL ROOM</div>
            <h2>Connect the Builder engine</h2>
            <p>
              GitHub Pages serves the UI.
              Supabase powers the secure, stateful parts behind it.
            </p>
          </div>

          <span class="status-pill ${CONFIGURED?"ok":"warn"}">
            <i></i>${CONFIGURED?"Backend configured":"Demo mode"}
          </span>
        </div>

        <div class="setup-grid">
          <div class="panel setup-main">
            <div class="section-head">
              <div>
                <b>Connection checklist</b>
                <p>
                  Finish these in order. The site will stop using demo mode once
                  config.js points to a real Supabase project.
                </p>
              </div>
            </div>

            ${
              steps.map(([n,t,d])=>`
                <div class="setup-step">
                  <span>${n}</span>
                  <div>
                    <b>${t}</b>
                    <p>${d}</p>
                  </div>
                </div>
              `).join("")
            }
          </div>

          <div class="panel setup-side">
            <span class="section-label">DEPLOYMENT</span>

            <b>Current GitHub Pages URL</b>

            <code>
              https://pushlabs-tech.github.io/projectx/
            </code>

            <p class="muted">
              This repo uses relative frontend assets so the project path
              works on GitHub Pages.
            </p>

            <button class="secondary" data-action="advancedAI">
              Advanced AI settings →
            </button>

            <button class="secondary" data-action="refreshAnalytics">
              Re-check backend
            </button>
          </div>
        </div>
      </div>`;
  }

  function settingsPage(){
    const tabs=[
      ["general","General"],
      ["ai","AI behavior"],
      ["security","Security"],
      ["workspace","Workspace"],
      ["billing","Plan & billing"]
    ];

    return `
      <div class="page settings-page">
        <div class="page-head">
          <div>
            <div class="eyebrow">CONTROL ROOM</div>
            <h2>Settings</h2>
            <p>Keep the defaults simple. Advanced controls stay here.</p>
          </div>
        </div>

        <div class="settings-shell">
          <div class="settings-tabs">
            ${
              tabs.map(([id,l])=>`
                <button
                  class="settings-tab ${ui.settingsTab===id?"active":""}"
                  data-settings-tab="${id}"
                >${l}</button>
              `).join("")
            }
          </div>

          <div class="settings-body">
            ${settingsTabHTML()}
          </div>
        </div>
      </div>`;
  }

  function settingsTabHTML(){
    if(ui.settingsTab==="ai"){
      return `
        <div class="setting-block">
          <b>AI behavior</b>

          <p>
            Choose the outcome-focused behavior.
            Provider and model plumbing remains optional.
          </p>

          <div class="option-grid">
            ${
              ["fast","balanced","powerful"]
              .map(k=>`
                <button
                  class="option-card ${state.defaults.selected===k?"selected":""}"
                  data-default-ai="${k}"
                >
                  <strong>
                    ${k[0].toUpperCase()+k.slice(1)}
                  </strong>
                  <span>
                    Let the router choose the best available source for this level.
                  </span>
                </button>
              `).join("")
            }
          </div>

          <label>Autonomy</label>

          <div class="segmented">
            ${
              ["ask","mostly","autonomous"]
              .map(v=>`
                <button
                  class="${state.autonomy===v?"active":""}"
                  data-autonomy="${v}"
                >
                  ${
                    v==="ask"
                      ?"Ask me"
                      :v==="mostly"
                        ?"Mostly automatic"
                        :"Autonomous"
                  }
                </button>
              `).join("")
            }
          </div>

          <button class="secondary" data-action="advancedAI">
            Advanced AI settings →
          </button>
        </div>`;
    }

    if(ui.settingsTab==="providers"){
      return `
        <div class="setting-block">
          <b>AI connection</b>
          <p>There is one connection flow now.</p>

          <button
            class="primary"
            data-action="advancedAI"
          >
            Connect an API key
          </button>
        </div>`;
    }

    if(ui.settingsTab==="security"){
      return `
        <div class="setting-block">
          <b>Safety controls</b>

          <div class="security-grid">
            <div>
              <strong>Approval gates</strong>
              <span>
                Required for destructive, deploy, payment and external-send actions.
              </span>
            </div>

            <div>
              <strong>Sandbox</strong>
              <span>
                Experimental changes can be tested before being applied.
              </span>
            </div>

            <div>
              <strong>Secret handling</strong>
              <span>
                Keys should stay in server-side secret storage.
              </span>
            </div>

            <div>
              <strong>Audit trail</strong>
              <span>
                Record agent runs, changes and important decisions.
              </span>
            </div>
          </div>
        </div>`;
    }

    if(ui.settingsTab==="workspace"){
      return `
        <div class="setting-block">
          <b>Workspace</b>

          <label>Workspace name</label>
          <input
            class="input"
            value="${esc(session.name)}'s workspace"
          >

          <label>Default preview</label>

          <select class="select">
            <option>Responsive</option>
            <option>Desktop</option>
            <option>Mobile</option>
          </select>

          <label>Default project behavior</label>

          <div class="radio-list">
            <span>Ask missing questions before building</span>
            <span>Always show a blueprint before autonomous execution</span>
            <span>Keep project resources attached to relevant agents</span>
          </div>
        </div>`;
    }

    if(ui.settingsTab==="billing"){
      return `
        <div class="setting-block">
          <b>Plan & billing</b>

          <div class="plan-banner">
            <span>Current plan</span>
            <strong>Creator prototype</strong>

            <p>
              Payments are infrastructure-only until you connect a live merchant account.
            </p>

            <button class="primary" data-view="billing">
              Open billing
            </button>
          </div>
        </div>`;
    }

    return `
      <div class="setting-block">
        <b>General</b>

        <p>
          Build the product around intent, not provider plumbing.
        </p>

        <div class="settings-lines">
          <span>Theme <b>Editorial</b></span>
          <span>Command bar <b>⌘K</b></span>
          <span>Autosave <b>On</b></span>
          <span>Project memory <b>On</b></span>
        </div>
      </div>`;
  }

  function contextualPanels(p){
    const c=new Set(p?.capabilityIds||[]);
    const out=["overview","preview","resources","tests","runs","ship"];

    if(c.has("database_design")||c.has("data_analysis")||c.has("spreadsheet_processing"))
      out.splice(3,0,"data");

    if(c.has("workflow_automation")||c.has("browser_automation"))
      out.splice(3,0,"workflows");

    if(c.has("agent_creation"))
      out.splice(3,0,"agents");

    if(c.has("api_creation"))
      out.splice(3,0,"integrations");

    if(
      c.has("web_building")||
      c.has("mobile_building")||
      c.has("game_runtime")||
      c.has("document_generation")
    )
      out.splice(2,0,"code");

    if(c.has("research"))
      out.splice(2,0,"research");

    out.push("brain","graph");

    return [...new Set(out)];
  }

  function projectView(p){
    const modes=[
      "interview",
      "discuss",
      "plan",
      "build",
      "visual",
      "research",
      "agent",
      "code-review"
    ];

    const labels={
      interview:"Interview",
      discuss:"Discuss",
      plan:"Plan",
      build:"Build",
      visual:"Visual",
      research:"Research",
      agent:"Agent",
      "code-review":"Review"
    };

    const panels=contextualPanels(p);

    return `
      <div class="workspace">
        <section class="workspace-chat">
          <div class="project-head">
            <div>
              <div class="project-type-pill">${esc(p.type)}</div>
              <h1>${esc(p.title)}</h1>
              <p>${esc(p.intention)}</p>
            </div>

            <div class="project-actions">
              <button
                class="secondary small"
                data-action="outcome"
              >Simulate</button>

              <button
                class="secondary small"
                data-action="makeGreat"
              >✦ Improve</button>

              <button
                class="icon"
                aria-label="More actions"
                data-action="projectMenu"
              >•••</button>
            </div>
          </div>

          <div class="mode-bar">
            ${
              modes.map(m=>`
                <button
                  class="mode-btn ${state.mode===m?"active":""}"
                  data-set-mode="${m}"
                >
                  ${labels[m]}
                </button>
              `).join("")
            }
          </div>

          <div class="chat-scroll">
            ${
              p.chat.length
                ?p.chat.map(msgHTML).join("")
                :starterConversation(p)
            }
          </div>

          <div class="composer">
            <div class="composer-tools">
              <button
                class="tool-btn"
                data-action="attach"
              >＋ Resource</button>

              <button
                class="tool-btn"
                data-action="advancedAI"
              >Connect AI</button>

              <span class="composer-meta">
                ${
                  state.autonomy==="autonomous"
                    ?"Autonomous"
                    :"Human-guided"
                }
                ·
                ${
                  selectedModel(state.mode)==="auto"
                    ?"Automatic routing"
                    :modelLabel(selectedModel(state.mode))
                }
              </span>
            </div>

            <textarea
              id="chatInput"
              rows="2"
              placeholder="${
                state.mode==="interview"
                  ?"Answer the question or describe what matters…"
                  :"Tell Builder what you want to make or change…"
              }"
            >${esc(ui.composer)}</textarea>

            <div class="composer-bottom">
              <span class="composer-hint">
                Enter to send · Shift+Enter newline
              </span>

              <button
                class="primary"
                data-action="sendMessage"
                ${ui.thinking?"disabled":""}
              >
                ${
                  state.mode==="interview"
                    ?"Answer ↑"
                    :"Build / change ↑"
                }
              </button>
            </div>
          </div>
        </section>

        <section class="canvas">
          <div class="canvas-top">
            <div class="canvas-tabs">
              ${
                panels.map(t=>`
                  <button
                    class="canvas-tab ${state.panel===t?"active":""}"
                    data-panel="${t}"
                  >
                    ${prettyPanel(t)}
                  </button>
                `).join("")
              }
            </div>

            <div class="canvas-actions">
              <button
                class="secondary small"
                data-action="autonomous"
              >Run</button>

              <button
                class="secondary small"
                data-action="exportProject"
              >Export</button>

              <button
                class="secondary small"
                data-action="ship"
              >Ship</button>
            </div>
          </div>

          <div class="canvas-body">
            ${projectPanelHTML(p)}
          </div>
        </section>
      </div>`;
  }

  function aiCommand(text){
    const p=project();

    if(!p){
      ui.composer=text;
      render();
      return;
    }

    const lower=String(text||"").toLowerCase();

    if(lower.includes("test"))
      return runTests();

    if(lower.includes("security"))
      return runSecurity();

    if(lower.includes("snapshot")||lower.includes("save version"))
      return snapshot();

    if(lower.includes("ship")||lower.includes("production"))
      return openShipModal();

    if(lower.includes("resource"))
      return openResourceUpload();

    ui.composer=text;
    state.mode="build";
    saveLocal();
    render();
    toast("Command routed to Builder");
  }

  function bindEvents(){
    $$('[data-view]').forEach(e=>
      e.addEventListener("click",()=>{
        patch({
          route:e.dataset.view,
          projectId:null
        });

        ui.sidebarOpen=false;
      })
    );

    $$('[data-open-project]').forEach(e=>
      e.addEventListener("click",()=>{
        state.projectId=e.dataset.openProject;
        state.route="project";
        state.panel="overview";
        saveLocal();
        render();
        ui.sidebarOpen=false;
      })
    );

    $$('[data-set-mode]').forEach(e=>
      e.addEventListener("click",()=>{
        state.mode=e.dataset.setMode;
        saveLocal();
        render();
      })
    );

    $$('[data-panel]').forEach(e=>
      e.addEventListener("click",()=>{
        state.panel=e.dataset.panel;
        saveLocal();
        render();
        setTimeout(renderPreview,0);
      })
    );

    $$('[data-action]').forEach(e=>
      e.addEventListener("click",()=>{
        handleAction(e.dataset.action);
      })
    );

    $$('[data-example]').forEach(e=>
      e.addEventListener("click",()=>{
        ui.composer=e.dataset.example;
        render();
        $("#homeInput")?.focus();
      })
    );

    $$('[data-settings-tab]').forEach(e=>
      e.addEventListener("click",()=>{
        ui.settingsTab=e.dataset.settingsTab;
        render();
      })
    );

    $$('[data-default-ai]').forEach(e=>
      e.addEventListener("click",()=>{
        state.defaults={
          ...state.defaults,
          selected:e.dataset.defaultAi
        };

        saveLocal();
        render();
      })
    );

    $$('[data-autonomy]').forEach(e=>
      e.addEventListener("click",()=>{
        state.autonomy=e.dataset.autonomy;
        saveLocal();
        render();
      })
    );

    $$('[data-provider]').forEach(e=>
      e.addEventListener("click",()=>{
        if(!CONFIGURED){
          patch({
            route:"setup",
            projectId:null
          });
          return;
        }

        ui.pendingProvider=e.dataset.provider;
        openModal("provider");
      })
    );

    $$('[data-template]').forEach(e=>
      e.addEventListener("click",()=>{
        ui.composer=
          `Build a ${e.dataset.template.toLowerCase()} using the best blueprint`;

        render();
        $("#homeInput")?.focus();
        toast(`${e.dataset.template} blueprint loaded`);
      })
    );

    $$('[data-type-choice]').forEach(e=>
      e.addEventListener("click",()=>{
        $$('[data-type-choice]')
          .forEach(x=>x.classList.remove("selected"));

        e.classList.add("selected");
        ui.pendingType=e.dataset.typeChoice;
      })
    );

    $$('[data-provider-remove]').forEach(e=>
      e.addEventListener(
        "click",
        ()=>removeProvider(e.dataset.providerRemove)
      )
    );

    $$('[data-agent-settings]').forEach(e=>
      e.addEventListener("click",()=>{
        ui.pendingAgent=e.dataset.agentSettings;
        openAgentSettings();
      })
    );

    $$('[data-resource-tab]').forEach(e=>
      e.addEventListener("click",()=>{
        ui.resourceTab=e.dataset.resourceTab;
        render();
      })
    );

    $$('[data-file]').forEach(e=>
      e.addEventListener("click",()=>{
        const p=project();

        updateProject(
          p.id,
          x=>({
            ...x,
            activeFile:e.dataset.file
          })
        );
      })
    );

    $$('[data-restore]').forEach(e=>
      e.addEventListener(
        "click",
        ()=>restoreVersion(e.dataset.restore)
      )
    );

    $("#homeInput")?.addEventListener(
      "input",
      e=>ui.composer=e.target.value
    );

    $("#chatInput")?.addEventListener(
      "input",
      e=>ui.composer=e.target.value
    );

    $("#chatInput")?.addEventListener(
      "keydown",
      e=>{
        if(e.key==="Enter"&&!e.shiftKey){
          e.preventDefault();
          sendMessage();
        }
      }
    );

    $("#sendBtn")?.addEventListener(
      "click",
      sendMessage
    );

    if(state.panel==="preview")
      setTimeout(renderPreview,0);

    $$('[data-device]').forEach(e=>
      e.addEventListener("click",()=>{
        $$('[data-device]')
          .forEach(x=>x.classList.remove("active"));

        e.classList.add("active");

        const f=$("#previewFrame");

        if(f){
          f.classList.remove(
            "device-tablet",
            "device-mobile"
          );

          if(e.dataset.device!=="desktop")
            f.classList.add(
              `device-${e.dataset.device}`
            );
        }
      })
    );
  }

  function handleAction(a){
    switch(a){
      case "newProject":
        openModal("new");
        break;

      case "createFromHome":{
        const t=ui.composer.trim();

        if(!t)
          return toast(
            "Tell me what you want to create first",
            "error"
          );

        makeProject(t,"interview");
        break;
      }

      case "command":
        openModal("command");
        break;

      case "search":
        openModal("search");
        break;

      case "signOut":
        signOut();
        break;

      case "toggleSidebar":
        ui.sidebarOpen=!ui.sidebarOpen;
        render();
        break;

      case "sendMessage":
        sendMessage();
        break;

      case "runTests":
        runTests();
        break;

      case "runSecurity":
        runSecurity();
        break;

      case "snapshot":
        snapshot();
        break;

      case "exportProject":
        exportProject();
        break;

      case "exportSource":
        exportSourceZip();
        break;

      case "refreshPreview":
        renderPreview();
        break;

      case "addProvider":
        ui.pendingProvider="generic";
        openModal("provider");
        break;

      case "advancedAI":
        openModal("advancedAI");
        break;

      case "autonomous":
        autonomousRun();
        break;

      case "ship":
        openShipModal();
        break;

      case "approveBlueprint":{
        const p=project();

        if(p){
          updateProject(p.id,x=>({
            ...x,
            stage:"Building",
            readiness:Math.max(x.readiness,25),
            plan:x.plan.map(
              (z,i)=>
                i===0
                  ?{...z,status:"done"}
                  :z
            )
          }));

          toast("Blueprint approved. Build started.");
        }

        break;
      }

      case "newResearch":
        makeProject(
          "Research project: answer an important question with evidence and a usable decision pack.",
          "research"
        );
        break;

      case "attach":
      case "uploadResource":
        openResourceUpload();
        break;

      case "openAgentBuilder":
        openAgentSettings();
        break;

      case "addRequirement":{
        const p=project();

        if(p){
          updateProject(p.id,x=>({
            ...x,
            requirements:[
              ...x.requirements,
              {
                id:uid(),
                text:"New requirement",
                status:"open"
              }
            ]
          }));

          toast("Requirement added");
        }

        break;
      }

      case "newWorkflow":
        toast("Workflow builder ready — define the trigger next");
        break;

      case "projectMenu":
        openModal("command");
        break;

      case "copyFile":{
        const p=project();

        if(p?.activeFile){
          navigator.clipboard?.writeText(
            p.files[p.activeFile]||""
          );

          toast("File copied");
        }

        break;
      }

      case "formatCode":
        toast("Formatting preview prepared");
        break;

      case "downloadFile":{
        const p=project();

        if(p?.activeFile){
          const b=new Blob(
            [p.files[p.activeFile]],
            {type:"text/plain"}
          );

          const a=document.createElement("a");
          a.href=URL.createObjectURL(b);
          a.download=p.activeFile;
          a.click();

          setTimeout(
            ()=>URL.revokeObjectURL(a.href),
            500
          );
        }

        break;
      }

      case "refreshAnalytics":
        refreshProviderState();
        break;

      case "saveAISettings":
        closeModal();
        toast("AI settings saved");
        break;

      case "makeGreat":
        closeModal();
        makeGreat();
        break;

      case "outcome":
        simulateOutcome();
        break;

      case "smartDecision":
        addSmartDecision();
        break;

      case "transformMobile":
        transformProject("mobile app");
        break;

      case "transformAPI":
        transformProject("API");
        break;

      case "transformDashboard":
        transformProject("analytics dashboard");
        break;

      case "projectBrain":
        state.panel="brain";
        saveLocal();
        render();
        break;

      case "projectGraph":
        state.panel="graph";
        saveLocal();
        render();
        break;
    }
  }

  function openResourceUpload(){
    const input=document.createElement("input");

    input.type="file";
    input.multiple=true;
    input.accept="*/*";

    input.onchange=()=>{
      const p=project();

      if(!p)
        return toast(
          "Open a creation to attach a resource",
          "error"
        );

      const picked=[...input.files];

      updateProject(
        p.id,
        x=>({
          ...x,
          resources:[
            ...x.resources,
            ...picked.map(f=>({
              id:uid(),
              name:f.name,
              category:
                f.type.includes("image")
                  ?"files"
                  :(f.name.endsWith(".csv")||f.name.endsWith(".xlsx")
                    ?"files"
                    :"knowledge"),
              description:"Uploaded project resource",
              source:"Upload",
              size:f.size,
              icon:f.type.includes("image")?"▧":"▤"
            }))
          ]
        })
      );

      toast(
        `${picked.length} resource${picked.length>1?"s":""} added`
      );
    };

    input.click();
  }

  function openAgentSettings(){
    const id=ui.pendingAgent||"orchestrator";
    const a=AGENTS[id]||AGENTS.orchestrator;

    modal="agentSettings";

    $("#modal").innerHTML=`
      <div class="modal-backdrop" data-close>
        <div class="modal" data-stop>
          <div class="modal-head">
            <div>
              <b>${a.label} configuration</b>
              <small>${a.desc}</small>
            </div>

            <button class="icon-btn" data-close>×</button>
          </div>

          <label>Permissions</label>

          <div class="permission-grid">
            ${
              [
                "Read resources",
                "Create",
                "Edit",
                "Delete",
                "Call APIs",
                "Send external messages",
                "Deploy",
                "Run payments"
              ]
              .map(
                (x,i)=>
                  `<label>
                    <input type="checkbox" ${i<4?"checked":""}>
                    ${x}
                  </label>`
              )
              .join("")
            }
          </div>

          <label>Autonomy boundary</label>

          <select class="select">
            <option>Ask before sensitive actions</option>
            <option>Mostly automatic</option>
            <option>Fully autonomous within permissions</option>
          </select>

          <label>Relevant resources</label>

          <div class="tag-row">
            ${
              project()?.resources.length
                ?project().resources.map(
                  r=>`<span>${esc(r.name)}</span>`
                ).join("")
                :"<span>None linked</span>"
            }
          </div>

          <div class="modal-actions">
            <button class="secondary" data-close>
              Cancel
            </button>

            <button
              class="primary"
              id="saveAgentBtn"
            >
              Save specialist
            </button>
          </div>
        </div>
      </div>`;

    bindModal();

    $("#saveAgentBtn")?.addEventListener(
      "click",
      ()=>{
        const p=project();

        if(p&&!p.agents.includes(id))
          updateProject(
            p.id,
            x=>({
              ...x,
              agents:[...x.agents,id]
            })
          );

        modal=null;
        render();
        toast("Agent configuration saved");
      }
    );
  }

  function openShipModal(){
    const p=project();

    if(!p)return;

    const checks=[
      ["Build",p.progress>=80],
      ["Tests",p.tests.some(x=>x[1]==="passed")],
      ["Security",p.security.some(x=>x[1]==="passed")],
      ["Health",p.health>=85]
    ];

    modal="ship";

    $("#modal").innerHTML=`
      <div class="modal-backdrop" data-close>
        <div class="modal" data-stop>
          <div class="modal-head">
            <div>
              <b>Ship ${esc(p.title)}</b>
              <small>
                Choose what “ship” means for this creation.
              </small>
            </div>

            <button class="icon-btn" data-close>×</button>
          </div>

          <div class="release-grid">
            ${
              checks.map(
                ([n,s])=>`
                  <div>
                    <span class="check-status ${s?"passed":"warn"}">
                      ${s?"PASS":"WAIT"}
                    </span>
                    <b>${n}</b>
                  </div>`
              ).join("")
            }
          </div>

          <label>Release target</label>

          <div class="type-grid">
            <button class="type-choice" data-release="publish">
              <b>Publish</b>
              <span>Web and hosted experiences</span>
            </button>

            <button class="type-choice" data-release="deploy">
              <b>Deploy</b>
              <span>APIs, backend or services</span>
            </button>

            <button class="type-choice" data-release="activate">
              <b>Activate</b>
              <span>Agents and automations</span>
            </button>

            <button class="type-choice" data-release="export">
              <b>Export</b>
              <span>Documents, data and source</span>
            </button>
          </div>

          <div class="modal-actions">
            <button class="secondary" data-close>
              Cancel
            </button>

            <button
              class="primary"
              id="releaseCheckBtn"
            >
              Run release check
            </button>
          </div>
        </div>
      </div>`;

    bindModal();

    $$('[data-release]',$('#modal')).forEach(e=>
      e.addEventListener("click",()=>{
        $$('[data-release]',$('#modal'))
          .forEach(x=>x.classList.remove("selected"));

        e.classList.add("selected");
      })
    );

    $("#releaseCheckBtn")?.addEventListener(
      "click",
      ()=>{
        const latest=project();

        const allPass=
          latest &&
          latest.tests.length &&
          latest.security.length &&
          latest.tests.every(x=>x[1]==="passed") &&
          latest.security.every(x=>x[1]==="passed") &&
          latest.progress>=80;

        if(!allPass)
          return toast(
            "Release blocked: build, tests, security and readiness must pass.",
            "error"
          );

        updateProject(
          p.id,
          x=>({
            ...x,
            stage:"Release ready",
            readiness:100
          })
        );

        modal=null;
        render();
        toast("Release check recorded");
      }
    );
  }

  window.addEventListener(
    "keydown",
    e=>{
      if(
        (e.ctrlKey||e.metaKey)&&
        e.key.toLowerCase()==="k"
      ){
        e.preventDefault();
        openModal("command");
      }

      if(
        e.key.toLowerCase()==="n" &&
        !["INPUT","TEXTAREA"].includes(
          document.activeElement?.tagName
        )
      ){
        e.preventDefault();
        openModal("new");
      }
    }
  );
    function qualityPanel(title,rows,action,label){return `<div class="quality-panel"><div class="section-head"><div><span class="section-label">Quality</span><b>${title}</b><p>Fast deterministic checks now; browser and integration testing can be delegated to the QA layer.</p></div><button class="primary small" data-action="${action}">${label}</button></div>${rows.length?rows.map(([n,s])=>`<div class="check-row"><span class="check-status ${s}">${s}</span><span>${esc(n)}</span></div>`).join(""):emptyHTML("No run yet.")}</div>`}

  function versionsPanel(p){return `<div class="versions"><div class="section-head"><div><span class="section-label">History</span><b>Versions & rollback</b><p>Every meaningful change can become a recoverable snapshot.</p></div><button class="secondary small" data-action="snapshot">＋ Snapshot</button></div>${p.versions.map(v=>`<div class="version-row"><div><b>${esc(v.label)}</b><small>${formatTime(v.ts)}</small></div><button class="secondary small" data-restore="${v.id}">Restore</button></div>`).join("")||emptyHTML("No snapshots yet.")}</div>`}

  function codePanel(p){const names=Object.keys(p.files),active=p.files[p.activeFile]!=null?p.activeFile:names[0];return `<div class="code-panel"><div class="file-list">${names.map(n=>`<button class="file ${n===active?"active":""}" data-file="${esc(n)}">${esc(n)}</button>`).join("")}</div><div class="code-editor"><div class="code-toolbar"><div><b>${esc(active||"No file")}</b><small>Code workspace · safe edit surface</small></div><div><button class="secondary small" data-action="copyFile">Copy</button><button class="secondary small" data-action="formatCode">Format</button><button class="secondary small" data-action="downloadFile">Download</button></div></div><pre>${esc(active?p.files[active]:"No files yet")}</pre></div></div>`}

  function runsPanel(p){return `<div class="runs-panel"><div class="section-head"><div><span class="section-label">Operations</span><b>Runs</b><p>Autonomous builds, tests, security scans and workflows.</p></div><button class="primary small" data-action="autonomous">Run autonomous</button></div>${p.runs.map(r=>`<div class="run-row"><span class="run-dot"></span><div><b>${esc(r.kind)}</b><small>${formatTime(r.ts)}</small></div><strong>${esc(r.status)}</strong></div>`).join("")||emptyHTML("No runs yet.")}</div>`}

  function shipPanel(p){const checks=[p.progress>=80,p.tests.some(x=>x[1]==="passed"),p.security.some(x=>x[1]==="passed"),p.health>=85];const ready=checks.every(Boolean);return `<div class="ship-panel"><div class="ship-hero ${ready?"ready":""}"><div><span class="section-label">Release control</span><h3>${ready?"Ready for a release check":"Not ready yet"}</h3><p>Ship the correct artifact for this creation: publish, deploy, activate, export or share.</p></div><button class="primary" data-action="ship">${ready?"Ship creation →":"Run readiness →"}</button></div><div class="release-grid">${[["Build quality",checks[0],`${p.progress}% complete`],["Tests",checks[1],"A passing suite is required"],["Security",checks[2],"No obvious high-risk findings"],["Project health",checks[3],`${p.health}% health`]].map(([n,s,d])=>`<div><span class="check-status ${s?"passed":"warn"}">${s?"PASS":"WAIT"}</span><b>${n}</b><small>${d}</small></div>`).join("")}</div></div>`}

  function providerListHTML(){const known=["google","nvidia","openai","anthropic","openrouter","bytez","generic"];const labels={google:"Google Gemini",nvidia:"NVIDIA NIM",openai:"OpenAI",anthropic:"Anthropic",openrouter:"OpenRouter",bytez:"Bytez",generic:"OpenAI-compatible"};return `<div class="provider-grid">${known.map(id=>{const p=state.providers.find(x=>x.provider===id);return `<div class="provider-card ${p?"connected":""}"><div class="provider-top"><span class="provider-logo">${labels[id][0]}</span><div><b>${labels[id]}</b><small>${p?`Connected · ${esc(p.label||"Personal")}`:"Optional"}</small></div><span class="status-dot ${p?"on":""}"></span></div><p>${id==="generic"?"Bring an OpenAI-compatible endpoint.":"Connect this provider with one API key; models stay abstracted behind the router."}</p><div class="provider-actions"><button class="secondary small" data-provider="${id}">${p?"Reconnect":"Connect"}</button>${p?`<button class="secondary small danger-btn" data-provider-remove="${id}">Remove</button>`:""}</div></div>`}).join("")}</div>`}

  function providerModal(){if(!CONFIGURED)return `<div class="modal-backdrop" data-close><div class="modal compact" data-stop><div class="modal-head"><div><span class="section-label">BACKEND REQUIRED</span><b>Connect Supabase first</b><small>Provider credentials are stored by the authenticated Edge Function. GitHub Pages cannot store them safely by itself.</small></div><button class="icon-btn" data-close>×</button></div><div class="setup-inline"><b>What is missing</b><span>Supabase URL + publishable key in config.js, deployed schema, AI Edge Function and Auth.</span></div><div class="modal-actions"><button class="secondary" data-close>Close</button><button class="primary" data-view="setup">Open setup →</button></div></div></div>`;const id=ui.pendingProvider||"generic";const labels={google:"Google Gemini",nvidia:"NVIDIA NIM",openai:"OpenAI",anthropic:"Anthropic",openrouter:"OpenRouter",bytez:"Bytez",generic:"OpenAI-compatible"};return `<div class="modal-backdrop" data-close><div class="modal" data-stop><div class="modal-head"><div><b>Connect ${labels[id]}</b><small>One provider + API key. The router handles models internally.</small></div><button class="icon-btn" data-close>×</button></div><input type="hidden" id="providerId" value="${id}"><label>Provider</label><select id="providerSelect" class="select">${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${k===id?"selected":""}>${v}</option>`).join("")}</select><label>Label</label><input id="providerLabel" class="input" placeholder="My AI key"><label>API key</label><div class="secret-field"><input id="providerKey" class="input" type="password" autocomplete="off" placeholder="Paste API key"><button id="toggleSecret" class="secondary small">Show</button></div>${id==="generic"?`<label>Compatible base URL</label><input id="providerBaseUrl" class="input" placeholder="https://example.com/v1">`:""}<div class="security-note">🔒 The frontend does not persist the raw key. Store and validate it only on your authenticated backend.</div><div class="modal-actions"><button class="secondary" data-close>Cancel</button><button class="primary" id="saveProvider">Test & connect</button></div></div></div>`}

  function advancedAIModal(){return `<div class="modal-backdrop" data-close><div class="modal wide-modal" data-stop><div class="modal-head"><div><b>Advanced AI settings</b><small>Simple by default. Power-user controls when you need them.</small></div><button class="icon-btn" data-close>×</button></div><div class="advanced-ai-grid"><div><span class="section-label">Default engine</span><h3>Automatic</h3><p>Builder chooses a capable available source based on task, latency, context and reliability.</p><div class="radio-list"><button class="radio-card active"><b>Automatic</b><span>Best available route for each task.</span></button><button class="radio-card"><b>Platform defaults</b><span>Use the AI sources provided by the platform.</span></button><button class="radio-card"><b>My connected source</b><span>Prefer your BYOK provider when compatible.</span></button></div></div><div><span class="section-label">Your connections</span><p>Provider settings live here, not in the project builder.</p>${!CONFIGURED?`<div class="setup-inline"><b>Backend not connected</b><span>Connect Supabase before adding a provider.</span></div>`:state.providers.length?state.providers.map(p=>`<div class="connection-row"><span class="status-dot on"></span><b>${esc(p.provider)}</b><small>${esc(p.label||"Personal")}</small><button class="secondary small" data-provider-remove="${p.provider}">Remove</button></div>`).join(""):emptyHTML("No personal providers connected.")}<button class="primary" data-action="addProvider">＋ Connect API key</button></div></div><div class="advanced-foot"><span>Power-user routing controls can be added later without exposing model infrastructure to normal users.</span><button class="secondary" data-action="saveAISettings">Save settings</button></div></div></div>`}

  function newModal(){const types=CREATION_TYPES.map(([t,d])=>`<button class="type-choice" data-type-choice="${esc(t)}"><b>${esc(t)}</b><span>${esc(d)}</span></button>`).join("");return `<div class="modal-backdrop" data-close><div class="modal wide-modal" data-stop><div class="modal-head"><div><b>New creation</b><small>Start with intent. We'll ask only what matters.</small></div><button class="icon-btn" data-close>×</button></div><label>What are you trying to make?</label><textarea id="newText" class="input area" rows="5" placeholder="Describe the outcome, audience and constraints…"></textarea><label>Detected or preferred type</label><div class="type-grid">${types}</div><div class="modal-actions"><button class="secondary" data-close>Cancel</button><button class="primary" id="createProjectBtn">Continue →</button></div></div></div>`}

  function interviewModal(){const p=project();return `<div class="modal-backdrop" data-close><div class="modal wide-modal" data-stop><div class="modal-head"><div><span class="section-label">Understand first</span><b>Before we build ${esc(p?.title||"this creation")}</b><small>Skip questions the system can already infer.</small></div><button class="icon-btn" data-close>×</button></div><div class="interview-grid"><div class="interview-question"><b>What matters most?</b><p>Choose the outcome you care about most.</p>${["Fastest working version","Premium user experience","Scalable foundation","Explore the idea first"].map((x,i)=>`<button class="answer-card" data-answer="${esc(x)}">${x}<span>${i===0?"Quick path":""}</span></button>`).join("")}</div><div class="interview-question"><b>How should Builder work?</b><p>You can change this later.</p><div class="segmented big">${[["ask","Ask me"],["mostly","Mostly automatic"],["autonomous","Autonomous"]].map(([v,l])=>`<button class="${state.autonomy===v?"active":""}" data-autonomy="${v}">${l}</button>`).join("")}</div><div class="modal-actions"><button class="secondary" data-close>Keep planning</button><button class="primary" data-action="startBuildFromInterview">Start building →</button></div></div></div></div></div>`}

  function commandModal(){const commands=[["newProject","New creation"],["projects","Creations"],["resources","Resources"],["agents","Agent system"],["settings","Settings"],["analytics","Analytics"],["advancedAI","Advanced AI"],["ship","Ship current creation"]];return `<div class="modal-backdrop" data-close><div class="modal compact command-modal" data-stop><div class="modal-head"><div><span class="section-label">UNIVERSAL COMMAND</span><b>Command center</b><small>Navigate or tell Builder what to do.</small></div><button class="icon-btn" data-close>×</button></div><input class="input command-input" data-ai-command autofocus placeholder="Try “make this better”, “run tests”, or “ship this”…">${commands.map(([id,l])=>`<button class="command" data-command="${id}">${esc(l)}<span>→</span></button>`).join("")}<div class="command-suggestions"><button data-command="aiCommand" data-text="Make this better">Make this better</button><button data-command="aiCommand" data-text="Run tests and security">Verify everything</button><button data-command="aiCommand" data-text="Make this production ready">Production ready</button></div></div></div>`}

  function searchModal(){const q=ui.search.toLowerCase();const ps=state.projects.filter(p=>!q||p.title.toLowerCase().includes(q)||p.intention.toLowerCase().includes(q)||p.type.toLowerCase().includes(q));return `<div class="modal-backdrop" data-close><div class="modal compact" data-stop><div class="modal-head"><b>Search</b><button class="icon-btn" data-close>×</button></div><input id="searchProjects" class="input" autofocus placeholder="Search creations…" value="${esc(ui.search)}">${ps.map(p=>`<button class="search-result" data-open-project="${p.id}"><b>${esc(p.title)}</b><small>${esc(p.type)}</small></button>`).join("")||emptyHTML("No matches.")}</div></div>`}

  function outcomeModal(){const p=project(),o=ui.outcome||{readiness:0,quality:0,risk:100,recommendation:"Run the simulator"};return `<div class="modal-backdrop" data-close><div class="modal wide-modal outcome-modal" data-stop><div class="modal-head"><div><span class="section-label">SIMULATOR</span><b>Outcome simulation</b><small>Deterministic preview of the current creation state.</small></div><button class="icon-btn" data-close>×</button></div><div class="outcome-hero"><div class="score-ring" style="--score:${o.readiness*3.6}deg"><strong>${o.readiness}</strong><span>readiness</span></div><div><b>${esc(p?.title||"Creation")}</b><p>${esc(o.recommendation)}</p></div></div><div class="outcome-grid"><div><span>Quality</span><strong>${o.quality}%</strong></div><div><span>Risk</span><strong>${o.risk}%</strong></div><div><span>Tests</span><strong>${p?.tests?.length||0}</strong></div><div><span>Security</span><strong>${p?.security?.length||0}</strong></div></div><div class="callout"><b>What-if controls</b><span>Change scope, resources, architecture or autonomy, then simulate again.</span></div><div class="modal-actions"><button class="secondary" data-close>Close</button><button class="primary" data-action="makeGreat">Improve first</button></div></div></div>`}

  function openModal(n){modal=n;renderModal()}
  function closeModal(){modal=null;renderModal()}

  function renderModal(){
    const host=$("#modal");
    if(!host)return;

    if(!modal){
      host.innerHTML="";
      return;
    }

    if(modal==="new")
      host.innerHTML=newModal();
    else if(modal==="provider")
      host.innerHTML=providerModal();
    else if(modal==="advancedAI")
      host.innerHTML=advancedAIModal();
    else if(modal==="command")
      host.innerHTML=commandModal();
    else if(modal==="search")
      host.innerHTML=searchModal();
    else if(modal==="interview")
      host.innerHTML=interviewModal();
    else if(modal==="outcome")
      host.innerHTML=outcomeModal();

    bindModal();
  }

  function bindModal(){
    const host=$("#modal");

    if(!host)return;

    $$("[data-close]",host).forEach(el=>
      el.addEventListener("click",e=>{
        e.preventDefault();
        closeModal();
      })
    );

    $$("[data-stop]",host).forEach(el=>
      el.addEventListener("click",e=>e.stopPropagation())
    );

    $("#createProjectBtn",host)?.addEventListener(
      "click",
      ()=>{
        const text=$("#newText",host)?.value.trim();

        if(!text)
          return toast(
            "Describe what you want to create first.",
            "error"
          );

        const selected=$("[data-type-choice].selected",host);
        const type=selected?.dataset.typeChoice;

        modal=null;

        makeProject(
          type&&type!=="Custom"
            ?`${text}`
            :text,
          "interview"
        );
      }
    );

    $$("[data-command]",host).forEach(el=>
      el.addEventListener(
        "click",
        ()=>{
          const command=el.dataset.command;

          if(command==="aiCommand"){
            const text=
              el.dataset.text||
              $(".command-input",host)?.value||
              "";

            closeModal();
            aiCommand(text);
            return;
          }

          const actions={
            newProject:()=>{closeModal();openModal("new")},
            projects:()=>{closeModal();state.route="projects";state.projectId=null;render()},
            resources:()=>{closeModal();state.route="resources";state.projectId=null;render()},
            agents:()=>{closeModal();state.route="agents";state.projectId=null;render()},
            settings:()=>{closeModal();state.route="settings";state.projectId=null;render()},
            analytics:()=>{closeModal();state.route="analytics";state.projectId=null;render()},
            advancedAI:()=>openModal("advancedAI"),
            ship:()=>{closeModal();openShipModal()}
          };

          actions[command]?.();
        }
      )
    );

    const search=$("#searchProjects",host);

    search?.addEventListener(
      "input",
      e=>{
        ui.search=e.target.value;
        renderModal();
        $("#searchProjects",$("#modal"))?.focus();
      }
    );

    $$("[data-open-project]",host).forEach(el=>
      el.addEventListener(
        "click",
        ()=>{
          state.projectId=el.dataset.openProject;
          state.route="project";
          state.panel="overview";
          closeModal();
          render();
        }
      )
    );

    $("#toggleSecret",host)?.addEventListener(
      "click",
      ()=>{
        const input=$("#providerKey",host);

        if(!input)return;

        input.type=
          input.type==="password"
            ?"text"
            :"password";

        $("#toggleSecret",host).textContent=
          input.type==="password"
            ?"Show"
            :"Hide";
      }
    );

    $("#providerSelect",host)?.addEventListener(
      "change",
      e=>{
        ui.pendingProvider=e.target.value;
        renderModal();
      }
    );

    $("#saveProvider",host)?.addEventListener(
      "click",
      saveProvider
    );

    $$("[data-provider-remove]",host).forEach(el=>
      el.addEventListener(
        "click",
        ()=>{
          removeProvider(el.dataset.providerRemove);
        }
      )
    );

    $$("[data-answer]",host).forEach(el=>
      el.addEventListener(
        "click",
        ()=>{
          $$("[data-answer]",host)
            .forEach(x=>x.classList.remove("selected"));

          el.classList.add("selected");

          const p=project();

          if(p){
            updateProject(
              p.id,
              x=>({
                ...x,
                decisions:[
                  ...(x.decisions||[]),
                  {
                    id:uid(),
                    title:"Interview preference",
                    detail:el.dataset.answer,
                    confidence:90,
                    ts:now()
                  }
                ]
              })
            );
          }
        }
      )
    );

    $$("[data-action]",host).forEach(el=>
      el.addEventListener(
        "click",
        ()=>{
          handleAction(el.dataset.action);
        }
      )
    );

    $$("[data-autonomy]",host).forEach(el=>
      el.addEventListener(
        "click",
        ()=>{
          state.autonomy=el.dataset.autonomy;
          saveLocal();

          $$("[data-autonomy]",host)
            .forEach(x=>x.classList.remove("active"));

          el.classList.add("active");
        }
      )
    );

    $('[data-view="setup"]',host)?.addEventListener(
      "click",
      ()=>{
        closeModal();
        state.route="setup";
        state.projectId=null;
        render();
      }
    );
  }

  async function saveProvider(){
    if(!CONFIGURED)
      return toast(
        "Connect Supabase before storing provider credentials.",
        "error"
      );

    const provider=
      $("#providerSelect")?.value||
      ui.pendingProvider||
      "generic";

    const label=
      $("#providerLabel")?.value.trim()||
      "Personal";

    const apiKey=
      $("#providerKey")?.value.trim();

    const baseUrl=
      $("#providerBaseUrl")?.value.trim()||
      "";

    if(!apiKey)
      return toast(
        "Paste the API key first.",
        "error"
      );

    try{
      const result=await api(
        "saveCredential",
        {
          provider,
          label,
          apiKey,
          baseUrl
        }
      );

      if(result.ok===false)
        throw new Error(result.error||"Provider connection failed.");

      await refreshProviderState(true);

      closeModal();

      toast(
        "AI provider connected.",
        "success"
      );
    }catch(e){
      toast(
        e.message||"Could not connect provider.",
        "error"
      );
    }
  }

  async function removeProvider(provider){
    if(!CONFIGURED){
      state.providers=
        state.providers.filter(
          x=>x.provider!==provider
        );

      saveLocal();
      render();
      return;
    }

    try{
      await api(
        "deleteCredential",
        {provider}
      );

      state.providers=
        state.providers.filter(
          x=>x.provider!==provider
        );

      saveLocal();
      render();

      toast(
        "AI connection removed.",
        "success"
      );
    }catch(e){
      toast(
        e.message||"Could not remove provider.",
        "error"
      );
    }
  }

  function emptyHTML(message){
    return `
      <div class="empty-state">
        <span>○</span>
        <b>${esc(message)}</b>
      </div>`;
  }

  function prettyPanel(t){
    return ({
      overview:"Overview",
      blueprint:"Blueprint",
      preview:"Preview",
      resources:"Resources",
      data:"Data",
      workflows:"Workflows",
      agents:"Agents",
      integrations:"Integrations",
      research:"Research",
      tests:"Tests",
      security:"Security",
      versions:"Versions",
      code:"Code",
      runs:"Runs",
      ship:"Ship",
      brain:"Brain",
      graph:"Graph"
    }[t]||t);
  }

  function starterConversation(p){
    return `
      <div class="starter-message">
        <div class="assistant-mark">✦</div>

        <div>
          <b>Let's make ${esc(p.title)} real.</b>

          <p>
            I've identified this as a ${esc(p.type)} creation and
            assembled ${p.agents.length} relevant specialists.
          </p>

          <div class="starter-actions">
            <button
              class="secondary small"
              data-action="approveBlueprint"
            >
              Review blueprint
            </button>

            <button
              class="secondary small"
              data-action="attach"
            >
              Add resources
            </button>

            <button
              class="primary small"
              data-action="autonomous"
            >
              Start build
            </button>
          </div>
        </div>
      </div>`;
  }

  function msgHTML(m){
    return `
      <div class="chat-message ${m.role} ${m.error?"error":""}">
        <div class="message-mark">
          ${m.role==="user"?"You":"✦"}
        </div>

        <div class="message-body">
          <div class="message-meta">
            <b>${m.role==="user"?"You":esc(AGENTS[m.mode]?.label||"Builder")}</b>
            <small>${formatTime(m.ts)}</small>
          </div>

          <div class="message-text">
            ${esc(m.text)}
          </div>
        </div>
      </div>`;
  }

  function projectPanelHTML(p){
    switch(state.panel){
      case "overview":
        return overviewPanel(p);

      case "blueprint":
        return blueprintPanel(p);

      case "preview":
        return `
          <div class="preview-panel">
            <div class="preview-toolbar">
              <div>
                <b>Live preview</b>
                <small>Runs the current artifact in an isolated iframe.</small>
              </div>

              <div class="preview-devices">
                <button data-device="desktop" class="active">Desktop</button>
                <button data-device="tablet">Tablet</button>
                <button data-device="mobile">Mobile</button>
              </div>

              <button
                class="secondary small"
                data-action="refreshPreview"
              >
                Refresh
              </button>
            </div>

            <iframe
              id="previewFrame"
              sandbox="allow-scripts"
              title="Project preview"
            ></iframe>
          </div>`;

      case "resources":
        return resourceCenterHTML(p);

      case "data":
        return dataPanel(p);

      case "workflows":
        return workflowPanel(p);

      case "agents":
        return projectAgentsPanel(p);

      case "integrations":
        return integrationsPanel(p);

      case "research":
        return researchPanel(p);

      case "tests":
        return qualityPanel(
          "Automated project tests",
          p.tests,
          "runTests",
          "Run tests"
        );

      case "security":
        return qualityPanel(
          "Security scan",
          p.security,
          "runSecurity",
          "Run scan"
        );

      case "versions":
        return versionsPanel(p);

      case "code":
        return codePanel(p);

      case "runs":
        return runsPanel(p);

      case "ship":
        return shipPanel(p);

      case "brain":
        return brainPanel(p);

      case "graph":
        return graphPanel(p);

      default:
        return overviewPanel(p);
    }
  }

  function overviewPanel(p){
    return `
      <div class="overview-panel">
        <div class="overview-grid">
          <div class="panel">
            <span class="section-label">PROJECT BRAIN</span>

            <h3>${esc(p.brain.goal)}</h3>

            <div class="tag-row">
              ${
                p.capabilities
                .map(x=>`<span>${esc(x)}</span>`)
                .join("")
                ||
                `<span>Custom</span>`
              }
            </div>
          </div>

          <div class="panel">
            <span class="section-label">Active specialists</span>

            <div class="specialists">
              ${
                p.agents
                .map(id=>{
                  const a=AGENTS[id];

                  return `
                    <span>
                      <i>${a?.icon||"•"}</i>
                      ${a?.label||id}
                    </span>`;
                })
                .join("")
              }
            </div>

            <button
              class="secondary small"
              data-panel="agents"
            >
              Configure agents →
            </button>
          </div>
        </div>

        <div class="smart-action-rail">
          <button
            class="smart-action primary"
            data-action="makeGreat"
          >
            <span>✦</span>
            <b>Make it Great</b>
            <small>Run a quality pass</small>
          </button>

          <button
            class="smart-action"
            data-action="outcome"
          >
            <span>◌</span>
            <b>Simulate</b>
            <small>Readiness, quality, risk</small>
          </button>

          <button
            class="smart-action"
            data-action="smartDecision"
          >
            <span>⌁</span>
            <b>Decision</b>
            <small>Record an important choice</small>
          </button>

          <button
            class="smart-action"
            data-action="projectGraph"
          >
            <span>◇</span>
            <b>Architecture</b>
            <small>Open live graph</small>
          </button>
        </div>

        <div class="panel">
          <div class="section-head">
            <div>
              <b>Next best action</b>
              <p>The engine suggests the smallest useful next step.</p>
            </div>

            <button
              class="primary small"
              data-set-mode="${p.readiness<35?"interview":"build"}"
            >
              ${p.readiness<35?"Continue understanding":"Build next"} →
            </button>
          </div>

          <div class="next-action">
            <span>01</span>

            <div>
              <b>
                ${esc(
                  p.plan.find(x=>x.status!=="done")?.title||
                  "Ship"
                )}
              </b>

              <p>
                ${esc(
                  p.plan.find(x=>x.status!=="done")?.detail||
                  "Your creation is ready for a release check."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>`;
  }

  function blueprintPanel(p){
    return `
      <div class="blueprint-panel">
        <div class="section-head">
          <div>
            <span class="section-label">Creation blueprint</span>
            <b>What needs to exist</b>
            <p>
              This adapts to ${esc(p.type)}
              instead of assuming everything is an app.
            </p>
          </div>

          <div>
            <button
              class="secondary small"
              data-action="addRequirement"
            >
              ＋ Requirement
            </button>

            <button
              class="primary small"
              data-action="approveBlueprint"
            >
              Approve & build →
            </button>
          </div>
        </div>

        <div class="blueprint-grid">
          <div class="blueprint-list">
            ${
              p.plan.map((x,i)=>`
                <button
                  class="blueprint-step ${x.status}"
                  data-blueprint-index="${i}"
                >
                  <span>${String(i+1).padStart(2,"0")}</span>

                  <div>
                    <b>${esc(x.title)}</b>
                    <small>${esc(x.detail)}</small>
                  </div>

                  <em>
                    ${
                      x.status==="done"
                        ?"✓"
                        :x.status==="in-progress"
                          ?"Now"
                          :"○"
                    }
                  </em>
                </button>
              `).join("")
            }
          </div>

          <div class="blueprint-side">
            <div class="side-card">
              <span>Resources</span>
              <strong>${p.resources.length}</strong>
              <small>linked to project</small>
            </div>

            <div class="side-card">
              <span>Agents</span>
              <strong>${p.agents.length}</strong>
              <small>specialists assigned</small>
            </div>

            <div class="side-card">
              <span>Integrations</span>
              <strong>${p.integrations.length}</strong>
              <small>connected or planned</small>
            </div>

            <div class="side-card">
              <span>Requirements</span>
              <strong>${p.requirements.length}</strong>
              <small>tracked decisions</small>
            </div>
          </div>
        </div>
      </div>`;
  }

  function brainPanel(p){
    return `
      <div class="brain-panel">
        <div class="section-head">
          <div>
            <span class="section-label">PROJECT INTELLIGENCE</span>
            <b>Project brain</b>
            <p>
              Goals, constraints, requirements, assumptions and decisions
              stay connected to the creation.
            </p>
          </div>

          <button
            class="secondary small"
            data-action="smartDecision"
          >
            Record decision
          </button>
        </div>

        <div class="brain-grid">
          <div class="panel">
            <span>Goal</span>
            <b>${esc(p.brain.goal)}</b>
          </div>

          <div class="panel">
            <span>Domain</span>
            <b>${esc(p.brain.domain)}</b>
          </div>

          <div class="panel">
            <span>Confidence</span>
            <b>${p.brain.confidence}%</b>
          </div>

          <div class="panel">
            <span>Updated</span>
            <b>${formatTime(p.brain.lastUpdated)}</b>
          </div>
        </div>

        <div class="panel">
          <div class="section-head">
            <div>
              <b>Success criteria</b>
            </div>
          </div>

          <div class="principles">
            ${
              p.brain.successCriteria
              .map(x=>`<span>${esc(x)}</span>`)
              .join("")
            }
          </div>
        </div>

        <div class="panel">
          <b>Decisions</b>

          ${
            p.decisions?.length
              ?p.decisions.map(d=>`
                <div class="list-row">
                  <div>
                    <b>${esc(d.title)}</b>
                    <small>${esc(d.detail)}</small>
                  </div>

                  <strong>${d.confidence}%</strong>
                </div>
              `).join("")
              :emptyHTML("No important decisions recorded yet.")
          }
        </div>
      </div>`;
  }

  function graphPanel(p){
    return `
      <div class="graph-panel">
        <div class="section-head">
          <div>
            <span class="section-label">PROJECT GRAPH</span>
            <b>Live capability graph</b>
            <p>
              The graph describes what this creation depends on.
            </p>
          </div>
        </div>

        <div class="graph-grid">
          ${
            p.graph.nodes
            .map((n,i)=>`
              <div
                class="graph-node"
                data-node="${esc(n.id)}"
              >
                <span>${String(i+1).padStart(2,"0")}</span>
                <b>${esc(n.label)}</b>
              </div>
            `)
            .join("")
          }
        </div>

        <div class="graph-summary">
          <span>
            ${p.graph.nodes.length} capabilities
          </span>

          <span>
            ${p.graph.edges.length} dependencies
          </span>
        </div>
      </div>`;
  }

  function resourceCenterHTML(p,global=false){
    const items=global
      ?state.projects.flatMap(pr=>
        (pr.resources||[]).map(r=>({
          ...r,
          projectTitle:pr.title
        }))
      )
      :(p?.resources||[]);

    const tabs=[
      ["all","All"],
      ["knowledge","Knowledge"],
      ["files","Files"]
    ];

    const filtered=
      ui.resourceTab==="all"
        ?items
        :items.filter(x=>x.category===ui.resourceTab);

    return `
      <div class="resource-center">
        <div class="section-head">
          <div>
            <span class="section-label">RESOURCE CENTER</span>
            <b>Context that Builder can use</b>
            <p>
              Files and knowledge stay attached to the relevant creation.
            </p>
          </div>

          ${
            !global
              ?`<button class="primary small" data-action="attach">＋ Add resource</button>`
              :""
          }
        </div>

        <div class="resource-tabs">
          ${
            tabs.map(([id,l])=>`
              <button
                class="${ui.resourceTab===id?"active":""}"
                data-resource-tab="${id}"
              >${l}</button>
            `).join("")
          }
        </div>

        <div class="resource-grid">
          ${
            filtered
            .map(r=>`
              <div class="resource-card">
                <div class="resource-icon">${r.icon||"▤"}</div>

                <div>
                  <b>${esc(r.name)}</b>
                  <p>${esc(r.description||"Project resource")}</p>

                  ${
                    r.projectTitle
                      ?`<small>${esc(r.projectTitle)}</small>`
                      :""
                  }
                </div>

                <span>
                  ${r.size?`${Math.round(r.size/1024)} KB`:"Knowledge"}
                </span>
              </div>
            `).join("")
            ||
            emptyHTML(
              global
                ?"No resources across the workspace."
                :"No resources linked to this creation."
            )
          }
        </div>
      </div>`;
  }

  function dataPanel(p){
    return `
      <div class="data-panel">
        <div class="section-head">
          <div>
            <span class="section-label">DATA</span>
            <b>Data capability</b>
            <p>
              Schema, datasets, transformations and analytics
              are treated as project assets.
            </p>
          </div>
        </div>

        <div class="three-grid">
          <div class="mini-panel">
            <b>Schema</b>
            <p>Model structured information around the actual outcome.</p>
          </div>

          <div class="mini-panel">
            <b>Transform</b>
            <p>Map and normalize incoming resources before analysis.</p>
          </div>

          <div class="mini-panel">
            <b>Analyze</b>
            <p>Create metrics and views from validated data.</p>
          </div>
        </div>

        <div class="panel">
          <b>Enabled data tools</b>

          <div class="tag-row">
            ${
              p.enabledTools
              .filter(x=>/data|schema|dataset|query|chart|analytics/.test(x))
              .map(x=>`<span>${esc(x)}</span>`)
              .join("")
              ||
              "<span>No specialized data tools detected yet.</span>"
            }
          </div>
        </div>
      </div>`;
  }

  function workflowPanel(p){
    return `
      <div class="workflow-panel">
        <div class="section-head">
          <div>
            <span class="section-label">WORKFLOW</span>
            <b>Workflow graph</b>
            <p>
              Triggers, conditions, actions, retries and approvals
              belong to the creation itself.
            </p>
          </div>

          <button class="primary small" data-action="newWorkflow">
            ＋ Add step
          </button>
        </div>

        <div class="workflow-rail">
          ${
            [
              ["01","Trigger"],
              ["02","Condition"],
              ["03","Action"],
              ["04","Retry"],
              ["05","Approval"],
              ["06","Complete"]
            ].map(([n,l])=>`
              <div class="workflow-node">
                <span>${n}</span>
                <b>${l}</b>
              </div>
            `).join("")
          }
        </div>

        <div class="callout">
          <b>Autonomy boundary</b>
          <span>
            Destructive, external-send, payment and production actions
            require explicit approval unless the project grants them.
          </span>
        </div>
      </div>`;
  }

  function projectAgentsPanel(p){
    return `
      <div class="project-agents">
        <div class="section-head">
          <div>
            <span class="section-label">SPECIALISTS</span>
            <b>Active agent team</b>
            <p>
              The team is assembled from the creation's actual capabilities.
            </p>
          </div>

          <button class="primary small" data-action="openAgentBuilder">
            Configure →
          </button>
        </div>

        <div class="agent-grid compact">
          ${
            p.agents
            .map(id=>{
              const a=AGENTS[id];

              return `
                <div class="agent-card">
                  <div class="agent-symbol">${a?.icon||"•"}</div>

                  <div>
                    <b>${esc(a?.label||id)}</b>
                    <p>${esc(a?.desc||"Specialist")}</p>
                  </div>

                  <span class="agent-status">
                    Active
                  </span>
                </div>`;
            })
            .join("")
          }
        </div>
      </div>`;
  }

  function integrationsPanel(p){
    return `
      <div class="integrations-panel">
        <div class="section-head">
          <div>
            <span class="section-label">INTEGRATIONS</span>
            <b>Project connections</b>
            <p>
              Only integrations relevant to this creation should appear here.
            </p>
          </div>

          <button class="primary small" data-action="advancedAI">
            AI connections
          </button>
        </div>

        <div class="integration-list">
          ${
            p.integrations.length
              ?p.integrations.map(x=>`
                <div class="connection-row">
                  <span class="status-dot on"></span>
                  <b>${esc(x.name||x.provider||"Integration")}</b>
                  <small>${esc(x.status||"Connected")}</small>
                </div>
              `).join("")
              :emptyHTML("No project integrations connected.")
          }
        </div>
      </div>`;
  }

  function researchPanel(p){
    return `
      <div class="research-panel">
        <div class="section-head">
          <div>
            <span class="section-label">RESEARCH</span>
            <b>Evidence workspace</b>
            <p>
              Research should feed requirements, decisions and implementation.
            </p>
          </div>

          <button class="primary small" data-action="newResearch">
            Start research
          </button>
        </div>

        <div class="research-grid">
          <div class="panel">
            <b>Research questions</b>
            <p>
              Identify what is unknown before spending build effort.
            </p>
          </div>

          <div class="panel">
            <b>Evidence</b>
            <p>
              Attach sources and resource material to the project brain.
            </p>
          </div>

          <div class="panel">
            <b>Decisions</b>
            <p>
              Convert evidence into explicit project decisions.
            </p>
          </div>
        </div>
      </div>`;
  }

  function enhanceMotion(){
    document.querySelectorAll(".reveal").forEach((el,i)=>{
      if(i>40)return;

      if(!el.dataset.motionReady){
        el.dataset.motionReady="1";
        el.style.setProperty(
          "--reveal-delay",
          `${Math.min(i*25,500)}ms`
        );
      }
    });
  }

  // Cloud persistence is intentionally best-effort:
  // local state remains the immediate source of truth so the UI never blocks
  // when Supabase is unavailable.
  let cloudSaveTimer=null;

  function queueCloudSave(p){
    if(!CONFIGURED||!sb||!session)return;

    clearTimeout(cloudSaveTimer);

    cloudSaveTimer=setTimeout(
      ()=>persistProjectCloud(p).catch(()=>{}),
      350
    );
  }

  async function persistProjectCloud(p){
    if(!sb||!session)return;

    try{
      await api(
        "persistProject",
        {
          project:{
            id:p.id,
            title:p.title,
            intention:p.intention,
            type:p.type,
            data:p
          }
        }
      );
    }catch{}
  }

  function startRealtime(){
    if(!sb||!session)return;

    try{
      sb
        .channel("builder-projects")
        .on(
          "postgres_changes",
          {
            event:"*",
            schema:"public",
            table:"projects"
          },
          payload=>{
            if(payload.eventType==="DELETE")return;

            const row=payload.new;
            if(!row)return;

            const index=
              state.projects.findIndex(
                p=>p.id===row.id
              );

            if(index<0)return;

            const local=state.projects[index];

            if(row.updated_at&&
              new Date(row.updated_at).getTime()<
              Number(local.updatedAt||0)
            )return;

            state.projects[index]={
              ...local,
              ...(row.data||{})
            };

            saveLocal();

            if(state.projectId===row.id)
              render();
          }
        )
        .subscribe();
    }catch{}
  }

  function initEngine(){
    document.documentElement.dataset.builderVersion=
      ENGINE_VERSION;

    enhanceMotion();

    if(CONFIGURED&&session)
      startRealtime();
  }

  window.addEventListener("error",e=>{
    const p=project();

    if(p){
      const message=
        e.error?.message||
        e.message||
        "Unknown runtime error";

      p.runs.unshift({
        id:uid(),
        kind:"Runtime error",
        status:"failed",
        message,
        ts:now()
      });

      p.runs=p.runs.slice(0,20);
      p.health=Math.max(0,p.health-2);

      saveLocal();
    }
  });

  window.addEventListener(
    "unhandledrejection",
    e=>{
      const p=project();

      if(!p)return;

      p.runs.unshift({
        id:uid(),
        kind:"Unhandled rejection",
        status:"failed",
        message:String(
          e.reason?.message||
          e.reason||
          "Unknown rejection"
        ),
        ts:now()
      });

      p.runs=p.runs.slice(0,20);
      saveLocal();
    }
  );

  document.addEventListener(
    "visibilitychange",
    ()=>{
      if(document.visibilityState==="visible")
        enhanceMotion();
    }
  );

  window.addEventListener(
    "keydown",
    e=>{
      if(
        (e.ctrlKey||e.metaKey)&&
        e.key.toLowerCase()==="k"
      ){
        e.preventDefault();
        openModal("command");
      }

      if(
        e.key.toLowerCase()==="n"&&
        !["INPUT","TEXTAREA"].includes(
          document.activeElement?.tagName
        )
      ){
        e.preventDefault();
        openModal("new");
      }

      if(e.key==="Escape"&&modal){
        closeModal();
      }
    }
  );

  // Defensive delegated handler: dynamic settings controls remain functional
  // even after a render replaces the DOM.
  document.addEventListener(
    "click",
    e=>{
      const el=e.target.closest?.("[data-autonomy]");

      if(
        el &&
        !el.closest("#modal")
      ){
        state.autonomy=el.dataset.autonomy;
        saveLocal();
        render();
      }
    },
    {capture:true}
  );

  initEngine();
  initAuth();
})();
