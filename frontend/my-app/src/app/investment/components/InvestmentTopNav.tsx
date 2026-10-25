'use client';

export default function InvestmentTopNav() {
  return (
    <header
      className="w-full h-16 sticky top-0 z-40 flex justify-between items-center px-8"
      style={{
        backgroundColor: '#f8f9ff',
        borderBottom: '1px solid rgba(226,232,240,0.2)',
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
          Search Assets...
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-6">
        {/* Notification bell */}
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

        {/* User avatar + name */}
        <div className="flex items-center gap-3 cursor-pointer">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: '#e2e8f0',
              color: '#334155',
              boxShadow: '0 0 0 2px #ffffff, 0 1px 4px rgba(11,28,48,0.1)',
            }}
          >
            AT
          </div>
          <span
            className="font-semibold text-sm tracking-tight"
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Alexander Thorne
          </span>
        </div>
      </div>
    </header>
  );
}
