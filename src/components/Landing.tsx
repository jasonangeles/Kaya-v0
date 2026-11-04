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

// Scroll-scrubbed word reveal (the GSAP SplitText + ScrollTrigger "scrub" look, done natively):
// the text is split into words, every word starts dim, and words light up one after another
// as the block moves up the screen (and dim again if you scroll back).
// End state = the hero's gradient text: each word paints its own slice of ONE gradient sized
// to the whole heading (positions measured on resize), so the gradient stays seamless while
// words fade individually. Opacity only, one rAF per scroll, no React re-renders.
const GRAD = 'radial-gradient(232% 220% at -30% -59%, #ffffff 44%, #ebffda 55%, #003a30 100%)';
const ScrollWords: React.FC<{ lines: string[]; className?: string }> = ({ lines, className = '' }) => {
  const root = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const words = Array.from(el.querySelectorAll<HTMLSpanElement>('[data-w]'));
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Give every word its slice of the shared gradient
    const layout = () => {
      const W = el.offsetWidth, H = el.offsetHeight;
      const base = el.getBoundingClientRect();
      words.forEach(w => {
        const r = w.getBoundingClientRect();
        w.style.backgroundSize = `${W}px ${H}px`;
        w.style.backgroundPosition = `${-(r.left - base.left)}px ${-(r.top - base.top)}px`;
      });
    };
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect(), vh = window.innerHeight;
      // 0 when the block's top is at 90% of the screen, 1 when its bottom reaches 70%.
      // Also forced to 1 at the very end of the page, so the last words always light up.
      let p = Math.min(1, Math.max(0, (vh * 0.9 - r.top) / (r.height + vh * 0.2)));
      const atEnd = window.scrollY + vh >= document.documentElement.scrollHeight - 4;
      if (atEnd) p = 1;
      const n = words.length;
      words.forEach((w, i) => {
        const f = reduce ? 1 : Math.min(1, Math.max(0, p * (n + 1) - i));
        w.style.opacity = (0.16 + 0.84 * f).toFixed(3);
      });
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    const onResize = () => { layout(); onScroll(); };
    layout(); update();
    document.fonts?.ready.then(onResize);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onResize); cancelAnimationFrame(raf); };
  }, [lines]);
  return (
    <h2 ref={root} className={className} aria-label={lines.join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {line.split(' ').map((w, wi) => (
            <React.Fragment key={wi}>
              <span data-w className="inline-block"
                style={{ opacity: 0.16, transition: 'opacity .25s linear', backgroundImage: GRAD, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', paddingBottom: '0.08em', marginBottom: '-0.08em' }}>{w}</span>{' '}
            </React.Fragment>
          ))}
        </span>
      ))}
    </h2>
  );
};

// --- Landing --------------------------------------------------------------
export const Landing: React.FC<{ onGetStarted?: () => void }> = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const openAuth = (m: 'signin' | 'signup') => () => { if (onGetStarted) return onGetStarted(); setAuthMode(m); setSignInOpen(true); };
  const openSignIn = openAuth('signin');
  const openSignUp = openAuth('signup');
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
            <button onClick={openSignUp} tabIndex={scrolled ? 0 : -1} className="h-8 px-3.5 rounded-full text-[12px] font-semibold text-black bg-[#dcf5df] hover:bg-[#c6e8cb] transition-colors">Start for free</button>
          </div>
        </div>
      </div>

      {/* Hero: pulled up under the sticky header so the background reaches the top edge */}
      <section className="relative isolate flow-root -mt-16 pt-16">
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
              <button onClick={openSignUp} className="bg-[#dcf5df] hover:bg-[#c6e8cb] text-black text-[16px] font-semibold px-6 py-3.5 rounded-xl transition-colors">Start for free</button>
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
              <div className="relative h-full rounded-[28px] p-6"
                style={{ background: 'linear-gradient(160deg, rgba(220,245,223,0.05) 0%, rgba(117,126,118,0.08) 25%, rgba(66,66,66,0.10) 50%, rgba(57,157,116,0.06) 100%)' }}>
                <span aria-hidden className="kaya-stroke" style={{ ['--stroke' as any]: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0))' }} />
                <div className="w-9 h-9 rounded-full bg-[#dcf5df] text-black flex items-center justify-center text-sm font-semibold mb-4">{i + 1}</div>
                <h3 className="text-[17px] font-medium text-white mb-1.5">{s.t}</h3>
                <p className="text-[14px] leading-relaxed" style={{ color: '#6e8777' }}>{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA + footer, with the hero's dither rising from the very bottom of the page */}
      {/* No overflow clipping here: the dither layer is taller than this block and rises above it,
          fading in from fully transparent, so there's no visible edge where the sections meet. */}
      <div className="relative isolate">
        <div className="absolute inset-x-0 bottom-0 h-[900px] -z-10 pointer-events-none"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 30%, #000 60%)', maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.35) 30%, #000 60%)' }}>
          <DitheringShader shape="gradient" type="16x16" colorBack="#070C0A" colorFront="#2A6E50" pxSize={1} levels={8} contrast={1.26} amplitude={2.5} speed={1} />
        </div>

        <section className="max-w-6xl mx-auto px-6 pt-24 sm:pt-32 pb-24 sm:pb-32 text-center">
          <ScrollWords
            lines={['Every bank.', 'Every wallet.', 'Every currency.', 'One number.']}
            className="text-[44px] sm:text-[72px] lg:text-[92px] font-semibold leading-[0.95] tracking-[-0.038em]"
          />
          <Reveal className="mt-12">
            <button onClick={openSignUp} className="bg-[#dcf5df] hover:bg-[#c6e8cb] text-black text-[16px] font-semibold px-6 py-3.5 rounded-xl transition-colors">Start for free</button>
            <p className="text-[12px] leading-4 mt-4" style={{ color: '#6e8777' }}>No bank logins · No ads · Your data stays yours</p>
          </Reveal>
        </section>

        <footer>
          <div className="max-w-6xl mx-auto px-6 pt-6 pb-10 flex flex-col items-center gap-3 text-center">
            <div className="flex items-center gap-3">
              <img src="/logo-icon.svg" alt="" className="w-6 h-6" draggable={false} />
              <span className="text-[16px] font-bold uppercase tracking-[4px] text-white">Kaya</span>
            </div>
            <p className="text-[12px] text-[#dcf5df]/70">Every account, every currency, one number · © {new Date().getFullYear()} Kaya</p>
          </div>
        </footer>
      </div>

      <SignInModal open={signInOpen} mode={authMode} onClose={() => setSignInOpen(false)} />
    </div>
  );
};
