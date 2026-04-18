import { apiFetch } from '../../utils.js';

// Inline onclick strings reach showDashboard/openArticle/_articleReturnFn
// via the window.* shim set up in main.js (removed in Phase 6).
export default async function loadNewsCard(card, body) {
  const articles = await apiFetch(`/api/news/${card.ticker || 'SPY'}`);
  if (!articles || !articles.length) {
    body.innerHTML = '<div class="card-err">No news found</div>';
    return;
  }

  const items = articles.slice(0, 15).map(a => {
    const dot = a.sentiment === 'positive' ? 'dot-pos'
              : a.sentiment === 'negative' ? 'dot-neg' : 'dot-neu';
    const escapedUrl   = (a.link  || '').replace(/'/g, "\\'");
    const escapedTitle = (a.title || 'Untitled').replace(/'/g, "\\'");
    const titleHtml = a.link
      ? `<a href="#" onclick="event.preventDefault();_articleReturnFn=()=>showDashboard();openArticle('${escapedUrl}','${escapedTitle}','${a.sentiment || ''}','${a.publisher || ''}','${a.published_at || ''}')">${a.title || 'Untitled'}</a>`
      : (a.title || 'Untitled');
    return `
      <div class="ncard-item">
        <span class="sent-dot ${dot}"></span>
        <div class="ncard-title">${titleHtml}</div>
      </div>`;
  }).join('');

  body.innerHTML = `<div class="ncard-list">${items}</div>`;
}
