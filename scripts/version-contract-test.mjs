import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pkg = JSON.parse(read('package.json'));
const version = fs.readFileSync(new URL('../VERSION', import.meta.url), 'utf8').trim();
const html = read('index.html');

assert.equal(pkg.version, version, 'package.json and VERSION must match');
for (const asset of ['px-app.css', 'config.js', 'px-final.js']) {
  assert.match(html, new RegExp(`(?:href|src)="\\./${asset.replace('.', '\\.')}\\?v=${version.replaceAll('.', '\\.')}"`), `${asset} must use the current release cache key`);
}
console.log('PASS release version and workspace asset cache contract');
