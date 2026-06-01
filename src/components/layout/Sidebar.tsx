'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const links = [
  { href: '/dashboard',                     label: 'Inicio',                   icon: '🏠' },
  { href: '/dashboard/registro',            label: 'Registro',                 icon: '👤' },
  { href: '/dashboard/asistencia',          label: 'Asistencia',               icon: '📋' },
  { href: '/dashboard/planilla-incluir',    label: 'Planilla Incluir',         icon: '📝' },
  { href: '/dashboard/dj-esc107',           label: 'DJ — ESC 107',             icon: '📄' },
  { href: '/dashboard/egresos',             label: 'Egresos',                  icon: '💸' },
  { href: '/dashboard/ingresos',            label: 'Ingresos',                 icon: '💰' },
  { href: '/dashboard/remitos',             label: 'Remitos',                  icon: '🧾' },
  { href: '/dashboard/reportes-km',         label: 'Reportes KM',              icon: '📊' },
  { href: '/dashboard/facturacion',         label: 'Facturación',              icon: '🗒️' },
  { href: '/dashboard/vencimientos',        label: 'Vencimientos',             icon: '📅' },
  { href: '/dashboard/paqueteria',          label: 'Paquetería',               icon: '📦' },
  { href: '/dashboard/traslado',            label: 'Traslado',                 icon: '🚕' },
  { href: '/dashboard/presentacion-docs',   label: 'Presentación Docs',        icon: '📁' },
  { href: '/dashboard/altas-pres',          label: 'Altas (PRES IS)',          icon: '📋' },
  { href: '/dashboard/cambio-transporte',   label: 'Cambio Transporte',        icon: '🔄' },
  { href: '/dashboard/choferes-mapa',       label: 'Choferes en vivo',         icon: '🗺️' },
  { href: '/dashboard/recorridos',          label: 'Recorridos',               icon: '🛣️' },
  { href: '/dashboard/administrador',       label: 'Administrador',            icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

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
      {/* Logo */}
      <div style={{ padding: '1.25rem 1rem .75rem', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🚌</span>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Transit·Ya</span>
        </div>
      </div>

      {/* Nav */}
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
              <span style={{ fontSize: '.9rem', width: '1.1rem', textAlign: 'center' }}>{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
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
