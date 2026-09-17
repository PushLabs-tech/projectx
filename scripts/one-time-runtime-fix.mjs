import fs from 'node:fs';

const file = 'px-final.js';
let source = fs.readFileSync(file, 'utf8');

source = source.replace('  applySpecChange,\n', '  applyProjectMutation,\n');

function replaceBlock(startMarker, endMarker, replacement) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Missing runtime marker: ${startMarker}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceBlock(
  'async function renderSection(project,section){',
  'const projectAgentSystem=',
  `async function renderSection(project,section){
  const body=$('#project-body');
  if(!body||!section)return;
  switch(section.kind){
    case 'conversation': return renderProjectChat(project);
    case 'output':
    case 'publish': return renderOutput(project);
    case 'code': return renderFiles(project);
    case 'test': return renderTests(project);
    case 'planning':
    case 'research':
    case 'workspace':
    default: return renderGeneratedSection(project,section);
  }
}
`,
);

replaceBlock(
  'function renderProjectChat(project,prefill=\'\'){',
  'function applyFileOperations(project,operations){',
  `function renderProjectChat(project,prefill=''){
  const body=$('#project-body');
  const messages=project.conversation.length?project.conversation.slice(-MAX_HISTORY):[{role:'assistant',text:'I have the canonical project state in context. What should we change or work on next?'}];
  body.innerHTML='<div class="box"><div class="sub">Project Chat changes the canonical project state. Real mutations create a new version and invalidate dependent output.</div><div id="project-log" class="conversation"></div><form id="project-form" class="form"><textarea id="project-input" placeholder="Ask ProjectX to change, build, research, test, or explain something..."></textarea><button class="primary" id="project-send">Send</button></form></div>';
  drawConversation(messages,'#project-log');
  const input=$('#project-input'),send=$('#project-send');
  input.value=prefill;
  $('#project-form').onsubmit=async e=>{
    e.preventDefault();
    const text=input.value.trim();
    if(!text||send.disabled)return;
    send.disabled=true;
    messages.push({role:'user',text});
    drawConversation(messages,'#project-log');
    input.value='';
    try{
      const data=await aiJson('discuss',{project,history:messages,message:text,system:projectAgentSystem},5500);
      if(!data)throw new Error('The AI returned invalid project action data.');
      const wantsMutation=Boolean(
        data.changed||
        (data.specPatch&&typeof data.specPatch==='object'&&Object.keys(data.specPatch).length)||
        (Array.isArray(data.workspaceSections)&&data.workspaceSections.length)||
        (Array.isArray(data.fileOperations)&&data.fileOperations.length)||
        (Array.isArray(data.agents)&&data.agents.length)
      );
      if(wantsMutation){
        snapshot(project,'Before change');
        const mutation=applyProjectMutation(project,{
          specPatch:data.specPatch||{},
          workspaceSections:Array.isArray(data.workspaceSections)?data.workspaceSections:undefined,
          agents:Array.isArray(data.agents)?data.agents:undefined,
          fileOperations:Array.isArray(data.fileOperations)?data.fileOperations:[]
        });
        if(!mutation.changed)throw new Error('The AI requested a mutation but nothing in the canonical project state changed.');
        project.status=data.needsBuild?'needs-build':'changed';
        project.executionState={...(project.executionState||{}),lastAgent:'orchestrator'};
      }
      if(data.changed&&!wantsMutation)throw new Error('The AI claimed a change without returning an executable mutation.');
      messages.push({role:'assistant',text:String(data.message||'Done.')});
      project.conversation=messages.slice(-MAX_HISTORY);
      saveProject(project);
      await syncRemoteProject(project);
      renderProject(project);
    }catch(error){
      messages.push({role:'assistant',text:\`I couldn't complete that request: \${error.message}\`});
      drawConversation(messages,'#project-log');
    }finally{send.disabled=false;}
  };
  input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();$('#project-form').requestSubmit();}};
}
`);

if(!source.includes('applyProjectMutation'))throw new Error('Canonical mutation import was not applied');
if(!source.includes("switch(section.kind)"))throw new Error('Kind-driven section routing was not applied');
if(source.includes("const name=section.name.toLowerCase();if(/playtest|preview|output/.test(name)"))throw new Error('Legacy name-driven section routing remains');

fs.writeFileSync(file, source);
console.log('PASS: canonical mutation + kind-driven section runtime patch');
