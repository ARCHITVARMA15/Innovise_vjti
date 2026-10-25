'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const navLinks = [
  { label: 'Overview',    href: '/overview',    icon: 'dashboard' },
  { label: 'Investments', href: '/investment',  icon: 'account_balance_wallet' },
  { label: 'Markets',     href: '/market',      icon: 'monitoring' },
  { label: 'Learners',    href: '/learners',    icon: 'school' },
  { label: 'Insights',    href: '/insights',    icon: 'lightbulb' },
  { label: 'Research Lab', href: '/research',   icon: 'science' },
  { label: 'Mindset',     href: '/mindset',     icon: 'psychology' },
  { label: 'Portfolio',   href: '/portfolio',   icon: 'donut_large' },
  { label: 'Reports',     href: '/reports',     icon: 'description' },
  { label: 'Analyst Watch', href: '/analyst-watch', icon: 'notifications_active' },
  { label: 'Financial Analytics', href: '/financial-analytics', icon: 'finance' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const val = localStorage.getItem('veritas_sidebar_collapsed');
      setCollapsed(val === '1');
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('veritas_sidebar_collapsed', collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  return (
    <aside
      className={`h-screen fixed left-0 top-0 z-50 flex flex-col py-6 px-2 transition-all duration-200 ${collapsed ? 'w-20' : 'w-64'}`}
      style={{ backgroundColor: '#f8fafc', borderRight: '1px solid rgba(226,232,240,0.6)' }}
    >
      {/* Brand + collapse toggle */}
      <div className="mb-6 px-3 flex items-center justify-between">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center w-full' : ''}`}>
          <h1
            className={`${collapsed ? 'text-xl' : 'text-2xl'} font-extrabold tracking-tight truncate`}
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Veritas
          </h1>
          {/* subtitle intentionally removed to keep brand concise */}
        </div>

        <button
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-2 rounded hover:bg-slate-100 transition-colors"
          onClick={() => setCollapsed(s => !s)}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>
            {collapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1 px-1">
        {navLinks.map(({ label, href, icon }) => {
          const isActive = pathname === href || (['/research', '/financial-analytics', '/analyst-watch'].includes(href) && pathname.startsWith(`${href}/`));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start'} gap-3 py-2 px-3 rounded-lg text-base font-medium transition-all duration-150`}
              style={{
                color: isActive ? '#0f172a' : '#64748b',
                backgroundColor: isActive ? '#ffffff' : 'transparent',
                boxShadow: isActive ? '0 1px 4px rgba(11,28,48,0.07)' : 'none',
                transform: isActive ? 'translateX(2px)' : 'none',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.color = '#334155';
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#f1f5f9';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  (e.currentTarget as HTMLAnchorElement).style.color = '#64748b';
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <span
                className="material-symbols-outlined"
                style={{ fontSize: '22px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                title={label}
              >
                {icon}
              </span>
              <span className={`transition-all duration-150 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="mt-auto pt-4 pb-2 px-1 space-y-1">
        <button
          className={`w-full py-2.5 rounded-lg mb-4 text-base font-bold text-white transition-all hover:opacity-90 ${collapsed ? 'px-2' : ''}`}
          style={{ backgroundColor: '#0f172a', fontFamily: 'Inter, sans-serif' }}
        >
          {!collapsed ? 'New Investment' : <span className="material-symbols-outlined">add</span>}
        </button>

        {[
          { label: 'Support', icon: 'help' },
          { label: 'Log Out', icon: 'logout' },
        ].map(({ label, icon }) => (
          <Link
            key={label}
            href="#"
            className={`flex items-center ${collapsed ? 'justify-center' : 'justify-start'} gap-3 py-2 px-3 text-base font-medium transition-colors`}
            style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#334155'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#64748b'; }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
              title={label}
            >
              {icon}
            </span>
            <span className={`${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>{label}</span>
          </Link>
        ))}
      </div>
    </aside>
  );
}
