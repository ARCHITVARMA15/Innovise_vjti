export default function SectorExposure() {
  const sectors = [
    { name: 'Technology', pct: 42, color: 'bg-[#131b2e]' },
    { name: 'Financials', pct: 18, color: 'bg-[#006591]' },
    { name: 'Healthcare', pct: 12, color: 'bg-[#39b8fd]' },
    { name: 'Energy', pct: 10, color: 'bg-[#4edea3]' },
    { name: 'Real Estate', pct: 8, color: 'bg-[#cbdbf5]' },
    { name: 'Others', pct: 10, color: 'bg-[#c6c6cd]' },
  ];

  return (
    <div className="bg-white rounded-xl glass-card-edge p-7 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
        Concentration Risk
      </p>
      <h3 className="text-lg font-bold text-black mb-5" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Sector Exposure
      </h3>
      <div className="space-y-3">
        {sectors.map((s) => {
          const warn = s.pct > 35;
          return (
            <div key={s.name}>
              <div className="flex justify-between mb-1">
                <span className="text-[12px] font-medium text-black flex items-center gap-1">
                  {warn && <span className="material-symbols-outlined text-amber-500 text-sm">warning</span>}
                  {s.name}
                </span>
                <span className={`text-[12px] font-bold ${warn ? 'text-amber-600' : 'text-black'}`}>{s.pct}%</span>
              </div>
              <div className="h-2 w-full bg-[#e5eeff] rounded-full overflow-hidden">
                <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${s.pct}%` }}></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
