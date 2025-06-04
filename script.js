const flyContainer = document.body; 
const splatSound = new Audio("https://github.com/FrogMallet/frogmallet.github.io/raw/refs/heads/main/splat.mp3");

// Clear existing flies on load (or before spawning)
document.querySelectorAll('.fly').forEach(fly => fly.remove());

// Function to create and initialize each fly
function createFly() {
  const fly = document.createElement('div');
  fly.classList.add('fly');

  // Generate random position but avoid near 0,0 (add offset 50px)
  let startX = 50 + Math.random() * (window.innerWidth - 100);
  let startY = 50 + Math.random() * (window.innerHeight - 100);

  fly.style.left = startX + 'px';
  fly.style.top = startY + 'px';

  flyContainer.appendChild(fly);

  console.log('Created fly at:', startX, startY); // Debug

  let lastX = startX;
  let lastY = startY;

  fly.style.transition = 'left 0.8s ease, top 0.8s ease, transform 0.8s ease';

  const moveInterval = setInterval(() => {
    if (fly.classList.contains('splatted')) {
      clearInterval(moveInterval);
      return;
    }

    const deltaX = (Math.random() - 0.5) * 40;
    const deltaY = (Math.random() - 0.5) * 40;

    let newX = lastX + deltaX;
    let newY = lastY + deltaY;

    newX = Math.min(Math.max(0, newX), window.innerWidth - 50);
    newY = Math.min(Math.max(0, newY), window.innerHeight - 50);

    const angleRad = Math.atan2(newY - lastY, newX - lastX);
    const angleDeg = angleRad * (180 / Math.PI);
    const rotation = angleDeg + 90;

    fly.style.left = newX + 'px';
    fly.style.top = newY + 'px';
    fly.style.transform = `rotate(${rotation}deg)`;

    lastX = newX;
    lastY = newY;
  }, 1200);

  fly.addEventListener('click', () => {
    if (fly.classList.contains('splatted')) return;

    splatSound.currentTime = 0;
    splatSound.play();

    fly.classList.add('splatted');
    fly.style.backgroundImage = "url('https://i.imgur.com/No3n3hq.png')";
    fly.style.width = '60px';
    fly.style.height = '60px';
    fly.style.cursor = 'default';
    fly.style.transform = 'rotate(0deg)';

    clearInterval(moveInterval);

    setTimeout(() => fly.remove(), 3000);
  });
}

// On page load, remove any fly stuck at or near (0,0)
window.addEventListener('load', () => {
  document.querySelectorAll('.fly').forEach(fly => {
    const left = parseFloat(fly.style.left);
    const top = parseFloat(fly.style.top);
    if (left < 10 && top < 10) {
      console.log('Removing stuck fly at:', left, top);
      fly.remove();
    }
  });
});

// Spawn flies randomly at intervals
function spawnFlies() {
  createFly();
  const nextSpawn = 1500 + Math.random() * 2000;
  setTimeout(spawnFlies, nextSpawn);
}

// Start spawning
spawnFlies();


