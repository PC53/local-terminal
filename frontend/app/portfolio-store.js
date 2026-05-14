const KEY = 'portfolio_holdings';

export function getHoldings() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function setHoldings(arr) {
  localStorage.setItem(KEY, JSON.stringify(arr));
}

export function addOrUpdateHolding(ticker, shares, avgCost) {
  const arr = getHoldings();
  const i = arr.findIndex(h => h.ticker === ticker);
  if (i >= 0) arr[i] = { ticker, shares, avgCost };
  else arr.push({ ticker, shares, avgCost });
  setHoldings(arr);
}

export function removeHolding(ticker) {
  setHoldings(getHoldings().filter(h => h.ticker !== ticker));
}
