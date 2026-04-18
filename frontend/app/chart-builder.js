// Single TradingView Lightweight Charts builder used by both the CHART
// command (full-panel) and dashboard chart cards. The only differences
// between the two were a handful of shade/layout values — captured here
// as themes so the code path is shared.
//
// Depends on the global `LightweightCharts` loaded from index.html.

const GREEN = '#33E29A';
const RED   = '#ff4455';

const THEMES = {
  // CHART command — larger panel, slightly darker background
  full: {
    bg: '#0a0a0a', text: '#666', grid: '#1a1a1a',
    volScaleId: 'volume', volMargin: 0.8,  volAlpha: 0.3,
    secondsVisible: false, mouseWheel: false,
    volDefaultColor: '#1e1e1e',
  },
  // Dashboard card — compact
  card: {
    bg: '#0d0d0d', text: '#444', grid: '#161616',
    volScaleId: 'vol',    volMargin: 0.82, volAlpha: 0.25,
    secondsVisible: null, mouseWheel: true,
    volDefaultColor: null,
  },
};

export function createPriceChart({ container, data, theme = 'full', width, height }) {
  const t = THEMES[theme] || THEMES.full;

  const timeScale = { borderColor: '#1e1e1e', timeVisible: true };
  if (t.secondsVisible !== null) timeScale.secondsVisible = t.secondsVisible;

  const opts = {
    width:  width  ?? container.clientWidth,
    height: height ?? container.clientHeight,
    layout: { background: { type: 'solid', color: t.bg }, textColor: t.text },
    grid:   { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: GREEN, labelBackgroundColor: GREEN },
      horzLine: { color: GREEN, labelBackgroundColor: GREEN },
    },
    rightPriceScale: { borderColor: '#1e1e1e', textColor: t.text },
    timeScale,
  };
  if (t.mouseWheel) {
    opts.handleScroll = { mouseWheel: true };
    opts.handleScale  = { mouseWheel: true };
  }

  const chart = LightweightCharts.createChart(container, opts);

  const candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor:         GREEN, downColor:       RED,
    borderUpColor:   GREEN, borderDownColor: RED,
    wickUpColor:     GREEN, wickDownColor:   RED,
  });
  candleSeries.setData(data);

  const volOpts = { priceFormat: { type: 'volume' }, priceScaleId: t.volScaleId };
  if (t.volDefaultColor) volOpts.color = t.volDefaultColor;
  const volSeries = chart.addSeries(LightweightCharts.HistogramSeries, volOpts);
  chart.priceScale(t.volScaleId).applyOptions({ scaleMargins: { top: t.volMargin, bottom: 0 } });
  volSeries.setData(data.map(d => ({
    time:  d.time,
    value: d.volume,
    color: d.close >= d.open
      ? `rgba(51,226,154,${t.volAlpha})`
      : `rgba(255,68,85,${t.volAlpha})`,
  })));

  chart.timeScale().fitContent();
  return { chart, candleSeries, volSeries };
}
