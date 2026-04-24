// Article reader overlay: fetches an article preview through the backend
// and renders it inside #article-reader. Called from the delegated
// click handler (see actions.js) which passes the `onReturn` function
// to run when the user clicks BACK.
import { articleReader } from './dom.js';
import { apiFetch, timeAgo } from './utils.js';
import { setStatus, showDashboard, showArticleReader } from './views.js';

let _returnFn = null;

export async function openArticle({ url, title, sentiment, source, publishedAt, onReturn }) {
  if (!url) return;

  _returnFn = onReturn || (() => showDashboard());

  showArticleReader();
  setStatus(`Loading article…`);

  const sentClass = sentiment === 'positive' ? 'positive'
                  : sentiment === 'negative' ? 'negative' : 'neutral';
  const sentLabel = sentiment || 'neutral';

  articleReader.innerHTML = `
    <div class="ar-topbar">
      <button class="ar-back" data-action="close-article">← BACK</button>
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
        <button class="ar-back" data-action="close-article">← BACK</button>
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

export function closeArticle() {
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  if (_returnFn) {
    const fn = _returnFn;
    _returnFn = null;
    fn();
  } else {
    showDashboard();
  }
}
