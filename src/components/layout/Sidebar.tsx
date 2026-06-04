'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

const links = [
  { href: '/dashboard', label: '🏠 Inicio' },
  { href: '/dashboard/registro', label: '👤 Registro' },
  { href: '/dashboard/asistencia', label: '📋 Asistencia' },
  { href: '/dashboard/planilla-incluir', label: '📝 Planilla Incluir' },
  { href: '/dashboard/egresos', label: '💸 Egresos' },
  { href: '/dashboard/ingresos', label: '💰 Ingresos' },
  { href: '/dashboard/reportes-km', label: '📊 Reportes KM' },
  { href: '/dashboard/remitos', label: '🧾 Remitos' },
  { href: '/dashboard/facturacion', label: '🧾 Facturación' },
  { href: '/dashboard/paqueteria', label: '📦 Paquetería' },
  { href: '/dashboard/traslado', label: '🚕 Traslado' },
  { href: '/dashboard/presentacion-docs', label: '📁 Presentación Docs' },
  { href: '/dashboard/altas-pres', label: '📋 Altas (PRES IS)' },
  { href: '/dashboard/cambio-transporte', label: '🔄 Nota Cambio Transporte' },
  { href: '/dashboard/dj-esc107', label: '📄 DJ — ESC 107' },
  { href: '/dashboard/vencimientos', label: '📅 Vencimientos' },
  { href: '/dashboard/choferes-mapa', label: '🚐 Choferes en vivo' },
  { href: '/dashboard/administrador', label: '⚙️ Administrador' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-gray-900 min-h-screen flex flex-col p-4">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white">Transit·Ya</h1>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`block px-4 py-2 rounded-lg text-sm transition ${
              pathname === link.href
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <button
        onClick={handleLogout}
        className="mt-4 px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition text-left"
      >
        🚪 Cerrar sesión
      </button>
    </aside>
  );
}
