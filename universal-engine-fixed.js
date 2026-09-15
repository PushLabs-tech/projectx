import * as Legacy from './universal-engine.js?legacy';
export * from './universal-engine.js?legacy';

export const ENGINE_VERSION = '15.0.0';
export const RUNTIME_CONTRACT_VERSION = '1.0.0';

function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

export function buildGameArtifact(title='ProjectX Game'){
  const safe=esc(title);
  return {
    'index.html':`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safe}</title><link rel="stylesheet" href="styles.css"></head><body><main id="game-app"><h1>${safe}</h1><div>Score: <b id="score">0</b> · Best: <b id="best">0</b></div><div id="wrap"><canvas id="gameCanvas" width="400" height="560" aria-label="Interactive playable game"></canvas><div id="overlay"><h2>Ready to Play</h2><p>Press Space, ArrowUp, click or tap to jump</p><button id="startBtn" type="button">Start Game</button></div></div><script src="game.js"></script><script src="app.js"></script></main></body></html>`,
    'styles.css':`*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:#0f172a;color:#fff;font:14px system-ui,sans-serif}#game-app{width:min(440px,100%);padding:20px;background:#1e293b;border:1px solid #334155;border-radius:16px}#wrap{position:relative;overflow:hidden;border-radius:12px;margin-top:12px}canvas{display:block;width:100%;height:auto;background:#70c5ce}#overlay{position:absolute;inset:0;display:grid;place-content:center;text-align:center;gap:10px;background:rgba(15,23,42,.82);padding:20px}#overlay.hidden{display:none}button{border:0;border-radius:999px;padding:10px 18px;font-weight:700;cursor:pointer;background:#38bdf8;color:#0f172a}`,
    'game.js':`(()=>{function createGameEngine(canvas,onScoreUpdate,onGameOver){if(!canvas)throw new Error('Game canvas is required');const ctx=canvas.getContext('2d');if(!ctx)throw new Error('2D canvas context is unavailable');const state={running:false,score:0,birdY:canvas.height/2,velocity:0,gravity:.35,jump:-6.5,pipes:[],width:canvas.width,height:canvas.height};let frame=0,rafId=null;function reset(){state.running=true;state.score=0;state.birdY=state.height/2;state.velocity=0;state.pipes=[];frame=0;onScoreUpdate?.(0)}function flap(){if(state.running)state.velocity=state.jump}function stop(){state.running=false;if(rafId!==null)cancelAnimationFrame(rafId);rafId=null}function over(){stop();onGameOver?.(state.score)}function tick(){if(!state.running)return;frame++;state.velocity+=state.gravity;state.birdY+=state.velocity;if(frame%90===0){const gap=130,min=50,max=Math.max(min,state.height-gap-min*2),top=min+Math.random()*(max-min);state.pipes.push({x:state.width,top,bottom:state.height-(top+gap),passed:false})}for(let i=state.pipes.length-1;i>=0;i--){const p=state.pipes[i];p.x-=2.5;if(!p.passed&&p.x<70){p.passed=true;state.score++;onScoreUpdate?.(state.score)}if(p.x<-60)state.pipes.splice(i,1)}if(state.birdY<0||state.birdY>state.height-20)return over();for(const p of state.pipes){if(56>p.x&&34<p.x+50&&(state.birdY-12<p.top||state.birdY+12>state.height-p.bottom))return over()}ctx.clearRect(0,0,state.width,state.height);ctx.fillStyle='#70c5ce';ctx.fillRect(0,0,state.width,state.height);ctx.fillStyle='#22c55e';for(const p of state.pipes){ctx.fillRect(p.x,0,50,p.top);ctx.fillRect(p.x,state.height-p.bottom,50,p.bottom)}ctx.fillStyle='#ded895';ctx.fillRect(0,state.height-20,state.width,20);ctx.fillStyle='#f59e0b';ctx.beginPath();ctx.arc(56,state.birdY,14,0,Math.PI*2);ctx.fill();rafId=requestAnimationFrame(tick)}return{start(){stop();reset();rafId=requestAnimationFrame(tick)},flap,stop,getState(){return{...state,pipes:state.pipes.map(p=>({...p}))}}}}window.createGameEngine=createGameEngine;window.ProjectXGameRuntime={version:'1.0.0',createGameEngine}})();`,
    'app.js':`(()=>{const canvas=document.getElementById('gameCanvas'),scoreEl=document.getElementById('score'),bestEl=document.getElementById('best'),overlay=document.getElementById('overlay'),startBtn=document.getElementById('startBtn');let engine=null,bestScore=0;function render(){if(bestEl)bestEl.textContent=String(bestScore)}function start(){if(!engine&&window.createGameEngine)engine=window.createGameEngine(canvas,s=>{if(scoreEl)scoreEl.textContent=String(s);if(s>bestScore)bestScore=s;render()},s=>{overlay?.classList.remove('hidden');if(overlay)overlay.querySelector('h2').textContent='Game Over';if(overlay)overlay.querySelector('p').textContent='Score: '+s+' · Best: '+bestScore;if(startBtn)startBtn.textContent='Play Again'});if(!engine)throw new Error('Game runtime failed to initialize');overlay?.classList.add('hidden');engine.start()}startBtn?.addEventListener('click',start);canvas?.addEventListener('pointerdown',e=>{e.preventDefault();engine?.flap()});window.addEventListener('keydown',e=>{if(e.code==='Space'||e.code==='ArrowUp'){e.preventDefault();if(overlay?.classList.contains('hidden'))engine?.flap();else start()}});render()})();`
  };
}

