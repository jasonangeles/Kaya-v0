import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Shared slide-up sheet (used by every form in the app).
 * Close it by: tapping the dimmed backdrop, tapping the grab bar, swiping the top strip down,
 * the ✕ button, or Escape. Portaled to <body> so it's positioned against the screen, not an
 * animating page.
 */
const CLOSE_DISTANCE = 90;   // px dragged down before release closes the sheet
const CLOSE_VELOCITY = 0.5;  // px/ms: a quick flick closes it even if it's short

export const BottomSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name for the dialog, e.g. "Add income". */
  label?: string;
  children?: React.ReactNode;
}> = ({ isOpen, onClose, label = 'Sheet', children }) => {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ y: number; t: number } | null>(null);
  // Parents pass a fresh onClose each render; keep the latest in a ref so the scroll lock below
  // only runs when the sheet opens or closes.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Lock the page behind the sheet (iOS otherwise scrolls the page and the touch layer drifts).
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const b = document.body;
    const prev = { position: b.style.position, top: b.style.top, width: b.style.width, overflow: b.style.overflow };
    b.style.position = 'fixed';
    b.style.top = `-${scrollY}px`;
    b.style.width = '100%';
    b.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      b.style.position = prev.position;
      b.style.top = prev.top;
      b.style.width = prev.width;
      b.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  useEffect(() => { if (!isOpen) { setDragY(0); setDragging(false); } }, [isOpen]);

  // Smooth height changes. The sheet is pinned to the bottom, so when its content grows or
  // shrinks (e.g. switching Asset ↔ Debt shows different fields) the top edge would jump.
  // Measure the content and animate the wrapper's height to it instead.
  const inner = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);
  const [resizing, setResizing] = useState(false);
  useEffect(() => {
    if (!isOpen) { setH(null); return; }
    const el = inner.current;
    if (!el) return;
    let first = true, t: number | undefined;
    const ro = new ResizeObserver(() => {
      const next = el.offsetHeight;
      if (first) { first = false; setH(next); return; }   // opening: no height animation
      setResizing(true);
      setH(next);
      window.clearTimeout(t);
      t = window.setTimeout(() => setResizing(false), 320);
    });
    ro.observe(el);
    return () => { ro.disconnect(); window.clearTimeout(t); };
  }, [isOpen]);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, t: performance.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    setDragY(Math.max(0, e.clientY - start.current.y)); // only downwards
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = Math.max(0, e.clientY - start.current.y);
    const v = dy / Math.max(1, performance.now() - start.current.t);
    start.current = null;
    setDragging(false);
    // A tap (barely moved) or a real swipe both close; a small nudge snaps back.
    if (dy < 6 || dy > CLOSE_DISTANCE || v > CLOSE_VELOCITY) onClose();
    else setDragY(0);
  };

  const y = isOpen ? `${dragY}px` : '100%';
  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={isOpen && dragY ? { opacity: Math.max(0.2, 1 - dragY / 400) } : undefined}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        style={{
          transform: `translateY(${y})`,
          visibility: isOpen ? 'visible' : 'hidden',
          transition: dragging ? 'none' : (isOpen ? 'transform 300ms ease-out' : 'transform 300ms ease-out, visibility 0s linear 300ms'),
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)',
        }}
        className={`fixed bottom-0 inset-x-0 z-50 kaya-sheet rounded-t-[28px] px-6 pb-6 max-h-[90vh] overflow-y-auto max-w-md mx-auto ${isOpen ? '' : 'pointer-events-none'}`}
      >
        {/* Grab strip: full width so it's easy to hit. Tap or swipe down to close. */}
        <button
          type="button"
          aria-label="Close"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { start.current = null; setDragging(false); setDragY(0); }}
          className="relative z-10 block w-[calc(100%+3rem)] -mx-6 pt-6 pb-6 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
        >
          <span aria-hidden className="block w-10 h-1 bg-ink/20 rounded-full mx-auto" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-6 right-6 z-20 text-textMuted hover:text-ink">✕</button>
        {/* Clip only while the height animates, so dropdowns inside the sheet aren't cut off */}
        <div style={{ height: h ?? 'auto', transition: 'height 280ms cubic-bezier(.2,.8,.2,1)', overflow: resizing ? 'hidden' : 'visible' }}>
          <div ref={inner} className="flow-root">{isOpen ? children : null}</div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default BottomSheet;
