/*
  Ribbit Rampage — Live Build (External JS)
  --------------------------------------------------
  How to use:
  1) Host this file and include it once on your page, after your theme scripts:
     <script src="https://raw.githubusercontent.com/FrogMallet/frogmallet.github.io/main/ribbit-rampage.js"></script>

  2) Minimal HTML required in the page body:
     - HUD elements (already in your theme):
         <div id="fly-counter">Flies Squashed: 0</div>
         <div id="rampage-timer">1:00</div>
         <img id="golden-frog" ... id="golden-frog" />
     - Boss overlay (if you don't have it, this script will create one):
         <div id="boss-fight" aria-hidden="true">
           <div id="boss-health"><div id="boss-health-fill"></div></div>
           <img id="boss-fly" src="(your BossFly.png)" alt="Boss Fly"/>
         </div>

  3) This script will ensure a centered wrapper and a countdown BAR above the boss
     (created if missing) that shrinks over 10 seconds after the FIRST hit.

  Hotkeys:
    - K: splat all current flies (debug/party mode)
    - B: start boss fight immediately
*/

(() => {
  if (window.__ribbitRampageActive) return;
  window.__ribbitRampageActive = true;

  // ---------------- State ----------------
  let flyKillCount = 0;
  let spawnRateMultiplier = 1;
  let spawnAllowed = true;
  let rampageTimer = null;
  let rampageTimeLeft = 60;
  let rampageActive = false;

  let postFirstKill = false;

  let bossActive = false;
  const bossHPMax = 300;
  let bossHP = bossHPMax;
  let bossHitGateTS = 0;          // throttle stamp for boss hits

  // Countdown bar state (requestAnimationFrame loop)
  let bossCountdownRAF = null;
  const BOSS_COUNTDOWN_MS = 12000; // 10s after first hit

  const FROG_DELAY_MS = 3200;

  // ---------------- DOM ----------------
  const flyContainer = document.body;
  const counterNodes = Array.from(document.querySelectorAll('#fly-counter'));
  const timerEl   = document.getElementById('rampage-timer');
  const frogEl    = document.getElementById('golden-frog');

  // Boss scaffold (created/normalized below)
  let bossWrap  = document.getElementById('boss-fight');
  let bossEl    = document.getElementById('boss-fly');
  let healthFill= document.getElementById('boss-health-fill');

  // Utilities
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const rand  = (a,b)=> a + Math.random()*(b-a);
  const clamp = (v,min,max)=> Math.min(Math.max(v,min),max);
  const hsl   = (h,s,l)=>`hsl(${h} ${s}% ${l}%)`;

  // ---------------- Ensure Boss UI exists & centered wrapper with countdown bar ----------------
// ---------------- Ensure Boss UI exists & align countdown to health bar ----------------
function ensureBossUI(){
  // Create boss overlay if missing
  if (!bossWrap){
    bossWrap = document.createElement('div');
    bossWrap.id = 'boss-fight';
    bossWrap.setAttribute('aria-hidden','true');
    Object.assign(bossWrap.style,{display:'none',position:'fixed',inset:'0',zIndex:'10004',pointerEvents:'none'});
    document.body.appendChild(bossWrap);
  }

  // Health bar (top centered)
  if (!healthFill){
    const hb = document.createElement('div');
    hb.id = 'boss-health';
    Object.assign(hb.style,{
      position:'absolute',
      top:'20px',
      left:'50%',
      transform:'translateX(-50%)',
      width:'min(90vw,600px)',
      height:'22px',
      border:'2px solid #000',
      background:'#222',
      borderRadius:'12px',
      overflow:'hidden',
      zIndex:'10005'
    });
    const fill = document.createElement('div');
    fill.id = 'boss-health-fill';
    Object.assign(fill.style,{height:'100%',width:'100%',background:hsl(120,100,40)});
    hb.appendChild(fill);
    bossWrap.appendChild(hb);
    healthFill = fill;
  }

  // Boss fly (kept centered; can live in a simple center wrapper)
  if (!bossEl){
    bossEl = document.createElement('img');
    bossEl.id = 'boss-fly';
    bossEl.alt = 'Boss Fly';
    bossEl.src = 'https://raw.githubusercontent.com/FrogMallet/frogmallet.github.io/ae7427698f32ed7b44dc617a4df7a37c0e9ade48/BossFly.png';
    Object.assign(bossEl.style,{
      position:'absolute',
      top:'50%',
      left:'50%',
      transform:'translate(-50%,-50%)',
      width:'min(60vw,450px)',
      userSelect:'none',
      pointerEvents:'auto'
    });
    bossWrap.appendChild(bossEl);
  }

  // Countdown bar: ABSOLUTE, same width & centering as health bar, below it
  let bossCountdown = document.getElementById('boss-countdown');
  let bossCountdownFill = document.getElementById('boss-countdown-fill');

  if (!bossCountdown){
    bossCountdown = document.createElement('div');
    bossCountdown.id = 'boss-countdown';
    Object.assign(bossCountdown.style,{
      position:'absolute',
      top:'45px',                     // just under #boss-health (which is at 20px + 22px height + ~10px gap)
      left:'50%',
      transform:'translateX(-50%)',
      width:'min(90vw,600px)',        // EXACT same width rule as #boss-health
      height:'14px',
      border:'2px solid #000',
      background:'#222',
      borderRadius:'10px',
      overflow:'hidden',
      display:'none',
      zIndex:'10005',
      boxShadow:'0 0 10px rgba(0,0,0,.6) inset'
    });
    bossWrap.appendChild(bossCountdown);

    bossCountdownFill = document.createElement('div');
    bossCountdownFill.id = 'boss-countdown-fill';
    Object.assign(bossCountdownFill.style,{
      height:'100%',
      width:'100%',
      background:'linear-gradient(90deg, #ff3b3b, #ffd400)',
      transition:'width .08s linear'
    });
    bossCountdown.appendChild(bossCountdownFill);
  } else if (!bossCountdownFill){
    bossCountdownFill = document.createElement('div');
    bossCountdownFill.id = 'boss-countdown-fill';
    Object.assign(bossCountdownFill.style,{
      height:'100%',
      width:'100%',
      background:'linear-gradient(90deg, #ff3b3b, #ffd400)',
      transition:'width .08s linear'
    });
    bossCountdown.appendChild(bossCountdownFill);
  }

  return { bossCountdown, bossCountdownFill };
}


  // ---------------- Audio ----------------
  const splatSound     = new Audio('https://github.com/FrogMallet/frogmallet.github.io/raw/refs/heads/main/splat.mp3');
  const rampageSound   = new Audio('https://github.com/FrogMallet/frogmallet.github.io/raw/refs/heads/main/Ribbit%20Rampage.mp3');
  const decimatedSound = new Audio('https://github.com/FrogMallet/frogmallet.github.io/raw/refs/heads/main/Flies%20Decimated.mp3');

  // ---------------- Helpers ----------------
  function setCounterText(txt){ counterNodes.forEach(el=>{ if(el) el.textContent = txt; }); }
  function updateCounter(){ setCounterText(`Flies Squashed: ${flyKillCount}`); }

  function showGoldenFrogDelayed(){
    setTimeout(()=>{
      const el = document.getElementById('golden-frog');
      if(!el) return;
      el.style.display = 'block';
      el.style.transform = 'translate(-50%,-50%) scale(1.1)';
    }, FROG_DELAY_MS);
  }

  // Enforce exactly one live fly until first kill
  let enforceObserver = null;
  function pruneToSingleFly(){
    if (postFirstKill) return;
    const all = Array.from(document.querySelectorAll('.fly:not(.splatted), .rr-fly:not(.splatted)'));
    if (all.length > 1) all.slice(1).forEach(n => n.remove());
  }
  function enforceOneFlyUntilFirstKill(){
    pruneToSingleFly();
    if (enforceObserver) return;
    enforceObserver = new MutationObserver(()=> pruneToSingleFly());
    enforceObserver.observe(document.body, {childList:true, subtree:true});
  }

  function formatTime(s){ const m = Math.floor(s/60), ss = String(s%60).padStart(2,'0'); return `${m}:${ss}`; }

  // ---------------- Rampage Timer ----------------
  function startRampageTimer(){
    rampageActive = true;
    rampageTimeLeft = 60;
    if (rampageTimer) clearInterval(rampageTimer);
    if (timerEl){ timerEl.style.display='block'; timerEl.textContent = formatTime(rampageTimeLeft); }
    rampageTimer = setInterval(()=>{
      rampageTimeLeft--;
      if (timerEl) timerEl.textContent = formatTime(rampageTimeLeft);
      if (rampageTimeLeft<=0){
        clearInterval(rampageTimer); rampageTimer=null;
        if (timerEl) timerEl.style.display='none';
        handleRampageTimeout();
      }
    }, 1000);
  }

  function handleRampageTimeout(){
    if (bossActive) return;
    document.querySelectorAll('.fly:not(.splatted), .rr-fly:not(.splatted)').forEach(f=>{
      const dx=rand(-2000,2000), dy=rand(-2000,2000);
      f.style.transition='all 2s ease-out';
      f.style.left=(parseInt(f.style.left||0)+dx)+'px';
      f.style.top=(parseInt(f.style.top||0)+dy)+'px';
      f.style.opacity='0';
      setTimeout(()=>f.remove(),2000);
    });
    // Soft reset
    rampageActive=false; spawnRateMultiplier=1; spawnAllowed=true; postFirstKill=false; flyKillCount=0;
    setCounterText('Flies Squashed: 0'); counterNodes.forEach(el=>{ if(el) el.style.display='none'; });
    setTimeout(()=> createFly(), 1200);
  }

  function showBanner(kind){
    const img = document.createElement('img');
    img.src = (kind==='DECIMATED')
      ? 'https://github.com/FrogMallet/frogmallet.github.io/blob/main/FLIES%20DECIMATED.png?raw=true'
      : 'https://github.com/FrogMallet/frogmallet.github.io/blob/main/Ribbit%20Rampage.png?raw=true';
    Object.assign(img.style,{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(90vw,600px)',height:'auto',zIndex:10005,pointerEvents:'none',animation:'fadeOut 3s forwards'});
    document.body.appendChild(img);
    const st=document.createElement('style'); st.textContent='@keyframes fadeOut{0%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}';
    document.head.appendChild(st);
    try { const s = (kind==='DECIMATED') ? decimatedSound : rampageSound; s.currentTime = 0; s.play().catch(()=>{});} catch(e){}
    setTimeout(()=> img.remove(), 3000);
  }

  // ---------------- Milestones ----------------
  function registerKill(amount=1){
    if (amount <= 0) return;
    const prev = flyKillCount;
    flyKillCount += amount;
    updateCounter();
    if (prev === 0) counterNodes.forEach(el => { if(el) el.style.display='block'; });
    handleMilestones(prev);
  }

  function handleMilestones(prev){
    if(prev<1 && flyKillCount>=1 && flyKillCount<10 && !postFirstKill){
      postFirstKill = true;
      if (enforceObserver){ enforceObserver.disconnect(); enforceObserver=null; }
      spawnFlies();
    }
    if(prev<10 && flyKillCount>=10 && !rampageActive){
      spawnRateMultiplier = .10;
      showBanner('RAMPAGE');
      startRampageTimer();
      spawnAllowed = true;
      spawnFlies();
    }
    if(prev<100 && flyKillCount>=100){
      if (rampageTimeLeft>0) startBossFight();
      else { showBanner('DECIMATED'); showGoldenFrogDelayed(); }
    }
  }

  // ---------------- Flies ----------------
  function createFly(){
    const fly = document.createElement('div');
    fly.className = 'fly';
    const w = isMobile?30:50, h = isMobile?30:50;
    fly.style.width=w+'px'; fly.style.height=h+'px';
    let x = rand(50, innerWidth-50), y = rand(50, innerHeight-50);
    fly.style.left=x+'px'; fly.style.top=y+'px';
    flyContainer.appendChild(fly);

    const move = setInterval(()=>{
      if (fly.classList.contains('splatted') || bossActive){ clearInterval(move); return; }
      const dx=(Math.random()-.5)*40, dy=(Math.random()-.5)*40;
      const nx=clamp(x+dx,0,innerWidth-w), ny=clamp(y+dy,0,innerHeight-h);
      const rot=Math.atan2(ny-y,nx-x)*180/Math.PI+90;
      fly.style.left=nx+'px'; fly.style.top=ny+'px'; fly.style.transform=`rotate(${rot}deg)`; x=nx; y=ny;
    }, 1200);

    fly.addEventListener('click', (ev)=>{
      if (fly.dataset.splatted==='1' || fly.classList.contains('splatted')) return;
      try { splatSound.currentTime=0; splatSound.play().catch(()=>{});} catch(e){}
      const splatSize=isMobile?40:60;
      fly.classList.add('splatted'); fly.dataset.splatted='1';
      fly.style.backgroundImage="url('https://raw.githubusercontent.com/FrogMallet/frogmallet.github.io/refs/heads/main/splat.png')";
      fly.style.width=splatSize+'px'; fly.style.height=splatSize+'px';
      fly.style.cursor='default'; fly.style.transform='rotate(0deg)';
      clearInterval(move); setTimeout(()=> fly.remove(), 3000);
      registerKill(1);
      ev.stopPropagation();
    }, true);
  }

  function spawnFlies(){
    if (!postFirstKill) return;
    if (!spawnAllowed || bossActive) return;
    const alive = document.querySelectorAll('.fly:not(.splatted), .rr-fly:not(.splatted)').length;
    if (flyKillCount<10 && alive>=10) return;
    createFly();
    const base = 5000 + Math.random()*3000;
    setTimeout(spawnFlies, base*spawnRateMultiplier);
  }

  // ---------------- Boss Logic (HP + Centered Countdown BAR) ----------------
  function updateHealthBar(){
    const p = Math.max(bossHP,0) / bossHPMax;
    if (healthFill) {
      healthFill.style.width = (p*100)+'%';
      healthFill.style.background = hsl(120*p,100,40);
    }
  }

  function startBossFight(){
    ensureBossUI(); // make sure structure exists
    const { bossCountdown, bossCountdownFill } = ensureBossUI();

    if (bossActive) return;
    bossActive = true;
    spawnAllowed = false;

    // stop rampage timer UI if present
    if (rampageTimer){ clearInterval(rampageTimer); rampageTimer=null; }
    if (timerEl) timerEl.style.display = 'none';

    // remove normal flies
    document.querySelectorAll('.fly, .rr-fly').forEach(f => f.remove());

    // reset boss state fully
    bossHP = bossHPMax;
    bossHitGateTS = 0;

    // Cancel any previous countdown animation and reset bar
    if (bossCountdownRAF){ cancelAnimationFrame(bossCountdownRAF); bossCountdownRAF = null; }
    if (bossCountdown){ bossCountdown.style.display = 'none'; }
    if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }

    updateHealthBar();

    // show overlay, make interactive
    bossWrap.style.display = 'block';
    bossWrap.style.pointerEvents = 'auto';
    bossWrap.setAttribute('aria-hidden','false');

    // hide any leftover frog
    if (frogEl) frogEl.style.display = 'none';

    // rebuild boss node and rebind listeners
    const old = document.getElementById('boss-fly');
    if (old){
      const fresh = old.cloneNode(true);
      old.parentNode.replaceChild(fresh, old);
      bossEl = fresh;
      Object.assign(bossEl.style, {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%,-50%)',
  pointerEvents: 'auto'
});
    }
    bossEl.setAttribute('draggable','false');
    bossEl.style.pointerEvents = 'auto';
    ;['pointerdown','mousedown','touchstart','click'].forEach(evt => {
      bossEl.addEventListener(evt, bossHit, { passive:true, capture:true });
    });

    // expose for hotkey
    window.startBossFight = startBossFight;
    console.log('[RR] Boss started — HP', bossHP, '/', bossHPMax);
  }
  window.startBossFight = startBossFight;

  function bossHit(){
    if (!bossActive) return;

    const now = performance.now();
    if (now - bossHitGateTS < 80) return;  // throttle multi-events per tap
    bossHitGateTS = now;
// keep the boss locked to center before animating
Object.assign(bossEl.style, {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%,-50%)'
});

    // Start the centered countdown BAR on the first successful hit
    if (!bossCountdownRAF){
      const { bossCountdown, bossCountdownFill } = ensureBossUI();
      const startTs = performance.now();

      if (bossCountdown){ bossCountdown.style.display = 'block'; }
      if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }

      function tick(){
        const elapsed = performance.now() - startTs;
        const p = Math.max(0, 1 - (elapsed / BOSS_COUNTDOWN_MS)); // 1 -> 0 over 10s
        if (bossCountdownFill){ bossCountdownFill.style.width = (p*100)+'%'; }
        if (p <= 0){
          bossCountdownRAF = null;
          bossGameOver();
          return;
        }
        bossCountdownRAF = requestAnimationFrame(tick);
      }
      bossCountdownRAF = requestAnimationFrame(tick);
    }

    // apply damage
    bossHP = Math.max(0, bossHP - 3);

    // hit feedback
    bossEl.classList.remove('boss-hit'); void bossEl.offsetWidth; bossEl.classList.add('boss-hit');
    updateHealthBar();

    if (bossHP <= 0){
      if (bossCountdownRAF){ cancelAnimationFrame(bossCountdownRAF); bossCountdownRAF = null; }
      const { bossCountdown, bossCountdownFill } = ensureBossUI();
      if (bossCountdown){ bossCountdown.style.display = 'none'; }
      if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }
      endBossFight();
    }
  }

  function endBossFight(){
    bossActive=false;
    if (bossWrap) bossWrap.style.display='none';
    showBanner('DECIMATED');
    showGoldenFrogDelayed();
    spawnAllowed=false;
  }

  function bossGameOver(){
    bossActive = false;

    // stop/hide countdown bar
    if (bossCountdownRAF){ cancelAnimationFrame(bossCountdownRAF); bossCountdownRAF = null; }
    const { bossCountdown, bossCountdownFill } = ensureBossUI();
    if (bossCountdown){ bossCountdown.style.display = 'none'; }
    if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }

    if (bossWrap){
      bossWrap.style.display='none';
      bossWrap.setAttribute('aria-hidden','true');
      bossWrap.style.pointerEvents='none';
    }
    const img=document.createElement('img');
    img.src='https://github.com/FrogMallet/frogmallet.github.io/blob/main/GAME%20OVER.png?raw=true';
    Object.assign(img.style,{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(90vw,600px)',height:'auto',zIndex:10005,pointerEvents:'none',animation:'fadeOut 3s forwards'});
    document.body.appendChild(img);
    const st=document.createElement('style'); st.textContent='@keyframes fadeOut{0%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}';
    document.head.appendChild(st);
    setTimeout(()=> img.remove(), 3000);
    spawnAllowed = false; // keep fail state until reload
    console.log('[RR] GAME OVER — boss timer expired');
  }

  // Prevent the golden frog from hijacking clicks
  if (frogEl) frogEl.addEventListener('click', e=> e.preventDefault());

  // ---------------- Hotkeys ----------------
  window.addEventListener('keydown', e=>{
    const key = (e.key||'').toLowerCase();
    if (key !== 'k') return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const flies = Array.from(document.querySelectorAll('.fly:not(.splatted), .rr-fly:not(.splatted)'));
    if(!flies.length) return;
    try{ splatSound.currentTime=0; splatSound.play().catch(()=>{});}catch(_){ }
    flies.forEach(f=>{
      if (f.dataset.splatted==='1') return;
      f.classList.add('splatted'); f.dataset.splatted='1';
      f.style.backgroundImage = "url('https://raw.githubusercontent.com/FrogMallet/frogmallet.github.io/refs/heads/main/splat.png')";
      const size = isMobile?40:60;
      f.style.width=size+'px'; f.style.height=size+'px';
      f.style.cursor='default'; f.style.transform='rotate(0deg)';
      setTimeout(()=> f.remove(),150);
    });
    registerKill(flies.length);
  }, true);

  // Delegated click for any .fly/.rr-fly (in case other scripts add them)
  window.addEventListener('click', (e)=>{
    const t = e.target.closest('.fly, .rr-fly');
    if(!t) return;
    if(t.classList.contains('splatted') || t.dataset.splatted==='1') return;
    try{ splatSound.currentTime=0; splatSound.play().catch(()=>{});}catch(_){ }
    t.classList.add('splatted'); t.dataset.splatted='1';
    const size = isMobile?40:60;
    t.style.backgroundImage = "url('https://raw.githubusercontent.com/FrogMallet/frogmallet.github.io/refs/heads/main/splat.png')";
    t.style.width=size+'px'; t.style.height=size+'px';
    t.style.cursor='default'; t.style.transform='rotate(0deg)';
    setTimeout(()=> t.remove(), 3000);
    registerKill(1);
  }, true);

  // B = start boss fight (debounced)
  let __rrLastB = 0;
  window.addEventListener('keydown', function (e) {
    if (((e.key || '').toLowerCase()) !== 'b') return;
    const now = Date.now();
    if (now - __rrLastB < 400) return;
    __rrLastB = now;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (typeof window.startBossFight === 'function') window.startBossFight();
    else try { startBossFight(); } catch(_) {}
  }, true);

  // ---------------- Boot ----------------
  setCounterText('Flies Squashed: 0');
  if (bossWrap) bossWrap.style.pointerEvents = 'none';
  enforceOneFlyUntilFirstKill();
  createFly();
  pruneToSingleFly();
})();
