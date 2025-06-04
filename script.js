function spawnFly() {
  const fly = document.createElement('img');
  fly.src = 'fly.png';
  fly.style.left = Math.random() * window.innerWidth + 'px';
  fly.style.top = Math.random() * window.innerHeight + 'px';
  fly.draggable = true;

  const container = document.getElementById('fly-container');
  container.appendChild(fly);

  fly.addEventListener('click', () => {
    fly.src = 'splat.png';
    fly.classList.add('splat');
    const sound = document.getElementById('slap-sound');
    sound.currentTime = 0;
    sound.play();
    setTimeout(() => {
      fly.remove();
    }, 800);
  });

  fly.addEventListener('dragstart', e => {
    e.dataTransfer.setDragImage(fly, 20, 20);
  });
}

setInterval(spawnFly, 7000); // every 7 seconds
