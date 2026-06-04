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
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push('/dashboard');
    } catch {
      setError('Email o contraseña incorrectos. Verificá tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px', fontFamily: 'var(--font)',
    }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '40px 36px',
        width: '100%', maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Image
            src="/assets/logo-horizontal.png"
            alt="Transit·Ya"
            width={200}
            height={52}
            style={{ objectFit: 'contain', maxWidth: '200px', height: 'auto', margin: '0 auto' }}
            priority
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
            Bienvenido
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text3)' }}>
            Iniciá sesión en tu cuenta
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              placeholder="admin@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              fontSize: '13px', color: 'var(--red)', padding: '10px 14px',
              background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 'var(--radius)',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '4px' }}
          >
            {loading ? (
              <><span className="spinner" style={{ width: '16px', height: '16px' }} /> Ingresando…</>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: 'var(--text3)' }}>
          Transit·Ya — Sistema de gestión de transporte
        </div>
      </div>
    </div>
  );
}
