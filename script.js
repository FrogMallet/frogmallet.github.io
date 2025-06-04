const fly = document.getElementById('fly');
const splatSound = new Audio('https://drive.google.com/uc?export=download&id=10UnfCuyOtHadWFiFU-PVbO1DdrA-FT9r');

let isDragging = false;
let dragStartX, dragStartY;
let flyStartX, flyStartY;

fly.addEventListener('mousedown', (e) => {
  if (fly.classList.contains('splatted')) return;
  isDragging = false; // reset drag flag on mousedown
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  flyStartX = fly.offsetLeft;
  flyStartY = fly.offsetTop;

  // Listen for mousemove on document
  const onMouseMove = (e) => {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isDragging = true;
    }
    if (isDragging) {
      fly.style.left = flyStartX + dx + 'px';
      fly.style.top = flyStartY + dy + 'px';
      fly.style.cursor = 'grabbing';
    }
  };

  const onMouseUp = (e) => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    fly.style.cursor = 'grab';

    if (!isDragging) {
      // This was a click, not a drag
      if (!fly.classList.contains('splatted')) {
        splatSound.currentTime = 0;
        splatSound.play().catch(err => console.error('Audio play error:', err));
        fly.classList.add('splatted');
      }
    }
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

