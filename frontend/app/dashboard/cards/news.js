import { apiFetch, escapeAttr } from '../../utils.js';

// Article links carry their payload as data-* attrs; the delegated
// click handler in actions.js opens the reader (default onReturn =
// back to dashboard).
export default async function loadNewsCard(card, body) {
  const articles = await apiFetch(`/api/news/${card.ticker || 'SPY'}`);
  if (!articles || !articles.length) {
    body.innerHTML = '<div class="card-err">No news found</div>';
    return;
  }

  const items = articles.slice(0, 15).map(a => {
    const dot = a.sentiment === 'positive' ? 'dot-pos'
              : a.sentiment === 'negative' ? 'dot-neg' : 'dot-neu';
    const titleHtml = a.link
      ? `<a href="#"
            data-action="open-article"
            data-url="${escapeAttr(a.link)}"
            data-title="${escapeAttr(a.title || 'Untitled')}"
            data-sentiment="${a.sentiment || ''}"
            data-publisher="${escapeAttr(a.publisher || '')}"
            data-published-at="${a.published_at || ''}">${a.title || 'Untitled'}</a>`
      : (a.title || 'Untitled');
    return `
      <div class="ncard-item">
        <span class="sent-dot ${dot}"></span>
        <div class="ncard-title">${titleHtml}</div>
      </div>`;
  }).join('');

  body.innerHTML = `<div class="ncard-list">${items}</div>`;
}
