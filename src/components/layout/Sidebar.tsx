'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

const MODULOS_POR_TIPO: Record<string, { href: string; label: string }[]> = {
  transporte_especial: [
    { href: '/dashboard', label: '🏠 Inicio' },
    { href: '/dashboard/registro', label: '👤 Registro' },
    { href: '/dashboard/asistencia', label: '📋 Asistencia' },
    { href: '/dashboard/planilla-incluir', label: '📝 Planilla Incluir' },
    { href: '/dashboard/dj-esc107', label: '📄 DJ — ESC 107' },
    { href: '/dashboard/egresos', label: '💸 Egresos' },
    { href: '/dashboard/ingresos', label: '💰 Ingresos' },
    { href: '/dashboard/remitos', label: '🧾 Remitos' },
    { href: '/dashboard/reportes-km', label: '📊 Reportes KM' },
    { href: '/dashboard/facturacion', label: '🧾 Facturación' },
    { href: '/dashboard/presentacion-docs', label: '📁 Presentación Docs' },
    { href: '/dashboard/altas-pres', label: '📋 Altas (PRES IS)' },
    { href: '/dashboard/cambio-transporte', label: '🔄 Nota Cambio Transporte' },
    { href: '/dashboard/vencimientos', label: '📅 Vencimientos' },
    { href: '/dashboard/choferes-mapa', label: '🚐 Choferes en vivo' },
    { href: '/dashboard/recorridos', label: '🗺️ Recorridos' },
    { href: '/dashboard/administrador', label: '⚙️ Administrador' },
  ],
  paqueteria: [
    { href: '/dashboard', label: '🏠 Inicio' },
    { href: '/dashboard/paqueteria', label: '📦 Paquetería' },
    { href: '/dashboard/facturacion', label: '🧾 Facturación' },
    { href: '/dashboard/vencimientos', label: '📅 Vencimientos' },
    { href: '/dashboard/administrador', label: '⚙️ Administrador' },
  ],
  traslado: [
    { href: '/dashboard', label: '🏠 Inicio' },
    { href: '/dashboard/traslado', label: '🚕 Traslado' },
    { href: '/dashboard/facturacion', label: '🧾 Facturación' },
    { href: '/dashboard/vencimientos', label: '📅 Vencimientos' },
    { href: '/dashboard/administrador', label: '⚙️ Administrador' },
  ],
};

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [links, setLinks] = useState(MODULOS_POR_TIPO.transporte_especial);

  useEffect(() => {
    api.get('/api/empresa/tipo').then(r => {
      const tipo = r.data?.tipo || r.data;
      const modulos = MODULOS_POR_TIPO[tipo];
      if (modulos) setLinks(modulos);
    }).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <aside style={{
      width: '220px', minHeight: '100vh', flexShrink: 0,
      background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ padding: '1.25rem 1rem .75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🚌</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Transit·Ya</span>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '.5rem 0' }}>
        {links.map(link => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '.6rem',
                padding: '.5rem 1rem',
                fontSize: '.82rem', fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text3)',
                background: active ? 'var(--blue-dim)' : 'transparent',
                borderLeft: active ? '3px solid var(--blue)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg4)'; } }}
              onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; } }}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '.6rem',
            padding: '.45rem .75rem', borderRadius: 'var(--radius)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '.82rem', color: 'var(--text3)', textAlign: 'left',
            transition: 'all 150ms ease',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
