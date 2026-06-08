'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const LINKS = [
  { href: '/superadmin/dashboard',      label: '📊 Dashboard'       },
  { href: '/superadmin/empresas',       label: '🏢 Empresas'        },
  { href: '/superadmin/pagos',          label: '💳 Pagos'            },
  { href: '/superadmin/features',       label: '⚙️ Features'         },
  { href: '/superadmin/usuarios',       label: '👥 Usuarios'         },
  { href: '/superadmin/comunicaciones', label: '📨 Comunicaciones'  },
  { href: '/superadmin/logs',           label: '📋 Logs'             },
];

export default function SuperadminSidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  const logout = async () => { await signOut(auth); router.push('/login'); };

  return (
    <aside style={{
      width: 216, minWidth: 216, background: 'var(--bg2)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem 1.25rem .75rem' }}>
        <div style={{ fontSize: '.58rem', fontWeight: 800, color: 'var(--red)',
          letterSpacing: '.15em', textTransform: 'uppercase', marginBottom: '.25rem' }}>
          ⚡ SUPERADMIN
        </div>
        <div style={{ fontSize: '.95rem', fontWeight: 700, color: 'var(--text)' }}>Transit·Ya</div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '.35rem .5rem' }}>
        {LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{
              display: 'block', padding: '.55rem .85rem', borderRadius: 'var(--radius)',
              fontSize: '.84rem', fontWeight: active ? 600 : 400,
              color: active ? 'var(--text)' : 'var(--text3)',
              background: active ? 'var(--bg4)' : 'transparent',
              textDecoration: 'none', marginBottom: '.1rem',
              border: active ? '1px solid var(--border)' : '1px solid transparent',
              transition: 'all var(--transition)',
            }}>
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '.75rem 1rem', borderTop: '1px solid var(--border)' }}>
        <Link href="/dashboard" style={{
          display: 'block', padding: '.4rem .5rem', fontSize: '.75rem', color: 'var(--text3)',
          textDecoration: 'none', marginBottom: '.4rem',
        }}>
          ← Volver al dashboard
        </Link>
        <button onClick={logout} style={{
          width: '100%', padding: '.4rem', background: 'none', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', color: 'var(--text3)', fontSize: '.78rem',
          cursor: 'pointer', transition: 'all var(--transition)',
        }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
