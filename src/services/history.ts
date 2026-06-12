import { Asset, HistoricalPoint, TimeRange } from '../types';

// Reconstructs real net worth over time from each asset's balance history.
// At any moment T, an asset's value = its most recent logged balance as of T
// (a step function), summed across assets and converted via the live rate map.
export const buildNetWorthSeries = (
  assets: Asset[],
  range: TimeRange,
  rates: Record<string, number>,
  btcUsd: number,
  displayCurrency: string
): HistoricalPoint[] => {
  const now = new Date();
  let start = new Date();
  let points = 40;

  switch (range) {
    case '1D': start.setDate(now.getDate() - 1); points = 24; break;
    case '1W': start.setDate(now.getDate() - 7); points = 28; break;
    case '1M': start.setDate(now.getDate() - 30); points = 30; break;
    case '3M': start.setDate(now.getDate() - 90); points = 45; break;
    case 'YTD': start = new Date(now.getFullYear(), 0, 1); points = 40; break;
    case '1Y': start.setFullYear(now.getFullYear() - 1); points = 52; break;
    case 'ALL': {
      let earliest = now.getTime();
      assets.forEach(a => a.history.forEach(h => {
        const t = new Date(h.date).getTime();
        if (t < earliest) earliest = t;
      }));
      start = new Date(Math.min(earliest, now.getTime()));
      points = 60;
      break;
    }
  }

  // Pre-sort each asset's history ascending by date.
  const prepared = assets.map(a => ({
    currency: a.currency,
    hist: [...a.history].sort((x, y) => new Date(x.date).getTime() - new Date(y.date).getTime())
          .map(h => ({ t: new Date(h.date).getTime(), amount: h.amount }))
  }));

  const usdOf = (amount: number, currency: string) => amount / (rates[currency] || 1);
  const startMs = start.getTime();
  const span = Math.max(now.getTime() - startMs, 1);

  const series: HistoricalPoint[] = [];
  for (let i = 0; i <= points; i++) {
    const t = startMs + (span * i) / points;
    let usd = 0;
    prepared.forEach(a => {
      let bal: number | null = null;
      for (let k = a.hist.length - 1; k >= 0; k--) {
        if (a.hist[k].t <= t) { bal = a.hist[k].amount; break; }
      }
      if (bal != null) usd += usdOf(bal, a.currency);
    });
    series.push({
      date: new Date(t).toISOString(),
      totalValueUSD: usd,
      totalValuePHP: usd * (rates.PHP || 1),
      totalValueBTC: btcUsd ? usd / btcUsd : 0,
      totalValueDisplay: usd * (rates[displayCurrency] || 1),
      btcPrice: btcUsd,
      inflationIndex: 0
    });
  }
  return series;
};
