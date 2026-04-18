import { contentPanel } from '../dom.js';
import { apiFetch, timeAgo } from '../utils.js';
import { setStatus, showLoading, showError } from '../views.js';

export const meta = {
  desc:  'Latest news with sentiment analysis',
  usage: 'NEWS <TICKER>',
};

export default async function renderNews(ticker) {
  if (!ticker) { showError('Usage: NEWS <TICKER>  e.g. NEWS AAPL'); return; }
  showLoading(`LOADING NEWS ${ticker}`);

  try {
    const articles = await apiFetch(`/api/news/${ticker}`);

    if (!articles || articles.length === 0) {
      contentPanel.innerHTML = `
        <div class="panel-section">
          <div class="panel-header"><span>NEWS</span><span class="panel-ticker">${ticker}</span></div>
          <p class="dimmed">No news found for ${ticker}</p>
        </div>`;
      setStatus(`NEWS ${ticker} — No articles found`);
      return;
    }

    const items = articles.map(a => {
      const sentClass = a.sentiment === 'positive' ? 'badge-positive'
                      : a.sentiment === 'negative' ? 'badge-negative'
                      : 'badge-neutral';
      const timeStr = a.published_at ? timeAgo(a.published_at) : '';
      const escapedUrl   = (a.link  || '').replace(/'/g, "\\'");
      const escapedTitle = (a.title || 'Untitled').replace(/'/g, "\\'");
      // Inline onclick sets _articleReturnFn + calls openArticle — both live on window (Phase 2 shim).
      const titleHtml = a.link
        ? `<a href="#" onclick="event.preventDefault();_articleReturnFn=()=>{renderNews('${ticker}')};openArticle('${escapedUrl}','${escapedTitle}','${a.sentiment || ''}','${a.publisher || ''}','${a.published_at || ''}')">${a.title || 'Untitled'}</a>`
        : (a.title || 'Untitled');

      return `
        <div class="news-item">
          <div class="news-title">${titleHtml}</div>
          <div class="news-meta">
            ${a.publisher ? `<span>${a.publisher}</span>` : ''}
            ${timeStr ? `<span>${timeStr}</span>` : ''}
            ${a.sentiment ? `<span class="badge ${sentClass}">${a.sentiment}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    const counts = { positive: 0, neutral: 0, negative: 0 };
    articles.forEach(a => { if (a.sentiment) counts[a.sentiment]++; });
    const total = articles.length;

    contentPanel.innerHTML = `
      <div class="panel-section">
        <div class="panel-header">
          <span>NEWS</span>
          <span class="panel-ticker">${ticker}</span>
          <span class="dimmed" style="font-size:11px">${total} articles</span>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:20px;font-size:12px;">
          <span>Sentiment:&nbsp;
            <span class="positive">${counts.positive} positive</span> ·
            <span class="dimmed">${counts.neutral} neutral</span> ·
            <span class="negative">${counts.negative} negative</span>
          </span>
        </div>

        <div>${items}</div>
      </div>
    `;

    setStatus(`NEWS ${ticker} — ${total} articles`);
  } catch (err) {
    showError(`Could not load news for ${ticker}: ${err.message}`);
  }
}
