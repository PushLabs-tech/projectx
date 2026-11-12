import { copyFile } from 'node:fs/promises';

await copyFile(new URL('../config.js', import.meta.url), new URL('../dist/config.js', import.meta.url));
