import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',testMatch:'mobile-audio-latency.spec.mjs',outputDir:'test-results/audio-runs',timeout:60000,expect:{timeout:12000},workers:1,
 reporter:[['list'],['json',{outputFile:'test-results/audio-browser-report.json'}]],
 use:{baseURL:'http://127.0.0.1:4173',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'chrome-desktop',use:{browserName:'chromium',channel:'chrome',viewport:{width:1280,height:800}}},
  {name:'chrome-mobile',use:{...devices['Pixel 7'],browserName:'chromium',channel:'chrome'}},
  {name:'webkit-mobile',use:{...devices['iPhone 13'],browserName:'webkit'}},
 ],
 webServer:{command:'node server.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:true},
});
