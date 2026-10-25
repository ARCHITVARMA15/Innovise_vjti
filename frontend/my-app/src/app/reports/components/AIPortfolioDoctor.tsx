export default function AIPortfolioDoctor() {
  return (
    <section className="bg-[#131b2e] rounded-xl p-7 shadow-[0_24px_40px_rgba(11,28,48,0.05)] text-white">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/50 mb-1">AI Analysis</p>
          <h3 className="text-xl font-extrabold" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Portfolio Doctor Report
          </h3>
          <p className="text-white/60 text-sm mt-1">Based on your current holdings, market conditions & SEBI norms</p>
        </div>
        <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-[#4edea3] text-[#002113] uppercase tracking-wider">
          Score 72 / 100
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#ffdad6]">warning</span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Critical</p>
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-[#ffdad6] mt-0.5">•</span>Tech sector overweight by 18% vs target
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#ffdad6] mt-0.5">•</span>Fixed income underweight — rate risk exposure high
            </li>
          </ul>
        </div>

        <div className="bg-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#4edea3]">check_circle</span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Strengths</p>
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-[#4edea3] mt-0.5">•</span>Excellent diversification across 4 asset classes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#4edea3] mt-0.5">•</span>XIRR 18.4% beats Nifty 50 by 4.2%
            </li>
          </ul>
        </div>

        <div className="bg-white/10 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[#39b8fd]">medication</span>
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">Prescriptions</p>
          </div>
          <ul className="space-y-2 text-sm text-white/80">
            <li className="flex items-start gap-2">
              <span className="text-[#39b8fd] mt-0.5">→</span>Buy 2 units LIQUIDBEES (₹8,000)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#39b8fd] mt-0.5">→</span>Trim HDFCBANK by 8% before Apr 5 RBI policy
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
