import * as enums from './enums.js';
import {commHandler} from './commHandler.js';
import {config} from './config.js';

console.log("welcome.js: has been started.");

document.addEventListener('DOMContentLoaded', async function () {

  commHandler.sendAnalyticsData({click_type:enums.ClickType.WELCOME_PAGE});

  linkAboutLimit.onclick = function(element) {
    commHandler.sendAnalyticsData({click_type:enums.ClickType.WELCOME_LINK_ENTRY_LIMIT});
  };
  
  linkAboutLimit.href = `${config.EksiSozlukURL}/eksi-sozlukun-yazar-engellemeye-sinir-getirmesi--7547420`;
  
});


