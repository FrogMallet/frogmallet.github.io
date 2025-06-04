function spawnFly() {
  const fly = document.createElement('div');
  fly.classList.add('fly');
  fly.style.backgroundImage = "url('fly.png')";
  fly.style.backgroundSize = 'cover';
  fly.style.left = Math.random() * (window.innerWidth - 50) + 'px';
  fly.style.top = Math.random() * (window.innerHeight - 50) + 'px';
  document.body.appendChild(fly);

  fly.addEventListener('mousedown', function (e) {
    e.preventDefault();
    let offsetX = e.clientX - fly.getBoundingClientRect().left;
    let offsetY = e.clientY - fly.getBoundingClientRect().top;

    function moveAt(pageX, pageY) {
      fly.style.left = pageX - offsetX + 'px';
      fly.style.top = pageY - offsetY + 'px';
    }

    function onMouseMove(e) {
      moveAt(e.pageX, e.pageY);
    }

    document.addEventListener('mousemove', onMouseMove);

    fly.onmouseup = function () {
      document.removeEventListener('mousemove', onMouseMove);
      fly.onmouseup = null;
    };
  });

  fly.addEventListener('click', () => {
    fly.classList.add('splatted');
    fly.style.pointerEvents = 'none';
    document.getElementById('slapSound').play();
    setTimeout(() => fly.remove(), 2000);
  });
}

setInterval(spawnFly, 8000); // spawn fly every 8 seconds
