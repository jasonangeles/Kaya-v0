import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './icons';
import { SignInModal } from './SignInModal';
import { DitheringShader } from './ui/dithering-shader';
import { OrbitWidgets } from './OrbitWidgets';
import { ExploreFeatures } from './ExploreFeatures';
import { ThemeShowcase } from './ThemeShowcase';
import { DetailsBento } from './DetailsBento';

// --- Scroll reveal (fade + rise, once) -----------------------------------
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(28px)',
        transition: `opacity .8s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .8s cubic-bezier(.2,.7,.2,1) ${delay}ms`
      }}
    >
      {children}
    </div>
  );
};

// Hero visual: the hand + phone PNG (Figma 120:5797), positioned as in the mockup.
// It scrolls normally until it's fully in view (the rounded panel below reaches the
// bottom of the window), then stays put while that panel slides up over it.
// Done with CSS position: sticky (no scroll listeners), so it never lags or wobbles.
// The wrapper is twice the visual's height with a matching negative margin, which gives
// the sticky layer room to stay pinned while the panel covers it without changing layout.
// Placement at desktop size (1×): 1073 × 841, left edge 199.5px left of center,
// 51px below the top of the visual block. Everything scales with --s on smaller screens.
const HeroVisual: React.FC = () => {
  const box = useRef<HTMLDivElement>(null);
  const pin = useRef<HTMLDivElement>(null);
  // The sticky offset only changes with the window size, so it's measured on resize, never on scroll.
  // top = (window height − visual height): the visual is fully in view exactly when it reaches that
  // spot. Capped at the visual's starting position so it never gets pushed down on tall screens.
  useEffect(() => {
    const set = () => {
      const b = box.current, p = pin.current;
      if (!b || !p) return;
      const startTop = b.getBoundingClientRect().top + window.scrollY;
      const h = p.offsetHeight;
      p.style.top = `${Math.min(window.innerHeight - h, startTop)}px`;
    };
    set();
    window.addEventListener('resize', set);
    return () => window.removeEventListener('resize', set);
  }, []);
  return (
  <div ref={box} className="kaya-hero-visual relative w-full" aria-hidden="true">
    <div ref={pin} className="kaya-hero-sticky sticky w-full">
      <img
        src="/hero-phone.webp"
        alt=""
        draggable={false}
        className="absolute max-w-none select-none"
        style={{ left: 'calc(50% - 199.5px * var(--s))', top: 'calc(51px * var(--s))', width: 'calc(1073px * var(--s))' }}
      />
    </div>
  </div>
  );
};

