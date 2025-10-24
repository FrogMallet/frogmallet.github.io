/*
  Ribbit Rampage — Toggleable Build
  ---------------------------------
  Set these at the top:
    window.RIBBIT_ENABLE_BOSS = false;
    window.RIBBIT_ENABLE_LEADERBOARD = false;
*/

(() => {
  if (window.__ribbitRampageActive) return;
  window.__ribbitRampageActive = true;

  // === Toggles ===
  window.RIBBIT_ENABLE_BOSS = window.RIBBIT_ENABLE_BOSS ?? false;
  window.RIBBIT_ENABLE_LEADERBOARD = window.RIBBIT_ENABLE_LEADERBOARD ?? false;

  // ---------------- State ----------------
  let flyKillCount = 0;
  let spawnRateMultiplier = 1;
  let spawnAllowed = true;
  let rampageTimer = null;
  let rampageTimeLeft = 60;
  let rampageActive = false;

  let postFirstKill = false;

  // Boss variables
  let bossActive = false;
  const bossHPMax = 300;
  let bossHP = bossHPMax;
  let bossHitGateTS = 0;
  const BOSS_DAMAGE_PER_HIT = 3;

  // ---------------- DOM ----------------
  const flyContainer = document.body;
  const counterNodes = Array.from(document.querySelectorAll('#fly-counter'));
  const timerEl = document.getElementById('rampage-timer');
  const frogEl = document.getElementById('golden-frog');
  let bossWrap = document.getElementById('boss-fight');
  let bossEl = document.getElementById('boss-fly');
  let healthFill = document.getElementById('boss-health-fill');

  const isMobile = /Mobi|Android/i.test(navigator.userAgent);
  const rand = (a,b)=> a + Math.random()*(b-a);
  const clamp = (v,min,max)=> Math.min(Math.max(v,min),max);

  // ---------------- Audio ----------------
  const splatSound = new Audio('https://frogmallet.github.io/splat.mp3');
  const rampageSound = new Audio('https://frogmallet.github.io/Ribbit%20Rampage.mp3');
  const decimatedSound = new Audio('https://frogmallet.github.io/Flies%20Decimated.mp3');
  const gameOverSound = new Audio('https://frogmallet.github.io/Game%20Over.mp3');
  [splatSound,rampageSound,decimatedSound,gameOverSound].forEach(a=>a.preload='auto');

  function setCounterText(txt){ counterNodes.forEach(el=> el.textContent = txt); }
  function updateCounter(){ setCounterText(`Flies Squashed: ${flyKillCount}`); }

  function showBanner(kind){
    const img = document.createElement('img');
    img.src = (kind==='DECIMATED')
      ? 'https://frogmallet.github.io/FLIES%20DECIMATED.png'
      : 'https://frogmallet.github.io/Ribbit%20Rampage.png';
    Object.assign(img.style,{
      position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
      width:'min(90vw,600px)',zIndex:10005,pointerEvents:'none',
      animation:'fadeOut 3s forwards'
    });
    document.body.appendChild(img);
    const st=document.createElement('style');
    st.textContent='@keyframes fadeOut{0%{opacity:1}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-50%) scale(1.2)}}';
    document.head.appendChild(st);
    const s=(kind==='DECIMATED')?decimatedSound:rampageSound;
    s.currentTime=0; s.play().catch(()=>{});
    setTimeout(()=> img.remove(),3000);
  }

  // ---------------- Fly spawning ----------------
  function createFly(){
    const fly=document.createElement('div');
    fly.className='fly';
    const w=isMobile?30:50,h=isMobile?30:50;
    fly.style.width=w+'px'; fly.style.height=h+'px';
    fly.style.left=rand(50,innerWidth-50)+'px';
    fly.style.top=rand(50,innerHeight-50)+'px';
    flyContainer.appendChild(fly);

    const move=setInterval(()=>{
      if(fly.classList.contains('splatted')||bossActive){clearInterval(move);return;}
      const dx=(Math.random()-.5)*40,dy=(Math.random()-.5)*40;
      const nx=clamp(parseFloat(fly.style.left)+dx,0,innerWidth-w);
      const ny=clamp(parseFloat(fly.style.top)+dy,0,innerHeight-h);
      fly.style.left=nx+'px';fly.style.top=ny+'px';
    },1200);

    fly.addEventListener('click',()=>{
      if(fly.dataset.splatted==='1')return;
      splatSound.currentTime=0;splatSound.play().catch(()=>{});
      fly.classList.add('splatted');fly.dataset.splatted='1';
      fly.style.backgroundImage="url('https://frogmallet.github.io/splat.png')";
      setTimeout(()=>fly.remove(),2000);
      registerKill(1);
    });
  }

  function spawnFlies(){
    if(!postFirstKill||!spawnAllowed||bossActive)return;
    const alive=document.querySelectorAll('.fly:not(.splatted)').length;
    if(flyKillCount<10&&alive>=10)return;
    createFly();
    setTimeout(spawnFlies,5000*spawnRateMultiplier);
  }

  // ---------------- Game progression ----------------
  function registerKill(n=1){
    const prev=flyKillCount;
    flyKillCount+=n;
    updateCounter();
    if(prev===0) counterNodes.forEach(el=> el.style.display='block');
    handleMilestones(prev);
  }

  function handleMilestones(prev){
    if(prev<1&&flyKillCount>=1&&!postFirstKill){
      postFirstKill=true; spawnFlies();
    }
    if(prev<10&&flyKillCount>=10&&!rampageActive){
      spawnRateMultiplier=.1; showBanner('RAMPAGE');
      rampageActive=true; spawnFlies();
    }
    if(prev<100&&flyKillCount>=100){
      if(window.RIBBIT_ENABLE_BOSS){
        startBossFight();
      } else {
        showBanner('DECIMATED');
      }
    }
  }

  // ---------------- Boss ----------------
  function startBossFight(){
    if(!window.RIBBIT_ENABLE_BOSS) return;
    bossActive=true;
    bossHP=bossHPMax;
    bossWrap.style.display='block';
    healthFill.style.width='100%';
    console.log('[RR] Boss started — HP',bossHP,'/',bossHPMax);
  }

  function bossHit(){
    if(!window.RIBBIT_ENABLE_BOSS||!bossActive)return;
    const now=performance.now();
    if(now-bossHitGateTS<120)return;
    bossHitGateTS=now;
    bossHP-=BOSS_DAMAGE_PER_HIT;
    const pct=clamp(bossHP/bossHPMax,0,1);
    healthFill.style.width=`${pct*100}%`;
    bossEl.classList.add('boss-hit');
    setTimeout(()=>bossEl.classList.remove('boss-hit'),180);
    if(bossHP<=0) endBossFight();
  }

  function endBossFight(){
    if(!window.RIBBIT_ENABLE_BOSS)return;
    bossActive=false;
    bossWrap.style.display='none';
    showBanner('DECIMATED');
  }

  function bossGameOver(){
    if(!window.RIBBIT_ENABLE_BOSS)return;
    bossActive=false;
    bossWrap.style.display='none';
    gameOverSound.play().catch(()=>{});
  }

  // ---------------- Leaderboard ----------------
  function maybeSubmitScore(outcome){
    if(!window.RIBBIT_ENABLE_LEADERBOARD)return;
    if(typeof window.FMHighscores==='undefined')return;
    const score=flyKillCount;
    window.FMHighscores.submit(score,{mode:outcome,version:"1.0.0"});
  }

// ---------------- Keyboard shortcuts ----------------
window.addEventListener('keydown', e=>{
  const key=(e.key||'').toLowerCase();

  // "K" key — mass kill toggleable (optional)
  if(key==='k' && window.RIBBIT_ENABLE_BOSS){
    e.preventDefault();
    const flies=document.querySelectorAll('.fly:not(.splatted)');
    flies.forEach(f=>{
      f.classList.add('splatted');
      f.style.backgroundImage="url('https://frogmallet.github.io/splat.png')";
      setTimeout(()=>f.remove(),200);
    });
    registerKill(flies.length);
  }

  // "B" key — boss toggleable
  if(key==='b' && window.RIBBIT_ENABLE_BOSS){
    e.preventDefault();
    startBossFight();
  }
},true);


  // ---------------- Boot ----------------
  setCounterText('Flies Squashed: 0');
  createFly();
