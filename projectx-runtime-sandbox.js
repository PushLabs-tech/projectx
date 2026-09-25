import { assemblePreviewHtml } from './projectx-core.js';

const DEFAULT_TIMEOUT_MS = 12000;
const MAX_TIMEOUT_MS = 30000;

function makeChannelId(){
  try { return crypto.randomUUID(); } catch {
    return 'px-'+Math.random().toString(36).slice(2)+Date.now().toString(36);
  }
}

export function createRuntimeSandbox(files={},options={}){
  const channelId=String(options.channelId||makeChannelId());
  const timeoutMs=Math.max(1000,Math.min(MAX_TIMEOUT_MS,Number(options.timeoutMs||DEFAULT_TIMEOUT_MS)));
  const srcdoc=assemblePreviewHtml(files,{channelId, sandboxed:true});
  return {
    channelId,
    timeoutMs,
    srcdoc,
    iframeAttributes:{
      sandbox:'allow-scripts',
      referrerPolicy:'no-referrer',
      loading:'eager'
    }
  };
}

export function isRuntimeSandboxMessage(event,channelId,source){
  return Boolean(
    event &&
    event.source===source &&
    event.data &&
    event.data.type &&
    String(event.data.channelId||'')===String(channelId)
  );
}

export function normalizeRuntimeEvent(data={}){
  const type=String(data.type||'unknown').slice(0,80);
  const severity=String(data.severity||(
    type==='PROJECTX_RUNTIME_ERROR'||type==='PROJECTX_RUNTIME_TIMEOUT'?'error':'info'
  )).slice(0,20);
  return {
    type,
    severity,
    message:String(data.message||'').slice(0,2000),
    stack:String(data.stack||'').slice(0,4000),
    source:String(data.source||'preview').slice(0,80),
    blockedUrl:String(data.blockedUrl||'').slice(0,2000),
    line:Number.isFinite(Number(data.line))?Number(data.line):null,
    column:Number.isFinite(Number(data.column))?Number(data.column):null,
    at:String(data.at||new Date().toISOString()).slice(0,60)
  };
}

export function createRuntimeMonitor(channelId,source,handlers={},options={}){
  const timeoutMs=Math.max(1000,Math.min(MAX_TIMEOUT_MS,Number(options.timeoutMs||DEFAULT_TIMEOUT_MS)));
  let done=false;
  let timer=null;
  const finish=(event)=>{if(done)return;done=true;if(timer)clearTimeout(timer);handlers.onEvent?.(normalizeRuntimeEvent(event));};
  const onMessage=(event)=>{
    if(!isRuntimeSandboxMessage(event,channelId,source))return;
    const data=event.data;
    if(String(data.type)==='PROJECTX_RUNTIME_READY'){
      handlers.onReady?.(normalizeRuntimeEvent(data));
      return;
    }
    if(String(data.type)==='PROJECTX_RUNTIME_DONE'){
      finish(data);
      handlers.onComplete?.(normalizeRuntimeEvent(data));
      return;
    }
    if(String(data.type).startsWith('PROJECTX_RUNTIME_')){
      handlers.onEvent?.(normalizeRuntimeEvent(data));
      if(String(data.type)==='PROJECTX_RUNTIME_ERROR') handlers.onError?.(normalizeRuntimeEvent(data));
    }
  };
  window.addEventListener('message',onMessage);
  timer=setTimeout(()=>{
    if(done)return;
    done=true;
    handlers.onEvent?.(normalizeRuntimeEvent({
      type:'PROJECTX_RUNTIME_TIMEOUT',
      message:'Preview did not report ready/completion before the sandbox execution window expired.',
      source:'sandbox',
      at:new Date().toISOString()
    }));
    handlers.onTimeout?.();
  },timeoutMs);
  return ()=>{if(timer)clearTimeout(timer);window.removeEventListener('message',onMessage);};
}

export const RUNTIME_SANDBOX_POLICY = Object.freeze({
  iframeSandbox:'allow-scripts',
  sameOrigin:false,
  topNavigation:false,
  forms:false,
  popups:false,
  downloads:false,
  networkByDefault:false,
  timeoutMs:DEFAULT_TIMEOUT_MS
});
