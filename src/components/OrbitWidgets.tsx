import React, { useEffect, useRef } from 'react';
import { Icons } from './icons';
import { InstitutionLogo } from './InstitutionLogo';

/**
 * Landing section: Kaya widgets on a slowly spinning globe around the logo.
 *
 * Works like the 21st.dev interactive icon cloud: cards sit on a sphere, the globe idles
 * at a steady spin, hovering steers it toward the cursor, and clicking a card brings it
 * to the front. Depth = how near a card is on the sphere: far cards are smaller, dimmer
 * and blurred (same treatment as the Figma reference frame "106:5440").
 * Positions are written straight to the DOM in a rAF loop (no React re-renders), the loop
 * pauses off-screen, and reduced-motion users get a still layout.
 */

const GREEN = '#399d74';
const MUTED = '#dcf5df';
const FAINT = '#6e8777';

// ---- Card shell (Kaya glass widget) ---------------------------------------
const Card: React.FC<{ children: React.ReactNode; w: number; pad?: number; r?: number }> = ({ children, w, pad = 16, r = 20 }) => (
  <div
    className="relative overflow-hidden text-left"
    style={{
      width: w,
      padding: pad,
      borderRadius: r,
      background: 'linear-gradient(160deg, rgba(220,245,223,0.07) 0%, rgba(66,66,66,0.10) 45%, rgba(57,157,116,0.07) 100%)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    }}
  >
    {/* Gradient stroke: white 10% at the top fading out, same as the app's widgets */}
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        borderRadius: r,
        padding: 1,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0))',
        WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        WebkitMaskComposite: 'xor',
        mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
        maskComposite: 'exclude',
      } as React.CSSProperties}
    />
    {children}
  </div>
);

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-[10px] font-medium uppercase tracking-[1.2px]" style={{ color: MUTED, opacity: 0.8 }}>{children}</p>
);

// ---- Widgets (v1.2 dummy data) ---------------------------------------------
const NetWorth = () => (
  <Card w={260} pad={18} r={24}>
    <Label>Net worth</Label>
    <div className="flex items-baseline gap-1 mt-1.5">
      <span className="text-xl" style={{ color: FAINT }}>₱</span>
      <span className="text-[28px] font-medium tracking-tight text-white tabular-nums">1,847,200</span>
    </div>
    <p className="text-[12px] mt-1 flex items-center gap-1.5">
      <span className="font-medium" style={{ color: GREEN }}>+4.2%</span>
      <span style={{ color: MUTED, opacity: 0.7 }}>past month</span>
    </p>
    <svg viewBox="0 0 224 56" className="w-full h-14 mt-2" aria-hidden>
      <defs>
        <pattern id="ow-dots" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="0.9" fill={GREEN} /></pattern>
        <linearGradient id="ow-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".85" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
        <mask id="ow-mask"><rect width="224" height="56" fill="url(#ow-fade)" /></mask>
      </defs>
      <path d="M0 44 L20 38 L36 40 L54 32 L72 35 L92 26 L110 29 L130 20 L150 23 L170 14 L192 16 L212 8 L224 10 L224 56 L0 56 Z" fill="url(#ow-dots)" mask="url(#ow-mask)" />
      <path d="M0 44 L20 38 L36 40 L54 32 L72 35 L92 26 L110 29 L130 20 L150 23 L170 14 L192 16 L212 8 L224 10" fill="none" stroke={GREEN} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  </Card>
);

const Account: React.FC<{ inst: string; name: string; amount: string; w?: number }> = ({ inst, name, amount, w = 230 }) => (
  <Card w={w} pad={12} r={18}>
    <div className="flex items-center gap-3">
      <InstitutionLogo name={inst} size={36} radius={11} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-white truncate">{name}</p>
        <p className="text-[11px] truncate" style={{ color: MUTED, opacity: 0.7 }}>{inst}</p>
      </div>
      <span className="text-[14px] font-semibold text-white tabular-nums shrink-0">{amount}</span>
    </div>
  </Card>
);

