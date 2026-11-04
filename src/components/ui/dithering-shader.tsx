import React, { useEffect, useRef } from 'react';

/**
 * DitheringShader — animated ordered-dither background (WebGL, no dependencies).
 *
 * Same props as the 21st.dev component (shape, type, colorBack, colorFront, pxSize, speed),
 * plus `levels` and `contrast` so it can match the Figma "Dither" settings used for
 * public/bg-dither.png (Bayer 16×16, size 1, 8 levels, contrast 1.26).
 *
 * Kaya defaults: dark #070C0A at the top → green #193F2F at the bottom, with a slow wave.
 * Falls back to the static PNG when WebGL isn't available; renders one still frame
 * when the user prefers reduced motion; pauses when off-screen or the tab is hidden.
 */
export type DitherShape = 'gradient' | 'wave' | 'radial';
export type DitherType = '2x2' | '4x4' | '8x8' | '16x16';

interface Props {
  shape?: DitherShape;
  type?: DitherType;
  colorBack?: string;
  colorFront?: string;
  /** Size of one dither cell in CSS pixels (Figma "Size"). */
  pxSize?: number;
  speed?: number;
  /** Number of color steps between back and front (Figma "Levels"). */
  levels?: number;
  /** Figma "Contrast" (1 = none). */
  contrast?: number;
  /** Where the gradient starts, measured from the top (0–1). 0 = full height, like the Figma frame. */
  start?: number;
  className?: string;
  style?: React.CSSProperties;
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_back;
uniform vec3  u_front;
uniform float u_px;
uniform float u_levels;
uniform float u_contrast;
uniform float u_start;
uniform int   u_shape;   // 0 gradient, 1 wave, 2 radial (bright center → dark edges)
uniform int   u_bayer;   // 2, 4, 8, 16

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
float bayer16(vec2 a) { return bayer8(0.5 * a) * 0.25 + bayer2(a); }

float threshold(vec2 c) {
  if (u_bayer == 2) return bayer2(c);
  if (u_bayer == 4) return bayer4(c);
  if (u_bayer == 8) return bayer8(c);
  return bayer16(c);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy / u_px);
  vec2 uv = (cell * u_px) / u_res;          // 0..1, y = 0 at the bottom
  float t = u_time;
  float top = 1.0 - uv.y;                    // 0 at the top, 1 at the bottom

  // Slow, soft waves bend where the green begins and breathe its brightness.
  float wave = 0.045 * sin(uv.x * 3.1 + t * 0.55)
             + 0.025 * sin(uv.x * 7.3 - t * 0.8 + top * 3.0)
             + 0.015 * sin((uv.x + top) * 11.0 + t * 1.1);
  if (u_shape == 1) wave *= 2.2;

  // Same pipeline as the Figma Dither effect: linear gradient → contrast per channel →
  // ordered dither of each RGB channel to N levels. (Contrast is what keeps the top
  // half pure black and the red channel at 0 — that's the look of bg-dither.png.)
  float v = clamp((top - u_start + wave) / (1.0 - u_start), 0.0, 1.0);
  if (u_shape == 2) {
    // Elliptical glow from the middle, breathing slowly
    vec2 d = (uv - 0.5) * vec2(1.0, 1.15);
    float r = length(d) / 0.62;
    v = clamp(1.0 - r + wave * 0.8, 0.0, 1.0);
  }
  vec3 col = mix(u_back, u_front, v);
  col = clamp((col - 0.5) * u_contrast + 0.5, 0.0, 1.0);
  // Tiny dead zone so near-black stays pure black (no stray dots at the top), scaled back up
  // so the bottom green keeps its brightness.
  col = max((col - 0.013) * 1.075, 0.0);

  float steps = max(u_levels - 1.0, 1.0);
  vec3 x = col * steps;
  float th = threshold(cell) + 0.5 / 256.0;
  vec3 q = (floor(x) + step(vec3(th), fract(x))) / steps;

  gl_FragColor = vec4(q, 1.0);
}
`;

export const DitheringShader: React.FC<Props> = ({
  shape = 'gradient',
  type = '16x16',
  colorBack = '#070C0A',
  colorFront = '#193F2F',
  pxSize = 1,
  speed = 0.6,
  levels = 8,
  contrast = 1.26,
  start = 0,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) { canvas.style.display = 'none'; if (fallbackRef.current) fallbackRef.current.style.display = 'block'; return; }

    const compile = (kind: number, src: string) => {
      const s = gl.createShader(kind)!; gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); }
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const U = (n: string) => gl.getUniformLocation(prog, n);
    const uRes = U('u_res'), uTime = U('u_time'), uPx = U('u_px');
    gl.uniform3fv(U('u_back'), hexToRgb(colorBack));
    gl.uniform3fv(U('u_front'), hexToRgb(colorFront));
    gl.uniform1f(U('u_levels'), levels);
    gl.uniform1f(U('u_contrast'), contrast);
    gl.uniform1f(U('u_start'), start);
    gl.uniform1i(U('u_shape'), shape === 'wave' ? 1 : shape === 'radial' ? 2 : 0);
    gl.uniform1i(U('u_bayer'), parseInt(type, 10));

    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uPx, Math.max(1, pxSize * dpr));
    };

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, visible = true, t0 = performance.now();
    const draw = (now: number) => {
      gl.uniform1f(uTime, ((now - t0) / 1000) * speed);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const loop = (now: number) => {
      draw(now);
      if (!reduce && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const start_ = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };

    const ro = new ResizeObserver(() => { resize(); if (reduce) draw(t0); });
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start_(); });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden) start_(); };
    document.addEventListener('visibilitychange', onVis);

    resize();
    start_();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteBuffer(buf); gl.deleteProgram(prog);
    };
  }, [shape, type, colorBack, colorFront, pxSize, speed, levels, contrast, start]);

  return (
    <div className={`absolute inset-0 overflow-hidden ${className}`} style={style} aria-hidden="true">
      <canvas ref={canvasRef} className="block w-full h-full" style={{ imageRendering: 'pixelated' }} />
      {/* No-WebGL fallback: the static export of the same Figma dither */}
      <div ref={fallbackRef} className="absolute inset-0 hidden"
        style={{ backgroundImage: 'url(/bg-dither.png)', backgroundSize: 'cover', backgroundPosition: 'center bottom' }} />
    </div>
  );
};

export default DitheringShader;
