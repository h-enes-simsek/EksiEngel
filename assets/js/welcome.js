import * as enums from './enums.js';
import {commHandler} from './commHandler.js';

console.log("welcome.js: has been started.");

commHandler.sendAnalyticsData({click_type:enums.ClickType.WELCOME_PAGE});

linkAboutLimit.onclick = function(element) {
  commHandler.sendAnalyticsData({click_type:enums.ClickType.WELCOME_LINK_ENTRY_LIMIT});
};
