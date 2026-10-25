'use client';

export default function TopNav() {
  return (
    <header
      className="w-full sticky top-0 z-40 h-16 px-8 flex justify-between items-center"
      style={{
        backgroundColor: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(11,28,48,0.05)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Left: Brand + Search */}
      <div className="flex items-center gap-8 flex-1">
        <span
          className="text-2xl font-bold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Veritas Ledger
        </span>

        <div className="relative w-full max-w-md">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            style={{ fontSize: '18px', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          >
            search
          </span>
          <input
            className="w-full rounded-lg pl-10 pr-4 py-2 text-sm placeholder-slate-400 outline-none"
            placeholder="Search markets, news, research..."
            type="text"
            style={{
              backgroundColor: '#eff4ff',
              color: '#0b1c30',
              fontFamily: 'Inter, sans-serif',
              border: 'none',
            }}
            onFocus={e => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = '0 0 0 2px rgba(0,101,145,0.3)';
            }}
            onBlur={e => {
              (e.currentTarget as HTMLInputElement).style.boxShadow = 'none';
            }}
          />
        </div>
      </div>

      {/* Right: Actions + Avatar */}
      <div className="flex items-center gap-3">
        {['notifications', 'settings'].map(icon => (
          <button
            key={icon}
            className="p-2 rounded-full transition-colors"
            style={{ color: '#64748b' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(241,245,249,0.8)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '22px', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              {icon}
            </span>
          </button>
        ))}

        {/* Avatar placeholder */}
        <div
          className="h-8 w-8 rounded-full ml-1 flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: '#e2e8f0',
            color: '#334155',
            boxShadow: '0 0 0 2px #ffffff, 0 1px 4px rgba(11,28,48,0.1)',
          }}
        >
          EQ
        </div>
      </div>
    </header>
  );
}
