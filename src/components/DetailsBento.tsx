import React, { useEffect, useState } from 'react';
import { Icons } from './icons';
import { InstitutionLogo } from './InstitutionLogo';
import { DitheringShader } from './ui/dithering-shader';

/** "The little things" bento grid: smaller features, each with a tiny live visual. */

const GREEN = '#399d74';
const MUTED = '#dcf5df';
const FAINT = '#6e8777';

// Card. On hover a waving dither glow fades in from the top-center (Figma 124:6983), so the
// frosted widgets inside show their blur and gradient edges. The shader mounts while hovered
// (and unmounts after the fade-out), so idle cards do no GPU work.
const Tile: React.FC<{ title: string; body: string; className?: string; children: React.ReactNode }> = ({ title, body, className = '', children }) => {
  const [hover, setHover] = useState(false);
  const [armed, setArmed] = useState(false);   // shader mounted
  const [shown, setShown] = useState(false);   // shader faded in
  // Mount on hover, fade in on the next frame (plain opacity), fade out on leave, then unmount
  // so idle cards do no GPU work.
  useEffect(() => {
    if (hover) {
      setArmed(true);
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setArmed(false), 600);
    return () => clearTimeout(t);
  }, [hover]);
  return (
    <div onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}
      className={`relative isolate overflow-hidden rounded-[28px] p-6 flex flex-col ${className}`}
      style={{ background: 'linear-gradient(160deg, rgba(220,245,223,0.05) 0%, rgba(117,126,118,0.08) 25%, rgba(66,66,66,0.10) 50%, rgba(57,157,116,0.06) 100%)' }}>
      {armed && (
        <div aria-hidden className="absolute inset-0 -z-10 pointer-events-none transition-opacity duration-500 ease-out"
          style={{ opacity: shown ? 0.75 : 0 }}>
          {/* Subtle: green from the top, fading to black over the bottom ~20% */}
          <DitheringShader shape="top" type="16x16" colorBack="#070C0A" colorFront="#193F2F" pxSize={1} levels={8} contrast={1.26} start={0.8} amplitude={1.5} speed={1.5} />
        </div>
      )}
      {/* Strokes: the widget gradient edge (white 10% → 0) always, plus a mint edge on hover
          (100% at the top → 10% at the bottom) so the whole card shape reads */}
      <span aria-hidden className="kaya-stroke" style={{ ['--stroke' as any]: 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0) 100%)' }} />
      <span aria-hidden className="kaya-stroke transition-opacity duration-500"
        style={{ ['--stroke' as any]: 'linear-gradient(180deg, rgba(220,245,223,1) 0%, rgba(220,245,223,0.10) 100%)', opacity: hover ? 1 : 0 }} />
      <div className="flex-1 flex items-center justify-center min-h-[120px] mb-5">{children}</div>
      <h3 className="text-[17px] font-medium text-white">{title}</h3>
      <p className="text-[14px] mt-1.5 leading-relaxed" style={{ color: FAINT }}>{body}</p>
    </div>
  );
};

const Chip: React.FC<{ icon: React.ReactNode; label: string; sub: string }> = ({ icon, label, sub }) => (
  <div className="kaya-frost flex items-center gap-3 rounded-2xl px-3.5 py-3">
    <span className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(57,157,116,0.15)', color: GREEN }}>{icon}</span>
    <span><span className="block text-[13px] font-medium text-white">{label}</span><span className="block text-[11px]" style={{ color: FAINT }}>{sub}</span></span>
  </div>
);

const HideAmounts = () => {
  const [hidden, setHidden] = useState(false);
  useEffect(() => { const id = setInterval(() => setHidden(h => !h), 2600); return () => clearInterval(id); }, []);
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[1.2px]" style={{ color: MUTED }}>
        Net worth <span className="transition-transform" style={{ transform: hidden ? 'scale(1.15)' : 'none' }}>{hidden ? <Icons.EyeOff size={14} /> : <Icons.Eye size={14} />}</span>
      </div>
      <p key={String(hidden)} className="text-[30px] font-medium text-white mt-1 tabular-nums animate-[kayaFadeUp_.3s_ease-out]">
        {hidden ? '••••••' : <><span style={{ color: FAINT }}>₱</span>1,847,200</>}
      </p>
    </div>
  );
};

