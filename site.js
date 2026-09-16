(() => {
  'use strict';
  const C = window.BUILDER_CONFIG || {};
  const page = document.documentElement.dataset.page || 'app';
  const meta = {
    app: { title: 'Project X — Turn an idea, goal, or problem into something real', description: 'Tell Project X what is on your mind. Project X understands, adapts, and builds or guides you to the outcome.' },
    privacy: { title: 'Privacy Policy — Project X', description: 'Project X privacy policy and information about account, AI provider and data privacy.' },
    terms: { title: 'Terms of Service — Project X', description: 'Project X terms of service.' },
    thankyou: { title: 'Thank You — Project X', description: 'Your Project X account or payment flow has completed.' },
    billing: { title: 'Billing & Plans — Project X', description: 'Manage Project X plans, intelligence tiers and usage.' },
    '404': { title: 'Page Not Found — Project X', description: 'The Project X page you requested could not be found.' }
  }[page] || null;
  if (meta) {
    document.title = meta.title;
    const d = document.querySelector('meta[name="description"]'); if (d) d.content = meta.description;
    const ogt = document.querySelector('meta[property="og:title"]'); if (ogt) ogt.content = meta.title;
    const ogd = document.querySelector('meta[property="og:description"]'); if (ogd) ogd.content = meta.description;
  }

  const analyticsId = C.GA_MEASUREMENT_ID || '';
  const consentKey = 'builder_analytics_consent_v1';
  function loadAnalytics() {
    if (!analyticsId || window.__builderAnalyticsLoaded) return;
    window.__builderAnalyticsLoaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function(){ window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', analyticsId, { anonymize_ip: true, send_page_view: true });
    const s = document.createElement('script'); s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(analyticsId)}`;
    document.head.appendChild(s);
  }
  function saveConsent(v) { try { localStorage.setItem(consentKey, v); } catch {} }
  function getConsent() { try { return localStorage.getItem(consentKey); } catch { return null; } }
  function banner() {
    if (page !== 'app' || !analyticsId || getConsent()) return;
    const el = document.createElement('div');
    el.className = 'cookie-banner';
    el.innerHTML = '<div><strong>Privacy choices</strong><p>Project X uses essential storage for sign-in. Optional analytics is off until you allow it.</p></div><div class="cookie-actions"><button data-cookie="decline">Decline analytics</button><button class="cookie-accept" data-cookie="accept">Allow analytics</button></div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { const v = e.target.closest('[data-cookie]')?.dataset.cookie; if (!v) return; saveConsent(v); if (v === 'accept') loadAnalytics(); el.remove(); });
  }
  const consent = getConsent();
  if (consent === 'accept') loadAnalytics();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner); else banner();

  const Sentinel = {
    errors: [],
    init() {
      window.addEventListener('error', e => {
        const item = { type: 'error', message: e.message || String(e), file: e.filename, line: e.lineno, time: Date.now() };
        this.errors.push(item);
        console.warn('[Project X Sentinel] Runtime error:', item);
      });
      window.addEventListener('unhandledrejection', e => {
        const item = { type: 'rejection', reason: String(e.reason), time: Date.now() };
        this.errors.push(item);
        console.warn('[Project X Sentinel] Rejection:', item);
      });
      const adaptViewport = () => {
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth > 768 && window.innerWidth <= 1024;
        document.documentElement.dataset.device = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
      };
      adaptViewport();
      window.addEventListener('resize', adaptViewport);
    },
    scan() { return { healthy: this.errors.length === 0, issues: this.errors.slice(-10), errorCount: this.errors.length, timestamp: new Date().toISOString() }; },
    heal() { this.errors = []; return { healed: true, summary: 'Runtime error buffer cleared' }; }
  };
  Sentinel.init();

  const UX_STYLE = `
    .px-start-layer{position:fixed;inset:0;z-index:99990;background:var(--bg,#f6f4ee);display:flex;align-items:center;justify-content:center;padding:24px;overflow:auto}
    .px-chat-shell{width:min(760px,100%);min-height:min(720px,calc(100vh - 48px));display:flex;flex-direction:column;justify-content:center}
    .px-chat-kicker{text-align:center;font-size:10px;letter-spacing:.18em;color:#777;text-transform:uppercase;margin-bottom:12px}
    .px-chat-heading{text-align:center;font-size:clamp(30px,6vw,52px);line-height:1.04;letter-spacing:-.045em;font-weight:700;margin:0 0 12px;color:var(--ink,#171717)}
    .px-chat-sub{text-align:center;color:#777;font-size:14px;margin:0 auto 30px;max-width:540px;line-height:1.55}
    .px-chat-log{display:flex;flex-direction:column;gap:14px;margin-bottom:18px;max-height:45vh;overflow:auto;padding:4px 2px}
    .px-msg{max-width:82%;padding:12px 15px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap}
    .px-msg.ai{align-self:flex-start;background:#fff;border:1px solid rgba(0,0,0,.1);color:#222}
    .px-msg.user{align-self:flex-end;background:#171717;color:#fff}
    .px-chat-form{display:flex;gap:8px;border:1px solid rgba(0,0,0,.18);background:#fff;border-radius:18px;padding:8px;box-shadow:0 8px 30px rgba(0,0,0,.06)}
    .px-chat-input{flex:1;resize:none;border:0;outline:0;background:transparent;padding:12px;font:inherit;font-size:14px;min-height:48px;max-height:130px}
    .px-chat-send{border:0;border-radius:12px;background:#171717;color:#fff;padding:0 18px;font-weight:600;cursor:pointer}
    .px-chat-step{text-align:center;color:#888;font-size:11px;margin-top:10px}
    .px-project-heading{padding:26px 20px 10px;text-align:center}
    .px-project-heading-title{font-size:clamp(25px,4vw,40px);font-weight:700;letter-spacing:-.04em;line-height:1.1;color:var(--ink,#171717)}
    .px-project-sections{display:flex;justify-content:center;gap:2px;width:min(1100px,calc(100% - 30px));margin:0 auto 20px;border-bottom:1px solid rgba(0,0,0,.12);overflow-x:auto;scrollbar-width:none}
    .px-project-sections::-webkit-scrollbar{display:none}
    .px-project-section{border:0;background:transparent;padding:10px 13px;color:#777;font:600 12px inherit;white-space:nowrap;border-bottom:2px solid transparent;cursor:pointer}
    .px-project-section.active{color:#171717;border-bottom-color:#171717}
    .px-project-legacy-hidden{display:none!important}
    @media(max-width:720px){.px-start-layer{padding:16px}.px-chat-shell{min-height:calc(100vh - 32px)}.px-chat-heading{font-size:34px}.px-chat-log{max-height:48vh}.px-msg{max-width:90%}.px-project-sections{justify-content:flex-start;width:calc(100% - 14px)}}
  `;
  function installStyle(){
    if(document.getElementById('px-chat-first-style'))return;
    const s=document.createElement('style'); s.id='px-chat-first-style'; s.textContent=UX_STYLE; document.head.appendChild(s);
  }
  installStyle();

  const STORE_KEYS=['builder_universal_v14','builder_state_v14'];
  function readState(){
    for(const key of STORE_KEYS){
      try{const raw=localStorage.getItem(key);if(raw){const x=JSON.parse(raw);if(x&&typeof x==='object')return x;}}catch{}
    }
    return null;
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function projectType(text){
    const x=String(text||'').toLowerCase();
    if(/\b(game|flappy|platformer|rpg|arcade)\b/.test(x))return 'Game';
    if(/\b(cafe|restaurant|shop|store|business|crm|booking|inventory)\b/.test(x))return 'Business';
    if(/\b(research|study|paper|competitor|market analysis)\b/.test(x))return 'Research';
    if(/\b(agent|assistant|copilot)\b/.test(x))return 'Agent';
    if(/\b(automation|workflow|schedule|trigger)\b/.test(x))return 'Automation';
    if(/\b(api|endpoint|backend)\b/.test(x))return 'API';
    if(/\b(mobile|ios|android)\b/.test(x))return 'Mobile';
    if(/\b(website|landing|portfolio|web site)\b/.test(x))return 'Website';
    return 'App';
  }
  const SECTION_MAP={
    Website:['Chat','Plan','Design','Preview','Code','Files','Test','Publish'],
    App:['Chat','Plan','Design','Data','Preview','Test','Publish'],
    Mobile:['Chat','Plan','Screens','Data','Build','Test','Publish'],
    Game:['Chat','Plan','Gameplay','Scenes','Assets','Code','Playtest','Publish'],
    Business:['Chat','Plan','Research','Budget','Operations','Marketing','Checklist','Launch'],
    Research:['Chat','Research','Sources','Analysis','Findings','Report'],
    Agent:['Chat','Goal','Tools','Knowledge','Testing','Deploy'],
    Automation:['Chat','Plan','Workflow','Integrations','Testing','Deploy'],
    API:['Chat','Plan','Endpoints','Data','Testing','Docs','Deploy']
  };
  function addMessage(log,who,text){log.push({who,text});}
  function makeQuestions(intent){
    const t=projectType(intent);
    if(t==='Website')return ['Who is this for, and what should visitors do first?','What are the most important pages or features?','What visual direction should it have?'];
    if(t==='Game')return ['What platform should the game run on?','What is the core gameplay loop?','What art style or mood do you want?'];
    if(t==='Business')return ['Where will the business operate, and who is the target customer?','What is the starting budget or major cost limit?','What should the business be ready to do first?'];
    if(t==='Research')return ['What exact question are you trying to answer?','What scope, market, geography, or time period matters?','What should the final output look like?'];
    if(t==='Agent')return ['What job should the agent perform?','What information or tools should it be allowed to use?','What should it produce or do when the job is complete?'];
    if(t==='Automation')return ['What starts the workflow?','What steps and systems are involved?','What should happen when something fails?'];
    if(t==='API')return ['Who or what will consume the API?','What are the core resources or operations?','What authentication and data rules matter?'];
    return ['What is the main outcome you want?','Who is this for, and what are the important constraints?','What should the finished result contain?'];
  }
  function combinedIntent(intent,answers){
    return `${intent}\n\nProject interview:\n${answers.map((a,i)=>`${i+1}. ${a}`).join('\n')}`;
  }
  function showIntake(){
    if(document.querySelector('.px-start-layer'))return;
    const root=document.querySelector('#appRoot'); if(!root)return;
    const layer=document.createElement('div'); layer.className='px-start-layer';
    layer.innerHTML=`<div class="px-chat-shell"><div class="px-chat-kicker">PROJECT X</div><h1 class="px-chat-heading">What are you creating?</h1><p class="px-chat-sub">Start with one conversation. I’ll understand the goal, ask only the missing questions, then shape the workspace around the outcome.</p><div class="px-chat-log" id="pxChatLog"></div><form class="px-chat-form" id="pxChatForm"><textarea class="px-chat-input" id="pxChatInput" rows="1" placeholder="Tell me what you want to create..."></textarea><button class="px-chat-send" type="submit">Send</button></form><div class="px-chat-step" id="pxChatStep">1 conversation · no workspace clutter</div></div>`;
    root.appendChild(layer);
    let intent=''; const answers=[]; const questions=[]; let qIndex=-1;
    const log=layer.querySelector('#pxChatLog'); const input=layer.querySelector('#pxChatInput'); const step=layer.querySelector('#pxChatStep');
    const draw=()=>{log.innerHTML='';messages.forEach(m=>{const d=document.createElement('div');d.className='px-msg '+m.who;d.textContent=m.text;log.appendChild(d)});log.scrollTop=log.scrollHeight;input.focus();};
    const messages=[];
    addMessage(messages,'ai','Tell me what you want to create, build, research, or figure out.'); draw();
    layer.querySelector('#pxChatForm').addEventListener('submit',e=>{
      e.preventDefault(); const value=input.value.trim(); if(!value)return; addMessage(messages,'user',value); input.value='';
      if(!intent){
        intent=value; questions.push(...makeQuestions(intent)); qIndex=0; addMessage(messages,'ai',questions[qIndex]); step.textContent=`Question 1 of ${questions.length}`;
      }else{
        answers.push(value); qIndex++;
        if(qIndex<questions.length){addMessage(messages,'ai',questions[qIndex]);step.textContent=`Question ${qIndex+1} of ${questions.length}`;}
        else{
          addMessage(messages,'ai','Got it. I have enough context. I’m shaping the workspace around this outcome.'); step.textContent='Creating your adaptive workspace…';
          const full=combinedIntent(intent,answers);
          layer.remove();
          const hero=document.querySelector('#heroPrompt'); const launch=document.querySelector('#heroMaterializeBtn');
          if(hero&&launch){hero.value=full; hero.dispatchEvent(new Event('input',{bubbles:true})); setTimeout(()=>launch.click(),50);}
          else{
            const newBtn=document.querySelector('[data-action="newProject"]'); if(newBtn) newBtn.click();
          }
        }
      }
      draw();
    });
  }

  function hideWelcome(){
    document.querySelectorAll('#appRoot h1,#appRoot h2,#appRoot h3,[role="heading"]').forEach(el=>{
      if(/^welcome back\b/i.test((el.textContent||'').trim()))el.classList.add('px-project-legacy-hidden');
    });
  }
  function adaptiveWorkspace(){
    const root=document.querySelector('#appRoot'); if(!root||root.classList.contains('hidden'))return;
    hideWelcome();
    const s=readState(); if(!s||!s.projectId)return;
    const p=(s.projects||[]).find(x=>x.id===s.projectId); if(!p)return;
    const intent=String(p.intention||p.intent||p.description||p.title||'');
    const title=String(p.title||intent.split('\n')[0]||'Project').trim();
    let header=root.querySelector('.px-project-heading');
    if(!header){
      header=document.createElement('div'); header.className='px-project-heading';
      header.innerHTML='<div class="px-project-heading-title">'+esc(title)+'</div>';
      root.prepend(header);
    }else header.querySelector('.px-project-heading-title').textContent=title;
    const type=projectType(intent); const sections=SECTION_MAP[type]||SECTION_MAP.App;
    let nav=root.querySelector('.px-project-sections');
    if(!nav){nav=document.createElement('nav');nav.className='px-project-sections';header.after(nav);}
    nav.innerHTML=sections.map((x,i)=>`<button class="px-project-section ${i===0?'active':''}" type="button" data-px-section="${esc(x.toLowerCase())}">${esc(x)}</button>`).join('');
    nav.querySelectorAll('[data-px-section]').forEach(btn=>btn.addEventListener('click',()=>{
      nav.querySelectorAll('.px-project-section').forEach(x=>x.classList.toggle('active',x===btn));
      const wanted=btn.dataset.pxSection;
      const candidates=[...root.querySelectorAll('[data-panel]')];
      const match=candidates.find(el=>{const p=String(el.dataset.panel||'').toLowerCase();const t=(el.textContent||'').trim().toLowerCase();return p===wanted||p.includes(wanted)||t===wanted;});
      if(match)match.click();
      else if(wanted==='chat')root.querySelector('textarea,input[placeholder*="message" i],input[placeholder*="tell" i]')?.focus();
    }));
  }

  let lastRoute='';
  const observe=()=>{
    adaptiveWorkspace();
    const s=readState(); const route=s?.route||'';
    if(route!==lastRoute){lastRoute=route;if(route==='home')hideWelcome();}
  };
  const mo=new MutationObserver(()=>{clearTimeout(window.__pxUxTimer);window.__pxUxTimer=setTimeout(observe,30);});
  mo.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('click',e=>{
    const el=e.target?.closest?.('[data-action="newProject"],[data-action="createFromHome"]');
    if(!el||page!=='app')return;
    e.preventDefault(); e.stopImmediatePropagation(); showIntake();
  },true);
  setInterval(observe,500);
  setTimeout(observe,200);

  window.BuilderSite = {
    track(name, params={}) { if (window.gtag && getConsent() === 'accept') window.gtag('event', name, params); },
    setPageMeta(title, description) {
      if (title) document.title = title;
      const d = document.querySelector('meta[name="description"]'); if (d && description) d.content = description;
      const ogt = document.querySelector('meta[property="og:title"]'); if (ogt && title) ogt.content = title;
      const ogd = document.querySelector('meta[property="og:description"]'); if (ogd && description) ogd.content = description;
    },
    sentinel: Sentinel
  };
})();
