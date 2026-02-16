import * as enums from './enums.js';
import {commHandler} from './commHandler.js';
import {config} from './config.js';

console.log("welcome.js: has been started.");

// Apply saved theme on load
function applyTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

document.addEventListener('DOMContentLoaded', async function () {
  applyTheme();
});
