'use client';
import { useState } from 'react';
import api from '@/lib/api';

interface Props {
  onClose: () => void;
}

export default function TrialExpiredModal({ onClose }: Props) {
  const [loadingMp, setLoadingMp] = useState(false);
  const [mpError,   setMpError]   = useState('');
  const [copied,    setCopied]    = useState(false);

  const ALIAS = 'marceloteje99';

  const handleMp = async () => {
    setLoadingMp(true); setMpError('');
    try {
      const { data } = await api.post('/api/empresa/checkout');
      if (data.init_point) {
        window.location.href = data.init_point;
      } else {
        setMpError('No se pudo generar el link de pago. Intentá de nuevo.');
      }
    } catch {
      setMpError('Error al conectar con MercadoPago. Intentá de nuevo.');
    } finally {
      setLoadingMp(false);
    }
  };

  const copyAlias = () => {
    navigator.clipboard.writeText(ALIAS).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        background: 'var(--bg3)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '2rem',
        maxWidth: '440px', width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,.6)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '.5rem' }}>⏰</div>
          <h2 style={{ margin: '0 0 .5rem', color: 'var(--text)', fontSize: '1.25rem', fontWeight: 700 }}>
            Tu período de prueba venció
          </h2>
          <p style={{ margin: 0, color: 'var(--text3)', fontSize: '.88rem', lineHeight: 1.5 }}>
            Activá tu suscripción para seguir gestionando tu empresa sin interrupciones.
          </p>
        </div>

        {/* Plan info */}
        <div style={{
          background: 'rgba(108,95,255,.1)',
          border: '1px solid rgba(108,95,255,.25)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.25rem',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: '.75rem', color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>Plan Pro</div>
            <div style={{ fontSize: '.85rem', color: 'var(--text)', marginTop: '.2rem' }}>Gestión completa + geolocalización</div>
          </div>
          <div style={{ fontWeight: 700, fontSize: '1.15rem', color: '#a78bfa' }}>$89.000/mes</div>
        </div>

        {/* MP button */}
        <button
          onClick={handleMp}
          disabled={loadingMp}
          style={{
            width: '100%',
            background: loadingMp ? 'rgba(0,174,243,.5)' : '#00aeef',
            color: '#fff',
            border: 'none',
            borderRadius: '10px',
            padding: '.9rem',
            fontSize: '.95rem', fontWeight: 700,
            cursor: loadingMp ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.6rem',
            marginBottom: '.75rem',
          }}
        >
          {loadingMp ? 'Generando link…' : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z" fill="#fff" opacity=".2"/>
                <path d="M7 12.5l3.5 3.5 6.5-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Pagar con MercadoPago
            </>
          )}
        </button>

        {mpError && (
          <p style={{ color: 'var(--red)', fontSize: '.8rem', textAlign: 'center', margin: '0 0 .75rem' }}>{mpError}</p>
        )}

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', margin: '.75rem 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: '.75rem', color: 'var(--text3)' }}>o transferencia bancaria</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

        {/* Transfer info */}
        <div style={{
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '.9rem 1rem',
          marginBottom: '1.25rem',
        }}>
          <div style={{ fontSize: '.75rem', color: 'var(--text3)', fontWeight: 600, marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Datos de transferencia</div>
          <div style={{ fontSize: '.85rem', color: 'var(--text)', marginBottom: '.35rem' }}>
            <span style={{ color: 'var(--text3)' }}>Alias: </span>
            <strong style={{ fontFamily: 'monospace' }}>{ALIAS}</strong>
            <button
              onClick={copyAlias}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: copied ? 'var(--green)' : 'var(--text3)', fontSize: '.78rem', marginLeft: '.5rem' }}
            >
              {copied ? '✓ Copiado' : 'Copiar'}
            </button>
          </div>
          <p style={{ margin: '.5rem 0 0', fontSize: '.78rem', color: 'var(--text3)', lineHeight: 1.4 }}>
            Enviá el comprobante a <a href="mailto:info@transitya.com" style={{ color: '#a78bfa' }}>info@transitya.com</a> y activamos tu cuenta en el día.
          </p>
        </div>

        {/* Footer */}
        <button
          onClick={onClose}
          style={{
            width: '100%',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '.7rem',
            color: 'var(--text3)',
            fontSize: '.85rem',
            cursor: 'pointer',
          }}
        >
          Cerrar y seguir navegando (solo lectura)
        </button>
      </div>
    </div>
  );
}