const Liquidity = () => {
  // Half-circle gauge, 58% liquid (same shape as the app's LiquidityGauge)
  const r = 54, cx = 70, cy = 66, half = Math.PI * r;
  const arc = (a0: number, a1: number) => {
    const p = (a: number) => { const t = Math.PI * (1 - a); return [cx + r * Math.cos(t), cy - r * Math.sin(t)]; };
    const [x0, y0] = p(a0), [x1, y1] = p(a1);
    return `M${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1}`;
  };
  const cap = 5 / half, gap = 1.5 / half, lf = 0.58;
  return (
    <Card w={190} pad={16} r={22}>
      <Label>Liquidity</Label>
      <div className="relative mt-2">
        <svg viewBox="0 0 140 74" className="w-full" aria-hidden>
          <defs><linearGradient id="ow-liq" x1="0" x2="1"><stop offset="0" stopColor={GREEN} /><stop offset="1" stopColor={MUTED} /></linearGradient></defs>
          <path d={arc(cap, lf - gap - cap)} fill="none" stroke="url(#ow-liq)" strokeWidth="10" strokeLinecap="round" />
          <path d={arc(lf + gap + cap, 1 - cap)} fill="none" stroke={FAINT} strokeWidth="10" strokeLinecap="round" />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <p className="text-2xl font-medium text-white leading-none tabular-nums">58%</p>
          <p className="text-[10px] mt-1" style={{ color: GREEN }}>liquid</p>
        </div>
      </div>
    </Card>
  );
};

const Income = () => {
  const bars = [48, 52, 61, 54, 69, 73, 66, 79, 77, 71, 84];
  return (
    <Card w={220} pad={16} r={22}>
      <div className="flex items-center justify-between">
        <Label>Passive income</Label>
        <span className="text-[11px] font-medium flex items-center gap-0.5" style={{ color: GREEN }}><Icons.ArrowUp size={11} weight="bold" />18.4%</span>
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-base" style={{ color: FAINT }}>₱</span>
        <span className="text-[22px] font-medium text-white tabular-nums">8,450</span>
        <span className="text-[11px] ml-1" style={{ color: FAINT }}>this month</span>
      </div>
      <div className="flex items-end gap-[5px] h-12 mt-3">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-t-[4px] rounded-b-[1px]"
            style={{ height: `${h}%`, background: `linear-gradient(0deg, ${GREEN}, ${MUTED})`, opacity: i === bars.length - 1 ? 1 : 0.4 }} />
        ))}
      </div>
    </Card>
  );
};

