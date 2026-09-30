import {handleDubbing} from './dubbing.js';
export default {async fetch(request,env){
 if(new URL(request.url).pathname.startsWith('/api/dubbing/'))return handleDubbing(request,env);
 return env.ASSETS.fetch(request);
}};
