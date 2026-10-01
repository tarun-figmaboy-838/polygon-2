/* Swiftee's bubble fits its words, on every screen, while she speaks them.
     node tests/checks/check-dialogue-fit.cjs
   The bubble used to sit in a fixed lane 360 stage px wide on most screens, so a
   long line wrapped into a tall, thin column beside a board with room to spare.
   Now one rule sizes it (dialogueLayout, fittedDialogue): the widest clear strip
   between the stage's margin and the screen's work, the fewest lines that strip
   allows, then the narrowest width that keeps them. These checks hold it there:

   - while the real voice plays, the bubble never resizes, moves or rewraps once its
     first word is showing, is never shown empty, and never flashes the whole line
   - at rest, on every screen and for every feedback line: the fewest lines the
     strip allows, at most three, no word left alone on the last line, nothing of
     the screen's work covered, nothing clipped, inside the stage, every word at the
     lesson's 46px, the tail the same small gap from Swiftee's crest
   - the copy it is measured in is hidden from sight and from screen readers, and is
     gone afterwards; the bubble never takes a click
   - resizing the window mid-sentence keeps the screen, the words shown so far, and
     the bubble's size and place on the stage
   - drawn in another face than it was measured in, it still leaves no word alone and
     nothing spilling out */
const fs=require('fs'),path=require('path'),http=require('http');
const {chromium}=require('playwright');
const R=path.resolve(__dirname,'..','..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json'};
const server=http.createServer((q,s)=>{const f=path.resolve(R,'.'+decodeURIComponent(new URL(q.url,'http://x').pathname).replace(/^\/$/,'/index.html'));
  if(!f.startsWith(R+path.sep)){s.writeHead(403);s.end();return;}
  fs.readFile(f,(e,d)=>{s.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});s.end(e?'m':d);});});
const fail=[];
const check=(ok,msg)=>{console.log((ok?'PASS ':'FAIL ')+msg); if(!ok) fail.push(msg);};
/* Lines the lesson speaks outside the step table, on the screen they are spoken on. */
const EXTRA={14:["Look! This boundary isn't curved. It is made of straight lines.",'Look closely. This boundary bends smoothly. It is curved.','Is the boundary straight or curved?'],
  23:['Perfect! Side, vertex and angle — all labelled.']};

