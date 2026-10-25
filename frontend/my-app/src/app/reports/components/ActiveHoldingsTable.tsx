'use client';

export default function ActiveHoldingsTable() {
  const holdings = [
    { name: 'Apple Inc.', ticker: 'AAPL', type: 'equity', buyPrice: 162.40, buyDate: '12 Jan 2024', qty: 450, current: 194.22 },
    { name: 'Vanguard S&P 500', ticker: 'VOO', type: 'etf', buyPrice: 380.15, buyDate: '3 Mar 2023', qty: 820, current: 432.10 },
    { name: 'NVIDIA Corp', ticker: 'NVDA', type: 'equity', buyPrice: 320.00, buyDate: '8 Aug 2023', qty: 200, current: 875.28 },
    { name: 'HDFC Flexi Cap', ticker: 'HDFC', type: 'mf', buyPrice: 48.20, buyDate: '1 Apr 2023', qty: 1200, current: 58.40 },
    { name: 'SGB 2.5% 2031', ticker: 'SGB', type: 'bond', buyPrice: 5420, buyDate: '15 Nov 2022', qty: 10, current: 5890 },
    { name: 'Microsoft Corp', ticker: 'MSFT', type: 'equity', buyPrice: 310.00, buyDate: '22 Feb 2024', qty: 180, current: 415.10 },
    { name: 'Bitcoin', ticker: 'BTC', type: 'crypto', buyPrice: 42000, buyDate: '10 Oct 2023', qty: 0.5, current: 68432 },
  ];

  const typeLabels: Record<string, string> = {
    equity: 'Stock',
    etf: 'ETF',
    mf: 'MF',
    bond: 'Bond',
    crypto: 'Crypto',
  };

  const typeBadges: Record<string, string> = {
    equity: 'bg-[#e6f1fb] text-[#185fa5]',
    etf: 'bg-[#e6f1fb] text-[#185fa5]',
    mf: 'bg-[#faeeda] text-[#854f0b]',
    bond: 'bg-[#eeedfe] text-[#534ab7]',
    crypto: 'bg-[#fbeaf0] text-[#993556]',
  };

  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN');

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 bg-[#131b2e] text-white text-[10px] font-extrabold tracking-[.08em] uppercase px-3.5 py-1 rounded-full">
          <span className="material-symbols-outlined text-sm text-[#4edea3]">radio_button_checked</span>
          Active Holdings
        </div>
        <div className="flex gap-2">
          <button className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#eff4ff] text-slate-500 hover:bg-[#e5eeff] flex items-center gap-1 transition-all">
            <span className="material-symbols-outlined text-sm">filter_list</span> Filter
          </button>
          <button className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-[#eff4ff] text-slate-500 hover:bg-[#e5eeff] flex items-center gap-1 transition-all">
            <span className="material-symbols-outlined text-sm">swap_vert</span> Sort
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl glass-card-edge shadow-[0_24px_40px_rgba(11,28,48,0.05)] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 px-6 py-3 bg-[#eff4ff] text-[10px] uppercase tracking-widest font-bold text-slate-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          <div className="col-span-3">Asset</div>
          <div className="col-span-1 text-right">Type</div>
          <div className="col-span-1 text-right">Buy Price</div>
          <div className="col-span-1 text-right">Buy Date</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-1 text-right">Current</div>
          <div className="col-span-1 text-right">Invested</div>
          <div className="col-span-1 text-right">Mkt Value</div>
          <div className="col-span-1 text-right">P&L</div>
          <div className="col-span-1 text-right">Trend</div>
        </div>

        {/* Holding rows */}
        {holdings.map((h, i) => {
          const invested = h.buyPrice * h.qty;
          const mktVal = h.current * h.qty;
          const pl = mktVal - invested;
          const plPct = ((h.current - h.buyPrice) / h.buyPrice) * 100;
          const isUp = pl >= 0;

          return (
            <div
              key={h.ticker}
              className={`grid grid-cols-12 px-6 py-4 hover:bg-[#eff4ff] transition-all ${
                i < holdings.length - 1 ? 'border-b border-slate-200/10' : ''
              }`}
            >
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#e5eeff] flex items-center justify-center text-[10px] font-extrabold text-slate-500" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {h.ticker.substring(0, 3)}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-black">{h.name}</p>
                  <p className="text-[11px] text-slate-500">{h.ticker}</p>
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeBadges[h.type]}`}>
                  {typeLabels[h.type]}
                </span>
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[13px] font-medium text-black">
                {fmt(h.buyPrice)}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[11px] text-slate-500">
                {h.buyDate}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[13px] font-medium text-black">
                {h.qty.toLocaleString()}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[13px] font-medium text-black">
                {fmt(h.current)}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[12px] text-slate-500">
                {fmt(invested)}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[12px] font-bold text-black">
                {fmt(mktVal)}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end flex-col">
                <span className={`${isUp ? 'text-[#3b6d11]' : 'text-[#ba1a1a]'} font-bold text-[12px]`}>
                  {isUp ? '+' : '-'}
                  {fmt(Math.abs(pl))}
                </span>
                <span className={`text-[10px] ${isUp ? 'text-[#3b6d11]' : 'text-[#ba1a1a]'}`}>
                  {isUp ? '+' : ''}
                  {plPct.toFixed(2)}%
                </span>
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <svg className="w-20 h-7" viewBox="0 0 80 28" fill="none">
                  <polyline
                    points={isUp ? '0,22 15,18 30,20 45,12 60,8 80,4' : '0,6 15,10 30,8 45,16 60,20 80,24'}
                    stroke={isUp ? '#4edea3' : '#f87171'}
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
