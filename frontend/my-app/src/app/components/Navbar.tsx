'use client';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 glass-nav h-20 flex items-center justify-between px-8 md:px-16">
      <div className="logo group flex cursor-pointer" id="main-logo">
        <span
          className="font-bebas text-4xl tracking-tighter transition-all duration-300"
          style={{ fontFamily: 'var(--font-bebas-neue)', color: '#00e5cc' }}
        >
          VERITAS
        </span>
      </div>

      <div className="hidden md:flex gap-12 text-sm uppercase tracking-widest relative" style={{ fontFamily: 'var(--font-dm-mono)' }}>
        <a className="nav-link relative py-2 hover:text-[#00e5cc] transition-colors" href="/overview">
          Overview
          <div className="h-[1px] w-0 bg-[#00e5cc] absolute bottom-0 left-0 transition-all duration-300 hover:w-full"></div>
        </a>
        <a className="nav-link relative py-2 hover:text-[#00e5cc] transition-colors" href="/investment">
          Investment
          <div className="h-[1px] w-0 bg-[#00e5cc] absolute bottom-0 left-0 transition-all duration-300 hover:w-full"></div>
        </a>
        <a className="nav-link relative py-2 hover:text-[#00e5cc] transition-colors" href="/insights">
          Insights
          <div className="h-[1px] w-0 bg-[#00e5cc] absolute bottom-0 left-0 transition-all duration-300 hover:w-full"></div>
        </a>
      </div>

      <button
        className="px-6 py-2 border text-xs uppercase tracking-widest transition-colors"
        style={{
          borderColor: '#C9A84C',
          color: '#C9A84C',
          fontFamily: 'var(--font-dm-mono)',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#C9A84C';
          (e.currentTarget as HTMLButtonElement).style.color = '#050810';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = '#C9A84C';
        }}
      >
        Terminal Access
      </button>
    </nav>
  );
}
