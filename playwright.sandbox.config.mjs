import config from './playwright.config.mjs';
// Only fixture tests. Provider and email requests are intercepted in account-login.spec.mjs.
process.env.ZOOBLUFF_BROWSER_SANDBOX='1';
export default {...config,testMatch:'account-login.spec.mjs',use:{...config.use,baseURL:'http://127.0.0.1:4175'},webServer:{command:'node server.mjs',url:'http://127.0.0.1:4175',env:{PORT:'4175'},reuseExistingServer:false}};
