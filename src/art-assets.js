import {BUILDINGS} from './scene-layout.js';
export const artAssets={};
export const ART_IDS=[...Object.keys(BUILDINGS),'home-burned','home-collapsed','courtyard-evidence','badger-alive','hedgehog-alive','hedgehog-injured',...'pigeon cat boar turtle goat snake'.split(' ').map(id=>`${id}-dark`)];
export function loadArt(ids=ART_IDS){
 return Promise.all(ids.map(id=>new Promise(resolve=>{
  const img=new Image();img.onload=()=>{artAssets[id]=img;resolve(true);};img.onerror=()=>{console.error(`Could not load artwork: ${id}`);resolve(false);};img.src=`assets/art/${id}.webp`;
 })));
}
