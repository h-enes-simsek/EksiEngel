'use strict';

const rules = [{
    conditions: [
        new chrome.declarativeContent.PageStateMatcher({
            pageUrl: {hostEquals: 'eksisozluk.com'},
        })
    ],
    actions: [new chrome.declarativeContent.ShowPageAction()]
}];

//activate extension in the page eksisozluk.com
chrome.runtime.onInstalled.addListener(function() {
	chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
		chrome.declarativeContent.onPageChanged.addRules(rules);
	});
});