// --- Landing --------------------------------------------------------------
export const Landing: React.FC<{ onGetStarted?: () => void }> = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const openSignIn = onGetStarted ?? (() => setSignInOpen(true));
  // The floating bar slides down from the top once the rounded second section
  // (#kaya-cover) reaches the top of the window, and slides away again above it.
  useEffect(() => {
    const onScroll = () => {
      const cover = document.getElementById('kaya-cover');
      setScrolled(!!cover && cover.getBoundingClientRect().top <= 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const steps = [
    { t: 'Add your accounts', d: 'Pick your banks, wallets, stocks and crypto, then type in the balances.' },
    { t: 'See your net worth', d: 'Kaya converts everything to your currency. Switch to USD, CAD or Bitcoin anytime.' },
    { t: 'Keep it current', d: 'Update a balance or log a dividend when something changes. Your history builds from there.' }
  ];

  return (
    <div className="min-h-[100dvh] bg-black text-white overflow-x-clip">
      {/* Nav (Figma 120:5797): logo + KAYA wordmark, mint Sign in. Sits on top of the hero, no blur. */}
      <header className="relative z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-icon.svg" alt="" className="w-6 h-6" draggable={false} />
            <span className="text-[16px] font-bold uppercase tracking-[4px] text-white">Kaya</span>
          </div>
          <button onClick={openSignIn} className="bg-[#dcf5df] hover:bg-[#c6e8cb] text-black text-[14px] leading-5 font-semibold px-4 py-2 rounded-lg transition-colors">Sign in</button>
        </div>
      </header>

      {/* Floating bar (Apple-style): drops in from the top once the second section reaches the top */}
      <div aria-hidden={!scrolled}
        className="fixed inset-x-0 top-0 z-40 px-3 sm:px-6 pt-2 pointer-events-none transition-[transform,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)]"
        style={{ transform: scrolled ? 'translateY(0)' : 'translateY(-110%)', opacity: scrolled ? 1 : 0 }}>
        <div className="kaya-frost pointer-events-auto max-w-[980px] mx-auto h-[52px] rounded-[16px] pl-4 pr-2 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo-icon.svg" alt="" className="w-5 h-5" draggable={false} />
            <span className="text-[14px] font-bold uppercase tracking-[3px] text-white">Kaya</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openSignIn} tabIndex={scrolled ? 0 : -1} className="h-8 px-3.5 rounded-full text-[12px] font-medium text-[#dcf5df] border border-[#dcf5df]/30 hover:border-[#dcf5df]/60 transition-colors">Sign in</button>
            <button onClick={openSignIn} tabIndex={scrolled ? 0 : -1} className="h-8 px-3.5 rounded-full text-[12px] font-semibold text-black bg-[#dcf5df] hover:bg-[#c6e8cb] transition-colors">Start for free</button>
          </div>
        </div>
      </div>

      {/* Hero: pulled up under the sticky header so the background reaches the top edge */}
      <section className="relative isolate -mt-16 pt-16">
        {/* Animated dither, anchored to the bottom of the hero: black at the top, green at the
            bottom. It runs 120px past the hero so the green shows around the rounded top
            corners of the next section instead of being cut off. */}
        <div
          className="absolute inset-x-0 -bottom-[120px] h-[820px] -z-10 pointer-events-none"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%)', maskImage: 'linear-gradient(to bottom, transparent 0%, #000 30%)' }}
        >
          <DitheringShader shape="gradient" type="16x16" colorBack="#070C0A" colorFront="#2A6E50" pxSize={1} levels={8} contrast={1.26} amplitude={2.5} speed={1} />
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-20 relative">
          <Reveal className="text-center max-w-2xl mx-auto">
            <h1 className="kaya-grad-text text-[52px] sm:text-[76px] lg:text-[92px] font-semibold leading-[0.83] tracking-[-0.038em]">
              Your net worth,<br />in one number.
            </h1>
            <p className="text-[16px] sm:text-[18px] leading-[1.625] text-white mt-6">
              Pesos in BPI, dollars in a TFSA, a bit of Bitcoin. Kaya adds it all up in the currency you choose. You enter the balances, so there are no bank logins.
            </p>
            <div className="flex items-center justify-center gap-3 mt-8">
              <button onClick={openSignIn} className="bg-[#dcf5df] hover:bg-[#c6e8cb] text-black text-[16px] font-semibold px-6 py-3.5 rounded-xl transition-colors">Start for free</button>
            </div>
            <p className="text-[12px] leading-4 mt-4" style={{ color: '#6e8777' }}>No bank logins · No ads · Your data stays yours</p>
          </Reveal>
        </div>
        <Reveal delay={150}>
          <HeroVisual />
        </Reveal>
      </section>

      {/* Closer look: black panel with rounded top corners that slides up over the hero */}
      <div id="kaya-cover" className="relative z-10 bg-black rounded-t-[40px] sm:rounded-t-[80px]">
      <section className="max-w-6xl mx-auto px-6 pt-16 sm:pt-[104px] pb-16">
        <Reveal className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.86] tracking-[-0.038em]">Take a closer look.</h2>
        </Reveal>
        <Reveal delay={120}><ExploreFeatures /></Reveal>
      </section>
      </div>

      {/* Orbit: every account around one total */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8 overflow-hidden">
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.86] tracking-[-0.038em]">Different accounts.<br />One clear total.</h2>
          <p className="text-[16px] sm:text-[18px] leading-[1.625] text-white mt-5">Banks, wallets, stocks and crypto in any currency. Kaya puts them on one screen so you stop switching apps.</p>
        </Reveal>
        <Reveal delay={120} className="mt-4 sm:mt-6">
          <OrbitWidgets />
        </Reveal>
      </section>

      {/* Themes: light and dark, in its own dithered container */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[32px] sm:rounded-[40px] px-5 pt-20 pb-12 sm:px-[72px] sm:pt-[72px] sm:pb-[56px]">
            <div className="absolute inset-0 -z-10">
              <DitheringShader shape="radial" type="16x16" colorBack="#070C0A" colorFront="#193F2F" pxSize={1} levels={8} contrast={1.26} speed={0.4} />
            </div>
            <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
              <h2 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.86] tracking-[-0.038em]">Easy on the eyes.</h2>
              <p className="text-[16px] sm:text-[18px] leading-[1.625] text-white mt-5">Pick dark for late-night check-ins or light for bright days.</p>
            </div>
            <ThemeShowcase />
          </div>
        </Reveal>
      </section>

      {/* The little things: bento grid of smaller features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.86] tracking-[-0.038em]">The little things.</h2>
          <p className="text-[16px] sm:text-[18px] leading-[1.625] text-white mt-5">What you start to notice after a few months with Kaya.</p>
        </Reveal>
        <Reveal delay={120}><DetailsBento /></Reveal>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.86] tracking-[-0.038em]">Set up in a few minutes.</h2>
          <p className="text-[16px] sm:text-[18px] leading-[1.625] text-white mt-5">Nothing to link and no spreadsheet to build.</p>
        </Reveal>
        <div className="grid sm:grid-cols-3 gap-6 items-stretch">
          {steps.map((s, i) => (
            <Reveal key={i} delay={i * 90} className="h-full">
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.02] p-6">
                <div className="w-9 h-9 rounded-full border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-sm font-semibold mb-4">{i + 1}</div>
                <h3 className="text-lg font-medium mb-1.5">{s.t}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 p-12 text-center" style={{ background: 'radial-gradient(ellipse 70% 120% at 50% 0%, rgba(16,185,129,0.15), transparent 70%)' }}>
            <h2 className="kaya-grad-text text-[44px] sm:text-[64px] font-semibold leading-[0.86] tracking-[-0.038em]">See your whole<br />net worth today.</h2>
            <p className="text-[16px] sm:text-[18px] leading-[1.625] text-white mt-5">Free to use. Nothing links to your bank.</p>
            <button onClick={openSignIn} className="mt-7 bg-white text-black font-semibold px-7 py-3.5 rounded-xl hover:opacity-90 transition-opacity">Start for free</button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-medium tracking-wide uppercase text-sm">Kaya</span>
          </div>
          <p className="text-xs text-zinc-600">Made for Filipinos at home and abroad · © {new Date().getFullYear()} Kaya</p>
        </div>
      </footer>

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
};
