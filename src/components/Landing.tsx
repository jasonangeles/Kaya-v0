import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './icons';

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

// --- Phone frame ----------------------------------------------------------
const Phone: React.FC<{ children: React.ReactNode; tilt?: number; float?: boolean }> = ({ children, tilt = 0, float = false }) => (
  <div className="relative" style={{ transform: `perspective(1400px) rotateY(${tilt}deg) rotateX(2deg)` }}>
    <div
      className={`relative rounded-[2.6rem] p-2.5 bg-[#0a0a0a] border border-white/10 ${float ? 'animate-[floatY_7s_ease-in-out_infinite]' : ''}`}
      style={{ boxShadow: '0 55px 90px -25px rgba(16,185,129,0.22), 0 45px 80px -35px rgba(0,0,0,0.85)' }}
    >
      <div className="w-[248px] rounded-[2.1rem] overflow-hidden bg-black">
        <div className="mx-auto mt-2.5 mb-1 h-1 w-12 rounded-full bg-white/15" />
        {children}
      </div>
    </div>
  </div>
);

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
      {/* Green ambience — kept high, behind the chart, so it never lights the bottom */}
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
      {/* Fixed fade overlay — darkens the bottom without clipping the moving device */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-8 h-[54%] z-20" style={{ background: 'linear-gradient(to bottom, transparent 0%, #000 70%)' }} />
    </div>
  );
};

