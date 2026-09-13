import fs from 'node:fs';
import path from 'node:path';

const root=new URL('../', import.meta.url).pathname;
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(['node_modules','.git','.next','dist'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(p)}}
walk(root);
const text=files.filter(f=>/\.(js|ts|html|css|json|toml|sql|yml|yaml)$/.test(f) && !f.endsWith('scripts/security-scan.mjs')).map(f=>({f,t:fs.readFileSync(f,'utf8')}));
const all=text.map(x=>x.t).join('\n');
const checks=[
  ['No committed secret-looking API keys',!/(sk-[A-Za-z0-9_-]{16,}|AIza[A-Za-z0-9_-]{20,}|sb_secret_|sb_service_role_)/.test(all)],
  ['No private key blocks',!/BEGIN (RSA|EC|OPENSSH)? ?PRIVATE KEY/.test(all)],
  ['No obvious command execution in browser',!/(child_process|execSync|spawnSync)\s*\(/.test(all)],
  ['No eval or Function constructor',!(/\beval\s*\(|new Function\s*\(/.test(all))],
  ['No plaintext connected-account tokens in base schema',!/(access_token|refresh_token)/.test(fs.readFileSync(path.join(root,'supabase/schema.sql'),'utf8'))],
  ['Provider credential table is server-only',/ai_provider_credentials[\s\S]{0,500}Never expose|ai_provider_credentials/.test(all)],
  ['Security headers are configured',fs.existsSync(path.join(root,'_headers')) && fs.existsSync(path.join(root,'netlify.toml'))],
  ['Robots and sitemap exist',fs.existsSync(path.join(root,'robots.txt')) && fs.existsSync(path.join(root,'sitemap.xml'))],
  ['Legal pages exist',fs.existsSync(path.join(root,'privacy.html')) && fs.existsSync(path.join(root,'terms.html'))],
  ['Custom 404 exists',fs.existsSync(path.join(root,'404.html'))],
  ['Payment webhook function exists',fs.existsSync(path.join(root,'supabase/functions/payments/index.ts'))],
  ['Audit/billing migration exists',fs.existsSync(path.join(root,'supabase/migrations/002_security_billing.sql'))]
];
let failed=0;
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);if(!ok)failed++}
process.exitCode=failed?1:0;
