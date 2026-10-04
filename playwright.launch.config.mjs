import base from './playwright.config.mjs';
export default {...base,testMatch:/launch-(safety|account)\.spec\.mjs/,outputDir:'test-results/launch-runs',reporter:[['list'],['json',{outputFile:'reports/launch-2026-10-04/browser-launch.json'}]]};