const GlowPhone: React.FC<{ children: React.ReactNode; tilt?: number }> = ({ children, tilt }) => (
  <div className="relative flex justify-center">
    <div className="absolute inset-0 blur-3xl" style={{ background: 'radial-gradient(circle at 50% 45%, rgba(16,185,129,0.20), transparent 68%)' }} />
    <div className="relative"><Phone tilt={tilt}>{children}</Phone></div>
  </div>
);

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
  const value = useCountUp(1284930, animate);
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
        <span className="text-emerald-400 text-[11px] font-medium">▲ 3.1%</span>
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
      {[{ n: 'Emergency Fund', s: 'BPI', v: '₱150,000' }, { n: 'TFSA', s: 'Wealthsimple', v: 'C$12,500' }, { n: 'Bitcoin', s: 'Ledger', v: '₿0.15' }].map((a, i) => (
        <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${i < 2 ? 'border-b border-white/5' : ''}`}>
          <div className="min-w-0"><p className="text-[11px] font-medium text-white truncate">{a.n}</p><p className="text-[9px] text-zinc-500">{a.s}</p></div>
          <span className="text-[11px] font-medium text-zinc-200">{a.v}</span>
        </div>
      ))}
    </div>
  </div>
  );
};

const IncomeScreen = () => (
  <div className="px-3 py-4 space-y-3">
    <p className="text-sm font-medium text-white pt-1">Passive Income</p>
    <div className="rounded-2xl bg-[#141414] border border-white/5 p-3.5">
      <div className="flex items-start justify-between mb-3">
        <div><p className="text-[9px] text-zinc-500 uppercase tracking-widest mb-1">This month</p><p className="text-xl font-semibold text-white">₱7,314</p></div>
        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium self-center">▲ 9%</span>
      </div>
      <div className="flex items-end gap-1.5 h-14">
        {[30, 45, 38, 60, 52, 70, 48, 80, 65, 90, 72, 100].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: i === 11 ? '#10b981' : '#3f3f46' }} />
        ))}
      </div>
    </div>
    <div className="rounded-2xl bg-[#141414] border border-white/5 overflow-hidden">
      {[{ s: 'FB', c: 'Dividend · Jun 8', v: '+₱1,800' }, { s: 'RCR', c: 'Dividend · Jun 1', v: '+₱2,207' }].map((r, i) => (
        <div key={i} className={`flex items-center justify-between px-3 py-2.5 ${i < 1 ? 'border-b border-white/5' : ''}`}>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><Icons.ArrowDownLeft size={12} /></span>
            <div><p className="text-[11px] font-medium text-white">{r.s}</p><p className="text-[9px] text-zinc-500">{r.c}</p></div>
          </div>
          <span className="text-[11px] font-medium text-emerald-400">{r.v}</span>
        </div>
      ))}
    </div>
  </div>
);

const AllocationScreen = () => (
  <div className="px-3 py-4 space-y-3">
    <p className="text-sm font-medium text-white pt-1">Allocation</p>
    <div className="rounded-2xl bg-[#141414] border border-white/5 p-3.5">
      <div className="flex h-2.5 rounded-full overflow-hidden mb-4">
        {[{ w: 34, c: '#10b981' }, { w: 24, c: '#e4e4e7' }, { w: 21, c: '#F7931A' }, { w: 21, c: '#71717a' }].map((s, i) => (
          <div key={i} style={{ width: `${s.w}%`, background: s.c }} />
        ))}
      </div>
      {[{ n: 'Philippine Banks', c: '#10b981', p: '34%' }, { n: 'Equities', c: '#e4e4e7', p: '24%' }, { n: 'Crypto Assets', c: '#F7931A', p: '21%' }, { n: 'Cash & Wallets', c: '#71717a', p: '21%' }].map((s, i) => (
        <div key={i} className="flex items-center justify-between py-1.5">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: s.c }} /><span className="text-[11px] text-white">{s.n}</span></div>
          <span className="text-[11px] font-medium text-white">{s.p}</span>
        </div>
      ))}
    </div>
  </div>
);

// --- Landing --------------------------------------------------------------
export const Landing: React.FC<{ onGetStarted: () => void }> = ({ onGetStarted }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const props = [
    { icon: <Icons.Global size={22} />, title: 'Every currency', desc: 'Hold pesos, dollars, dirhams, even sats. Kaya converts it all live, so your total always makes sense.' },
    { icon: <Icons.Trend size={22} />, title: 'Passive income', desc: 'Log dividends and interest as they arrive and watch them grow month over month — the quiet habit that builds wealth.' },
    { icon: <Icons.Lock size={22} />, title: 'Privacy-first', desc: 'Manual by design. No bank connections, no scraping. Export or wipe your data anytime.' }
  ];
  const steps = [
    { t: 'Add your accounts', d: 'Banks, wallets, stocks, crypto. You enter the balances — nothing ever connects to your bank.' },
    { t: 'See your net worth', d: 'Everything converts to your currency, live. Switch to USD, CAD, or Bitcoin whenever you like.' },
    { t: 'Watch it grow', d: 'Log updates and dividends, and your wealth and habits build a real history over time.' }
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
          <button onClick={onGetStarted} className="bg-white text-black text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity">Sign in</button>
        </div>
      </header>

      {/* Hero — pulled up under the sticky header so the green glow reaches the very top edge */}
      <section className="relative -mt-16 pt-16">
        <div className="absolute inset-x-0 top-0 h-[700px] pointer-events-none" style={{ background: 'radial-gradient(ellipse 65% 55% at 50% 0%, rgba(16,185,129,0.18) 0%, transparent 62%)' }} />
        <div className="max-w-6xl mx-auto px-6 pt-20 pb-24 relative">
          <Reveal className="text-center max-w-2xl mx-auto">
            <span className="inline-block text-[11px] uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1 mb-6">Privacy-first wealth tracker</span>
            <h1 className="text-4xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
              Your net worth,<br /><span className="text-zinc-500">in every currency.</span>
            </h1>
            <p className="text-lg text-zinc-400 mt-6 leading-relaxed">
              Kaya brings your banks, investments and crypto into one number — converted live, even denominated in Bitcoin. No bank logins. No noise. Just your money, clearly.
            </p>
            <div className="flex items-center justify-center gap-3 mt-8">
              <button onClick={onGetStarted} className="bg-white text-black font-semibold px-6 py-3.5 rounded-xl hover:opacity-90 transition-opacity">Get started — it's free</button>
            </div>
            <p className="text-xs text-zinc-600 mt-4">No bank linking · passwordless · your data stays yours</p>
          </Reveal>

          <Reveal delay={150} className="flex justify-center mt-12">
            <HeroPhone><OverviewScreen animate /></HeroPhone>
          </Reveal>
        </div>
      </section>

      {/* Value props */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid sm:grid-cols-3 gap-5">
          {props.map((p, i) => (
            <Reveal key={i} delay={i * 90}>
              <div className="h-full rounded-3xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4">{p.icon}</div>
                <h3 className="text-lg font-medium mb-1.5">{p.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Feature A */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <Reveal>
            <span className="text-xs uppercase tracking-widest text-emerald-400">One clear number</span>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3 leading-tight">A total that finally makes sense</h2>
            <p className="text-zinc-400 mt-4 leading-relaxed text-lg">Cash in Manila, a TFSA in Canada, sats in cold storage — Kaya converts it all into your currency, live, so the number at the top is always real. Tap it to view your wealth in USD, CAD, or Bitcoin.</p>
          </Reveal>
          <Reveal delay={120}><GlowPhone tilt={-9}><OverviewScreen /></GlowPhone></Reveal>
        </div>
      </section>

      {/* Feature B */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <Reveal className="lg:order-2">
            <span className="text-xs uppercase tracking-widest text-emerald-400">Passive income</span>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3 leading-tight">Watch the dividends build</h2>
            <p className="text-zinc-400 mt-4 leading-relaxed text-lg">Log dividends and interest as they land. See month-over-month and year-over-year growth at a glance — and duplicate a recurring payout in two taps instead of retyping it.</p>
          </Reveal>
          <Reveal delay={120} className="lg:order-1"><GlowPhone tilt={9}><IncomeScreen /></GlowPhone></Reveal>
        </div>
      </section>

      {/* Feature C */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <Reveal>
            <span className="text-xs uppercase tracking-widest text-emerald-400">Allocation</span>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mt-3 leading-tight">Know exactly where you stand</h2>
            <p className="text-zinc-400 mt-4 leading-relaxed text-lg">A clean breakdown of your wealth by type and by currency — so your diversification, and your Bitcoin slice, are obvious in a single glance.</p>
          </Reveal>
          <Reveal delay={120}><GlowPhone tilt={-9}><AllocationScreen /></GlowPhone></Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <Reveal className="text-center max-w-xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Start in minutes</h2>
          <p className="text-zinc-400 mt-3 text-lg">No setup, no linking, no spreadsheet wrangling.</p>
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
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Start tracking your wealth today</h2>
            <p className="text-zinc-400 mt-3 text-lg">Free to use. No bank linking. Yours to keep.</p>
            <button onClick={onGetStarted} className="mt-7 bg-white text-black font-semibold px-7 py-3.5 rounded-xl hover:opacity-90 transition-opacity">Get started — it's free</button>
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
          <p className="text-xs text-zinc-600">Built for global Filipinos · Privacy-first · © {new Date().getFullYear()} Kaya</p>
        </div>
      </footer>
    </div>
  );
};
