

/*
  Ribbit Rampage — Live Build (External JS)
  --------------------------------------------------
  Include once, after theme scripts:
  <script src="https://frogmallet.github.io/ribbit-rampage.js"></script>
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
  let bossHitGateTS = 0;

  const BOSS_DAMAGE_PER_HIT = 3;

  let bossHitCount = 0;         // counts valid hits this fight
  let bossRandomTrigger = 0;    // which hit number will play the random SFX
  let bossRandomPlayed = false; // ensure random SFX only fires once
  let bossOwPlayed = false;     // ensure "4th-to-last" SFX only fires once

  function randInt(min, maxInclusive){
    return Math.floor(Math.random() * (maxInclusive - min + 1)) + min;
  }

  // Countdown BAR via RAF
  let bossCountdownRAF = null;
  const BOSS_COUNTDOWN_MS = 12000; // 12s after FIRST hit

  const FROG_DELAY_MS = 3200;

  // ---------------- DOM ----------------
  const flyContainer = document.body;
  const counterNodes = Array.from(document.querySelectorAll('#fly-counter'));
  const timerEl   = document.getElementById('rampage-timer');
  const frogEl    = document.getElementById('golden-frog');

  let bossWrap  = document.getElementById('boss-fight');
  let bossEl    = document.getElementById('boss-fly');
  let healthFill= document.getElementById('boss-health-fill');

  // Utilities
  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const rand  = (a,b)=> a + Math.random()*(b-a);
  const clamp = (v,min,max)=> Math.min(Math.max(v,min),max);
  const hsl   = (h,s,l)=>`hsl(${h} ${s}% ${l}%)`;

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

    // Boss fly (centered)
    if (!bossEl){
      bossEl = document.createElement('img');
      bossEl.id = 'boss-fly';
      bossEl.alt = 'Boss Fly';
      bossEl.src = 'https://frogmallet.github.io/BossFly.png';
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

    // Countdown bar: same width/center as health bar, just below it
    let bossCountdown = document.getElementById('boss-countdown');
    let bossCountdownFill = document.getElementById('boss-countdown-fill');

    if (!bossCountdown){
      bossCountdown = document.createElement('div');
      bossCountdown.id = 'boss-countdown';
      Object.assign(bossCountdown.style,{
        position:'absolute',
        top:'45px', // 20 + 22 + ~3px gap
        left:'50%',
        transform:'translateX(-50%)',
        width:'min(90vw,600px)',
        height:'14px',
        border:'2px solid #000',
        background:'#222',
        borderRadius:'10px',
        overflow:'hidden',
        display:'none',
        opacity:'0',
        zIndex:'10005',
        boxShadow:'0 0 10px rgba(0,0,0,.6) inset',
        transition:'opacity .2s ease'
      });
      bossWrap.appendChild(bossCountdown);

      bossCountdownFill = document.createElement('div');
      bossCountdownFill.id = 'boss-countdown-fill';
      Object.assign(bossCountdownFill.style,{
        height:'100%',
        width:'100%',
        background:'linear-gradient(90deg, #ff3b3b, #ffd400)',
      });
      bossCountdown.appendChild(bossCountdownFill);
    } else if (!bossCountdownFill){
      bossCountdownFill = document.createElement('div');
      bossCountdownFill.id = 'boss-countdown-fill';
      Object.assign(bossCountdownFill.style,{
        height:'100%',
        width:'100%',
        background:'linear-gradient(90deg, #ff3b3b, #ffd400)',
      });
      bossCountdown.appendChild(bossCountdownFill);
    }

    return { bossCountdown, bossCountdownFill };
  }

  // ---------------- Audio ----------------
  const splatSound     = new Audio('https://frogmallet.github.io/splat.mp3');
  const rampageSound   = new Audio('https://frogmallet.github.io/Ribbit%20Rampage.mp3');
  const decimatedSound = new Audio('https://frogmallet.github.io/Flies%20Decimated.mp3');

  // Try both likely casings for Game Over (Pages & jsDelivr)
  function pickFirstWorkingAudio(sources){
    const a = new Audio();
    let i = 0;
    function tryNext(){
      if (i >= sources.length) { console.warn('[RR] No working Game Over audio source'); return; }
      a.src = sources[i++];
      a.load();
      const onCanPlay = () => {
        a.removeEventListener('error', onError);
        console.log('[RR] GameOver audio OK:', a.src);
      };
      const onError = () => {
        a.removeEventListener('canplaythrough', onCanPlay);
        console.warn('[RR] GameOver audio failed:', a.src);
        tryNext();
      };
      a.addEventListener('canplaythrough', onCanPlay, { once:true });
      a.addEventListener('error', onError, { once:true });
    }
    tryNext();
    return a;
  }

  const gameOverSound = pickFirstWorkingAudio([
    'https://frogmallet.github.io/Game%20Over.mp3',
    'https://frogmallet.github.io/GAME%20OVER.mp3',
    'https://cdn.jsdelivr.net/gh/FrogMallet/frogmallet.github.io@main/Game%20Over.mp3',
    'https://cdn.jsdelivr.net/gh/FrogMallet/frogmallet.github.io@main/GAME%20OVER.mp3'
  ]);
  gameOverSound.volume = 1.0;

  // Boss SFX
  const bossHitSfx    = new Audio('https://frogmallet.github.io/boss%20hit.mp3');
  const bossRandomSfx = new Audio('https://frogmallet.github.io/cmon%20mah.mp3');
  const bossOwSfx     = new Audio('https://frogmallet.github.io/ow%20mah.mp3');
  bossHitSfx.volume = 1.0;
  bossRandomSfx.volume = 1.0;
  bossOwSfx.volume = 1.0;

  // One-time audio primer for iOS/Chrome autoplay
  function primeAudio(a){
    try {
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; }).catch(() => { a.muted = false; });
      } else { a.pause(); a.currentTime = 0; a.muted = false; }
    } catch(e){ a.muted = false; }
  }
  let __rrAudioPrimed = false;
  function unlockAllAudioOnce(){
    if (__rrAudioPrimed) return;
    __rrAudioPrimed = true;

    [splatSound, rampageSound, decimatedSound, bossHitSfx, bossRandomSfx, bossOwSfx, gameOverSound]
      .forEach(a => { a.preload = 'auto'; primeAudio(a); });
  }
  ['pointerdown','touchstart','mousedown','click','keydown'].forEach(ev => {
    window.addEventListener(ev, unlockAllAudioOnce, { once:true, passive:true, capture:true });
  });

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

  // ------- Highscore helpers -------
function promptNameIfMissing() {
  if (!window.FMHighscores) return; // safe no-op if not loaded
  if (!window.FMHighscores.getName()) {
    const n = prompt("Enter your name for the leaderboard:", "Anonymous Frog");
    if (n) window.FMHighscores.setName(n);
  }
}
function submitScore(outcome /* 'win' | 'loss' */) {
  if (!window.FMHighscores) return;
  // Simple scoring: number of flies squashed this run
  const finalScore = flyKillCount;
  window.FMHighscores.submit(finalScore, { mode: outcome, version: "1.0.0" });
}


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
    rampageActive=false; spawnRateMultiplier=1; spawnAllowed=true; postFirstKill=false; flyKillCount=0;
    setCounterText('Flies Squashed: 0'); counterNodes.forEach(el=>{ if(el) el.style.display='none'; });
    setTimeout(()=> createFly(), 1200);
  }
  function showBanner(kind){
    const img = document.createElement('img');
    img.src = (kind==='DECIMATED')
      ? 'https://frogmallet.github.io/FLIES%20DECIMATED.png'
      : 'https://frogmallet.github.io/Ribbit%20Rampage.png';
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
      fly.style.backgroundImage="url('https://frogmallet.github.io/splat.png')";
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

  // ---------------- Boss Logic ----------------
  function updateHealthBar(){
    const p = Math.max(bossHP,0) / bossHPMax;
    if (healthFill) {
      healthFill.style.width = (p*100)+'%';
      healthFill.style.background = hsl(120*p,100,40);
    }
  }

  function startBossFight(){
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

    // per-fight SFX state
    bossHitCount = 0;
    bossRandomPlayed = false;
    bossOwPlayed = false;
    const totalHits = Math.ceil(bossHPMax / BOSS_DAMAGE_PER_HIT); // 300/3 = 100
    const latestSafe = Math.max(1, totalHits - 5);
    bossRandomTrigger = randInt(2, latestSafe);

    // Cancel any previous countdown animation and reset bar
    if (bossCountdownRAF){ cancelAnimationFrame(bossCountdownRAF); bossCountdownRAF = null; }
    if (bossCountdown){ bossCountdown.style.display = 'none'; bossCountdown.style.opacity = '0'; }
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
        position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)',
        pointerEvents:'auto'
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
//  window.startBossFight = startBossFight;

  function bossHit(){
    if (!bossActive) return;

    const now = performance.now();
    if (now - bossHitGateTS < 80) return;  // throttle
    bossHitGateTS = now;

    // keep the boss locked to center
    Object.assign(bossEl.style, {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)'
    });

    // Every-hit SFX
    try { bossHitSfx.currentTime = 0; bossHitSfx.play().catch(()=>{}); } catch(e){}

    // Start the countdown BAR on the very first successful hit
    if (!bossCountdownRAF){
      const { bossCountdown, bossCountdownFill } = ensureBossUI();

      // show the bar full, then shrink
      if (bossCountdown){
        bossCountdown.style.display = 'block';
        // force style flush before setting opacity for smooth fade
        void bossCountdown.offsetWidth;
        bossCountdown.style.opacity = '1';
      }
      if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }

      const startTs = performance.now();

      function tick(){
        const elapsed = performance.now() - startTs;
        const p = Math.max(0, 1 - (elapsed / BOSS_COUNTDOWN_MS)); // 1 -> 0 over 12s
        if (bossCountdownFill) bossCountdownFill.style.width = (p*100)+'%';
        if (p <= 0){
          bossCountdownRAF = null;
          bossGameOver();
          return;
        }
        bossCountdownRAF = requestAnimationFrame(tick);
      }
      bossCountdownRAF = requestAnimationFrame(tick);
    }

    // Count hit and apply damage
    bossHitCount++;
    bossHP = Math.max(0, bossHP - BOSS_DAMAGE_PER_HIT);

    // Random one-liner once
    if (!bossRandomPlayed && bossHitCount === bossRandomTrigger) {
      bossRandomPlayed = true;
      try { bossRandomSfx.currentTime = 0; bossRandomSfx.play().catch(()=>{}); } catch(e){}
    }

    // "4th-to-last" one-liner (i.e., exactly 3 more hits remain after this one)
    const remainingHits = Math.ceil(bossHP / BOSS_DAMAGE_PER_HIT);
    if (!bossOwPlayed && remainingHits === 3) {
      bossOwPlayed = true;
      try { bossOwSfx.currentTime = 0; bossOwSfx.play().catch(()=>{}); } catch(e){}
    }

    // Hit feedback + check kill
    bossEl.classList.remove('boss-hit'); void bossEl.offsetWidth; bossEl.classList.add('boss-hit');
    updateHealthBar();

    if (bossHP <= 0){
      if (bossCountdownRAF){ cancelAnimationFrame(bossCountdownRAF); bossCountdownRAF = null; }
      const { bossCountdown, bossCountdownFill } = ensureBossUI();
      if (bossCountdown){ bossCountdown.style.display = 'none'; bossCountdown.style.opacity = '0'; }
      if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }
      endBossFight();
    }
  }

