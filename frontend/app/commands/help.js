import { contentPanel } from '../dom.js';
import { setStatus } from '../views.js';
import { COMMANDS } from './registry.js';

export const meta = {
  desc:  'Show all available commands',
  usage: 'HELP',
};

export default function renderHelp() {
  const cmds = Object.entries(COMMANDS).map(([cmd, info]) => `
    <div class="help-row">
      <span class="help-cmd">${cmd}</span>
      <span class="help-desc">${info.usage} — ${info.desc}</span>
    </div>
  `).join('');

  contentPanel.innerHTML = `
    <div class="panel-section">
      <div class="panel-header"><span>HELP</span></div>

      <div class="section-title" style="margin-bottom:12px;">Commands</div>
      <div class="help-grid">${cmds}</div>

      <div class="section-title" style="margin-top:24px;margin-bottom:12px;">Keyboard Shortcuts</div>
      <div class="shortcut-list">
        <div class="shortcut-row">
          <span class="shortcut-key">\`</span>
          <span class="dimmed">Open command bar</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">/</span>
          <span class="dimmed">Open command bar</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">ESC</span>
          <span class="dimmed">Close command bar</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">↑ / ↓</span>
          <span class="dimmed">Navigate autocomplete / history</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">TAB</span>
          <span class="dimmed">Accept autocomplete suggestion</span>
        </div>
        <div class="shortcut-row">
          <span class="shortcut-key">ENTER</span>
          <span class="dimmed">Execute command</span>
        </div>
      </div>

      <div class="section-title" style="margin-top:24px;margin-bottom:12px;">Examples</div>
      <div class="help-grid">
        <div class="help-row" style="cursor:pointer" onclick="runCommand('DES AAPL')">
          <span class="help-cmd accent">DES AAPL</span>
          <span class="help-desc">Apple Inc. overview</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('CHART NVDA')">
          <span class="help-cmd accent">CHART NVDA</span>
          <span class="help-desc">NVIDIA price chart</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('NEWS TSLA')">
          <span class="help-cmd accent">NEWS TSLA</span>
          <span class="help-desc">Tesla latest news</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('FIN MSFT')">
          <span class="help-cmd accent">FIN MSFT</span>
          <span class="help-desc">Microsoft financials</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('MOST')">
          <span class="help-cmd accent">MOST</span>
          <span class="help-desc">Market movers</span>
        </div>
        <div class="help-row" style="cursor:pointer" onclick="runCommand('DES BTC-USD')">
          <span class="help-cmd accent">DES BTC-USD</span>
          <span class="help-desc">Bitcoin price</span>
        </div>
      </div>
    </div>
  `;

  setStatus('HELP — All commands listed');
}
