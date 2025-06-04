// Select the body to append flies
const body = document.body;

// Preload splat sound
const splatSound = new Audio('splat.mp3');

// Function to create a fly
function createFly() {
  const fly = document.createElement('img');
  fly.src = 'fly.png';
  fly.style.position = 'fixed';
  fly.style.width = '50px';
  fly.style.cursor = 'grab';
  
  // Random position inside viewport
  fly.style.top = Math.random() * (window.innerHeight - 50) + 'px';
  fly.style.left = Math.random() * (window.innerWidth - 50) + 'px';

  // Append fly
  body.appendChild(fly);

  // Drag variables
  let isDragging = false;
  let offsetX, offsetY;

  fly.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - fly.getBoundingClientRect().left;
    offsetY = e.clientY - fly.getBoundingClientRect().top;
    fly.style.cursor = 'grabbing';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    fly.style.top = (e.clientY - offsetY) + 'px';
    fly.style.left = (e.clientX - offsetX) + 'px';
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      fly.style.cursor = 'grab';
    }
  });

  // On click, splat the fly
  fly.addEventListener('click', () => {
    splatSound.currentTime = 0;
    splatSound.play();
    fly.src = 'splat.png';
    fly.style.cursor = 'default';
    
    // Remove the fly after 1.5 seconds
    setTimeout(() => {
      fly.remove();
    }, 1500);
  });
}

// Spawn a fly every 5-10 seconds randomly
setInterval(() => {
  createFly();
}, 5000 + Math.random() * 5000);

// Optional: spawn first fly immediately
createFly();

