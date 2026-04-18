// View switching + status bar. Owns the show/hide dance between
// dashboard / content panel / article reader.
import {
  contentPanel, dashboardView, articleReader, statusMsg,
} from './dom.js';

export function setStatus(msg) {
  statusMsg.textContent = msg;
}

export function showDashboard() {
  dashboardView.style.display = 'block';
  contentPanel.style.display  = 'none';
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  setStatus("Dashboard — Press ` to enter a command");
}

export function showContent() {
  dashboardView.style.display = 'none';
  articleReader.classList.remove('visible');
  articleReader.style.display = 'none';
  contentPanel.style.display  = 'block';
}

export function showArticleReader() {
  dashboardView.style.display = 'none';
  contentPanel.style.display  = 'none';
  articleReader.style.display = 'flex';
  articleReader.classList.add('visible');
}

export function showLoading(msg = 'LOADING') {
  showContent();
  contentPanel.innerHTML = `<div class="loading">${msg}</div>`;
}

export function showError(msg) {
  showContent();
  contentPanel.innerHTML = `<div class="error">ERROR: ${msg}</div>`;
  setStatus('Error');
}
