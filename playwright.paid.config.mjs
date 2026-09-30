import config from './playwright.config.mjs';
export default {...config,use:{...config.use,baseURL:'http://127.0.0.1:4191'},webServer:{command:'node server.mjs',url:'http://127.0.0.1:4191',env:{PORT:'4191'},reuseExistingServer:true}};
