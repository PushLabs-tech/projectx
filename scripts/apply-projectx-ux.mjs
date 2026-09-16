import fs from 'node:fs';

const appPath = 'app.js';
const cssPath = 'styles.css';
let app = fs.readFileSync(appPath, 'utf8');
let css = fs.readFileSync(cssPath, 'utf8');

if (!app.includes('PROJECTX_ADAPTIVE_UX_V3')) {
  const anchor = '  function bindAuth(){\n';
  if (!app.includes(anchor)) throw new Error('bindAuth anchor not found');
  const fn = `  // PROJECTX_ADAPTIVE_UX_V3
  function projectXAdaptiveUX(){
    const root=document.querySelector('#appRoot');
    if(!root)return;
    root.querySelectorAll('h1,h2,h3,[role="heading"]').forEach(el=>{
      if(/^welcome back\\b/i.test((el.textContent||'').trim()))el.classList.add('px-hide-generic-welcome');
    });
    const p=project();
    if(!p||!state.projectId)return;
    const intent=String(p.intention||p.intent||p.description||p.title||'').trim();
    const type=detectType(intent);
    const title=String(p.title||type||'Project').trim();
    let header=root.querySelector('.px-project-header');
    if(!header){header=document.createElement('div');header.className='px-project-header';root.prepend(header);}
    header.innerHTML='<div class="px-project-title">'+esc(title)+'</div>';
    const schemas={
      Website:['Chat','Plan','Design','Preview','Code','Files','Test','Publish'],
      App:['Chat','Plan','Design','Preview','Code','Data','Test','Publish'],
      Mobile:['Chat','Plan','Design','Preview','Code','Data','Test','Publish'],
      Game:['Chat','Plan','Scenes','Assets','Code','Playtest','Test','Publish'],
      Agent:['Chat','Plan','Tools','Memory','Test','Deploy'],
      Automation:['Chat','Plan','Workflow','Integrations','Test','Deploy'],
      API:['Chat','Plan','Endpoints','Data','Test','Docs','Deploy'],
      Data:['Chat','Plan','Data','Analysis','Dashboard','Export'],
      Document:['Chat','Plan','Content','Review','Export'],
      Presentation:['Chat','Plan','Slides','Assets','Review','Export'],
      Research:['Chat','Research','Sources','Analysis','Findings','Report'],
      'Business system':['Chat','Plan','Customers','Operations','Analytics','Launch'],
      'Creative project':['Chat','Plan','Assets','Draft','Review','Export'],
      Custom:['Chat','Plan','Workspace','Output']
    };
    const sections=schemas[type]||schemas.App;
    let nav=root.querySelector('.px-adaptive-sections');
    if(!nav){nav=document.createElement('nav');nav.className='px-adaptive-sections';header.after(nav);}
    nav.innerHTML=sections.map((name,i)=>'<button type="button" class="px-section '+(i===0?'active':'')+'" data-px-section="'+esc(name.toLowerCase())+'">'+esc(name)+'</button>').join('');
    nav.querySelectorAll('[data-px-section]').forEach(btn=>btn.addEventListener('click',()=>{
      nav.querySelectorAll('.px-section').forEach(x=>x.classList.toggle('active',x===btn));
      const wanted=btn.dataset.pxSection;
      const match=[...root.querySelectorAll('[data-panel]')].find(el=>{
        const panel=String(el.dataset.panel||'').toLowerCase();
        const text=String(el.textContent||'').trim().toLowerCase();
        return panel===wanted||panel.includes(wanted)||text===wanted;
      });
      if(match)match.click();
      else if(wanted==='chat')root.querySelector('textarea,input[placeholder*="message" i],input[placeholder*="tell" i]')?.focus();
    }));
  }

`;
  app = app.replace(anchor, fn + anchor);
}

const renderAnchor = '    renderShell();\n    renderModal();\n';
if (!app.includes('    projectXAdaptiveUX();\n')) {
  if (!app.includes(renderAnchor)) throw new Error('render anchor not found');
  app = app.replace(renderAnchor, renderAnchor + '    bindEvents();\n    projectXAdaptiveUX();\n');
}

if (!css.includes('PROJECTX_CLEAN_UX_V3')) {
  css += `

/* PROJECTX_CLEAN_UX_V3 */
.px-hide-generic-welcome{display:none!important}
.px-project-header{width:100%;display:flex;align-items:center;justify-content:center;text-align:center;padding:26px 20px 8px}
.px-project-title{font-family:var(--font-sans);font-size:clamp(25px,3vw,38px);font-weight:700;line-height:1.15;letter-spacing:-.035em;color:var(--ink)}
.px-adaptive-sections{width:min(1100px,calc(100% - 32px));margin:8px auto 18px;display:flex;align-items:center;justify-content:center;gap:2px;overflow-x:auto;padding:4px;border-bottom:1px solid var(--line);scrollbar-width:none}
.px-adaptive-sections::-webkit-scrollbar{display:none}
.px-section{appearance:none;border:0;background:transparent;color:var(--muted);padding:9px 13px;font-size:12px;font-weight:600;white-space:nowrap;border-bottom:2px solid transparent;border-radius:0}
.px-section:hover{background:var(--surface-subtle);color:var(--ink)}
.px-section.active{color:var(--ink);border-bottom-color:var(--ink)}
@media(max-width:720px){.px-project-header{padding:20px 16px 6px}.px-project-title{font-size:25px}.px-adaptive-sections{width:calc(100% - 20px);justify-content:flex-start}.px-section{padding:8px 10px;font-size:11px}}
`;
}

fs.writeFileSync(appPath, app);
fs.writeFileSync(cssPath, css);
console.log('ProjectX UX patch applied');
