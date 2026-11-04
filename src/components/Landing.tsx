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

// Larger, realistic iPhone-style hero device: thin frame, bottom fade-to-black,
// gentle float + mouse-follow 3D tilt.
const HeroPhone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ x: -py * 9, y: px * 11 });
  };
  return (
    <div className="relative mx-auto w-[282px] sm:w-[316px]" onMouseMove={onMove} onMouseLeave={() => setTilt({ x: 0, y: 0 })}>
      {/* Green ambience, kept high behind the chart so it never lights the bottom */}
      <div className="absolute inset-x-0 top-0 h-[42%] blur-3xl" style={{ background: 'radial-gradient(ellipse 64% 92% at 50% 20%, rgba(16,185,129,0.20), transparent 72%)' }} />
      <div style={{ transform: `perspective(1100px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform .18s ease-out' }}>
        <div
          className="relative rounded-[3rem] p-[6px] bg-gradient-to-b from-zinc-700 via-zinc-900 to-black animate-[floatY_7s_ease-in-out_infinite]"
          style={{ boxShadow: '0 38px 80px -38px rgba(0,0,0,0.95)' }}
        >
          <div className="rounded-[2.8rem] bg-black p-[1px]">
            <div className="relative rounded-[2.75rem] overflow-hidden bg-black">
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[32%] h-[26px] bg-black rounded-full ring-1 ring-white/5" />
              <div className="h-12" />
              {children}
              <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 38%)' }} />
            </div>
          </div>
          <span className="absolute left-[-1px] top-[120px] w-[2px] h-7 rounded-l bg-zinc-700" />
          <span className="absolute left-[-1px] top-[165px] w-[2px] h-12 rounded-l bg-zinc-700" />
          <span className="absolute left-[-1px] top-[225px] w-[2px] h-12 rounded-l bg-zinc-700" />
          <span className="absolute right-[-1px] top-[185px] w-[2px] h-16 rounded-r bg-zinc-700" />
        </div>
      </div>
      {/* Fixed fade overlay: darkens the bottom without clipping the moving device */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-8 h-[54%] z-20" style={{ background: 'linear-gradient(to bottom, transparent 0%, #000 70%)' }} />
    </div>
  );
};

// Count up from 0 to target with an ease-out curve (only when `run` is true).
const useCountUp = (target: number, run: boolean, dur = 1300) => {
  const [v, setV] = useState(run ? 0 : target);
  useEffect(() => {
    if (!run) { setV(target); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target]);
  return v;
};

// --- Recreated app screens (dummy data) ----------------------------------
// `animate` triggers the hero's one-time count-up + left-to-right line draw.
const OverviewScreen: React.FC<{ animate?: boolean }> = ({ animate = false }) => {
  const [drawn, setDrawn] = useState(!animate);
  const value = useCountUp(1847200, animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);
  return (
  <div className="px-3 py-4 space-y-3">
    <div className="flex items-center gap-1.5">
      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="text-[10px] font-medium tracking-widest uppercase text-white">Kaya</span>
    </div>
    <div className="rounded-2xl bg-[#141414] border border-white/5 p-3.5">
      <p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">Net Worth</p>
      <div className="flex items-baseline gap-1 mb-1">
        <span className="text-base text-zinc-500">₱</span>
        <span className="text-2xl font-semibold text-white tracking-tight tabular-nums">{value.toLocaleString('en-US')}</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-emerald-400 text-[11px] font-medium">▲ 4.2%</span>
        <span className="text-zinc-600 text-[10px]">past month</span>
      </div>
      <svg viewBox="0 0 200 56" className="w-full h-11" preserveAspectRatio="none">
        <defs><linearGradient id="lgo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity="0.35" /><stop offset="100%" stopColor="#10b981" stopOpacity="0" /></linearGradient></defs>
        <path d="M0,44 C20,40 34,42 52,36 S96,34 120,26 S168,14 200,10 L200,56 L0,56 Z" fill="url(#lgo)" style={{ opacity: drawn ? 1 : 0, transition: 'opacity .9s ease .5s' }} />
        <path d="M0,44 C20,40 34,42 52,36 S96,34 120,26 S168,14 200,10" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" pathLength={1} strokeDasharray={1} style={{ strokeDashoffset: drawn ? 0 : 1, transition: 'stroke-dashoffset 1.4s cubic-bezier(.4,.1,.2,1)' }} />
      </svg>
      <div className="flex justify-between mt-2">
        {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((r, i) => (
          <span key={r} className={`text-[8px] px-1.5 py-0.5 rounded-full ${i === 5 ? 'bg-zinc-800 text-white' : 'text-zinc-600'}`}>{r}</span>
        ))}
      </div>
    </div>
    <div className="rounded-2xl bg-[#141414] border border-white/5 overflow-hidden">
      {[{ n: 'Emergency Fund', s: 'BPI', v: '₱220,000' }, { n: 'Roth IRA', s: 'Fidelity', v: '$16,800' }, { n: 'Bitcoin', s: 'Ledger', v: '₿0.21' }].map((a, i) => (
        <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${i < 2 ? 'border-b border-white/5' : ''}`}>
          <div className="min-w-0"><p className="text-[11px] font-medium text-white truncate">{a.n}</p><p className="text-[9px] text-zinc-500">{a.s}</p></div>
          <span className="text-[11px] font-medium text-zinc-200">{a.v}</span>
        </div>
      ))}
    </div>
  </div>
  );
};

