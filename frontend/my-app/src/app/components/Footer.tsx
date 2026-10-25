'use client';

export default function Footer() {
  return (
    <footer
      className="py-20 border-t px-8"
      style={{ backgroundColor: '#030508', borderColor: 'rgba(255,255,255,0.05)' }}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div
          className="text-3xl tracking-widest"
          style={{ fontFamily: 'var(--font-bebas-neue)', color: '#00e5cc' }}
        >
          VERITAS
        </div>

        <div
          className="text-[10px] text-gray-600 uppercase tracking-widest"
          style={{ fontFamily: 'var(--font-dm-mono)' }}
        >
          © 2024 Veritas Analytics Corp. All rights reserved. Terminal protocols engaged.
        </div>

        <div className="flex gap-6">
          {['GITHUB', 'DOCS', 'STATUS'].map(link => (
            <a
              key={link}
              href="#"
              className="text-gray-500 transition-colors text-xs"
              style={{ fontFamily: 'var(--font-dm-mono)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = '#00e5cc'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = ''; }}
            >
              {link}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
