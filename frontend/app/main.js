/* ═══════════════════════════════════════════════════════════
   LOCAL TERMINAL — main.js  (ES module entry point)

   Remaining here (post-phase-4):
   - Clock + market-status ticker
   - Article reader (open/close, return-fn)               → Phase 5
   - Bootstrap: wire command-bar + initDashboard
   - window.* shim for inline onclick= handlers           → Phase 6
   ═══════════════════════════════════════════════════════════ */
import { articleReader } from './dom.js';
import { apiFetch, timeAgo } from './utils.js';
import { setStatus, showDashboard, showArticleReader } from './views.js';
import { bindKeyboard, runCommand } from './command-bar.js';
import { initDashboard, refreshCard, removeCard } from './dashboard/engine.js';
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

// ─── ARTICLE READER ───────────────────────────────────────────────────────────
// _articleReturnFn lives on `window` so inline onclick strings can assign to it.
window._articleReturnFn = null;

async function openArticle(url, title, sentiment, source, publishedAt) {
  if (!url) return;

  window._articleReturnFn = window._articleReturnFn || (() => showDashboard());

  showArticleReader();
  setStatus(`Loading article…`);

  const sentClass = sentiment === 'positive' ? 'positive'
                  : sentiment === 'negative' ? 'negative' : 'neutral';
  const sentLabel = sentiment || 'neutral';

  articleReader.innerHTML = `
    <div class="ar-topbar">
      <button class="ar-back" onclick="closeArticle()">← BACK</button>
      ${source ? `<span class="ar-source-badge">${source}</span>` : ''}
      <span class="ar-sentiment ${sentClass}">${sentLabel}</span>
      ${publishedAt ? `<span class="dimmed" style="font-size:10px">${timeAgo(publishedAt)}</span>` : ''}
      <a class="ar-open-btn" href="${url}" target="_blank" rel="noopener">OPEN IN BROWSER ↗</a>
    </div>
    <div class="ar-loading">Fetching article</div>
  `;

  try {
    const data = await apiFetch(`/api/article/preview?url=${encodeURIComponent(url)}`);

    const heroHtml = data.image
      ? `<img class="ar-hero" src="${data.image}" alt="" onerror="this.style.display='none'" />`
      : '';

    let parasHtml;
    if (data.blocked) {
      parasHtml = `
        <div class="ar-blocked">
          <div class="ar-blocked-icon">⊘</div>
          <div class="ar-blocked-msg">This publisher requires browser access (cookie consent / paywall).</div>
          <a class="ar-blocked-btn" href="${url}" target="_blank" rel="noopener">Open Full Article ↗</a>
        </div>`;
    } else if (data.paragraphs && data.paragraphs.length) {
      parasHtml = `<div class="ar-paragraphs">${data.paragraphs.map(p => `<p class="ar-paragraph">${p}</p>`).join('')}</div>`;
    } else {
      parasHtml = `<p class="ar-no-content">Article body could not be extracted — the source may use JavaScript rendering.</p>`;
    }

    const displayTitle = data.title || title || 'Article';
    const siteName     = data.site_name || source || '';

    articleReader.innerHTML = `
      <div class="ar-topbar">
        <button class="ar-back" onclick="closeArticle()">← BACK</button>
        ${siteName ? `<span class="ar-source-badge">${siteName}</span>` : ''}
        <span class="ar-sentiment ${sentClass}">${sentLabel}</span>
        ${publishedAt ? `<span class="dimmed" style="font-size:10px">${timeAgo(publishedAt)}</span>` : ''}
        <a class="ar-open-btn" href="${url}" target="_blank" rel="noopener">OPEN IN BROWSER ↗</a>
      </div>
      ${heroHtml}
      <div class="ar-body">
        <h1 class="ar-title">${displayTitle}</h1>
        ${data.description ? `<p class="ar-description">${data.description}</p>` : ''}
        ${parasHtml}
      </div>
    `;

    setStatus(`${siteName ? siteName + ' · ' : ''}${displayTitle.slice(0, 60)}`);
  } catch (err) {
    articleReader.querySelector('.ar-loading')?.remove();
    articleReader.insertAdjacentHTML('beforeend',
      `<div class="ar-error">Could not load article: ${err.message}</div>
       <div class="ar-body"><h1 class="ar-title">${title || 'Article'}</h1></div>`
    );
  }
}

function closeArticle() {
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  if (window._articleReturnFn) {
    window._articleReturnFn();
    window._articleReturnFn = null;
  } else {
    showDashboard();
  }
}

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
