(() => {
  'use strict';

  const STORE = 'projectx_settings_v1';
  const get = () => { try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } };
  const save = (patch) => { const next = { ...get(), ...patch }; localStorage.setItem(STORE, JSON.stringify(next)); return next; };
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

  const groups = [
    ['general','General','Workspace basics'],
    ['ai','AI','Providers, models & usage'],
    ['agents','Agents','Agent behavior'],
    ['integrations','Integrations','Connected services'],
    ['defaults','Project Defaults','New project preferences'],
    ['appearance','Appearance','Interface preferences'],
    ['notifications','Notifications','What ProjectX should tell you'],
    ['security','Security & Privacy','Account & data controls'],
    ['git','Git & Deployment','Repositories & publishing'],
    ['storage','Storage','Files & space'],
    ['billing','Billing & Usage','Plan & consumption'],
    ['advanced','Advanced','Power-user controls']
  ];

  const agents = [
    ['Discuss','Understands the goal and asks questions'],
    ['Research','Collects and organizes research'],
    ['Plan','Turns intent into a structured plan'],
    ['Build','Creates or updates the project'],
    ['Test','Checks the result for problems'],
    ['Review','Reviews quality and suggests improvements']
  ];

  const state = () => ({
    name: 'Pushkar',
    workspace: 'ProjectX',
    language: 'English',
    timezone: 'Asia/Kolkata',
    autosave: true,
    confirmDelete: true,
    aiMode: 'automatic',
    responseStyle: 'balanced',
    appearance: 'system',
    density: 'comfortable',
    reduceMotion: false,
    emailNotifications: true,
    browserNotifications: false,
    buildNotifications: true,
    testNotifications: true,
    creditNotifications: true,
    framework: 'Automatic',
    database: 'Automatic',
    auth: 'Automatic',
    deployment: 'Not configured',
    autoCommit: false,
    autoDeploy: false,
    debug: false,
    experimental: false,
    ...get()
  });

  const css = `
  .pxs{width:min(1120px,calc(100% - 48px));margin:auto;padding:34px 0 70px;color:#171a1f}
  .pxs-head{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:28px}
  .pxs-eyebrow{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:#9aa2ad;font-weight:750;margin-bottom:9px}
  .pxs-head h1{font-size:38px;line-height:1.05;letter-spacing:-.055em;margin:0}
  .pxs-head p{font-size:13px;color:#78818d;margin:9px 0 0;line-height:1.5}
  .pxs-layout{display:grid;grid-template-columns:205px minmax(0,1fr);gap:34px;align-items:start}
  .pxs-nav{position:sticky;top:18px;display:grid;gap:2px}
  .pxs-nav button{border:0;background:transparent;text-align:left;border-radius:8px;padding:9px 10px;color:#68717d;font-size:11px;font-weight:600;cursor:pointer}
  .pxs-nav button:hover{background:#f3f4f5;color:#171a1f}.pxs-nav button.active{background:#eceef1;color:#171a1f}
  .pxs-section{display:none}.pxs-section.active{display:block}
  .pxs-title{margin-bottom:18px}.pxs-title h2{font-size:18px;letter-spacing:-.025em;margin:0 0 5px}.pxs-title p{font-size:12px;color:#7d8691;margin:0;line-height:1.55}
  .pxs-card{border:1px solid #e1e5e9;border-radius:11px;background:#fff;margin-bottom:12px;overflow:hidden}
  .pxs-row{min-height:62px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid #edf0f2}.pxs-row:last-child{border-bottom:0}
  .pxs-row-main{min-width:0}.pxs-row-main strong{display:block;font-size:12px;font-weight:680}.pxs-row-main span{display:block;font-size:10px;color:#8a939e;margin-top:4px;line-height:1.45}
  .pxs-control{flex:0 0 auto}.pxs-control input[type=text],.pxs-control input[type=password],.pxs-control select{width:210px;height:34px;border:1px solid #d9dee3;border-radius:7px;background:#fff;padding:0 9px;color:#303640;font-size:11px;outline:0}.pxs-control input:focus,.pxs-control select:focus{border-color:#aab1b9;box-shadow:0 0 0 2px #f0f1f2}
  .pxs-toggle{width:36px;height:20px;border:0;border-radius:999px;background:#d9dde1;padding:2px;cursor:pointer}.pxs-toggle i{display:block;width:16px;height:16px;background:#fff;border-radius:50%;transition:transform .15s}.pxs-toggle.on{background:#171a1f}.pxs-toggle.on i{transform:translateX(16px)}
  .pxs-select{width:210px;height:34px;border:1px solid #d9dee3;border-radius:7px;background:#fff;padding:0 9px;color:#303640;font-size:11px}
  .pxs-save{border:0;border-radius:8px;background:#171a1f;color:#fff;padding:9px 13px;font-size:11px;font-weight:650;cursor:pointer}.pxs-save.secondary{background:#fff;color:#4f5864;border:1px solid #d9dee3}
  .pxs-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.pxs-note{padding:12px 14px;border:1px dashed #d9dee3;border-radius:9px;color:#7d8691;font-size:11px;line-height:1.55;background:#fafbfc}
  .pxs-agent{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid #edf0f2}.pxs-agent:last-child{border-bottom:0}.pxs-agent strong{font-size:12px}.pxs-agent span{display:block;font-size:10px;color:#8a939e;margin-top:4px}.pxs-agent select{width:150px;height:32px;border:1px solid #d9dee3;border-radius:7px;font-size:10px;padding:0 7px;background:#fff}.pxs-badge{font-size:9px;color:#8b949f;border:1px solid #e0e4e8;border-radius:999px;padding:5px 7px;white-space:nowrap}
  .pxs-placeholder{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 16px}.pxs-placeholder strong{font-size:12px}.pxs-placeholder p{font-size:10px;color:#858e99;margin:5px 0 0}.pxs-placeholder button{border:1px solid #d9dee3;background:#fff;border-radius:7px;padding:8px 10px;font-size:10px;color:#59636f;cursor:pointer}
  .pxs-danger{border-color:#e5dede}.pxs-danger h3{font-size:12px;margin:0}.pxs-danger p{font-size:10px;color:#8b7e7e;margin:5px 0 12px}.pxs-danger button{border:1px solid #d8caca;background:#fff;border-radius:7px;color:#795e5e;padding:8px 10px;font-size:10px;cursor:pointer}
  .pxs-toast{position:fixed;right:24px;bottom:24px;background:#171a1f;color:#fff;padding:10px 13px;border-radius:8px;font-size:11px;box-shadow:0 8px 25px rgba(0,0,0,.12);z-index:2147483649}
  @media(max-width:800px){.pxs{width:calc(100% - 28px);padding:28px 0 50px}.pxs-head h1{font-size:32px}.pxs-layout{grid-template-columns:1fr;gap:20px}.pxs-nav{position:static;display:flex;overflow:auto;padding-bottom:2px}.pxs-nav button{white-space:nowrap}.pxs-control input[type=text],.pxs-control input[type=password],.pxs-control select,.pxs-select{width:160px}.pxs-row{gap:12px}.pxs-agent{grid-template-columns:1fr auto}.pxs-agent select{grid-column:1 / -1;width:100%}.pxs-head .pxs-save{display:none}}
  `;

  function inject(){
    if(document.getElementById('pxs-css')) return;
    const s=document.createElement('style'); s.id='pxs-css'; s.textContent=css; document.head.appendChild(s);
  }

  function row(label, desc, control){
    return `<div class="pxs-row"><div class="pxs-row-main"><strong>${label}</strong><span>${desc}</span></div><div class="pxs-control">${control}</div></div>`;
  }
  const toggle=(key)=>`<button class="pxs-toggle ${state()[key]?'on':''}" data-toggle="${key}" aria-label="Toggle ${key}"><i></i></button>`;
  const select=(key,options)=>`<select class="pxs-select" data-setting="${key}">${options.map(x=>`<option value="${esc(x)}" ${state()[key]===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`;

  function section(id,title,desc,body){
    return `<section class="pxs-section ${id==='general'?'active':''}" data-section-page="${id}"><div class="pxs-title"><h2>${title}</h2><p>${desc}</p></div>${body}</section>`;
  }

  function render(){
    const main=document.querySelector('.pxc-main');
    if(!main) return;
    inject();
    const s=state();
    main.innerHTML=`<div class="pxc-top"><button data-pxs-home>← Home</button></div><div class="pxs"><div class="pxs-head"><div><div class="pxs-eyebrow">PROJECT X · ACCOUNT</div><h1>Settings</h1><p>One place for your workspace, AI, integrations and preferences.</p></div><button class="pxs-save" data-save-all>Save changes</button></div><div class="pxs-layout"><nav class="pxs-nav">${groups.map(([id,label,sub])=>`<button class="${id==='general'?'active':''}" data-pxs-tab="${id}"><span>${label}</span></button>`).join('')}</nav><div class="pxs-pages">
      ${section('general','General','Basic workspace preferences.',`<div class="pxs-card">${row('Workspace name','Name shown for this workspace.',`<input type="text" data-setting="workspace" value="${esc(s.workspace)}">`)}${row('Language','Default language for the ProjectX interface.',select('language',['English','Hindi','Auto']))}${row('Time zone','Used for dates and scheduled activity.',`<input type="text" data-setting="timezone" value="${esc(s.timezone)}">`)}${row('Auto-save','Keep local changes saved automatically.',toggle('autosave'))}${row('Confirm before deleting','Ask before destructive project actions.',toggle('confirmDelete'))}</div>`)}
      ${section('ai','AI','Choose how ProjectX handles AI configuration.',`<div class="pxs-card">${row('Model selection','Let ProjectX choose a model or use a fixed preference.',select('aiMode',['automatic','manual']))}${row('Response style','Preferred level of detail.',select('responseStyle',['concise','balanced','detailed']))}${row('AI credentials','Secure provider-key storage is not exposed in this client yet.','<span class="pxs-badge">Placeholder</span>')}</div><div class="pxs-note">API keys should not be stored in browser localStorage. A secure server-side credential vault can be connected here later.</div><div class="pxs-card" style="margin-top:12px"><div class="pxs-placeholder"><div><strong>Model catalog</strong><p>Provider and model discovery will appear here when the secure credential layer is connected.</p></div><span class="pxs-badge">Coming soon</span></div></div>`)}
      ${section('agents','Agents','Configure the roles that help turn an idea into a finished result.',`<div class="pxs-card">${agents.map(([name,desc],i)=>`<div class="pxs-agent"><div><strong>${name}</strong><span>${desc}</span></div><select data-agent-model="${name}"><option>Automatic</option><option>Project default</option><option>Provider model</option></select>${i<5?toggle('agent_'+name.toLowerCase()):'<span class="pxs-badge">Enabled</span>'}</div>`).join('')}</div><div class="pxs-note">Advanced per-agent tool permissions and model routing are reserved for the secure agent service. The controls above are safe local preferences.</div>`)}
      ${section('integrations','Integrations','Connect services that ProjectX can work with.',`<div class="pxs-card">${['GitHub','Supabase','Google','Figma','Deployment provider'].map(name=>`<div class="pxs-placeholder"><div><strong>${name}</strong><p>${name==='Deployment provider'?'Deployment connection is not configured.':'Connection state is not available in this client.'}</p></div><button data-placeholder="${name}">Connect</button></div>`).join('')}</div>`)}
      ${section('defaults','Project Defaults','Starting defaults for new creations. Each project can override these.',`<div class="pxs-card">${row('Framework','Default software framework.',select('framework',['Automatic','Web','React','Node','Other']))}${row('Database','Default data layer.',select('database',['Automatic','Supabase','Other']))}${row('Authentication','Default authentication choice.',select('auth',['Automatic','Email','Google','Other']))}${row('Deployment','Default publishing target.',select('deployment',['Not configured','GitHub Pages','Other']))}</div>`)}
      ${section('appearance','Appearance','Keep the interface comfortable and restrained.',`<div class="pxs-card">${row('Theme','Interface appearance.',select('appearance',['system','light','dark']))}${row('Density','Amount of space in the interface.',select('density',['comfortable','compact']))}${row('Reduce motion','Minimize non-essential animations.',toggle('reduceMotion'))}</div><div class="pxs-note">Theme changes are stored locally. Full application-wide theme synchronization can be connected to the account profile later.</div>`)}
      ${section('notifications','Notifications','Choose which events should appear in your account.',`<div class="pxs-card">${row('Build completed','Tell me when a build finishes.',toggle('buildNotifications'))}${row('Tests','Tell me when tests report a problem.',toggle('testNotifications'))}${row('Credit warnings','Warn me about usage limits.',toggle('creditNotifications'))}${row('Email notifications','Email delivery is reserved for the notification service.',toggle('emailNotifications'))}${row('Browser notifications','Browser permission flow is not enabled yet.',toggle('browserNotifications'))}</div>`)}
      ${section('security','Security & Privacy','Account and data controls.',`<div class="pxs-card">${['Password & authentication','Active sessions','Connected account permissions','Data export','AI data & privacy controls'].map(x=>`<div class="pxs-placeholder"><div><strong>${x}</strong><p>Secure account service placeholder.</p></div><span class="pxs-badge">Placeholder</span></div>`).join('')}</div><div class="pxs-card pxs-danger" style="padding:16px"><h3>Delete account</h3><p>Permanent account deletion requires the authenticated account service.</p><button data-placeholder="Delete account">Unavailable</button></div>`)}
      ${section('git','Git & Deployment','Repository and publishing preferences.',`<div class="pxs-card">${row('Auto-commit','Commit generated changes automatically.',toggle('autoCommit'))}${row('Auto-deploy','Deploy after a successful build.',toggle('autoDeploy'))}${row('Default repository','Choose where new projects publish.','<span class="pxs-badge">Not configured</span>')}</div><div class="pxs-note">GitHub OAuth, repository selection, environment variables and deployment secrets should be handled by the server-side integration layer. Placeholder controls are intentionally non-functional until that layer is connected.</div>`)}
      ${section('storage','Storage','Files, attachments and storage usage.',`<div class="pxs-card"><div class="pxs-placeholder"><div><strong>Storage usage</strong><p>Usage data will appear when the storage service is connected.</p></div><span class="pxs-badge">Placeholder</span></div><div class="pxs-placeholder"><div><strong>Project assets</strong><p>Manage uploaded assets and unused files.</p></div><button data-placeholder="Project assets">Open</button></div></div>`)}
      ${section('billing','Billing & Usage','Plan and consumption information.',`<div class="pxs-card">${row('Current plan','Your current ProjectX plan.','<span class="pxs-badge">Free</span>')}${row('AI credits','Credit balance requires the usage service.','<span class="pxs-badge">Placeholder</span>')}${row('Usage history','Detailed consumption history.',`<button class="pxs-save secondary" data-placeholder="Usage history">View</button>`)}</div><div class="pxs-note">Payments and plan changes are intentionally left as placeholders until billing is connected. No payment information is collected here.</div>`)}
      ${section('advanced','Advanced','Power-user controls. Change these only when you know what they do.',`<div class="pxs-card">${row('Debug mode','Expose additional diagnostics when supported.',toggle('debug'))}${row('Experimental features','Enable features that are not yet part of the stable experience.',toggle('experimental'))}${row('API access','Developer API controls require a secure backend.', '<span class="pxs-badge">Placeholder</span>')}${row('Webhooks','Webhook management requires a secure backend.', '<span class="pxs-badge">Placeholder</span>')}</div><div class="pxs-actions"><button class="pxs-save secondary" data-reset-settings>Reset local settings</button><button class="pxs-save" data-save-all>Save changes</button></div>`)}
    </div></div></div>`;
    bind();
  }

  function setValue(key,value){ save({[key]:value}); }
  function toast(text){ const old=document.querySelector('.pxs-toast'); old?.remove(); const t=document.createElement('div'); t.className='pxs-toast'; t.textContent=text; document.body.appendChild(t); setTimeout(()=>t.remove(),1800); }

  function bind(){
    const main=document.querySelector('.pxc-main');
    main.querySelectorAll('[data-pxs-tab]').forEach(b=>b.addEventListener('click',()=>{
      main.querySelectorAll('[data-pxs-tab]').forEach(x=>x.classList.toggle('active',x===b));
      main.querySelectorAll('[data-section-page]').forEach(x=>x.classList.toggle('active',x.dataset.sectionPage===b.dataset.pxsTab));
    }));
    main.querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.toggle;setValue(k,!state()[k]);b.classList.toggle('on',!!state()[k]);}));
    main.querySelectorAll('[data-setting]').forEach(c=>c.addEventListener('change',()=>setValue(c.dataset.setting,c.value)));
    main.querySelectorAll('[data-agent-model]').forEach(c=>c.addEventListener('change',()=>save({['agentModel_'+c.dataset.agentModel]:c.value})));
    main.querySelectorAll('[data-save-all]').forEach(b=>b.addEventListener('click',()=>{main.querySelectorAll('[data-setting]').forEach(c=>setValue(c.dataset.setting,c.value));toast('Settings saved');}));
    main.querySelectorAll('[data-placeholder]').forEach(b=>b.addEventListener('click',()=>toast(`${b.dataset.placeholder}: placeholder — service not connected yet`)));
    main.querySelector('[data-reset-settings]')?.addEventListener('click',()=>{if(confirm('Reset local ProjectX settings?')){localStorage.removeItem(STORE);render();toast('Local settings reset');}});
    main.querySelector('[data-pxs-home]')?.addEventListener('click',()=>{document.querySelector('.pxc-new')?.click();});
  }

  document.addEventListener('click',(e)=>{
    const nav=e.target.closest('[data-nav="settings"]');
    if(!nav) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    document.querySelectorAll('.pxc-nav button').forEach(b=>b.classList.toggle('active',b===nav));
    render();
  },true);

  window.addEventListener('load',()=>{ if(document.querySelector('.pxc')) inject(); });
})();