/* The bubble at rest, in stage px. Runs in the page. */
function atRest(){
  const g=window.__poly,sign=document.querySelector('.comic-dialogue.dialogue-box');
  if(!sign||getComputedStyle(sign).visibility==='hidden'||+getComputedStyle(sign).opacity<0.5) return null;
  const panel=sign.offsetParent,root=panel.parentElement,sr=panel.getBoundingClientRect(),f=1980/sr.width;
  const txt=sign.querySelector('.narrator-text'),LH=46*1.2;
  const words=[...txt.querySelectorAll('span')].filter(sp=>/\S/.test(sp.textContent));
  const lineOf=sp=>Math.floor((sp.offsetTop+sp.offsetHeight/2)/LH);
  const lines=[...new Set(words.map(lineOf))].sort((a,b)=>a-b);
  const B={x:sign.offsetLeft,y:sign.offsetTop,r:sign.offsetLeft+sign.offsetWidth,b:sign.offsetTop+sign.offsetHeight};
  const R=el=>{const q=el.getBoundingClientRect();return{x:(q.x-sr.x)*f,y:(q.y-sr.y)*f,r:(q.right-sr.x)*f,b:(q.bottom-sr.y)*f};};
  const vis=el=>{for(let e=el;e&&e!==root;e=e.parentElement){const cs=getComputedStyle(e);if(cs.visibility==='hidden'||cs.display==='none'||+cs.opacity<0.1)return false;}return true;};
  const hit=(a,c)=>a.x<c.r-1&&c.x<a.r-1&&a.y<c.b-1&&c.y<a.b-1;
  const over=new Set();
  const consider=(el,tag)=>{if(el.closest('.comic-dialogue')||el.closest('#polygon-screen-navigator')||!vis(el))return;const q=R(el);
    if(q.r-q.x<3&&q.b-q.y<3)return; if(q.r-q.x>1500&&q.b-q.y>700)return; if(hit(B,q))over.add(tag);};
  root.querySelectorAll('button,[role=button],[role=group],.shape-card,.label-socket,.label-tile,[data-label-target],.game-action,.story-controls > *')
    .forEach(el=>consider(el,String(el.className.baseVal||el.className||el.tagName).split(' ')[0]+':'+(el.textContent||'').trim().slice(0,12)));
  root.querySelectorAll('.story-surface svg path,.story-surface svg polygon,.story-surface svg polyline,.story-surface svg circle,.story-surface svg text').forEach(el=>consider(el,'figure:'+el.tagName));
  const c=g.guideRef.current,gq=c&&R(c);
  if(gq){const w=gq.r-gq.x,h=gq.b-gq.y;if(hit(B,{x:gq.x+w*.3,y:gq.y+h*.2,r:gq.x+w*.7,b:gq.y+h*.55}))over.add('Swiftee\'s face');}
  const tail=sign.querySelector('.dialogue-tail'),tip=new DOMPoint(12,54).matrixTransform(tail.getScreenCTM()),L=g.guideLayout();
  const gap=g.topLessonScene()?(L.x+L.w*.16)-(tip.x-sr.x)*f:(L.y+L.h*.11)-(tip.y-sr.y)*f;
  /* The fewest lines: the same words, all shown, at the strip's full text width. */
  const strip=g.dialogueLayout(),copy=txt.cloneNode(true);
  copy.querySelectorAll('span').forEach(sp=>{sp.style.opacity='1';sp.style.animation='none';});
  Object.assign(copy.style,{position:'absolute',left:'-10000px',top:'0',visibility:'hidden',width:(strip.w-48)+'px',maxWidth:'none'});
  document.body.appendChild(copy);const fewest=Math.round(copy.getBoundingClientRect().height/LH);copy.remove();
  const t=sign.querySelector('.dialogue-text');
  const mid=sign.getBoundingClientRect(),under=document.elementFromPoint(mid.x+mid.width/2,mid.y+mid.height/2);
  return{text:txt.textContent.replace(/\s+/g,' ').trim(),w:sign.offsetWidth,h:sign.offsetHeight,lines:lines.length,fewest,
    alone:lines.length>1&&words.filter(sp=>lineOf(sp)===lines[lines.length-1]).length===1,
    overlaps:[...over],inside:B.x>=0&&B.y>=0&&B.r<=1980&&B.b<=1980*9/16,gap:Math.round(gap),
    clipped:t.scrollWidth>t.clientWidth+2||t.scrollHeight>t.clientHeight+2,
    sizes:[...new Set(words.map(sp=>getComputedStyle(sp).fontSize))],takesClicks:!!(under&&under.closest('.comic-dialogue'))};
}
const judge=(where,m)=>{
  if(!m){check(false,where+': the bubble is on screen');return;}
  const bad=[];
  if(m.lines!==m.fewest) bad.push(m.lines+' lines where '+m.fewest+' fit');
  if(m.lines>3) bad.push(m.lines+' lines');
  if(m.alone) bad.push('a word alone on the last line');
  if(m.overlaps.length) bad.push('covers '+m.overlaps.join(', '));
  if(m.clipped) bad.push('clipped');
  if(!m.inside) bad.push('outside the stage');
  if(m.sizes.join()!=='46px') bad.push('text at '+m.sizes.join(','));
  if(m.gap<10||m.gap>32) bad.push('tail '+m.gap+'px from her crest');
  if(m.takesClicks) bad.push('takes clicks');
  check(!bad.length,where+': '+m.lines+' line'+(m.lines>1?'s':'')+', '+m.w+'x'+m.h+(bad.length?' — '+bad.join('; '):'')+' | '+m.text);
};

