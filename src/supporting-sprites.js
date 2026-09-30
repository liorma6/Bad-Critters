import {artAssets} from './art-assets.js';
import {speech} from './speech-animation.js';
import {drawSpeakingSprite,MOUTH_RIGS} from './mouth-rigs.js';
export function drawSupporting(c,id,x,y,w,h){
 const image=artAssets[`${id}-alive`];if(!image)return;
 if(speech.resident!==id){c.drawImage(image,x,y,w,h);return;}
 c.save();c.translate(x,y);c.scale(w/image.width,h/image.height);c.translate(0,image.height-8);drawSpeakingSprite(c,image,[0,0,image.width,image.height,0],1,MOUTH_RIGS[id],speech.mouth);c.restore();
}
