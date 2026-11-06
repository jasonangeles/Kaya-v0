import { supabase } from './supabaseClient';

/* ===========================================================================
 * Consent helpers (GDPR / CASL)
 *
 * 1. Cookie consent: Google Analytics only runs after "Accept" (see index.html,
 *    window.kayaLoadAnalytics). The choice is saved on this device.
 * 2. Marketing email consent: stored on the user's Supabase account
 *    (auth user_metadata). A database trigger copies every opt-in / opt-out into
 *    a write-only history table with a server timestamp (supabase/marketing-consent.sql).
 * ======================================================================== */

// ---------------------------------------------------------------- cookies --
export type CookieChoice = 'granted' | 'denied';
const COOKIE_KEY = 'kaya-cookie-consent';
export const COOKIE_EVENT = 'kaya:cookie-settings';

export const getCookieChoice = (): CookieChoice | null => {
  try {
    const v = localStorage.getItem(COOKIE_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch { return null; }
};

export const setCookieChoice = (choice: CookieChoice) => {
  try { localStorage.setItem(COOKIE_KEY, choice); } catch { /* storage blocked */ }
  const w = window as any;
  if (choice === 'granted') {
    w.kayaLoadAnalytics?.();
  } else {
    w.gtag?.('consent', 'update', { analytics_storage: 'denied' });
    // Remove any Google Analytics cookies already set on this domain
    document.cookie.split(';').map(c => c.trim().split('=')[0]).filter(n => n === '_ga' || n.startsWith('_ga_') || n === '_gid')
      .forEach(n => {
        const host = location.hostname.replace(/^www\./, '');
        [location.hostname, '.' + host, host].forEach(d => { document.cookie = `${n}=; Max-Age=0; path=/; domain=${d}`; });
        document.cookie = `${n}=; Max-Age=0; path=/`;
      });
  }
};

/** Re-open the cookie banner (footer link, Settings). */
export const openCookieSettings = () => window.dispatchEvent(new Event(COOKIE_EVENT));

// -------------------------------------------------------------- marketing --
export type ConsentSource = 'signup_form' | 'in_app_prompt' | 'settings';

/** The exact wording shown at each place we ask. Saved with the consent. */
export const CONSENT_TEXT: Record<ConsentSource, string> = {
  signup_form: 'Email me Kaya tips, news and offers. Unsubscribe anytime.',
  in_app_prompt: "Want Kaya tips and news by email? We'll only send the good stuff. Unsubscribe anytime.",
  settings: 'Tips, news and offers',
};

export type MarketingMeta = {
  marketing_opt_in?: boolean;
  marketing_consent_at?: string | null;
  marketing_consent_source?: ConsentSource | null;
  marketing_consent_text?: string | null;
  marketing_withdrawn_at?: string | null;
  marketing_prompt_dismissed_at?: string | null;
  marketing_asked_at?: string | null;
};

const save = async (data: MarketingMeta) => {
  if (!supabase) return false;
  const { error } = await supabase.auth.updateUser({ data });
  return !error;
};

export const optIn = (source: ConsentSource) => {
  const now = new Date().toISOString();
  return save({
    marketing_opt_in: true,
    marketing_consent_at: now,
    marketing_consent_source: source,
    marketing_consent_text: CONSENT_TEXT[source],
    marketing_withdrawn_at: null,
    marketing_asked_at: now,
  });
};

export const optOut = () => save({ marketing_opt_in: false, marketing_withdrawn_at: new Date().toISOString() });

/** "No thanks" or closing the one-time prompt: never show it again. */
export const dismissPrompt = () => {
  const now = new Date().toISOString();
  return save({ marketing_prompt_dismissed_at: now, marketing_asked_at: now });
};

/** Signed up without ticking the box: they were asked, so no prompt later. */
const markAsked = () => save({ marketing_asked_at: new Date().toISOString() });

/** Should the one-time prompt show for this account? */
export const shouldAskMarketing = (meta: MarketingMeta | undefined) =>
  !!meta && !meta.marketing_opt_in && !meta.marketing_prompt_dismissed_at && !meta.marketing_asked_at;

// The sign-up form can finish by code OR by the email link (which reloads the page),
// so the choice is parked on this device and applied once the user is signed in.
const PENDING_KEY = 'kaya-pending-marketing';
export const setPendingSignupConsent = (checked: boolean) => {
  try { localStorage.setItem(PENDING_KEY, checked ? 'yes' : 'no'); } catch { /* ignore */ }
};
export const clearPendingSignupConsent = () => { try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } };
export const hasPendingSignupConsent = () => { try { return !!localStorage.getItem(PENDING_KEY); } catch { return false; } };
/** Call when a session appears. Applies a parked sign-up choice, if any. */
export const applyPendingSignupConsent = async () => {
  let v: string | null = null;
  try { v = localStorage.getItem(PENDING_KEY); } catch { /* ignore */ }
  if (!v) return;
  const ok = v === 'yes' ? await optIn('signup_form') : await markAsked();
  if (ok) clearPendingSignupConsent();
};
