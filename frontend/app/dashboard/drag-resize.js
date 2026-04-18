// Mouse-driven move/resize for dashboard cards. Engine calls these with
// a persistence callback (onSave) so this module stays ignorant of the
// localStorage key and serialization concerns.
import { dashboard } from '../state.js';

export function initDrag(el, card, onSave) {
  const handle = el.querySelector('.card-drag-handle');
  let ox, oy, ox0, oy0;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    ox = e.clientX; oy = e.clientY;
    ox0 = card.x;   oy0 = card.y;
    el.classList.add('dragging');
    el.style.zIndex = 999;

    function onMove(e) {
      card.x = Math.max(0, ox0 + e.clientX - ox);
      card.y = Math.max(0, oy0 + e.clientY - oy);
      el.style.left = card.x + 'px';
      el.style.top  = card.y + 'px';
    }
    function onUp() {
      el.classList.remove('dragging');
      el.style.zIndex = '';
      onSave();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

export function initResize(el, card, onSave) {
  const handle = el.querySelector('.card-resize-handle');
  let sx, sy, sw, sh;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    sx = e.clientX; sy = e.clientY;
    sw = card.w;    sh = card.h;

    function onMove(e) {
      card.w = Math.max(200, sw + e.clientX - sx);
      card.h = Math.max(120, sh + e.clientY - sy);
      el.style.width  = card.w + 'px';
      el.style.height = card.h + 'px';
      if (dashboard.charts[card.id]) {
        const body = document.getElementById(`body_${card.id}`);
        if (body) dashboard.charts[card.id].applyOptions({ width: body.clientWidth, height: body.clientHeight });
      }
    }
    function onUp() {
      onSave();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
