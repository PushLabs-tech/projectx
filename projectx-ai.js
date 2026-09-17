(() => {
  'use strict';
  const STORE='projectx_ai_v1';
  const DEFAULTS={provider:'gemini',model:'gemini-2.5-flash',keys:{}};
  const read=()=>{try{return {...DEFAULTS,...JSON.parse(localStorage.getItem(STORE)||'{}')};}catch{return {...DEFAULTS};}};
  const write=v=>{const next={...DEFAULTS,...read(),...v};localStorage.setItem(STORE,JSON.stringify(next));window.dispatchEvent(new CustomEvent('projectx:ai-changed',{detail:next}));return next;};
  const cleanKey=k=>String(k||'').trim();
  const mask=k=>k?`${k.slice(0,4)}${'•'.repeat(Math.max(4,Math.min(12,k.length-8)))}${k.slice(-4)}`:'Not connected';
  const getProvider=()=>read().provider||'gemini';
  const getModel=()=>read().model||'gemini-2.5-flash';
  const getKey=(provider=getProvider())=>read().keys?.[provider]||'';
  const hasKey=(provider=getProvider())=>Boolean(cleanKey(getKey(provider)));
  async function gemini(messages,{system='',model=getModel(),temperature=0.2,maxTokens=1800}={}){
    const key=cleanKey(getKey('gemini')); if(!key) throw Object.assign(new Error('Gemini API key is not configured.'),{code:'NO_KEY'});
    const contents=messages.map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:String(m.content||'') }]}));
    const body={contents,systemInstruction:{parts:[{text:system}]},generationConfig:{temperature,maxOutputTokens:maxTokens,responseMimeType:'application/json'}};
    const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw Object.assign(new Error(data?.error?.message||`AI request failed (${res.status})`),{code:res.status});
    const text=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('')||'';
    if(!text) throw Object.assign(new Error('The AI returned an empty response.'),{code:'EMPTY'});
    return text;
  }
  async function test(provider=getProvider()){
    if(provider!=='gemini') throw Object.assign(new Error('This provider is a settings placeholder.'),{code:'PLACEHOLDER'});
    const text=await gemini([{role:'user',content:'Reply with exactly the word OK.'}],{system:'You are a connection test. Return only OK.',maxTokens:10});
    return /\bok\b/i.test(text);
  }
  window.ProjectXAI={
    get:read,getKey,hasKey,getProvider,getModel,mask,
    setProvider:p=>write({provider:p}),
    setModel:m=>write({model:m}),
    saveKey:(provider,key)=>{const s=read();return write({keys:{...s.keys,[provider]:cleanKey(key)}});},
    removeKey:provider=>{const s=read();const keys={...s.keys};delete keys[provider];return write({keys});},
    test,
    chat:gemini
  };
})();
