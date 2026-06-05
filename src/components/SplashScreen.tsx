'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [hiding,  setHiding]  = useState(false);

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    if (sessionStorage.getItem('splash_shown')) return;
    sessionStorage.setItem('splash_shown', '1');
    setVisible(true);

    const t1 = setTimeout(() => setHiding(true), 2200);
    const t2 = setTimeout(() => setVisible(false), 2800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes splashGlow {
          0%   { opacity: .6; transform: scale(1); }
          100% { opacity: 1;  transform: scale(1.05); }
        }
        @keyframes splashRing {
          0%, 100% { transform: scale(1);    opacity: .6; }
          50%       { transform: scale(1.12); opacity: .2; }
        }
        @keyframes splashPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: .7; transform: scale(.95); }
        }
        @keyframes splashBarFill {
          0%   { width: 0%; }
          80%  { width: 90%; }
          100% { width: 100%; }
        }
        #splash-logo-wrap  { animation: none; }
        #splash-logo-wrap.in  { opacity: 1 !important; transform: scale(1) translateY(0) !important; }
        #splash-text-wrap.in  { opacity: 1 !important; transform: translateY(0) !important; }
        #splash-bar-wrap.in   { opacity: 1 !important; }
        #splash-bar.run       { animation: splashBarFill 2s ease-in-out forwards; }
      `}</style>

      <div
        id="splash-screen"
        style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#070d14',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 0, overflow: 'hidden',
          transition: 'opacity 0.6s ease',
          opacity: hiding ? 0 : 1,
          pointerEvents: hiding ? 'none' : 'all',
        }}
      >
        {/* Fondos animados */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: '20%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 500, height: 500,
            background: 'radial-gradient(circle,rgba(74,144,217,0.12) 0%,transparent 70%)',
            animation: 'splashGlow 3s ease-in-out infinite alternate',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '10%',
            width: 200, height: 200,
            background: 'radial-gradient(circle,rgba(38,198,176,0.06) 0%,transparent 70%)',
            animation: 'splashGlow 4s ease-in-out infinite alternate-reverse',
          }} />
        </div>

        {/* Logo circular */}
        <SplashLogo />

        {/* Nombre / logo texto */}
        <SplashText />

        {/* Barra de progreso */}
        <SplashBar />

        {/* Versión */}
        <div style={{
          position: 'absolute', bottom: 24,
          fontFamily: "'Inter',sans-serif", fontSize: 11,
          color: '#1e3a5f', letterSpacing: '.06em',
        }}>
          v2.0 · multiempresa
        </div>
      </div>
    </>
  );
}

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
