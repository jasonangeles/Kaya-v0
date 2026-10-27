// Curated registry of financial institutions used to render brand-colored
// monogram logos. Fully local — no network calls at runtime. Real logo files
// dropped into src/assets/logos/<id>.svg|png override the monogram automatically.
// The `domain` field is used ONLY by the build-time script scripts/fetch-logos.mjs
// to download those files once; it is never fetched from the browser.
export interface Institution {
  id: string;       // stable key, also the logo filename
  short: string;    // monogram shown on the tile (1–4 chars)
  color: string;    // brand background color
  aliases: string[];// normalized matches (lowercased, alphanumeric)
  domain?: string;  // primary web domain, for build-time logo fetching only
}

export const INSTITUTIONS: Institution[] = [
  // ---- Philippines · banks ----
  { id: 'bpi', short: 'BPI', color: '#B11116', aliases: ['bpi', 'bankofthephilippineislands'], domain: 'bpi.com.ph' },
  { id: 'bdo', short: 'BDO', color: '#002F6C', aliases: ['bdo', 'bdounibank', 'bancodeoro'], domain: 'bdo.com.ph' },
  { id: 'metrobank', short: 'MB', color: '#002F6C', aliases: ['metrobank', 'mbtc'], domain: 'metrobank.com.ph' },
  { id: 'landbank', short: 'LB', color: '#0A7A3B', aliases: ['landbank', 'landbankofthephilippines'], domain: 'landbank.com' },
  { id: 'pnb', short: 'PNB', color: '#0033A0', aliases: ['pnb', 'philippinenationalbank'], domain: 'pnb.com.ph' },
  { id: 'securitybank', short: 'SB', color: '#00529B', aliases: ['securitybank'], domain: 'securitybank.com' },
  { id: 'unionbank', short: 'UB', color: '#F47920', aliases: ['unionbank', 'unionbankph', 'ubp'], domain: 'unionbankph.com' },
  { id: 'chinabank', short: 'CB', color: '#C8102E', aliases: ['chinabank', 'cbc'], domain: 'chinabank.ph' },
  { id: 'rcbc', short: 'RCBC', color: '#003B7A', aliases: ['rcbc'], domain: 'rcbc.com' },
  { id: 'eastwest', short: 'EW', color: '#E03C31', aliases: ['eastwest', 'eastwestbank'], domain: 'eastwestbanker.com' },
  { id: 'psbank', short: 'PS', color: '#1C75BC', aliases: ['psbank'], domain: 'psbank.com.ph' },
  { id: 'dbp', short: 'DBP', color: '#0054A6', aliases: ['dbp', 'developmentbankofthephilippines'], domain: 'dbp.ph' },

  // ---- Philippines · digital / e-wallets ----
  { id: 'gcash', short: 'G', color: '#0070E0', aliases: ['gcash'], domain: 'gcash.com' },
  { id: 'maya', short: 'M', color: '#00C66B', aliases: ['maya', 'paymaya'], domain: 'maya.ph' },
  { id: 'maribank', short: 'M', color: '#FF6B00', aliases: ['maribank', 'mari', 'seabank'], domain: 'maribank.ph' },
  { id: 'tonik', short: 'T', color: '#22D3A6', aliases: ['tonik', 'tonikbank'], domain: 'tonikbank.com' },
  { id: 'gotyme', short: 'GT', color: '#FF5A00', aliases: ['gotyme', 'gotymebank'], domain: 'gotyme.com.ph' },
  { id: 'cimb', short: 'CIMB', color: '#EC1C24', aliases: ['cimb', 'cimbph', 'cimbbank'], domain: 'cimbbank.com.ph' },
  { id: 'unobank', short: 'UNO', color: '#2E3192', aliases: ['uno', 'unobank', 'unodigitalbank'], domain: 'uno.bank' },

  // ---- Canada · banks & brokerages ----
  { id: 'rbc', short: 'RBC', color: '#0051A5', aliases: ['rbc', 'royalbank', 'royalbankofcanada'], domain: 'rbc.com' },
  { id: 'td', short: 'TD', color: '#00B04F', aliases: ['td', 'tdbank', 'torontodominion'], domain: 'td.com' },
  { id: 'scotiabank', short: 'S', color: '#EC111A', aliases: ['scotiabank', 'scotia', 'bankofnovascotia'], domain: 'scotiabank.com' },
  { id: 'bmo', short: 'BMO', color: '#0079C1', aliases: ['bmo', 'bankofmontreal'], domain: 'bmo.com' },
  { id: 'cibc', short: 'CIBC', color: '#B4131E', aliases: ['cibc'], domain: 'cibc.com' },
  { id: 'nbc', short: 'NBC', color: '#E2231A', aliases: ['nationalbank', 'nbc', 'nationalbankofcanada'], domain: 'nbc.ca' },
  { id: 'tangerine', short: 'T', color: '#FF6200', aliases: ['tangerine'], domain: 'tangerine.ca' },
  { id: 'simplii', short: 'S', color: '#E4002B', aliases: ['simplii', 'simpliifinancial'], domain: 'simplii.com' },
  { id: 'eqbank', short: 'EQ', color: '#5B2D8E', aliases: ['eqbank', 'equitablebank'], domain: 'eqbank.ca' },
  { id: 'desjardins', short: 'D', color: '#00874E', aliases: ['desjardins'], domain: 'desjardins.com' },
  { id: 'vancity', short: 'V', color: '#00543D', aliases: ['vancity'], domain: 'vancity.com' },
  { id: 'atb', short: 'ATB', color: '#0072CE', aliases: ['atb', 'atbfinancial'], domain: 'atb.com' },
  { id: 'wealthsimple', short: 'WS', color: '#1A1A1A', aliases: ['wealthsimple'], domain: 'wealthsimple.com' },
  { id: 'questrade', short: 'Q', color: '#00A0DF', aliases: ['questrade'], domain: 'questrade.com' },

  // ---- USA · banks & brokerages ----
  { id: 'chase', short: 'C', color: '#117ACA', aliases: ['chase', 'jpmorganchase', 'jpmorgan'], domain: 'chase.com' },
  { id: 'bofa', short: 'BA', color: '#E31837', aliases: ['bankofamerica', 'bofa', 'boa'], domain: 'bankofamerica.com' },
  { id: 'wellsfargo', short: 'WF', color: '#D71E2B', aliases: ['wellsfargo', 'wells'], domain: 'wellsfargo.com' },
  { id: 'usbank', short: 'US', color: '#0C2074', aliases: ['usbank', 'usbancorp'], domain: 'usbank.com' },
  { id: 'capitalone', short: 'C1', color: '#004977', aliases: ['capitalone'], domain: 'capitalone.com' },
  { id: 'pnc', short: 'PNC', color: '#F58025', aliases: ['pnc', 'pncbank'], domain: 'pnc.com' },
  { id: 'truist', short: 'T', color: '#2D1A45', aliases: ['truist'], domain: 'truist.com' },
  { id: 'ally', short: 'A', color: '#A50034', aliases: ['ally', 'allybank'], domain: 'ally.com' },
  { id: 'schwab', short: 'CS', color: '#00A0DF', aliases: ['schwab', 'charlesschwab'], domain: 'schwab.com' },
  { id: 'sofi', short: 'SoFi', color: '#00558C', aliases: ['sofi'], domain: 'sofi.com' },
  { id: 'discover', short: 'D', color: '#FF6000', aliases: ['discover', 'discoverbank'], domain: 'discover.com' },

  // ---- UAE · banks ----
  { id: 'enbd', short: 'ENBD', color: '#E2241A', aliases: ['emiratesnbd', 'enbd'], domain: 'emiratesnbd.com' },
  { id: 'fab', short: 'FAB', color: '#00205B', aliases: ['fab', 'firstabudhabibank'], domain: 'bankfab.com' },
  { id: 'adcb', short: 'ADCB', color: '#E03E2F', aliases: ['adcb', 'abudhabicommercialbank'], domain: 'adcb.com' },
  { id: 'mashreq', short: 'M', color: '#FF5F00', aliases: ['mashreq', 'mashreqbank'], domain: 'mashreq.com' },
  { id: 'dib', short: 'DIB', color: '#009639', aliases: ['dib', 'dubaiislamicbank'], domain: 'dib.ae' },
  { id: 'adib', short: 'ADIB', color: '#00529B', aliases: ['adib', 'abudhabiislamicbank'], domain: 'adib.ae' },
  { id: 'rakbank', short: 'RAK', color: '#ED1C24', aliases: ['rakbank', 'rak'], domain: 'rakbank.ae' },
  { id: 'emiratesislamic', short: 'EI', color: '#C8102E', aliases: ['emiratesislamic'], domain: 'emiratesislamic.ae' },
  { id: 'cbd', short: 'CBD', color: '#1A3668', aliases: ['cbd', 'commercialbankofdubai'], domain: 'cbd.ae' },
  { id: 'wio', short: 'Wio', color: '#6E4BF4', aliases: ['wio', 'wiobank'], domain: 'wio.io' },
  { id: 'liv', short: 'Liv', color: '#2DC84D', aliases: ['liv', 'livbank'], domain: 'liv.me' },

  // ---- Global · banks & remittance ----
  { id: 'hsbc', short: 'HSBC', color: '#DB0011', aliases: ['hsbc'], domain: 'hsbc.com' },
  { id: 'citi', short: 'Citi', color: '#003B7E', aliases: ['citi', 'citibank', 'citigroup'], domain: 'citi.com' },
  { id: 'standardchartered', short: 'SC', color: '#0473EA', aliases: ['standardchartered', 'stanchart'], domain: 'sc.com' },
  { id: 'wise', short: 'W', color: '#9FE870', aliases: ['wise', 'transferwise'], domain: 'wise.com' },
  { id: 'revolut', short: 'R', color: '#191C1F', aliases: ['revolut'], domain: 'revolut.com' },
  { id: 'paypal', short: 'PP', color: '#003087', aliases: ['paypal'], domain: 'paypal.com' },
  { id: 'remitly', short: 'R', color: '#0077C8', aliases: ['remitly'], domain: 'remitly.com' },
  { id: 'westernunion', short: 'WU', color: '#FFDD00', aliases: ['westernunion', 'wu'], domain: 'westernunion.com' },

  // ---- Crypto · exchanges & wallets ----
  { id: 'binance', short: 'B', color: '#F0B90B', aliases: ['binance'], domain: 'binance.com' },
  { id: 'coinbase', short: 'C', color: '#0052FF', aliases: ['coinbase'], domain: 'coinbase.com' },
  { id: 'kraken', short: 'K', color: '#5741D9', aliases: ['kraken'], domain: 'kraken.com' },
  { id: 'bybit', short: 'By', color: '#F7A600', aliases: ['bybit'], domain: 'bybit.com' },
  { id: 'okx', short: 'OKX', color: '#0B0B0B', aliases: ['okx', 'okex'], domain: 'okx.com' },
  { id: 'ledger', short: 'L', color: '#0B0B0B', aliases: ['ledger'], domain: 'ledger.com' },
  { id: 'trezor', short: 'T', color: '#00854D', aliases: ['trezor'], domain: 'trezor.io' },
  { id: 'metamask', short: 'MM', color: '#F6851B', aliases: ['metamask'], domain: 'metamask.io' },
  { id: 'trustwallet', short: 'TW', color: '#3375BB', aliases: ['trustwallet', 'trust'], domain: 'trustwallet.com' },
  { id: 'strike', short: 'S', color: '#191919', aliases: ['strike'], domain: 'strike.me' },
  { id: 'pdax', short: 'P', color: '#1A1F71', aliases: ['pdax'], domain: 'pdax.ph' },
  { id: 'coinsph', short: 'C', color: '#1652F0', aliases: ['coinsph', 'coins'], domain: 'coins.ph' },

  // ---- Brokerages / investing ----
  { id: 'ibkr', short: 'IB', color: '#D81222', aliases: ['interactivebrokers', 'ibkr'], domain: 'interactivebrokers.com' },
  { id: 'robinhood', short: 'R', color: '#00C805', aliases: ['robinhood'], domain: 'robinhood.com' },
  { id: 'vanguard', short: 'V', color: '#96151D', aliases: ['vanguard'], domain: 'vanguard.com' },
  { id: 'fidelity', short: 'F', color: '#468125', aliases: ['fidelity'], domain: 'fidelity.com' },
  { id: 'col', short: 'COL', color: '#00529B', aliases: ['col', 'colfinancial'], domain: 'colfinancial.com' },
  { id: 'gotrade', short: 'Go', color: '#00B86B', aliases: ['gotrade', 'heygotrade'], domain: 'heygotrade.com' },
  { id: 'investatrade', short: 'IT', color: '#12B5C9', aliases: ['investatrade', 'investa'], domain: 'investagrams.com' },
  { id: 'stake', short: 'St', color: '#16233F', aliases: ['stake', 'getstake'], domain: 'hellostake.com' },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

// Build a fast exact-match index from every alias.
const INDEX = new Map<string, Institution>();
for (const inst of INSTITUTIONS) for (const a of inst.aliases) INDEX.set(a, inst);

export function findInstitution(name?: string): Institution | null {
  if (!name) return null;
  const n = norm(name);
  if (!n) return null;
  const exact = INDEX.get(n);
  if (exact) return exact;
  // Prefix match in both directions (handles "BPI Savings", "TD Canada Trust").
  // Require >=3 chars to avoid noisy 2-letter collisions.
  let best: Institution | null = null;
  let bestLen = 0;
  for (const inst of INSTITUTIONS) {
    for (const a of inst.aliases) {
      if (a.length < 3) continue;
      if ((n.startsWith(a) || a.startsWith(n)) && a.length > bestLen) { best = inst; bestLen = a.length; }
    }
  }
  return best;
}

// Luminance check → choose readable text color on the brand tile.
export function textOn(color: string): string {
  const h = color.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0a0a0a' : '#ffffff';
}
