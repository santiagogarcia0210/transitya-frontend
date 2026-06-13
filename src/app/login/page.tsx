'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { signInWithEmailAndPassword, signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import FlowFieldBackground from '@/components/ui/FlowFieldBackground';
import PatternText from '@/components/ui/PatternText';
import Button from '@/components/ui/Button';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? '';

type Vista = 'login' | 'registro';

const TIPOS_EMPRESA = [
  { value: 'transporte_especial', label: '♿ Transporte Especial' },
  { value: 'traslado',            label: '🚌 Traslado de Pasajeros' },
  { value: 'paqueteria',          label: '📦 Transporte de Paquetería' },
];

export default function LoginPage() {
  const [vista,      setVista]      = useState<Vista>('login');

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'register') {
      setVista('registro');
    }
  }, []);

  /* ── Login ── */
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [loginErr,   setLoginErr]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);

  /* ── Registro ── */
  const [rEmail,     setREmail]     = useState('');
  const [rPass,      setRPass]      = useState('');
  const [rPass2,     setRPass2]     = useState('');
  const [rEmpresa,   setREmpresa]   = useState('');
  const [rTelefono,  setRTelefono]  = useState('');
  const [rTipo,      setRTipo]      = useState('transporte_especial');
  const [rNombre,    setRNombre]    = useState('');
  const [rErr,       setRErr]       = useState('');
  const [rOk,        setROk]        = useState('');
  const [rLoading,   setRLoading]   = useState(false);
  const [showRPwd,   setShowRPwd]   = useState(false);

  const router = useRouter();

  /* ─── Iniciar sesión ─── */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setLoginErr('Completá email y contraseña'); return; }
    setLoading(true); setLoginErr('');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdTokenResult();
      if (token.claims.rol === 'superadmin') {
        router.push('/superadmin');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setLoginErr('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Crear cuenta ─── */
  const handleRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    setRErr(''); setROk('');
    if (!rEmail || !rPass || !rEmpresa) { setRErr('Email, contraseña y nombre de empresa son obligatorios'); return; }
    if (rPass.length < 6) { setRErr('La contraseña debe tener al menos 6 caracteres'); return; }
    if (rPass !== rPass2) { setRErr('Las contraseñas no coinciden'); return; }

    setRLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/registro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email:       rEmail.trim(),
          password:    rPass,
          nombreEmpresa: rEmpresa.trim(),
          tipo:        rTipo,
          adminNombre: rNombre.trim() || rEmpresa.trim(),
          telefono:    rTelefono.trim(),
        }),
      });
      const data = await res.json();
      if (!data.ok) { setRErr(data.mensaje || 'Error al crear la cuenta'); setRLoading(false); return; }

      /* Si el backend devuelve un custom token, usarlo para autenticar */
      if (data.customToken) {
        await signInWithCustomToken(auth, data.customToken);
        router.push('/dashboard');
        return;
      }
      setROk('¡Cuenta creada! Ahora iniciá sesión con tu email y contraseña.');
      setTimeout(() => {
        setVista('login');
        setEmail(rEmail);
        setROk('');
      }, 2000);
    } catch {
      setRErr('Error de red al crear la cuenta');
    }
    setRLoading(false);
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '.78rem', color: 'var(--text3)',
    marginBottom: '.35rem', fontWeight: 500,
  };

  return (
    <div style={{
      position: 'relative',
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem',
      overflow: 'hidden',
    }}>
      <FlowFieldBackground intensity="full" />
      {/* Wordmark above card */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', marginBottom: '1.5rem' }}>
        <PatternText fontSize="2.25rem" tag="h1">Transit·Ya</PatternText>
        <p style={{ color: 'var(--text3)', fontSize: '.78rem', marginTop: '.4rem', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          Sistema de gestión de transporte
        </p>
      </div>

      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '420px',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl, 16px)',
        padding: vista === 'registro' ? '2rem' : '2.5rem 2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(59,130,246,.06)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div className="login-logo-wrap">
            <div className="login-logo-ring" aria-hidden="true" />
            <Image
              src="/assets/logo-circular.png"
              alt="Transit·Ya"
              width={96} height={96}
              className="login-logo-img"
              priority
            />
          </div>
        </div>

        {/* ══ VISTA LOGIN ══ */}
        {vista === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" className="input" placeholder="usuario@empresa.com"
                value={email} onChange={e => setEmail(e.target.value)}
                autoComplete="email" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'} className="input"
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ width: '100%', paddingRight: '2.75rem' }}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: '.85rem' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {loginErr && (
              <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 'var(--radius)', padding: '.65rem .85rem',
                fontSize: '.82rem', color: 'var(--red)', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                <span>⚠️</span> {loginErr}
              </div>
            )}

            <Button type="submit" depth loading={loading}
              style={{ width: '100%', padding: '.85rem', fontSize: '.95rem', fontWeight: 600, marginTop: '.25rem' }}>
              {!loading && 'Iniciar sesión'}
              {loading && 'Iniciando sesión…'}
            </Button>

            {/* Separador */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginTop: '.25rem' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: '.75rem', color: 'var(--text3)' }}>o</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            <button type="button" className="btn btn-secondary"
              style={{ width: '100%', padding: '.75rem', fontSize: '.9rem', fontWeight: 600 }}
              onClick={() => { setVista('registro'); setLoginErr(''); }}>
              Crear cuenta
            </button>
          </form>
        )}

        {/* ══ VISTA REGISTRO ══ */}
        {vista === 'registro' && (
          <form onSubmit={handleRegistro} style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.25rem' }}>
              Crear nueva cuenta
            </div>
            <p style={{ fontSize: '.82rem', color: 'var(--text3)', marginTop: 0 }}>
              Registrá tu empresa y empezá a gestionar.
            </p>

            {/* 01 · Acceso */}
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '.08em', paddingBottom: '.4rem',
              borderBottom: '1px solid var(--border)' }}>
              01 · Datos de acceso
            </div>

            <div>
              <label style={labelStyle}>Email *</label>
              <input type="email" className="input" placeholder="admin@tuempresa.com"
                value={rEmail} onChange={e => setREmail(e.target.value)}
                autoComplete="email" style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input type={showRPwd ? 'text' : 'password'} className="input"
                  placeholder="Mínimo 6 caracteres"
                  value={rPass} onChange={e => setRPass(e.target.value)}
                  autoComplete="new-password"
                  style={{ width: '100%', paddingRight: '2.75rem' }} />
                <button type="button" onClick={() => setShowRPwd(v => !v)}
                  style={{ position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', fontSize: '.85rem' }}>
                  {showRPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Repetir contraseña *</label>
              <input type="password" className="input" placeholder="Repetí la contraseña"
                value={rPass2} onChange={e => setRPass2(e.target.value)}
                autoComplete="new-password" style={{ width: '100%' }} />
            </div>

            {/* 02 · Empresa */}
            <div style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '.08em', paddingBottom: '.4rem',
              borderBottom: '1px solid var(--border)', marginTop: '.25rem' }}>
              02 · Tu empresa
            </div>

            <div>
              <label style={labelStyle}>Nombre de la empresa *</label>
              <input type="text" className="input" placeholder="Ej: Transportes García"
                value={rEmpresa} onChange={e => setREmpresa(e.target.value)}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Tu nombre (administrador)</label>
              <input type="text" className="input" placeholder="Ej: Juan García"
                value={rNombre} onChange={e => setRNombre(e.target.value)}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Teléfono de contacto</label>
              <input type="tel" className="input" placeholder="Ej: +54 381 123-4567"
                value={rTelefono} onChange={e => setRTelefono(e.target.value)}
                style={{ width: '100%' }} />
            </div>
            <div>
              <label style={labelStyle}>Tipo de empresa *</label>
              <select className="select" value={rTipo} onChange={e => setRTipo(e.target.value)}
                style={{ width: '100%' }}>
                {TIPOS_EMPRESA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            {rErr && (
              <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.3)',
                borderRadius: 'var(--radius)', padding: '.65rem .85rem',
                fontSize: '.82rem', color: 'var(--red)' }}>
                ⚠️ {rErr}
              </div>
            )}
            {rOk && (
              <div style={{ background: 'var(--green-dim)', border: '1px solid rgba(16,185,129,.3)',
                borderRadius: 'var(--radius)', padding: '.65rem .85rem',
                fontSize: '.82rem', color: 'var(--green)' }}>
                ✅ {rOk}
              </div>
            )}

            <Button type="submit" depth loading={rLoading}
              style={{ width: '100%', padding: '.85rem', fontSize: '.95rem', fontWeight: 600, marginTop: '.25rem' }}>
              {!rLoading && 'Crear cuenta →'}
              {rLoading && 'Creando cuenta…'}
            </Button>

            <button type="button" className="btn btn-secondary"
              style={{ width: '100%' }}
              onClick={() => { setVista('login'); setRErr(''); setROk(''); }}>
              ← Ya tengo cuenta
            </button>
          </form>
        )}
      </div>

      <p style={{ position: 'relative', zIndex: 1, marginTop: '1.5rem', fontSize: '.72rem', color: 'var(--text3)', textAlign: 'center', opacity: .6 }}>
        © 2026 Transit·Ya
      </p>
    </div>
  );
}
