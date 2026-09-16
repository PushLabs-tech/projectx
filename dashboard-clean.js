(() => {
  'use strict';

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const NAV = ['Home','Projects','Analytics','Settings'];
  const OLD = new Set(['Activity','Research','Agents','Integrations','Resources','Templates']);

  const CSS = `
  #appRoot{padding-left:0!important;margin:0!important;min-height:100vh!important;background:#fff!important}
  .px-clean-sidebar{position:fixed;inset:0 auto 0 0;width:248px;z-index:100000;background:#fbfcfd;border-right:1px solid #e7e9ee;padding:28px 14px 16px;display:flex;flex-direction:column;color:#151a24;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .px-clean-brand{padding:0 14px 34px;font-size:24px;line-height:1;font-weight:750;letter-spacing:-.055em;color:#111722}
  .px-clean-nav{display:grid;gap:4px}
  .px-clean-nav button,.px-clean-assistant,.px-clean-account,.px-clean-recent button{font:inherit;cursor:pointer}
  .px-clean-nav button{width:100%;border:0;background:transparent;display:flex;align-items:center;gap:12px;text-align:left;padding:11px 12px;border-radius:10px;color:#667080;font-size:14px;font-weight:500}
  .px-clean-nav button:hover,.px-clean-nav button.active{background:#eef1f5;color:#151a24}
  .px-clean-nav button.active{font-weight:650}
  .px-clean-icon{width:18px;display:inline-grid;place-items:center;font-size:15px;color:#252b35;flex:0 0 18px}
  .px-clean-divider{height:1px;background:#e7e9ee;margin:22px 7px 17px}
  .px-clean-label{padding:0 11px 9px;font-size:9px;font-weight:750;letter-spacing:.14em;text-transform:uppercase;color:#a0a7b2}
  .px-clean-assistant{width:100%;border:1px solid #e0e4e9;background:#fff;border-radius:10px;display:flex;align-items:center;gap:12px;padding:11px 12px;color:#303744;font-size:14px;font-weight:550}
  .px-clean-assistant:hover{background:#f5f6f8}
  .px-clean-recent{display:grid;gap:2px;max-height:170px;overflow:hidden}
  .px-clean-recent button{width:100%;border:0;background:transparent;text-align:left;padding:7px 11px;border-radius:7px;color:#667080;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .px-clean-recent button:hover{background:#f0f2f5;color:#151a24}
  .px-clean-account{margin-top:auto;width:100%;border:1px solid #e0e4e9;background:#fff;border-radius:12px;padding:10px;display:flex;align-items:center;gap:10px;text-align:left;color:#151a24}
  .px-clean-account:hover{background:#f7f8fa}
  .px-clean-avatar{width:34px;height:34px;border-radius:50%;background:#e9edf2;display:grid;place-items:center;color:#697384;font-size:13px;font-weight:700;flex:0 0 34px}
  .px-clean-account-main{min-width:0;flex:1}.px-clean-account-name{display:block;font-size:13px;font-weight:650}.px-clean-account-plan{display:block;margin-top:2px;color:#8b93a0;font-size:11px}.px-clean-chevron{font-size:19px;color:#8b93a0}
  .px-clean-main{position:fixed;left:248px;right:0;top:0;bottom:0;overflow:auto;background:#fff;color:#141923;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .px-clean-topbar{height:72px;border-bottom:1px solid #eef0f3;display:flex;align-items:center;justify-content:flex-end;padding:0 36px}
  .px-clean-assistant-top{border:1px solid #e0e4e9;background:#fff;border-radius:10px;padding:10px 15px;font:600 13px inherit;cursor:pointer;color:#1b2230}.px-clean-assistant-top:hover{background:#f5f6f8}
  .px-clean-home{width:min(1050px,calc(100% - 64px));margin:0 auto;padding:62px 0 50px}
  .px-clean-hero{text-align:center}.px-clean-hero h1{margin:0;font-size:clamp(34px,4vw,52px);line-height:1.08;letter-spacing:-.045em;font-weight:720;color:#111722}.px-clean-hero p{margin:14px auto 34px;max-width:620px;color:#737d8e;font-size:15px;line-height:1.6}
  .px-clean-composer{background:#fff;border:1px solid #dce1e7;border-radius:15px;box-shadow:0 10px 32px rgba(20,27,38,.06);overflow:hidden;text-align:left}
  .px-clean-composer textarea{display:block;width:100%;min-height:116px;padding:20px 22px;border:0;outline:0;resize:none;background:#fff;color:#151b26;font:500 15px/1.55 inherit}.px-clean-composer textarea::placeholder{color:#929aaa}
  .px-clean-composer-bottom{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-top:1px solid #f0f2f5}.px-clean-attach{border:0;background:transparent;color:#7a8493;font:500 12px inherit;padding:7px}.px-clean-send{width:42px;height:42px;border:0;border-radius:10px;background:#141a24;color:#fff;font-size:21px;cursor:pointer}.px-clean-send:hover{background:#242c38}
  .px-clean-examples{display:flex;align-items:center;justify-content:center;gap:7px;flex-wrap:wrap;margin:20px 0 54px;color:#7a8493;font-size:12px}.px-clean-example{border:1px solid #e2e6eb;background:#fff;border-radius:999px;padding:8px 12px;color:#4f5968;font:500 12px inherit;cursor:pointer}.px-clean-example:hover{background:#f6f7f9}
  .px-clean-features{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #e9ecf0;border-bottom:1px solid #e9ecf0;margin-bottom:38px}.px-clean-feature{padding:28px 25px;text-align:center}.px-clean-feature+.px-clean-feature{border-left:1px solid #e9ecf0}.px-clean-feature-icon{font-size:24px;margin-bottom:12px}.px-clean-feature strong{display:block;font-size:14px;margin-bottom:6px}.px-clean-feature span{display:block;color:#7b8594;font-size:12px;line-height:1.5}
  .px-clean-recent-home{border-bottom:1px solid #e9ecf0;padding-bottom:28px}.px-clean-recent-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}.px-clean-recent-head h2{margin:0;font-size:18px;letter-spacing:-.025em}.px-clean-view{border:0;background:transparent;color:#1670e8;font:600 12px inherit;cursor:pointer}.px-clean-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.px-clean-card{border:1px solid #e2e6eb;border-radius:12px;padding:15px;background:#fff;display:flex;align-items:center;gap:11px;text-align:left;cursor:pointer}.px-clean-card:hover{background:#f8f9fb}.px-clean-card-icon{width:36px;height:36px;border-radius:50%;background:#eef4ff;color:#246ee8;display:grid;place-items:center;flex:0 0 36px}.px-clean-card-title{font-size:12px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.px-clean-card-meta{font-size:11px;color:#8a93a1;margin-top:3px}.px-clean-card-arrow{margin-left:auto;color:#707a89;font-size:18px}.px-clean-footer{text-align:center;color:#9aa2ae;font-size:12px;line-height:1.8;padding:56px 0 10px}
  .px-clean-panel{width:min(1000px,calc(100% - 64px));margin:0 auto;padding:50px 0}.px-clean-panel h1{margin:0 0 8px;font-size:34px;letter-spacing:-.04em}.px-clean-panel p{color:#7b8594;font-size:14px}.px-clean-empty{margin-top:25px;border:1px solid #e3e7ec;border-radius:12px;padding:28px;background:#fff;color:#737d8c;font-size:13px}
  .px-clean-assistant-modal{position:fixed;z-index:100010;right:24px;top:78px;width:min(390px,calc(100vw - 32px));background:#fff;border:1px solid #dfe4ea;border-radius:14px;box-shadow:0 18px 50px rgba(15,22,32,.15);padding:18px}.px-clean-assistant-modal h3{margin:0 0 5px;font-size:16px}.px-clean-assistant-modal p{margin:0 0 14px;color:#7c8592;font-size:12px}.px-clean-assistant-modal textarea{width:100%;min-height:90px;border:1px solid #e1e5ea;border-radius:9px;padding:10px;resize:none;outline:0;font:13px/1.5 inherit}.px-clean-assistant-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:10px}.px-clean-assistant-actions button{border:1px solid #dfe4e9;background:#fff;border-radius:8px;padding:8px 11px;font:600 12px inherit;cursor:pointer}.px-clean-assistant-actions .primary{background:#151b25;color:#fff;border-color:#151b25}
  .px-clean-source-hidden{display:none!important}
  @media(max-width:800px){.px-clean-sidebar{position:fixed;width:100%;height:68px;bottom:auto;padding:8px 12px;flex-direction:row;align-items:center}.px-clean-brand{padding:0 10px;font-size:19px}.px-clean-nav{display:flex;flex:1;justify-content:center}.px-clean-nav button{width:auto;padding:9px 10px;justify-content:center}.px-clean-nav button span:last-child{display:none}.px-clean-divider,.px-clean-label,.px-clean-assistant,.px-clean-recent,.px-clean-account-main,.px-clean-chevron{display:none}.px-clean-account{margin:0;width:auto;border:0;padding:0;background:transparent}.px-clean-main{left:0;top:68px}.px-clean-topbar{height:56px;padding:0 14px}.px-clean-home{width:calc(100% - 28px);padding:38px 0}.px-clean-hero h1{font-size:34px}.px-clean-features,.px-clean-cards{grid-template-columns:1fr}.px-clean-feature+.px-clean-feature{border-left:0;border-top:1px solid #e9ecf0}.px-clean-feature{padding:20px}.px-clean-panel{width:calc(100% - 28px)}}
  `;

  const addStyle = () => { if(document.getElementById('px-clean-final-style')) return; const s=document.createElement('style'); s.id='px-clean-final-style'; s.textContent=CSS; document.head.appendChild(s); };

  function leaf(label){
    return [...document.querySelectorAll('#appRoot *')].find(el => el.children.length===0 && (el.textContent||'').trim()===label) || null;
  }
  function clickLegacy(label){
    const el=leaf(label); if(!el) return false;
    const target=el.closest('button,a,[role="button"],li') || el;
    target.click(); return true;
  }
  function hideLegacyChrome(){
    const all=[...document.querySelectorAll('#appRoot *')];
    for(const el of all){
      if(el.children.length) continue;
      const t=(el.textContent||'').trim().toLowerCase();
      if(t==='builder'){
        let n=el;
        for(let i=0;i<6&&n&&n!==document.body;i++,n=n.parentElement){
          const r=n.getBoundingClientRect();
          if(r.width>100 && r.width<360 && r.height>400){n.classList.add('px-clean-source-hidden');break;}
        }
      }
    }
    // Hide any remaining legacy left rail by geometry/text signature.
    for(const el of [...document.querySelectorAll('#appRoot > *,#appRoot > * > *')]){
      const r=el.getBoundingClientRect(); const txt=(el.textContent||'').toLowerCase();
      if(r.width>120&&r.width<360&&r.height>500&&txt.includes('universal creation engine')&&txt.includes('new creation')) el.classList.add('px-clean-source-hidden');
    }
  }
  function recent(){
    const out=[];
    try{
      for(const key of ['builder_universal_v14','builder_state_v14']){
        const raw=localStorage.getItem(key); if(!raw) continue;
        const s=JSON.parse(raw); const list=Array.isArray(s.projects)?s.projects:[];
        for(const p of list){
          const title=String(p.title||p.name||p.intention||p.intent||'').split('\n')[0].trim();
          if(title&&!out.includes(title)) out.push(title);
        }
      }
    }catch{}
    return out.slice(0,6);
  }
  function showAssistant(){
    document.querySelector('.px-clean-assistant-modal')?.remove();
    const m=document.createElement('div');m.className='px-clean-assistant-modal';
    m.innerHTML='<h3>Assistant X</h3><p>Ask about a project, an idea, or what to do next.</p><textarea placeholder="What do you need help with?"></textarea><div class="px-clean-assistant-actions"><button data-close>Close</button><button class="primary" data-send>Ask Assistant</button></div>';
    document.body.appendChild(m);
    m.addEventListener('click',e=>{if(e.target.closest('[data-close]'))m.remove();if(e.target.closest('[data-send]')){const v=m.querySelector('textarea').value.trim();if(v){m.querySelector('p').textContent='Assistant X is ready to work with this request from your project context.';m.querySelector('textarea').value='';}}});
  }
  function creationStart(text){
    const btn=document.querySelector('[data-action="newProject"]');
    if(btn){btn.click();setTimeout(()=>{const input=document.querySelector('#heroPrompt');if(input){input.value=text;input.dispatchEvent(new Event('input',{bubbles:true));}},80);return;}
    window.dispatchEvent(new CustomEvent('projectx:start',{detail:{text}}));
  }
  function home(){
    let main=document.querySelector('.px-clean-main');
    if(main) main.remove();
    main=document.createElement('main');main.className='px-clean-main';
    const rs=recent();
    main.innerHTML=`<div class="px-clean-topbar"><button class="px-clean-assistant-top" data-assistant>✦ &nbsp; Assistant X</button></div><section class="px-clean-home"><div class="px-clean-hero"><h1>What do you want to create?</h1><p>Describe your idea. ProjectX will ask the right questions, understand it, and help you turn it into reality.</p><div class="px-clean-composer"><textarea id="px-clean-prompt" placeholder="Tell me what you want to create..."></textarea><div class="px-clean-composer-bottom"><button class="px-clean-attach" type="button">⌕ &nbsp; Add file (optional)</button><button class="px-clean-send" type="button" data-create>→</button></div></div><div class="px-clean-examples"><span>Try an example:</span><button class="px-clean-example">Website for my sneaker store</button><button class="px-clean-example">Local café business plan</button><button class="px-clean-example">A 2D platformer game</button><button class="px-clean-example">AI study assistant</button><button class="px-clean-example">Other idea</button></div></div><div class="px-clean-features"><div class="px-clean-feature"><div class="px-clean-feature-icon">□</div><strong>Understand your idea</strong><span>Asks only what’s needed</span></div><div class="px-clean-feature"><div class="px-clean-feature-icon">≋</div><strong>Creates a tailored workspace</strong><span>Sections adapt to your project</span></div><div class="px-clean-feature"><div class="px-clean-feature-icon">ϟ</div><strong>Helps you go from idea to real</strong><span>Plan, build, organize, execute</span></div></div><section class="px-clean-recent-home"><div class="px-clean-recent-head"><h2>Recent creations</h2><button class="px-clean-view" data-view-projects>View all →</button></div><div class="px-clean-cards">${(rs.length?rs:['No recent creations yet']).slice(0,3).map((x,i)=>x==='No recent creations yet'?'<div class="px-clean-empty">No recent creations yet. Start with the prompt above.</div>':`<button class="px-clean-card" data-recent="${esc(x)}"><span class="px-clean-card-icon">${i===0?'◉':i===1?'□':'⌁'}</span><span style="min-width:0"><span class="px-clean-card-title">${esc(x)}</span><span class="px-clean-card-meta">Recent creation</span></span><span class="px-clean-card-arrow">›</span></button>`).join('')}</div></section><div class="px-clean-footer">Ideas to reality, with you.<br>ProjectX</div></section>`;
    document.body.appendChild(main);
    main.addEventListener('click',e=>{
      if(e.target.closest('[data-assistant]')) return showAssistant();
      const ex=e.target.closest('.px-clean-example'); if(ex){document.querySelector('#px-clean-prompt').value=ex.textContent;document.querySelector('#px-clean-prompt').focus();return;}
      if(e.target.closest('[data-create]')){const v=document.querySelector('#px-clean-prompt').value.trim();if(v)creationStart(v);return;}
      const card=e.target.closest('[data-recent]');if(card){clickLegacy(card.dataset.recent);return;}
      if(e.target.closest('[data-view-projects]'))clickLegacy('Projects');
    });
  }
  function panel(title,desc){
    const main=document.querySelector('.px-clean-main'); if(!main)return;
    main.innerHTML=`<div class="px-clean-topbar"><button class="px-clean-assistant-top" data-assistant>✦ &nbsp; Assistant X</button></div><section class="px-clean-panel"><h1>${esc(title)}</h1><p>${esc(desc)}</p><div class="px-clean-empty">This section is connected to your ProjectX workspace. Use the navigation to switch areas.</div></section>`;
    main.querySelector('[data-assistant]')?.addEventListener('click',showAssistant);
  }
  function buildSidebar(){
    if(document.querySelector('.px-clean-sidebar'))return;
    const side=document.createElement('aside');side.className='px-clean-sidebar';
    const rs=recent();
    side.innerHTML=`<div class="px-clean-brand">ProjectX</div><nav class="px-clean-nav"><button data-nav="Home" class="active"><span class="px-clean-icon">⌂</span><span>Home</span></button><button data-nav="Projects"><span class="px-clean-icon">□</span><span>Projects</span></button><button data-nav="Analytics"><span class="px-clean-icon">▥</span><span>Analytics</span></button><button data-nav="Settings"><span class="px-clean-icon">⚙</span><span>Settings</span></button></nav><div class="px-clean-divider"></div><div class="px-clean-label">Assistant</div><button class="px-clean-assistant" data-assistant>✦ <span>Assistant X</span></button><div class="px-clean-divider"></div><div class="px-clean-label">Recent</div><div class="px-clean-recent">${rs.length?rs.map(x=>`<button data-recent="${esc(x)}">${esc(x)}</button>`).join(''):'<button disabled>No recent creations</button>'}</div><button class="px-clean-account" data-account><span class="px-clean-avatar">P</span><span class="px-clean-account-main"><span class="px-clean-account-name">Pushkar</span><span class="px-clean-account-plan">Free Plan</span></span><span class="px-clean-chevron">›</span></button>`;
    document.body.appendChild(side);
    side.addEventListener('click',e=>{
      if(e.target.closest('[data-assistant]'))return showAssistant();
      const nav=e.target.closest('[data-nav]');
      if(nav){side.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x===nav));const label=nav.dataset.nav;if(label==='Home')home();else {clickLegacy(label);panel(label,label==='Projects'?'Your creations and saved work.':label==='Analytics'?'Usage and project activity.':'Account, preferences, and plan settings.');}return;}
      const r=e.target.closest('[data-recent]');if(r){clickLegacy(r.dataset.recent);return;}
      if(e.target.closest('[data-account]')){side.querySelector('[data-nav="Settings"]').click();}
    });
  }
  function start(){
    addStyle();
    hideLegacyChrome();
    buildSidebar();
    home();
    const obs=new MutationObserver(()=>{hideLegacyChrome();});
    const root=document.querySelector('#appRoot');if(root)obs.observe(root,{subtree:true,childList:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,50));else setTimeout(start,50);
})();
