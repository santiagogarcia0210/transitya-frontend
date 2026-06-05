'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { invalidateEmpresaTipoCache } from '@/hooks/useEmpresaTipo';

const TIPOS = [
  { value: 'transporte_especial', label: 'Transporte Especial' },
  { value: 'traslado',            label: 'Traslado de Pasajeros' },
  { value: 'paqueteria',          label: 'Transporte de Paquetería' },
];

interface Props {
  onClose: () => void;
}

export default function MiEmpresaModal({ onClose }: Props) {
  const [nombre,  setNombre]  = useState('');
  const [tipo,    setTipo]    = useState('transporte_especial');
  const [logo,    setLogo]    = useState('');
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/api/empresa/config')
      .then(r => {
        const c = r.data?.config || {};
        setNombre(c.nombre || '');
        setTipo(c.tipo   || 'transporte_especial');
        setLogo(c.logo   || '');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 256;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setLogo(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    setSaving(true); setMsg(null);
    try {
      await api.put('/api/empresa/config', { nombre: nombre.trim(), tipo, logo });
      invalidateEmpresaTipoCache();
      setMsg({ text: '✅ Configuración guardada. Recargá para ver cambios.', ok: true });
      setTimeout(() => { window.location.reload(); }, 1200);
    } catch (err: unknown) {
      console.error('[MiEmpresaModal] guardar:', err);
      const data = (err as { response?: { data?: { error?: string; mensaje?: string }; status?: number } })?.response;
      const detail = data?.data?.error || data?.data?.mensaje || '';
      const status = data?.status;
      setMsg({
        text: `Error al guardar${detail ? `: ${detail}` : ''}${status ? ` (${status})` : ''}. Revisá la consola.`,
        ok: false,
      });
    }
    setSaving(false);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '1rem' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1.25rem' }}>
          🏢 Mi empresa
        </h3>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', color: 'var(--text3)', padding: '1.5rem 0' }}>
            <span className="spinner" /> Cargando…
          </div>
        ) : (
          <>
            {/* Nombre */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500 }}>
                Nombre de la empresa
              </label>
              <input
                className="input"
                placeholder="Ej: Transporte San Martín"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
              />
            </div>

            {/* Tipo */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.3rem', fontWeight: 500 }}>
                Tipo de empresa
              </label>
              <select className="select" value={tipo} onChange={e => setTipo(e.target.value)}>
                {TIPOS.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <p style={{ fontSize: '.72rem', color: 'var(--text3)', marginTop: '.3rem' }}>
                Determina qué módulos aparecen en el menú lateral.
              </p>
            </div>

            {/* Logo */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '.78rem', color: 'var(--text3)', marginBottom: '.5rem', fontWeight: 500 }}>
                Logo de la empresa
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logo}
                    alt="Logo"
                    style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover',
                      border: '2px solid var(--border)' }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: '50%',
                    background: 'var(--bg4)', border: '2px dashed var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem' }}>
                    🏢
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
                  <button className="btn btn-secondary" style={{ fontSize: '.78rem' }}
                    onClick={() => fileRef.current?.click()}>
                    {logo ? '↻ Cambiar logo' : '+ Subir logo'}
                  </button>
                  {logo && (
                    <button className="btn btn-danger" style={{ fontSize: '.72rem', padding: '.25rem .5rem' }}
                      onClick={() => setLogo('')}>
                      Quitar logo
                    </button>
                  )}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={handleFile} />
            </div>

            {msg && (
              <p style={{ fontSize: '.82rem', color: msg.ok ? 'var(--green)' : 'var(--red)',
                marginBottom: '.75rem' }}>
                {msg.text}
              </p>
            )}

            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                Cancelar
              </button>
              <button className="btn btn-primary" style={{ flex: 1 }} onClick={guardar} disabled={saving}>
                {saving
                  ? <><span className="spinner" style={{ width: 12, height: 12, borderWidth: '2px' }} /> Guardando…</>
                  : 'Guardar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
