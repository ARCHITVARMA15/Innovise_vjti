'use client';

export default function PortfolioTopNav() {
  return (
    <header
      className="w-full h-16 sticky top-0 z-40 flex justify-between items-center px-8"
      style={{
        backgroundColor: '#f8f9ff',
        borderBottom: '1px solid rgba(226,232,240,0.2)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* Page title + search */}
      <div className="flex items-center gap-8">
        <h1
          className="text-lg font-extrabold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Personal Portfolio
        </h1>
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ backgroundColor: '#eff4ff' }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '16px', color: '#94a3b8', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          >
            search
          </span>
          <span className="text-[11px] tracking-widest" style={{ color: '#94a3b8' }}>
            Search assets...
          </span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-5">
        <div className="relative cursor-pointer">
          <span
            className="material-symbols-outlined"
            style={{ fontSize: '22px', color: '#475569', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
          >
            notifications
          </span>
          <span
            className="absolute top-0 right-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: '#006591' }}
          />
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{
            backgroundColor: '#e2e8f0',
            color: '#334155',
            boxShadow: '0 0 0 2px #f8f9ff, 0 1px 4px rgba(11,28,48,0.1)',
          }}
        >
          AT
        </div>
      </div>
    </header>
  );
}