export const DetailsBento: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
    <Tile className="md:col-span-2" title="Backups your way" body="Download a backup, restore it on a new phone, or export a CSV for Google Sheets. Your data is never stuck in the app.">
      <div className="flex flex-wrap gap-3 justify-center">
        <Chip icon={<Icons.Download size={16} />} label="kaya-backup.json" sub="Full backup · 48 KB" />
        <Chip icon={<Icons.Upload size={16} />} label="Restore" sub="On a new phone" />
        <Chip icon={<Icons.Cloud size={16} />} label="export.csv" sub="Opens in Sheets" />
      </div>
    </Tile>

    <Tile title="Logging streak" body="Update your balances once a month and keep the flame going.">
      <div className="text-center">
        <span className="inline-flex w-12 h-12 rounded-2xl items-center justify-center animate-[subtlePulse_2.4s_ease-in-out_infinite]" style={{ background: 'linear-gradient(rgba(245,158,11,0.15), rgba(245,158,11,0.15)), #0d0f0e', color: '#f59e0b' }}><Icons.Fire size={24} weight="fill" /></span>
        <p className="text-[20px] font-semibold text-white mt-2">3 months</p>
        <div className="flex justify-center gap-1.5 mt-2">
          {['J', 'J', 'A', 'S', 'O', 'N'].map((m, i) => (
            <span key={i} className="w-6 h-6 rounded-full text-[9px] font-semibold flex items-center justify-center"
              style={i >= 3 ? { background: '#f59e0b', color: '#000' } : { background: 'rgba(255,255,255,0.06)', color: FAINT }}>{m}</span>
          ))}
        </div>
      </div>
    </Tile>

    <Tile title="Hide amounts" body="Tap the eye to hide every number before you open Kaya around other people.">
      <HideAmounts />
    </Tile>

    <Tile title="Debts count too" body="Add loans and credit cards. Kaya subtracts them, so your number stays honest.">
      <div className="kaya-frost w-full max-w-[260px] rounded-2xl px-4 py-3.5 space-y-2 text-[13px]">
        <div className="flex justify-between"><span className="text-zinc-400">Assets</span><span className="text-white font-semibold">₱1.92M</span></div>
        <div className="flex justify-between"><span className="text-zinc-400">Liabilities</span><span className="text-rose-400 font-semibold">−₱72.8K</span></div>
        <div className="border-t border-white/10 pt-2 flex justify-between"><span style={{ color: MUTED }}>Net worth</span><span className="font-semibold" style={{ color: MUTED }}>₱1.85M</span></div>
      </div>
    </Tile>

    <Tile title="Rates you pick" body="Pin the currency pairs you care about and see how they moved this week.">
      <div className="kaya-frost w-full max-w-[270px] rounded-2xl px-4 py-3 space-y-2.5">
        {[['USD', '63.55', 'PHP', '0.41', true], ['CAD', '45.48', 'PHP', '0.28', true], ['USD', '1.40', 'CAD', '0.12', false]].map(([a, v, b, c, up], i) => (
          <div key={i} className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-white">1 {a} = <span className="font-semibold">{v}</span> {b}</p>
              <p className="text-[10px]" style={{ color: up ? GREEN : '#fb7185' }}>{up ? '▲' : '▼'} {c}% <span style={{ color: FAINT }}>this week</span></p>
            </div>
            <svg width="54" height="20" viewBox="0 0 54 20" aria-hidden>
              <path d={up ? 'M0 15 L9 13 L18 14 L27 9 L36 10 L45 6 L54 5' : 'M0 6 L9 8 L18 7 L27 11 L36 10 L45 14 L54 15'} fill="none" stroke={up ? GREEN : '#fb7185'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ))}
      </div>
    </Tile>

    <Tile title="Track without counting" body="Follow a joint account or a loan you manage for family, without adding it to your own total.">
      <div className="kaya-frost w-full max-w-[260px] rounded-2xl px-3.5 py-3 flex items-center gap-3">
        <InstitutionLogo name="BDO" size={36} radius={11} />
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-white truncate">Mom's Savings</span>
          <span className="inline-block text-[9px] px-1.5 py-[2px] rounded-full mt-0.5" style={{ background: 'rgba(110,135,119,0.15)', color: FAINT }}>Not in net worth</span>
        </span>
        <span className="text-[13px] font-semibold text-white">₱64,000</span>
      </div>
    </Tile>

    <Tile className="md:col-span-2" title="Monthly reminders" body="A gentle nudge when it's time to update your balances. Nothing more.">
      <div className="kaya-frost w-full max-w-[380px] rounded-[22px] px-4 py-3.5 flex items-start gap-3 animate-[kayaFadeUp_.6s_ease-out]">
        <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(160deg, #193F2F, #0b1712)' }}><img src="/logo-icon.svg" alt="" className="w-5 h-5" /></span>
        <span className="flex-1 min-w-0">
          <span className="flex justify-between text-[12px]"><span className="font-semibold text-white">Kaya</span><span style={{ color: FAINT }}>now</span></span>
          <span className="block text-[13px] text-white mt-0.5">Time for your monthly check-in</span>
          <span className="block text-[12px] text-zinc-400">Update your balances to keep your 3-month streak.</span>
        </span>
      </div>
    </Tile>
  </div>
);

export default DetailsBento;