export function createProject(intent='Create something'){
  const p=Legacy.createProject(intent);
  if(p?.kind==='game'){p.artifacts=buildGameArtifact(p.title||intent);p.files={...p.artifacts};p.stage='built';p.runtime={...(p.runtime||{}),kind:'game_canvas',status:'ready',supportsPreview:true};}
  return p;
}

export function buildArtifact(project,prompt=''){
  const game=project?.kind==='game'||/\b(flappy|game|playable|platformer|arcade|pong|tetris)\b/i.test(String(project?.intent||prompt));
  if(!game)return Legacy.buildArtifact(project,prompt);
  const files=buildGameArtifact(project.intent||project.title||'ProjectX Game');
  project.artifacts=files;project.files={...files};project.stage='built';project.progress=Math.max(Number(project.progress||0),75);project.readiness=Math.max(Number(project.readiness||0),80);return files;
}

export function sandboxRun(project){
  const base=typeof Legacy.sandboxRun==='function'?Legacy.sandboxRun(project):{ok:true,errors:[]};
  const game=String(project?.artifacts?.['game.js']||''),checks=[];
  if(project?.kind==='game'||game){checks.push({name:'canonical-game-runtime',status:/window\.createGameEngine\s*=/.test(game)&&/requestAnimationFrame/.test(game)?'passed':'failed'});checks.push({name:'game-no-storage-dependency',status:/\blocalStorage\b|\bsessionStorage\b/.test(game)?'failed':'passed'});checks.push({name:'game-classic-script',status:/\bexport\s+(?:default\s+)?function/.test(game)?'failed':'passed'});}
  return {...base,runtimeChecks:checks,ok:Boolean(base.ok)&&checks.every(x=>x.status==='passed')};
}
export function browserTest(project,runner=null){if(typeof runner==='function')return runner(project);return sandboxRun(project).runtimeChecks?.map(x=>({...x,verificationMode:'static-runtime-contract'}))||[];}
export function runSyntheticUsers(project,users=Legacy.syntheticUsers(project),runner=null){return users.map(user=>{if(typeof runner!=='function')return{...user,completed:false,errors:['real-synthetic-runner-required']};try{const r=runner(project,user)||{};return{...user,completed:Boolean(r.completed),errors:r.errors||[]}}catch(e){return{...user,completed:false,errors:[String(e)]}}});}
export function createDeploymentAdapter(target='web'){return{target,configured:false,async deploy(){return{status:'unavailable',reason:'deployment-adapter-not-configured'}}};}
export async function deploy(project,adapter,target='web'){const verification=typeof Legacy.verify==='function'?Legacy.verify(project):{passed:false};if(!verification.passed)return{status:'blocked',reason:'verification-failed',tests:verification.tests||[]};return(adapter||createDeploymentAdapter(target)).deploy({project,target});}
export function createCompilerAdapter(target='web'){return{target,configured:false,async compile(){return{status:'unavailable',reason:'compiler-adapter-not-configured'}}};}
export async function compile(project,adapter,target='web'){return(adapter||createCompilerAdapter(target)).compile({project,target});}
export function createPersistenceAdapter(storageProvider='local'){return{provider:storageProvider,async saveProject(project){return{ok:true,mode:'local',projectId:project.id,version:(project.versions||[]).length+1}},async loadProject(){return null}};}
export async function persistCloud(project,adapter){return(adapter||createPersistenceAdapter('cloud')).saveProject(project);}
export function runUniversalSimulation(intent='Build something useful'){const r=Legacy.runUniversalSimulation(intent);return{...r,compiled:{...(r.compiled||{}),status:'simulated'},cloud:{...(r.cloud||{}),status:'simulated'},deployed:{...(r.deployed||{}),status:'simulated'},simulationOnly:true};}
