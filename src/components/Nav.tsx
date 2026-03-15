'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/availability', label: 'My Availability' },
  { href: '/stats', label: 'Stats' },
  { href: '/admin/roster', label: 'Roster' },
  { href: '/admin/schedule', label: 'Schedule' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' });
    router.push('/');
    router.refresh();
  }

  return (
    <nav className="bg-green-800 text-white shadow-lg print:hidden">
      <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-1">
          <span className="text-xl mr-4 font-bold tracking-wide">⚾ Softball MGT</span>
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-green-600 text-white'
                  : 'hover:bg-green-700 text-green-100'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-green-300 hover:text-white transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
