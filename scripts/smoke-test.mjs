import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
const root=new URL('..',import.meta.url).pathname;
const must=['index.html','app.js','styles.css','config.js','site.js','privacy.html','terms.html','thank-you.html','404.html','billing.html','billing.js','robots.txt','sitemap.xml','_headers','netlify.toml','vercel.json','supabase/schema.sql','supabase/migrations/002_security_billing.sql','supabase/functions/ai/index.ts','supabase/functions/payments/index.ts','scripts/security-scan.mjs'];
let failed=0;
for(const f of must){const ok=fs.existsSync(new URL(f,`file://${root.endsWith('/')?root:root+'/'}`));console.log(`${ok?'PASS':'FAIL'} ${f}`);if(!ok)failed++}
try{execFileSync(process.execPath,['--check',new URL('app.js',`file://${root.endsWith('/')?root:root+'/'}`).pathname],{stdio:'ignore'});console.log('PASS app.js syntax')}catch{console.log('FAIL app.js syntax');failed++}
try{execFileSync(process.execPath,['--check',new URL('site.js',`file://${root.endsWith('/')?root:root+'/'}`).pathname],{stdio:'ignore'});console.log('PASS site.js syntax')}catch{console.log('FAIL site.js syntax');failed++}
console.log(failed?`FAILED ${failed} checks`:'ALL CHECKS PASSED');process.exitCode=failed?1:0;
