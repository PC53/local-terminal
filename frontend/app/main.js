/* ═══════════════════════════════════════════════════════════
   LOCAL TERMINAL — main.js  (ES module entry point)

   Remaining here (post-phase-5):
   - Clock + market-status ticker
   - Bootstrap: wire command-bar + initDashboard
   - window.* shim for inline onclick= handlers           → Phase 6
   ═══════════════════════════════════════════════════════════ */
import { setStatus, showDashboard } from './views.js';
import { bindKeyboard, runCommand } from './command-bar.js';
import { initDashboard, refreshCard, removeCard } from './dashboard/engine.js';
import { openArticle, closeArticle } from './article-reader.js';
import {
  renderChart, renderNews, renderFinancials, renderMost,
} from './commands/registry.js';

// ─── CLOCK ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const clock = document.getElementById('clock');
  if (clock) {
    clock.textContent = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZoneName: 'short',
    });
  }
}

setInterval(updateClock, 1000);
updateClock();

// ─── MARKET STATUS ────────────────────────────────────────────────────────────
function updateMarketStatus() {
  const dot   = document.getElementById('market-status-dot');
  const label = document.getElementById('market-status-label');
  if (!dot || !label) return;

  const now   = new Date();
  const nyNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day   = nyNow.getDay(); // 0=Sun, 6=Sat
  const hour  = nyNow.getHours();
  const min   = nyNow.getMinutes();
  const hhmm  = hour * 60 + min;

  const isWeekend    = day === 0 || day === 6;
  const isPremarket  = !isWeekend && hhmm >= 4 * 60 && hhmm < 9 * 60 + 30;
  const isOpen       = !isWeekend && hhmm >= 9 * 60 + 30 && hhmm < 16 * 60;
  const isAfterHours = !isWeekend && hhmm >= 16 * 60 && hhmm < 20 * 60;

  dot.className = 'status-dot';

  if (isOpen) {
    dot.classList.add('open');
    label.textContent = 'MARKET OPEN';
    label.style.color = 'var(--positive)';
  } else if (isPremarket) {
    dot.classList.add('pre');
    label.textContent = 'PRE-MARKET';
    label.style.color = 'var(--warning)';
  } else if (isAfterHours) {
    dot.classList.add('pre');
    label.textContent = 'AFTER HOURS';
    label.style.color = 'var(--warning)';
  } else {
    dot.classList.add('closed');
    label.textContent = 'MARKET CLOSED';
    label.style.color = 'var(--text-dim)';
  }
}

setInterval(updateMarketStatus, 30000);
updateMarketStatus();

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
bindKeyboard();
initDashboard();
setStatus("Dashboard — Press ` to enter a command");

// ─── GLOBAL EXPOSURE FOR INLINE onclick HANDLERS ──────────────────────────────
// Removed in Phase 6 once all inline handlers switch to event delegation.
window.runCommand       = runCommand;
window.showDashboard    = showDashboard;
window.openArticle      = openArticle;
window.closeArticle     = closeArticle;
window.renderChart      = renderChart;
window.renderNews       = renderNews;
window.renderFinancials = renderFinancials;
window.renderMost       = renderMost;
window.refreshCard      = refreshCard;
window.removeCard       = removeCard;