(async()=>{
  await new Promise(r=>server.listen(9436,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}});
    const errors=[]; page.on('pageerror',e=>{if(!/\{\{|attribute/.test(e.message))errors.push(e.message);});
    await page.goto('http://127.0.0.1:9436/index.html?preview=1&bridge=0');
    await page.waitForFunction(()=>window.__poly?.state.ready&&window.__poly.state.k===0,null,{timeout:60000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(2000);
    const steps=await page.evaluate(()=>__poly.steps().map(s=>({sc:s.sc,label:s.label,fb:Object.values(s.fb||{}).filter(t=>typeof t==='string')})));
    const worst={unstable:0,empty:0,flash:0};
    for(let k=0;k<steps.length;k++){
      if(steps[k].sc==='END') continue;   // the summary draws its own bubble (tests/summary.test.cjs)
      const n=k+1, where='Screen '+n+' ('+steps[k].label+')';
      await page.evaluate(k=>{const g=__poly;g.setState({k},()=>g.runStep(k,false));},k);
      /* Her real voice: the bubble every 40 ms until she has finished and the screen is hers to use. */
      const seen=await page.evaluate(k=>new Promise(done=>{
        const g=__poly,t0=performance.now(),out=[];
        const tick=()=>{
          if(g.state.k!==k){done(out);return;}
          const s=document.querySelector('.comic-dialogue.dialogue-box');
          if(s&&getComputedStyle(s).visibility!=='hidden'&&+getComputedStyle(s).opacity>0.05){
            const all=[...s.querySelectorAll('.narrator-text span')].filter(sp=>/\S/.test(sp.textContent));
            out.push({text:all.map(sp=>sp.textContent).join(' '),lit:all.filter(sp=>+getComputedStyle(sp).opacity>0.05).length,of:all.length,
              layout:s.offsetWidth+'x'+s.offsetHeight+'@'+s.offsetLeft+','+s.offsetTop+' '+all.map(sp=>sp.offsetLeft+','+sp.offsetTop).join(' ')});
          }
          if((!g._voiceLocked&&g.state.storyControls&&performance.now()-t0>1500&&out.length)||performance.now()-t0>22000) done(out); else setTimeout(tick,40);
        };
        tick();
      }),k);
      const layouts={}; seen.filter(x=>x.lit).forEach(x=>(layouts[x.text]=layouts[x.text]||new Set()).add(x.layout));
      const unstable=Object.values(layouts).filter(v=>v.size>1).length, empty=seen.filter(x=>!x.lit).length, flash=seen.length&&seen[0].lit===seen[0].of&&seen[0].of>3?1:0;
      if(unstable||empty||flash) check(false,where+': while she speaks'+(unstable?', the bubble resizes or rewraps':'')+(empty?', it is shown empty':'')+(flash?', the whole line flashes first':''));
      worst.unstable+=unstable; worst.empty+=empty; worst.flash+=flash;
      judge(where,await page.evaluate(atRest));
      for(const text of steps[k].fb.concat(EXTRA[n]||[])){
        const m=await page.evaluate(({text,src})=>new Promise(res=>{const g=__poly;
          g.setState({narr:text,narrShow:text});g.prepareNarratorReveal(g.instructionPages(text)[0]);
          g.setState({wordReveal:'complete',storyDialogue:true},()=>setTimeout(()=>res(Object.assign(eval('('+src+')')()||{},{chunks:g.instructionPages(text).length})),60));}),{text,src:atRest.toString()});
        judge(where+', feedback',m);
        if(m.chunks!==1) check(false,where+': "'+text+'" is split into '+m.chunks+' chunks');
      }
    }
    check(!worst.unstable&&!worst.empty&&!worst.flash,'while she speaks, on every screen: no resize or rewrap once a word shows, never empty, never the whole line first');

    /* The copy the bubble is measured in. */
    const probe=await page.evaluate(()=>{const g=__poly,seen=[],add=Element.prototype.appendChild;
      Element.prototype.appendChild=function(el){if(el&&el.style&&el.style.left==='-10000px')seen.push({aria:el.getAttribute('aria-hidden'),vis:el.style.visibility,pe:el.style.pointerEvents,home:this.className||this.tagName});return add.call(this,el);};
      try{g.fittedDialogue('A measuring line nobody has seen before, with a polygon in it.');}finally{Element.prototype.appendChild=add;}
      return{seen,left:[...document.querySelectorAll('[aria-hidden="true"]')].filter(el=>el.style&&el.style.left==='-10000px').length};});
    check(probe.seen.length===1&&probe.seen[0].aria==='true'&&probe.seen[0].vis==='hidden'&&probe.seen[0].pe==='none'&&probe.left===0,
      'the bubble is measured in one hidden, aria-hidden copy that is removed afterwards '+JSON.stringify(probe));
    const again=await page.evaluate(()=>{const g=__poly,add=Element.prototype.appendChild;let n=0;
      Element.prototype.appendChild=function(el){if(el&&el.style&&el.style.left==='-10000px')n++;return add.call(this,el);};
      try{g.fittedDialogue('A measuring line nobody has seen before, with a polygon in it.');}finally{Element.prototype.appendChild=add;}return n;});
    check(again===0,'the same words are not measured twice');

    /* Resize while she is mid-sentence. */
    for(const n of [18,33]){
      await page.evaluate(n=>{const g=__poly;g.setState({k:n-1},()=>g.runStep(n-1,false));},n);
      await page.waitForFunction(()=>__poly.state.wordReveal==='recorded'&&__poly.state.revealedWords>=2,null,{timeout:20000});
      const read=()=>page.evaluate(()=>{const g=__poly,s=document.querySelector('.comic-dialogue.dialogue-box');return{k:g.state.k,words:g.state.revealedWords,box:s.offsetWidth+'x'+s.offsetHeight+'@'+s.offsetLeft+','+s.offsetTop};});
      const seq=[await read()];
      for(const vp of [[390,844],[1024,768],[1920,1080],[1440,810]]){await page.setViewportSize({width:vp[0],height:vp[1]});await page.waitForTimeout(200);seq.push(await read());}
      check(seq.every(x=>x.k===n-1)&&new Set(seq.map(x=>x.box)).size===1&&seq.every((x,i)=>!i||x.words>=seq[i-1].words),
        'Screen '+n+': resizing mid-sentence keeps the screen, the words shown and the bubble '+JSON.stringify(seq));
      await page.waitForFunction(()=>!__poly._voiceLocked,null,{timeout:20000}).catch(()=>{});
    }
    /* The words drawn in another face than the one the bubble was measured in (a webfont that
       failed or came late, a browser that sets type its own way): still no word alone at the
       end, nothing spilling out of the box. */
    await page.addStyleTag({content:'.comic-dialogue .narrator-text,.comic-dialogue .narrator-text span{font-family:"Arial Black",Arial,sans-serif!important}'});
    // as a page drawn in that face from the start: nothing measured before it is kept
    await page.evaluate(()=>{const g=__poly;if(g._dialogueWidths)g._dialogueWidths.clear();if(g._fitStrikes)g._fitStrikes.clear();});
    for(const n of [3,18,20]){
      await page.evaluate(n=>{const g=__poly;g.setState({k:n-1},()=>g.runStep(n-1,false));},n);
      await page.waitForFunction(n=>{const g=__poly;return g.state.k===n-1&&g.state.narrShow===g.step().narr&&g.state.wordReveal!=='waiting';},n,{timeout:20000}).catch(()=>{});
      await page.waitForTimeout(500);
      const m=await page.evaluate(()=>{const s=document.querySelector('.comic-dialogue.dialogue-box'),t=s.querySelector('.narrator-text'),LH=55.2;
        const w=[...t.children].filter(x=>/\S/.test(x.textContent)),line=x=>Math.floor((x.offsetTop+x.offsetHeight/2)/LH),L=[...new Set(w.map(line))];
        return{lines:L.length,alone:L.length>1&&w.filter(x=>line(x)===L[L.length-1]).length===1,spill:t.scrollWidth>t.clientWidth+1,box:s.offsetWidth+'x'+s.offsetHeight,text:t.textContent};});
      check(!m.alone&&!m.spill,'Screen '+n+' in another face: '+m.lines+' lines, '+m.box+(m.alone?' — a word alone':'')+(m.spill?' — spills out':'')+' | '+m.text);
    }
    check(errors.length===0,'no page errors: '+errors.slice(0,2).join(' | '));
  } finally { await browser.close(); server.close(); }
  if(fail.length){console.error('\n'+fail.length+' check(s) failed');process.exit(1);}
  console.log('\nall checks passed');
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
