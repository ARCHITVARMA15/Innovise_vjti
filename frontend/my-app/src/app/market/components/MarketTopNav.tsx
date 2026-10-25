'use client';

export default function MarketTopNav() {
  return (
    <header
      className="w-full h-16 sticky top-0 z-40 flex justify-between items-center px-8"
      style={{
        backgroundColor: '#f8f9ff',
        boxShadow: '0 24px 40px -15px rgba(11,28,48,0.06)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-3">
        <span
          className="material-symbols-outlined cursor-pointer"
          style={{ fontSize: '20px', color: '#94a3b8', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
        >
          search
        </span>
        <span
          className="text-[10px] tracking-widest uppercase"
          style={{ color: '#94a3b8' }}
        >
          Search assets...
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <button
          className="material-symbols-outlined p-2 rounded-full transition-colors"
          style={{
            fontSize: '22px',
            color: '#000000',
            fontVariationSettings: "'FILL' 0, 'wght' 300",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#eff4ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          notifications
        </button>
        <button
          className="material-symbols-outlined p-2 rounded-full transition-colors"
          style={{
            fontSize: '22px',
            color: '#000000',
            fontVariationSettings: "'FILL' 0, 'wght' 300",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#eff4ff'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
        >
          account_circle
        </button>
      </div>
    </header>
  );
}