// --- Landing --------------------------------------------------------------
export const Landing: React.FC<{ onGetStarted?: () => void }> = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const openSignIn = onGetStarted ?? (() => setSignInOpen(true));
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
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
      {/* Nav */}
      <header className={`sticky top-0 z-30 transition-colors duration-300 ${scrolled ? 'backdrop-blur-xl bg-black/40 supports-[backdrop-filter]:bg-black/30' : 'bg-transparent'}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-medium tracking-wide uppercase">Kaya</span>
          </div>
          <button onClick={openSignIn} className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Sign in</button>
        </div>
      </header>

      {/* Hero: pulled up under the sticky header so the background reaches the top edge */}
      <section className="relative isolate -mt-16 pt-16">
        {/* Animated dither (same settings as the app background), fading into the page at the bottom */}
        <div
          className="absolute inset-0 -z-10 pointer-events-none"
          style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 78%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 78%, transparent 100%)' }}
        >
          <DitheringShader shape="gradient" type="16x16" colorBack="#070C0A" colorFront="#193F2F" pxSize={1} levels={8} contrast={1.26} speed={0.6} />
        </div>
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 relative">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="inline-block text-[11px] uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-6">Private net worth tracker</span>
            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              Your net worth,<br /><span className="text-zinc-500">in one number.</span>
            </h1>
            <p className="text-lg text-zinc-400 mt-6 leading-relaxed">
              Pesos in BPI, dollars in a TFSA, a bit of Bitcoin. Kaya adds it all up in the currency you choose. You enter the balances, so there are no bank logins.
            </p>
            <div className="flex items-center justify-center gap-3 mt-8">
              <button onClick={openSignIn} className="bg-white text-black font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity">Start for free</button>
            </div>
            <p className="text-xs text-zinc-600 mt-4">Free to start. No ads. Your data stays yours.</p>
          </Reveal>

          <Reveal delay={150} className="flex justify-center mt-12">
            <HeroPhone><OverviewScreen animate /></HeroPhone>
          </Reveal>
        </div>
      </section>

      {/* Closer look: interactive feature explorer (replaces the 3 USP cards) */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <Reveal>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mb-8 sm:mb-10">Take a closer look.</h2>
        </Reveal>
        <Reveal delay={120}><ExploreFeatures /></Reveal>
      </section>

      {/* Orbit: every account around one total */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-8 overflow-hidden">
        <Reveal className="text-center max-w-2xl mx-auto">
          <span className="inline-block text-[11px] uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-6">All your accounts</span>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08]">
            Different accounts.<br /><span className="text-zinc-500">One clear total.</span>
          </h2>
        </Reveal>
        <Reveal delay={120} className="mt-4 sm:mt-6">
          <OrbitWidgets />
        </Reveal>
        <Reveal className="text-center">
          <p className="text-zinc-400 text-base sm:text-lg max-w-xl mx-auto">Banks, wallets, stocks and crypto in any currency. Kaya puts them on one screen so you stop switching apps.</p>
        </Reveal>
      </section>

      {/* Themes: light and dark, in its own dithered container */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <Reveal>
          <div className="relative isolate overflow-hidden rounded-[32px] sm:rounded-[40px] px-5 py-14 sm:px-[72px] sm:py-[88px]">
            <div className="absolute inset-0 -z-10">
              <DitheringShader shape="radial" type="16x16" colorBack="#070C0A" colorFront="#193F2F" pxSize={1} levels={8} contrast={1.26} speed={0.4} />
            </div>
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="inline-block text-[11px] uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-6">Light and dark</span>
              <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.08]">Easy on the eyes.</h2>
              <p className="text-zinc-300/80 mt-4 text-base sm:text-lg">Pick dark for late-night check-ins or light for bright days. Every screen follows along.</p>
            </div>
            <ThemeShowcase />
          </div>
        </Reveal>
      </section>

      {/* The little things: bento grid of smaller features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="max-w-2xl mb-10">
          <span className="text-xs uppercase tracking-widest text-emerald-400">The details</span>
          <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight mt-3 leading-[1.08]">The little things.</h2>
          <p className="text-zinc-400 mt-4 text-base sm:text-lg">What you start to notice after a few months with Kaya.</p>
        </Reveal>
        <Reveal delay={120}><DetailsBento /></Reveal>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Set up in a few minutes</h2>
          <p className="text-zinc-400 mt-3 text-lg">Nothing to link and no spreadsheet to build.</p>
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
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">See your whole net worth today</h2>
            <p className="text-zinc-400 mt-3 text-lg">Free to use. Nothing links to your bank.</p>
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
