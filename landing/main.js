import { App } from './App.js';
import { installInteractions } from './interactions.js';

const waveUrl = new URL('../landing-assets/projectx-wave.webp', import.meta.url).href;
document.documentElement.style.setProperty('--landing-wave-image', `url("${waveUrl}")`);

const root = document.querySelector('#root');
root.innerHTML = App();
installInteractions();
