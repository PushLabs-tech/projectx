import { App } from './App.js';
import { installInteractions } from './interactions.js';

const landingBase = import.meta.env?.BASE_URL || '/projectx/';
const waveUrl = `${landingBase}landing-assets/projectx-wave.webp`;
document.documentElement.style.setProperty('--landing-wave-image', `url("${waveUrl}")`);

const root = document.querySelector('#root');
root.innerHTML = App();
installInteractions();
