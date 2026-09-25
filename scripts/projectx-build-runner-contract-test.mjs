import fs from 'node:fs';
import assert from 'node:assert/strict';

const workflow = fs.readFileSync('.github/workflows/projectx-build.yml', 'utf8');
assert.match(workflow, /repository_dispatch:/);
assert.match(workflow, /types:\s*\[projectx_build\]/);
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /actions\/checkout@v4/);
assert.match(workflow, /persist-credentials:\s*false/);
assert.match(workflow, /GITHUB_TOKEN:\s*""/);
assert.match(workflow, /timeout-minutes:\s*10/);
assert.match(workflow, /actions\/upload-artifact@v4/);
assert.match(workflow, /projectx-build-evidence\.json/);
assert.match(workflow, /permissions:\s*\n\s+contents:\s+read\n\s+actions:\s+read/);
assert.match(workflow, /Enforce verification result/);
console.log('ProjectX isolated build runner contract passed.');
