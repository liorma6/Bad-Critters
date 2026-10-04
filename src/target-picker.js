import {RESIDENTS,SUPPORTING,LOCATIONS} from './content.js';
import {portrait,renderPortraits} from './render.js';
export class TargetPicker{
 constructor(onSelect){
  this.onSelect=onSelect;this.layer=document.createElement('div');this.layer.id='target-picker-layer';this.layer.hidden=true;this.layer.innerHTML='<section id="target-picker" role="dialog" aria-modal="true" aria-label="מה לבחור כאן?" tabindex="-1"></section>';document.body.append(this.layer);this.panel=this.layer.firstElementChild;
  this.layer.addEventListener('pointerdown',event=>{event.stopPropagation();if(event.target===this.layer){event.preventDefault();this.close();}});
  this.layer.addEventListener('click',event=>event.stopPropagation());
  this.layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();this.close();}if(event.key==='Tab'){const buttons=[...this.panel.querySelectorAll('button')],index=buttons.indexOf(document.activeElement),next=index<0?(event.shiftKey?buttons.length-1:0):(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length;event.preventDefault();buttons[next]?.focus();}});
  window.addEventListener('resize',()=>this.position());window.addEventListener('scroll',()=>this.position(),{passive:true});
 }
 get opened(){return !this.layer.hidden;}
 open(targets,point,state){
  this.returnFocus=document.activeElement;this.point=point;this.layer.hidden=false;this.panel.replaceChildren();
  const title=document.createElement('strong');title.textContent='מה לבחור כאן?';this.panel.append(title);
  for(const target of targets){const person=[...RESIDENTS,...SUPPORTING].find(r=>r.id===target.id),place=LOCATIONS.find(l=>l.id===target.id),button=document.createElement('button');button.dataset.target=`${target.type}:${target.id}`;
   const action=person?`לדבר עם ${person.name}`:!state.crimeDone&&target.id===state.case.preLocation?'לקרוא את ההודעה':state.crimeDone?`לבדוק ראיות · ${place.name}`:`לבדוק את ${place.name}`;
   button.innerHTML=person?portrait(person):'<span class="target-icon" aria-hidden="true">▤</span>';const label=document.createElement('span');label.textContent=action;button.append(label);button.onclick=event=>{event.preventDefault();event.stopPropagation();this.close(false);this.onSelect(target);};this.panel.append(button);
  }
  const close=document.createElement('button');close.textContent='ביטול';close.className='text-button';close.onclick=()=>this.close();this.panel.append(close);renderPortraits();this.position();this.panel.focus({preventScroll:true});
 }
 position(){if(!this.opened)return;const w=this.panel.offsetWidth,h=this.panel.offsetHeight;this.panel.style.left=Math.max(8,Math.min(innerWidth-w-8,this.point.x+8))+'px';this.panel.style.top=Math.max(8,Math.min(innerHeight-h-8,this.point.y+8))+'px';}
 close(focus=true){if(!this.opened)return;this.layer.hidden=true;if(focus&&this.returnFocus?.isConnected)this.returnFocus.focus({preventScroll:true});}
}
