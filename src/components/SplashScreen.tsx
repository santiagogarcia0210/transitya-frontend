'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

/* ── WebGL shader sources ──────────────────────────────────────────────── */
const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG = `
  precision mediump float;
  uniform vec2  u_res;
  uniform float u_time;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash(i), b = hash(i+vec2(1,0)), c = hash(i+vec2(0,1)), d = hash(i+vec2(1,1));
    vec2 u = f*f*(3.0-2.0*f);
    return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
  }
  float fbm(vec2 p) {
    float v=0.0, a=0.5;
    for(int i=0;i<3;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
    return v;
  }
  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    uv = uv*2.0 - 1.0;
    uv.x *= u_res.x / u_res.y;

    float t  = u_time * 0.12;
    float n1 = fbm(uv*1.5 + vec2(t*0.30, t*0.20));
    float n2 = fbm(uv*2.0 - vec2(t*0.15, t*0.28));

    vec3 base = vec3(0.027, 0.047, 0.094);          /* #070c18 */
    vec3 blue = vec3(0.231, 0.510, 0.965);           /* #3b82f6 */
    vec3 teal = vec3(0.078, 0.722, 0.651);           /* #14b8a6 */

    vec3 col = base
      + blue * smoothstep(0.38, 0.62, n1) * 0.15
      + teal * smoothstep(0.42, 0.68, n2) * 0.10;

    float vig = 1.0 - dot(uv*0.45, uv*0.45);
    col *= smoothstep(0.0, 0.85, vig);

    gl_FragColor = vec4(col, 1.0);
  }
`;

function makeShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

/* ── Main component ────────────────────────────────────────────────────── */
export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [hiding,  setHiding]  = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Show / hide logic tied to Firebase auth ── */
  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem('splash_shown')) return;
    sessionStorage.setItem('splash_shown', '1');
    setVisible(true);

    const MIN_MS    = 900;
    const shownAt   = Date.now();
    let authDone    = false;
    let timerDone   = false;
    let hidingStarted = false;

    const maybeHide = () => {
      if (!authDone || !timerDone || hidingStarted) return;
      hidingStarted = true;
      setHiding(true);
      setTimeout(() => setVisible(false), 700);
    };

    const elapsed   = Date.now() - shownAt;
    const remaining = Math.max(0, MIN_MS - elapsed);
    const t1 = setTimeout(() => { timerDone = true; maybeHide(); }, remaining);

    // Safety cap: hide after 4 s no matter what
    const t2 = setTimeout(() => { authDone = true; timerDone = true; maybeHide(); }, 4000);

    const unsub = onAuthStateChanged(auth, () => {
      authDone = true;
      maybeHide();
    });

    return () => {
      unsub();
      clearTimeout(t1);
      clearTimeout(t2);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /* ── WebGL animation ── */
  useEffect(() => {
    if (!visible || reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, makeShader(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, makeShader(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos  = gl.getAttribLocation(prog, 'a_pos');
    const uRes  = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // 0.5× pixel ratio for perf — it's a blurred bg, not UI
    const DPR = Math.min(window.devicePixelRatio || 1, 2) * 0.5;

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * DPR;
      canvas.height = canvas.offsetHeight * DPR;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const t0 = performance.now();
    const render = (now: number) => {
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [visible, reducedMotion]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#070c18', overflow: 'hidden',
        transition: 'opacity 0.7s ease',
        opacity: hiding ? 0 : 1,
        pointerEvents: hiding ? 'none' : 'all',
      }}
    >
      {/* Shader background */}
      {!reducedMotion ? (
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />
      ) : (
        <div style={{
          position: 'absolute', inset: 0,
          background:
            'radial-gradient(ellipse at 50% 30%, rgba(59,130,246,.10) 0%, transparent 60%),' +
            'radial-gradient(ellipse at 65% 70%, rgba(20,184,166,.06) 0%, transparent 50%)',
        }} />
      )}

      {/* Foreground content */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <SplashLogo />
        <SplashText />
        <SplashBar />
      </div>

      <div style={{
        position: 'absolute', bottom: 24, zIndex: 1,
        fontFamily: "'Inter',sans-serif", fontSize: 11,
        color: '#1e3a5f', letterSpacing: '.06em',
      }}>
        v2.0 · multiempresa
      </div>
    </div>
  );
}

/* ── Sub-components (visual unchanged) ────────────────────────────────── */
function SplashLogo() {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 80); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      position: 'relative',
      opacity:   shown ? 1 : 0,
      transform: shown ? 'scale(1) translateY(0)' : 'scale(.7) translateY(20px)',
      transition: 'opacity .6s cubic-bezier(.34,1.56,.64,1), transform .7s cubic-bezier(.34,1.56,.64,1)',
    }}>
      <div style={{
        position: 'absolute', inset: -20, borderRadius: '50%',
        border: '1.5px solid rgba(74,144,217,.3)',
        animation: 'splashRing 2.5s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', inset: -38, borderRadius: '50%',
        border: '1px solid rgba(74,144,217,.15)',
        animation: 'splashRing 2.5s ease-in-out infinite .4s',
      }} />
      <style>{`
        @keyframes splashRing {
          0%,100%{transform:scale(1);opacity:.6}
          50%{transform:scale(1.12);opacity:.2}
        }
        @keyframes splashBarFill {
          0%{width:0%} 80%{width:90%} 100%{width:100%}
        }
        @media(prefers-reduced-motion:reduce){
          *{animation-duration:.01ms!important;animation-iteration-count:1!important}
        }
      `}</style>
      <Image
        src="/assets/logo-circular.png"
        alt="Transit·Ya"
        width={110} height={110}
        style={{
          objectFit: 'contain', borderRadius: '50%',
          boxShadow: '0 0 40px rgba(74,144,217,.3), 0 20px 60px rgba(0,0,0,.5)',
        }}
        priority
      />
    </div>
  );
}

function SplashText() {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 300); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      marginTop: 28, textAlign: 'center',
      opacity:   shown ? 1 : 0,
      transform: shown ? 'translateY(0)' : 'translateY(16px)',
      transition: 'opacity .5s ease, transform .5s ease',
    }}>
      <Image
        src="/assets/logo-horizontal.png"
        alt="Transit·Ya"
        width={180} height={48}
        style={{ objectFit: 'contain', height: 40, width: 'auto' }}
        priority
      />
      <div style={{
        fontFamily: "'Inter',sans-serif", fontSize: 12, color: '#4a6a8a',
        marginTop: 6, letterSpacing: '.12em', textTransform: 'uppercase',
      }}>
        Gestión de transporte
      </div>
    </div>
  );
}

function SplashBar() {
  const [shown, setShown] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShown(true), 500); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      width: 140, height: 2,
      background: '#0d1a2e', borderRadius: 2,
      overflow: 'hidden', marginTop: 48,
      opacity: shown ? 1 : 0,
      transition: 'opacity .3s ease',
    }}>
      <div style={{
        height: '100%',
        background: 'linear-gradient(90deg,#4a90d9,#26c6b0)',
        borderRadius: 2,
        animation: shown ? 'splashBarFill 2s ease-in-out forwards' : 'none',
      }} />
    </div>
  );
}
