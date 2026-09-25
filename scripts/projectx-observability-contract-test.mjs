import fs from 'node:fs';

const ui=fs.readFileSync('px-ui.js','utf8');
const app=fs.readFileSync('px-final.js','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const mustUi=['[\'runs\', \'Runs\']','[\'palette-runs\', \'Open execution runs\', \'runs\']'];
const mustApp=['async function renderExecutionRuns(project)','engine_runs','engine_run_events','project_execution_events','job_queue','verification_results','deployments','projectx_build_runs','setInterval(()=>{if(document.visibilityState===\'visible\'&&activeProject()?.id===project.id)draw();},8000)'];
for(const needle of [...mustUi,...mustApp]){
  const source=mustUi.includes(needle)?ui:app;
  if(!source.includes(needle)) throw new Error('Missing observability contract: '+needle);
}
if(!pkg.scripts.check.includes('projectx-observability-contract-test.mjs')) throw new Error('package check missing observability contract');
console.log('ProjectX observability contract: PASS');
