export default function ClosedPositions() {
  const closed = [
    { name: 'Tesla Inc.', ticker: 'TSLA', type: 'equity', buyPrice: 215.0, buyDate: '5 Jan 2024', sellPrice: 176.54, sellDate: '18 Mar 2025', qty: 110 },
    { name: 'Reliance Ind.', ticker: 'RELI', type: 'equity', buyPrice: 2340, buyDate: '12 Jul 2022', sellPrice: 2980, sellDate: '10 Jan 2025', qty: 50 },
    { name: 'Parag Parikh FoF', ticker: 'PPFAS', type: 'mf', buyPrice: 52.4, buyDate: '1 Sep 2022', sellPrice: 74.1, sellDate: '28 Feb 2025', qty: 800 },
    { name: 'Nifty BeES ETF', ticker: 'NBEES', type: 'etf', buyPrice: 198.4, buyDate: '3 Mar 2022', sellPrice: 245.8, sellDate: '15 Dec 2024', qty: 500 },
  ];

  const typeLabels: Record<string, string> = { equity: 'Stock', etf: 'ETF', mf: 'MF' };
  const typeBadges: Record<string, string> = {
    equity: 'bg-[#f1efe8] text-[#5f5e5a]',
    etf: 'bg-[#f1efe8] text-[#5f5e5a]',
    mf: 'bg-[#faeeda] text-[#854f0b]',
  };

  const fmt = (n: number) => '₹' + Math.abs(n).toLocaleString('en-IN');

  return (
    <section>
      <div className="inline-flex items-center gap-2 bg-[#131b2e] text-white text-[10px] font-extrabold tracking-[.08em] uppercase px-3.5 py-1 rounded-full mb-4">
        <span className="material-symbols-outlined text-sm text-slate-400">history</span>
        Closed Positions
      </div>

      <div className="bg-white rounded-xl glass-card-edge shadow-[0_24px_40px_rgba(11,28,48,0.05)] overflow-hidden">
        <div className="grid grid-cols-12 px-6 py-3 bg-[#eff4ff] text-[10px] uppercase tracking-widest font-bold text-slate-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          <div className="col-span-3">Asset</div>
          <div className="col-span-1 text-right">Type</div>
          <div className="col-span-1 text-right">Buy Price</div>
          <div className="col-span-1 text-right">Buy Date</div>
          <div className="col-span-1 text-right">Sell Price</div>
          <div className="col-span-1 text-right">Sell Date</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-1 text-right">Invested</div>
          <div className="col-span-1 text-right">P&L</div>
          <div className="col-span-1 text-right">XIRR</div>
        </div>

        {closed.map((c, i) => {
          const invested = c.buyPrice * c.qty;
          const proceeds = c.sellPrice * c.qty;
          const pl = proceeds - invested;
          const plPct = ((c.sellPrice - c.buyPrice) / c.buyPrice) * 100;
          const isUp = pl >= 0;
          const xirr = 18.4; // Simplified

          return (
            <div
              key={c.ticker}
              className={`grid grid-cols-12 px-6 py-4 hover:bg-[#eff4ff] transition-all ${
                i < closed.length - 1 ? 'border-b border-slate-200/10' : ''
              }`}
            >
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#eff4ff] flex items-center justify-center text-[10px] font-extrabold text-slate-400" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {c.ticker.substring(0, 3)}
                </div>
                <div>
                  <p className="text-[13px] font-bold text-slate-500">{c.name}</p>
                  <p className="text-[11px] text-slate-400">{c.ticker}</p>
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-end">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeBadges[c.type]}`}>
                  {typeLabels[c.type]}
                </span>
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[13px] text-slate-500">
                {fmt(c.buyPrice)}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[11px] text-slate-400">
                {c.buyDate}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[13px] text-slate-500">
                {fmt(c.sellPrice)}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[11px] text-slate-400">
                {c.sellDate}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[13px] text-slate-500">
                {c.qty.toLocaleString()}
              </div>
              <div className="col-span-1 text-right flex items-center justify-end text-[12px] text-slate-500">
                {fmt(invested)}
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
              <div className={`col-span-1 text-right flex items-center justify-end text-[12px] font-bold ${isUp ? 'text-[#006591]' : 'text-[#ba1a1a]'}`}>
                {isUp ? '+' : ''}
                {xirr}%
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
