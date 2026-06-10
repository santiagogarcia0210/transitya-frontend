'use client';
import { useEffect, useRef } from 'react';

interface FlowFieldProps {
  intensity?: 'full' | 'subtle';
  className?: string;
}

const COLORS = [
  '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6', '#3b82f6',
  '#3b82f6', '#3b82f6', '#14b8a6', '#3b82f6', '#14b8a6',
];
const BG = '#0a0f1e';

export default function FlowFieldBackground({ intensity = 'full', className = '' }: FlowFieldProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Pin non-null refs so closures see them as non-nullable
    const cvs: HTMLCanvasElement        = canvas;
    const ctr: HTMLDivElement           = container;
    const c2d: CanvasRenderingContext2D = ctx;

    const isSubtle  = intensity === 'subtle';
    const DPR       = Math.min(window.devicePixelRatio || 1, 2);
    const MAX_ALPHA = isSubtle ? 0.15 : 0.48;
    const SPEED     = isSubtle ? 0.5  : 1;

    let W = 0, H = 0, rafId = 0, paused = false;
    const particles: Particle[] = [];

    function getCount() {
      const w = window.innerWidth;
      if (isSubtle) return w < 768 ? 40 : 80;
      if (w < 480)  return 160;
      if (w < 768)  return 260;
      if (w < 1200) return 380;
      return 480;
    }

    class Particle {
      x = 0; y = 0; vx = 0; vy = 0; age = 0; life = 0; col = '';
      constructor(stagger: boolean) {
        this.life = Math.random() * 220 + 80;
        this.age  = stagger ? Math.floor(Math.random() * this.life) : 0;
        this.x    = Math.random() * W;
        this.y    = Math.random() * H;
        this.col  = COLORS[Math.floor(Math.random() * COLORS.length)];
      }
      reset() {
        this.x   = Math.random() * W;
        this.y   = Math.random() * H;
        this.vx  = 0; this.vy = 0; this.age = 0;
        this.life = Math.random() * 220 + 80;
        this.col  = COLORS[Math.floor(Math.random() * COLORS.length)];
      }
      update() {
        const angle = (Math.cos(this.x * 0.0038) + Math.sin(this.y * 0.0038)) * Math.PI;
        this.vx += Math.cos(angle) * 0.14 * SPEED;
        this.vy += Math.sin(angle) * 0.14 * SPEED;
        this.vx *= 0.94; this.vy *= 0.94;
        this.x += this.vx; this.y += this.vy;
        this.age++;
        if (this.age > this.life || this.x < -4 || this.x > W + 4 || this.y < -4 || this.y > H + 4) {
          this.reset();
        }
      }
      draw() {
        c2d.globalAlpha = Math.sin((this.age / this.life) * Math.PI) * MAX_ALPHA;
        c2d.fillStyle   = this.col;
        c2d.fillRect(this.x, this.y, 1.5, 1.5);
      }
    }

    function resize() {
      W = ctr.clientWidth;
      H = ctr.clientHeight;
      cvs.style.width  = W + 'px';
      cvs.style.height = H + 'px';
      cvs.width  = W * DPR;
      cvs.height = H * DPR;
      c2d.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = getCount();
      while (particles.length < n) particles.push(new Particle(true));
      while (particles.length > n) particles.pop();
    }

    function tick() {
      if (!paused) {
        c2d.save();
        c2d.globalAlpha = 0.1;
        c2d.fillStyle   = BG;
        c2d.fillRect(0, 0, W, H);
        c2d.restore();
        for (const p of particles) { p.update(); p.draw(); }
        c2d.globalAlpha = 1;
      }
      rafId = requestAnimationFrame(tick);
    }

    const io = new IntersectionObserver(
      (entries) => { paused = !entries[0].isIntersecting; },
      { threshold: 0 }
    );
    io.observe(ctr);

    const onVis = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('resize', resize, { passive: true });

    resize();
    c2d.globalAlpha = 1;
    c2d.fillStyle = BG;
    c2d.fillRect(0, 0, W, H);
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('resize', resize);
    };
  }, [intensity]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  );
}
