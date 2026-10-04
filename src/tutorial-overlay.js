import {guidance} from './progression.js';
import {interactionTargets} from './render.js';
export class TutorialOverlay{
 constructor({canvas,getState,isModal,onSkip}){
  Object.assign(this,{canvas,getState,isModal});this.layer=document.createElement('div');this.layer.id='tutorial-coach';this.layer.hidden=true;this.layer.innerHTML='<div id="tutorial-hole"></div><section id="tutorial-instruction" aria-label="הדרכה"><p id="tutorial-text" aria-live="polite"></p><progress id="tutorial-watch-progress" max="2" value="0" aria-label="התקדמות התצפית" hidden></progress><small id="tutorial-note"></small><button id="tutorial-skip" class="text-button">דילוג על ההדרכה</button></section>';document.body.append(this.layer);
  this.hole=this.layer.firstElementChild;this.tip=this.layer.lastElementChild;this.text=this.tip.querySelector('p');this.note=this.tip.querySelector('small');this.progress=this.tip.querySelector('progress');this.skip=this.tip.querySelector('button');this.skip.onclick=onSkip;
  this.nightNote=document.createElement('p');this.nightNote.id='night-invitation-note';this.nightNote.hidden=true;document.getElementById('action-dock').prepend(this.nightNote);
  const guard=event=>{if(!this.spec?.blocking||this.layer.hidden||this.tip.contains(event.target)||event.target.closest?.('#skip-tutorial,#close-dialog'))return;if(this.allowed().some(el=>el===event.target||el.contains(event.target)))return;event.preventDefault();event.stopImmediatePropagation();};
  document.addEventListener('pointerdown',guard,true);document.addEventListener('click',guard,true);
  document.addEventListener('keydown',event=>{if(!this.spec?.blocking||this.layer.hidden||event.key!=='Tab')return;const items=[...this.allowed(),this.skip].filter(el=>el?.getClientRects().length&&!el.disabled),index=items.indexOf(document.activeElement);event.preventDefault();items[(index+(event.shiftKey?-1:1)+items.length)%items.length]?.focus({preventScroll:true});},true);
 }
 worldTarget(){const s=this.getState();return s.tutorial.enabled&&['place-lens','watch','prefact','trace','witness'].includes(s.tutorial.step)?guidance(s).target:null;}
 allowed(){const items=[this.spec?.element||this.canvas];if(this.spec?.world||guidance(this.getState()).action==='notebook')items.push(...document.querySelectorAll('#guide-action:not(:disabled),#next-action:not(:disabled)'));if(this.isModal())items.push(document.querySelector('#close-dialog'));return items.filter(Boolean);}
 specification(){
  const s=this.getState(),step=s.tutorial.step;if(!s.tutorial.enabled||step==='done'||['night','discovery'].includes(s.flow)||s.paused)return null;
  const selectors={lens:'#lens','notebook-before':'#notebook','notebook-entry':`#entry-${s.tutorial.observationId} summary`,'notebook-return':'#notebook-close','prefact-return':'#back-world','trace-return':'#back-world','ask-witness':'[data-question="alibi"]','witness-return':'#leave-person',advance:'#next-action'};
  const dialogStep=['notebook-entry','notebook-return','prefact-return','trace-return','ask-witness','witness-return'].includes(step);
  if(this.isModal()!==dialogStep)return null;
  if(selectors[step]){const element=document.querySelector(selectors[step]);if(!element)return null;return {element,blocking:step!=='advance',rect:()=>{
   const target=element.getBoundingClientRect(),entry=(step==='notebook-return'?document.getElementById(`entry-${s.tutorial.observationId}`):step==='prefact-return'?document.getElementById('preliminary-notice'):null)?.getBoundingClientRect();
   // Keep the newly opened observation readable while teaching the one exit action.
   if(!entry)return target;const left=Math.min(entry.left,target.left),top=Math.min(entry.top,target.top);return {left,top,width:Math.max(entry.right,target.right)-left,height:Math.max(entry.bottom,target.bottom)-top};
  }};}
  const target=this.worldTarget();if(!target)return null;
  return {world:target,blocking:true,rect:()=>{const b=interactionTargets(s,canvasWidth(this.canvas)).find(t=>t.id===target.id&&t.type===target.type)?.rect,c=this.canvas.getBoundingClientRect();return b?{left:c.left+b.x*c.width/1000,top:c.top+b.y*c.height/760,width:b.w*c.width/1000,height:b.h*c.height/760}:null;}};
 }
 update(){
  const s=this.getState(),spec=this.spec=this.specification();this.nightNote.hidden=!spec||spec.blocking;document.body.classList.toggle('with-night-invitation',!!spec&&!spec.blocking);if(!spec){this.layer.hidden=true;this.lastStep=null;document.querySelector('#next-action')?.classList.remove('night-invitation');return;}
  if(!spec.blocking){this.layer.hidden=true;this.lastStep=null;this.nightNote.textContent=guidance(s).text;document.querySelector('#next-action').classList.add('night-invitation');return;}
  const step=s.tutorial.step;
  this.layer.hidden=false;this.layer.dataset.step=step;this.layer.classList.toggle('nonblocking',!spec.blocking);document.querySelector('#next-action')?.classList.toggle('night-invitation',!spec.blocking);
  const changed=this.lastStep!==step;this.lastStep=step;
  if(changed){const g=guidance(s);this.text.textContent=g.text;this.note.textContent=g.detail+(spec.world?' במקלדת: Enter מפעיל את היעד המסומן.':'');if(spec.blocking){if(spec.element)spec.element.scrollIntoView({block:'center',behavior:'instant'});else{const r=spec.rect();if(r)window.scrollBy({top:r.top+r.height/2-innerHeight*.43,behavior:'instant'});} (spec.element||this.canvas).focus({preventScroll:true});}}
  const rect=spec.rect();if(!rect)return;const x=Math.max(4,rect.left-6),y=Math.max(4,rect.top-6),right=Math.min(innerWidth-4,rect.left+rect.width+6),bottom=Math.min(innerHeight-4,rect.top+rect.height+6);
  Object.assign(this.hole.style,{left:x+'px',top:y+'px',width:Math.max(0,right-x)+'px',height:Math.max(0,bottom-y)+'px'});
  this.progress.hidden=s.tutorial.step!=='watch';this.progress.value=Math.min(2,s.tutorial.watchSeconds);
  this.tip.style.width=Math.min(330,innerWidth-24)+'px';const width=this.tip.offsetWidth,height=this.tip.offsetHeight;
  let top=bottom+12;if(top+height>innerHeight-8)top=y-height-12;
  Object.assign(this.tip.style,{left:Math.max(12,Math.min(innerWidth-width-12,(x+right-width)/2))+'px',top:Math.max(8,top)+'px'});
 }
}
const canvasWidth=canvas=>canvas.getBoundingClientRect().width;
