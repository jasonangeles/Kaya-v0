import React, { useEffect, useState } from 'react';
import { COOKIE_EVENT, getCookieChoice, setCookieChoice, type CookieChoice } from '../services/consent';

/**
 * Cookie consent banner (GDPR). Shown once per device, on the landing page and in the app,
 * until the visitor picks Accept or Decline. Google Analytics stays off until Accept.
 * "Cookie settings" (footer, app Settings) re-opens it to change the choice.
 * Accept and Decline look identical (same size, weight and style): EU regulators treat a
 * highlighted Accept next to a muted Decline as nudging, so neither is emphasised.
 */
export const CookieBanner: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // drives the slide-in

  useEffect(() => {
    if (!getCookieChoice()) setOpen(true);
    const reopen = () => setOpen(true);
    window.addEventListener(COOKIE_EVENT, reopen);
    return () => window.removeEventListener(COOKIE_EVENT, reopen);
  }, []);

  useEffect(() => {
    if (!open) { setShown(false); return; }
    const t = setTimeout(() => setShown(true), 600); // let the page paint first
    return () => clearTimeout(t);
  }, [open]);

  const choose = (c: CookieChoice) => {
    setCookieChoice(c);
    setShown(false);
    setTimeout(() => setOpen(false), 350);
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-label="Cookie preferences"
      className="fixed z-[80] left-3 right-3 bottom-3 sm:left-auto sm:right-5 sm:bottom-5 sm:w-[380px] transition-[transform,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
      style={{ transform: shown ? 'none' : 'translateY(16px)', opacity: shown ? 1 : 0, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="kaya-frost rounded-[20px] p-5 text-left" style={{ background: 'rgba(20, 22, 21, 0.78)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
        <p className="text-[14px] font-semibold text-white">Cookies, briefly</p>
        <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: '#9fb3a6' }}>
          We use analytics cookies to see what's working. No ads, no selling your data.{' '}
          <a href="/privacy" className="underline underline-offset-2 text-[#dcf5df] hover:text-white">Privacy</a>
        </p>
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={() => choose('denied')}
            className="h-10 rounded-xl text-[14px] font-semibold text-[#dcf5df] border border-[#dcf5df]/30 hover:border-[#dcf5df]/60 transition-colors">Decline</button>
          <button onClick={() => choose('granted')}
            className="h-10 rounded-xl text-[14px] font-semibold text-[#dcf5df] border border-[#dcf5df]/30 hover:border-[#dcf5df]/60 transition-colors">Accept</button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