function endBossFight(){
  bossActive=false;
  window.dispatchEvent(new CustomEvent('ribbit:gameover', { detail: { score: flyKillCount, outcome: 'win' } }));
  if (bossWrap) bossWrap.style.display='none';
  showBanner('DECIMATED');
  showGoldenFrogDelayed();
  spawnAllowed=false;

  // [FM Leaderboard] on win:
  promptNameIfMissing();
  submitScore('win');
//  Leaderboard.submitScore({ name: "Test", score: 42 });

  
  // Optional: auto-jump to the board after the banner finishes
  // setTimeout(() => { location.href = "/pages/leaderboard"; }, 900);
}


  
function bossGameOver(){
  bossActive = false;

  // stop/hide countdown bar
  if (bossCountdownRAF){ cancelAnimationFrame(bossCountdownRAF); bossCountdownRAF = null; }
  const { bossCountdown, bossCountdownFill } = ensureBossUI();
  if (bossCountdown){ bossCountdown.style.display = 'none'; bossCountdown.style.opacity = '0'; }
  if (bossCountdownFill){ bossCountdownFill.style.width = '100%'; }

  if (bossWrap){
    bossWrap.style.display='none';
    bossWrap.setAttribute('aria-hidden','true');
    bossWrap.style.pointerEvents='none';
  }

  window.dispatchEvent(new CustomEvent('ribbit:gameover', { detail: { score: flyKillCount, outcome: 'loss' } }));

  const img=document.createElement('img');
img.src='https://raw.githubusercontent.com/FrogMallet/frogmallet.github.io/main/Game%20Over.png';
  Object.assign(img.style,{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',width:'min(90vw,600px)',height:'auto',zIndex:10005,pointerEvents:'none',animation:'fadeOut 3s forwards'});
  document.body.appendChild(img);

  try {
    gameOverSound.currentTime = 0;
    const p = gameOverSound.play();
    if (p && p.catch) p.catch(err => console.warn('[RR] gameOverSound blocked/error:', err));
  } catch(e) {
    console.warn('[RR] gameOverSound threw:', e);
  }

  const st=document.createElement('style'); st.textContent='@keyframes fadeOut{0%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}';
  document.head.appendChild(st);
  setTimeout(()=> img.remove(), 3000);
  spawnAllowed = false; // keep fail state until reload
  console.log('[RR] GAME OVER — boss timer expired');

  // [FM Leaderboard] on loss:
  promptNameIfMissing();
  submitScore('loss');
  Leaderboard.submitScore({ name: "Test", score: 42 });

  // Optional: auto-jump to the board after the sound/banner
  // setTimeout(() => { location.href = "/pages/leaderboard"; }, 1200);
}


  // Prevent the golden frog from hijacking clicks
  if (frogEl) frogEl.addEventListener('click', e=> e.preventDefault());

  // ---------------- Hotkeys ----------------
 /* window.addEventListener('keydown', e=>{
    const key = (e.key||'').toLowerCase();
    if (key !== 'k') return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const flies = Array.from(document.querySelectorAll('.fly:not(.splatted), .rr-fly:not(.splatted)'));
    if(!flies.length) return;
    try{ splatSound.currentTime=0; splatSound.play().catch(()=>{});}catch(_){ }
    flies.forEach(f=>{
      if (f.dataset.splatted==='1') return;
      f.classList.add('splatted'); f.dataset.splatted='1';
      f.style.backgroundImage = "url('https://frogmallet.github.io/splat.png')";
      const size = isMobile?40:60;
      f.style.width=size+'px'; f.style.height=size+'px';
      f.style.cursor='default'; f.style.transform='rotate(0deg)';
      setTimeout(()=> f.remove(),150);
    });
    registerKill(flies.length);
  }, true);

  // Delegated click for any .fly/.rr-fly
  window.addEventListener('click', (e)=>{
    const t = e.target.closest('.fly, .rr-fly');
    if(!t) return;
    if(t.classList.contains('splatted') || t.dataset.splatted==='1') return;
    try{ splatSound.currentTime=0; splatSound.play().catch(()=>{});}catch(_){ }
    t.classList.add('splatted'); t.dataset.splatted='1';
    const size = isMobile?40:60;
    t.style.backgroundImage = "url('https://frogmallet.github.io/splat.png')";
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
*/
  // ---------------- Boot ----------------
  setCounterText('Flies Squashed: 0');
  if (bossWrap) bossWrap.style.pointerEvents = 'none';
  enforceOneFlyUntilFirstKill();
  createFly();
  pruneToSingleFly();
})();
