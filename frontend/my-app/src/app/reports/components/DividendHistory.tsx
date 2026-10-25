export default function DividendHistory() {
  const dividends = [
    { ticker: 'AAPL', name: 'Apple Inc.', date: '15 Mar 2025', type: 'Dividend', amount: 4120 },
    { ticker: 'VOO', name: 'Vanguard S&P 500', date: '28 Feb 2025', type: 'Dividend', amount: 18200 },
    { ticker: 'SGB', name: 'SGB 2.5% 2031', date: '15 Feb 2025', type: 'Interest', amount: 6775 },
    { ticker: 'HDFC', name: 'HDFC Flexi Cap', date: '10 Jan 2025', type: 'IDCW Payout', amount: 9317 },
  ];

  const fmt = (n: number) => '₹' + n.toLocaleString('en-IN');

  return (
    <section className="bg-white rounded-xl glass-card-edge p-7 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Income Report
          </p>
          <h3 className="text-lg font-bold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Dividend & Interest History
          </h3>
        </div>
        <span className="text-lg font-extrabold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
          ₹38,412 <span className="text-sm font-medium text-slate-500">YTD</span>
        </span>
      </div>

      <div className="space-y-0">
        {dividends.map((d, i) => (
          <div
            key={i}
            className={`flex items-center justify-between px-2 py-3 ${
              i < dividends.length - 1 ? 'border-b border-slate-200/10' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#e5eeff] flex items-center justify-center text-[10px] font-extrabold text-slate-500">
                {d.ticker.substring(0, 3)}
              </div>
              <div>
                <p className="text-[13px] font-bold text-black">{d.name}</p>
                <p className="text-[11px] text-slate-500">{d.date}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#e6f1fb] text-[#185fa5]">{d.type}</span>
            <span className="text-[14px] font-extrabold text-[#3b6d11]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              +{fmt(d.amount)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
