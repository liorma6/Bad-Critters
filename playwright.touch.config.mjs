import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',testMatch:'touch-highlights.spec.mjs',outputDir:'test-results/touch-runs',timeout:45000,expect:{timeout:10000},workers:1,
 reporter:[['list'],['json',{outputFile:'test-results/touch-browser-report.json'}]],
 use:{baseURL:'http://127.0.0.1:4173',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},
 projects:[
  {name:'chrome-mobile',grep:/conversation buttons|picker opens/,use:{...devices['Pixel 7'],browserName:'chromium',channel:'chrome'}},
  {name:'webkit-mobile',grep:/conversation buttons|picker opens/,use:{...devices['iPhone 13'],browserName:'webkit'}},
  {name:'chrome-desktop',grep:/mouse hover|picker opens/,use:{browserName:'chromium',channel:'chrome',viewport:{width:1280,height:800}}},
 ],
 webServer:{command:'node server.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:true},
});