const Allocation = () => {
  const segs: [string, number, string][] = [['Equities', 38, ''], ['PH Banks', 27, MUTED], ['Crypto', 15, FAINT], ['Intl Banks', 12, '#2b6b50'], ['Others', 8, '#3f4a44']];
  return (
    <Card w={240} pad={16} r={22}>
      <Label>Allocation</Label>
      <div className="flex gap-[3px] h-2 mt-3">
        {segs.map(([k, p, c], i) => (
          <div key={k} className="rounded-full" style={{ flexGrow: p, background: i === 0 ? `linear-gradient(90deg, ${GREEN}, ${MUTED})` : c }} />
        ))}
      </div>
      <div className="mt-3 space-y-1.5">
        {segs.slice(0, 3).map(([k, p, c], i) => (
          <div key={k} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-2 text-white"><i className="w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? GREEN : c }} />{k}</span>
            <span className="font-medium text-white tabular-nums">{p}%</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

const Rate = () => (
  <Card w={190} pad={14} r={18}>
    <p className="text-[14px] text-white tabular-nums">1 USD = <span className="font-semibold">63.55</span> PHP</p>
    <p className="text-[11px] mt-1" style={{ color: GREEN }}>▲ 0.41% <span style={{ color: FAINT }}>this week</span></p>
  </Card>
);

const Streak = () => (
  <Card w={150} pad={12} r={16}>
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-[10px] flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}><Icons.Fire size={16} weight="fill" /></span>
      <div>
        <p className="text-[13px] font-semibold text-white">3 months</p>
        <p className="text-[10px]" style={{ color: FAINT }}>logging streak</p>
      </div>
    </div>
  </Card>
);

const Dividend = () => (
  <Card w={210} pad={12} r={18}>
    <div className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-[11px] flex items-center justify-center shrink-0" style={{ background: 'rgba(57,157,116,0.15)', color: GREEN }}><Icons.ArrowDownLeft size={16} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-white truncate">JFC Dividend</p>
        <p className="text-[10px]" style={{ color: FAINT }}>Nov 3</p>
      </div>
      <span className="text-[13px] font-semibold text-white tabular-nums">+₱5,200</span>
    </div>
  </Card>
);

// Order around the loop. Big and small cards alternate so the ring feels balanced.
// The first MOBILE_COUNT cards are the ones shown on phones.
const WIDGETS: React.ReactNode[] = [
  <NetWorth key="nw" />,
  <Account key="bpi" inst="BPI" name="Emergency Fund" amount="₱220,000" w={250} />,
  <Liquidity key="liq" />,
  <Account key="ws" inst="Wealthsimple" name="TFSA" amount="C$16,800" w={240} />,
  <Income key="inc" />,
  <Rate key="fx" />,
  <Account key="ledger" inst="Ledger" name="Bitcoin" amount="₿0.21" w={210} />,
  <Allocation key="alloc" />,
  <Streak key="streak" />,
  <Dividend key="div" />,
  <Account key="gcash" inst="GCash" name="GCash Wallet" amount="₱12,850" w={240} />,
];
const MOBILE_COUNT = 7;

// ---- Sphere math (quaternions keep the rotation stable over time) -------------
type V3 = [number, number, number];
type Q = [number, number, number, number]; // w, x, y, z
const qMul = (a: Q, b: Q): Q => [
  a[0] * b[0] - a[1] * b[1] - a[2] * b[2] - a[3] * b[3],
  a[0] * b[1] + a[1] * b[0] + a[2] * b[3] - a[3] * b[2],
  a[0] * b[2] - a[1] * b[3] + a[2] * b[0] + a[3] * b[1],
  a[0] * b[3] + a[1] * b[2] - a[2] * b[1] + a[3] * b[0],
];
const qAxis = (ax: V3, ang: number): Q => { const s = Math.sin(ang / 2); return [Math.cos(ang / 2), ax[0] * s, ax[1] * s, ax[2] * s]; };
const qNorm = (q: Q): Q => { const l = Math.hypot(...q) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
const qRot = (q: Q, v: V3): V3 => {
  const [w, x, y, z] = q;
  const ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
// Even spread of points over a sphere (Fibonacci / golden-angle).
const spherePoints = (n: number): V3[] => Array.from({ length: n }, (_, i) => {
  const y = 1 - ((i + 0.5) * 2) / n, r = Math.sqrt(1 - y * y), t = i * Math.PI * (3 - Math.sqrt(5));
  return [Math.cos(t) * r, y, Math.sin(t) * r];
});

export const OrbitWidgets: React.FC = () => {
  const stageRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const toFront = useRef<(i: number) => void>(() => {});

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const n = WIDGETS.length;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // Idle speed: one full turn every 80s (the pace you liked). Hovering steers the
    // globe toward the cursor at up to 2× that, like the icon cloud's min/max speed.
    const IDLE = (Math.PI * 2) / 80;
    const MAX = IDLE * 2;
    let dir: V3 = (() => { const a: V3 = [-0.1, 1, 0]; const l = Math.hypot(...a); return [a[0] / l, a[1] / l, 0]; })();
    let omega: V3 = [dir[0] * IDLE, dir[1] * IDLE, 0];   // current angular velocity (rad/s)
    let target: V3 = [...omega];
    let q: Q = qNorm(qMul(qAxis([0, 1, 0], 0.5), qAxis([1, 0, 0], -0.25)));
    let pts: V3[] = [], count = 0;
    let raf = 0, visible = false, last = performance.now();
    let hover = false, mx = 0, my = 0;               // cursor offset from center, −1..1
    let lx = 0, ly = 0;                               // eased logo parallax
    let focus: { from: Q; to: Q; t0: number } | null = null;
    // Touch drag (phones): spin by dragging, with inertia
    let drag: { x: number; y: number; t: number } | null = null;

    const layout = () => {
      const w = stage.clientWidth;
      const c = w < 640 ? MOBILE_COUNT : n;
      if (c !== count) { count = c; pts = spherePoints(count); }
    };

    const place = () => {
      const w = stage.clientWidth, h = stage.clientHeight;
      const small = w < 640;
      const rx = Math.min(w * (small ? 0.40 : 0.40), w / 2 - (small ? 70 : 125));
      const ry = h * 0.36;
      const base = small ? 0.6 : 0.85;
      for (let i = 0; i < n; i++) {
        const el = itemRefs.current[i];
        if (!el) continue;
        if (i >= count) { el.style.display = 'none'; continue; }
        el.style.display = '';
        const v = qRot(q, pts[i]);
        const depth = (v[2] + 1) / 2;                 // 0 = far side of the globe, 1 = nearest
        const persp = 0.8 + 0.2 * v[2];               // a touch of perspective pull toward the middle
        const x = v[0] * rx * persp, y = -v[1] * ry * persp;
        const s = base * (0.6 + 0.4 * depth);
        const blur = (1 - depth) * (1 - depth) * 7;
        const op = 0.22 + 0.78 * depth;
        el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        el.style.opacity = op.toFixed(3);
        el.style.filter = blur > 0.25 ? `blur(${blur.toFixed(2)}px)` : 'none';
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.pointerEvents = depth > 0.55 ? 'auto' : 'none';
      }
      if (logoRef.current) logoRef.current.style.transform = `translate(calc(-50% + ${lx.toFixed(1)}px), calc(-50% + ${ly.toFixed(1)}px))`;
    };

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const slerp = (a: Q, b: Q, t: number): Q => {
      let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
      if (d < 0) { b = [-b[0], -b[1], -b[2], -b[3]]; d = -d; }
      if (d > 0.9995) return qNorm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]);
      const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
      return [a[0] * wa + b[0] * wb, a[1] * wa + b[1] * wb, a[2] * wa + b[2] * wb, a[3] * wa + b[3] * wb];
    };

    // Click a card: rotate the globe so it comes to the front in 500ms (clickToFront: 500).
    toFront.current = (i: number) => {
      if (i >= count) return;
      const v = qRot(q, pts[i]);
      const axis: V3 = [v[1], -v[0], 0];               // v × (0,0,1)
      const al = Math.hypot(axis[0], axis[1]);
      if (al < 1e-4) return;
      const ang = Math.acos(Math.max(-1, Math.min(1, v[2])));
      focus = { from: q, to: qNorm(qMul(qAxis([axis[0] / al, axis[1] / al, 0], ang), q)), t0: performance.now() };
      start();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (focus) {
        const t = Math.min(1, (now - focus.t0) / 500);
        q = slerp(focus.from, focus.to, ease(t));
        if (t >= 1) focus = null;
      } else if (!drag) {
        // Steer toward the cursor (front of the globe follows the pointer), else idle spin.
        if (hover) {
          const m = Math.hypot(mx, my);
          if (m > 0.05) {
            dir = [my / m, mx / m, 0];
            const sp = IDLE + (MAX - IDLE) * Math.min(1, m);
            target = [dir[0] * sp, dir[1] * sp, 0];
          } else target = [dir[0] * IDLE, dir[1] * IDLE, 0];
        } else target = [dir[0] * IDLE, dir[1] * IDLE, 0];
        const k = 1 - Math.exp(-dt * 2.5);
        omega = [omega[0] + (target[0] - omega[0]) * k, omega[1] + (target[1] - omega[1]) * k, 0];
        const sp = Math.hypot(omega[0], omega[1]);
        if (sp > 1e-6) q = qNorm(qMul(qAxis([omega[0] / sp, omega[1] / sp, 0], sp * dt), q));
      }
      // Subtle logo parallax toward the cursor
      const kl = 1 - Math.exp(-dt * 4);
      lx += ((hover ? mx * 10 : 0) - lx) * kl;
      ly += ((hover ? my * 8 : 0) - ly) * kl;
      place();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    function start() { if (reduce && !focus) { place(); return; } cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(loop); }

    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1, ny = ((e.clientY - r.top) / r.height) * 2 - 1;
      if (e.pointerType === 'touch' && drag) {
        const t = performance.now(), dts = Math.max(0.008, (t - drag.t) / 1000);
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        const ax: V3 = [dy, dx, 0], al = Math.hypot(dy, dx);
        if (al > 0) {
          const ang = al / (r.width * 0.5);
          q = qNorm(qMul(qAxis([ax[0] / al, ax[1] / al, 0], ang), q));
          omega = [(ax[0] / al) * (ang / dts), (ax[1] / al) * (ang / dts), 0];
          const sp = Math.hypot(omega[0], omega[1]);
          if (sp > MAX * 3) omega = [omega[0] / sp * MAX * 3, omega[1] / sp * MAX * 3, 0];
          dir = [ax[0] / al, ax[1] / al, 0];
        }
        drag = { x: e.clientX, y: e.clientY, t };
        if (reduce) place();
        return;
      }
      if (e.pointerType !== 'touch') { hover = true; mx = Math.max(-1, Math.min(1, nx)); my = Math.max(-1, Math.min(1, ny)); }
    };
    const onLeave = () => { hover = false; };
    const onDown = (e: PointerEvent) => { if (e.pointerType === 'touch') drag = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = () => { drag = null; };

    layout();
    place();
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerleave', onLeave);
    stage.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else cancelAnimationFrame(raf); }, { rootMargin: '100px' });
    io.observe(stage);
    const ro = new ResizeObserver(() => { layout(); place(); });
    ro.observe(stage);
    const onVis = () => { if (!document.hidden && visible) start(); };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      stage.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div ref={stageRef} className="relative w-full h-[520px] sm:h-[640px] select-none" style={{ touchAction: 'pan-y' }} aria-hidden="true">
      {/* Soft green light behind the logo */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[420px] max-w-full rounded-full blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(57,157,116,0.22), rgba(57,157,116,0) 100%)' }} />

      {WIDGETS.map((wd, i) => (
        <div key={i} ref={el => { itemRefs.current[i] = el; }} onClick={() => toFront.current(i)}
          className="absolute left-1/2 top-1/2 will-change-transform cursor-default" style={{ transformOrigin: 'center' }}>
          {wd}
        </div>
      ))}

      {/* Kaya logo in the middle of the globe, in a circle (z between far and near cards) */}
      <div ref={logoRef} className="absolute left-1/2 top-1/2 pointer-events-none" style={{ zIndex: 50, transform: 'translate(-50%, -50%)' }}>
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full flex items-center justify-center"
          style={{ background: 'radial-gradient(circle at 50% 30%, #193F2F 0%, #0b1712 75%)', boxShadow: '0 0 0 1px rgba(220,245,223,0.10) inset, 0 0 60px 6px rgba(57,157,116,0.35)' }}>
          <img src="/logo-icon.svg" alt="" className="w-11 h-11 sm:w-12 sm:h-12" draggable={false} />
        </div>
      </div>
    </div>
  );
};

export default OrbitWidgets;
