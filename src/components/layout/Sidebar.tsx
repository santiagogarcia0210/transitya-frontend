'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const links = [
  { href: '/dashboard',                   label: 'Inicio',              icon: '🏠' },
  { href: '/dashboard/registro',          label: 'Beneficiarios',       icon: '👤' },
  { href: '/dashboard/asistencia',        label: 'Asistencia',          icon: '📋' },
  { href: '/dashboard/planilla-incluir',  label: 'Planilla Incluir',    icon: '📝' },
  { href: '/dashboard/dj-esc107',         label: 'DJ — ESC 107',        icon: '📄' },
  { href: '/dashboard/egresos',           label: 'Egresos',             icon: '💸' },
  { href: '/dashboard/ingresos',          label: 'Ingresos',            icon: '💰' },
  { href: '/dashboard/remitos',           label: 'Remitos',             icon: '🧾' },
  { href: '/dashboard/reportes-km',       label: 'Reportes KM',         icon: '📊' },
  { href: '/dashboard/facturacion',       label: 'Facturación',         icon: '🗒️' },
  { href: '/dashboard/vencimientos',      label: 'Vencimientos',        icon: '📅' },
  { href: '/dashboard/paqueteria',        label: 'Paquetería',          icon: '📦' },
  { href: '/dashboard/traslado',          label: 'Traslado',            icon: '🚕' },
  { href: '/dashboard/presentacion-docs', label: 'Presentación Docs',   icon: '📁' },
  { href: '/dashboard/altas-pres',        label: 'Altas (PRES IS)',     icon: '📋' },
  { href: '/dashboard/cambio-transporte', label: 'Nota Cambio Transp.', icon: '🔄' },
  { href: '/dashboard/choferes-mapa',     label: 'Choferes en vivo',    icon: '🗺️' },
  { href: '/dashboard/administrador',     label: 'Administrador',       icon: '⚙️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [open, setOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  const NavContent = () => (
    <>
      {/* Logo */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          {/* Desktop: logo horizontal */}
          <span className="logo-desktop" style={{ display: 'flex', alignItems: 'center' }}>
            <Image
              src="/assets/logo-horizontal.png"
              alt="Transit·Ya"
              width={140}
              height={36}
              style={{ objectFit: 'contain', maxHeight: '36px', width: 'auto' }}
              priority
            />
          </span>
          {/* Mobile: solo icono */}
          <span className="logo-mobile" style={{ display: 'none' }}>
            <Image
              src="/assets/logo-icon.png"
              alt="Transit·Ya"
              width={32}
              height={32}
              style={{ objectFit: 'contain' }}
              priority
            />
          </span>
        </Link>
        {/* Botón cerrar en mobile */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Cerrar menú"
          style={{
            display: 'none', background: 'none', border: 'none',
            color: 'var(--text3)', fontSize: '18px', cursor: 'pointer', padding: '4px',
          }}
          className="sidebar-close-btn"
        >✕</button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
        {links.map(link => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 16px', fontSize: '13px',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text)' : 'var(--text3)',
                background: active ? 'var(--blue-dim)' : 'transparent',
                borderLeft: active ? '3px solid var(--blue)' : '3px solid transparent',
                textDecoration: 'none',
                transition: 'all var(--transition)',
                fontFamily: 'var(--font)',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text2)';
                  (e.currentTarget as HTMLAnchorElement).style.background = 'var(--bg4)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--text3)';
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '14px', width: '18px', textAlign: 'center', flexShrink: 0 }}>
                {link.icon}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleLogout}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 12px', borderRadius: 'var(--radius)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '13px', color: 'var(--text3)', fontFamily: 'var(--font)',
            transition: 'all var(--transition)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--red)';
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--red-dim)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)';
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
          }}
        >
          <span>🚪</span> Cerrar sesión
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Hamburger — solo mobile */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="hamburger-btn"
        style={{
          display: 'none',
          position: 'fixed', top: '12px', left: '12px', zIndex: 200,
          background: 'var(--bg3)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '8px 10px',
          fontSize: '18px', cursor: 'pointer', color: 'var(--text)',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        ☰
      </button>

      {/* Overlay mobile */}
      {open && (
        <div
          className="sidebar-overlay"
          onClick={() => setOpen(false)}
          style={{
            display: 'none', position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 149,
          }}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`sidebar-container${open ? ' sidebar-open' : ''}`}
        style={{
          width: '220px', minHeight: '100vh', flexShrink: 0,
          background: 'var(--bg2)', borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', zIndex: 150,
          position: 'relative',
        }}
      >
        <NavContent />
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .hamburger-btn     { display: flex !important; }
          .sidebar-overlay   { display: block !important; }
          .sidebar-close-btn { display: flex !important; }
          .logo-desktop      { display: none !important; }
          .logo-mobile       { display: flex !important; }
        }
      `}</style>
    </>
  );
}
