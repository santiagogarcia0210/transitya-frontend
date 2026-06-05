'use client';
import { useState } from 'react';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPwd,  setShowPwd]  = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Completá email y contraseña'); return; }
    setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch {
      setError('Email o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      /* Subtle grid pattern */
      backgroundImage: `
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(59,130,246,0.18) 0%, transparent 70%),
        linear-gradient(rgba(31,45,64,0.5) 1px, transparent 1px),
        linear-gradient(90deg, rgba(31,45,64,0.5) 1px, transparent 1px)
      `,
      backgroundSize: '100% 100%, 40px 40px, 40px 40px',
    }}>
      {/* Card */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '2.5rem 2rem',
        boxShadow: '0 24px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(59,130,246,.06)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Image
            src="/assets/logo-horizontal.png"
            alt="Transit·Ya"
            width={200}
            height={60}
            style={{ objectFit: 'contain', margin: '0 auto', display: 'block' }}
            priority
          />
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Email */}
          <div>
            <label style={{ display: 'block', fontSize: '.78rem', color: 'var(--text3)',
              marginBottom: '.35rem', fontWeight: 500 }}>
              Email
            </label>
            <input
              type="email"
              className="input"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              style={{ width: '100%' }}
            />
          </div>

          {/* Contraseña */}
          <div>
            <label style={{ display: 'block', fontSize: '.78rem', color: 'var(--text3)',
              marginBottom: '.35rem', fontWeight: 500 }}>
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ width: '100%', paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                style={{
                  position: 'absolute', right: '.75rem', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text3)', fontSize: '.85rem', padding: '.15rem',
                  lineHeight: 1,
                }}
                title={showPwd ? 'Ocultar' : 'Mostrar'}
              >
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '.5rem',
              background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,.3)',
              borderRadius: 'var(--radius)', padding: '.65rem .85rem',
              fontSize: '.82rem', color: 'var(--red)',
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%', padding: '.85rem',
              fontSize: '.95rem', fontWeight: 600,
              marginTop: '.25rem',
              boxShadow: loading ? 'none' : '0 4px 16px rgba(59,130,246,.3)',
            }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem' }}>
                <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                Iniciando sesión…
              </span>
            ) : 'Iniciar sesión'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p style={{ marginTop: '1.75rem', fontSize: '.75rem', color: 'var(--text3)', textAlign: 'center' }}>
        Transit·Ya · Sistema de gestión de transporte
      </p>
    </div>
  );
}
