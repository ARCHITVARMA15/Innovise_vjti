export default function TaxSummary() {
  return (
    <section className="bg-white rounded-xl glass-card-edge p-7 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            FY 2024–25
          </p>
          <h3 className="text-lg font-bold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Tax Liability Summary
          </h3>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 bg-[#e5eeff] px-3 py-1 rounded-full">
          Estimated · Not filing advice
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#eff4ff] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">STCG Tax (15%)</p>
          <p className="text-xl font-extrabold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            ₹28,400
          </p>
          <p className="text-[11px] text-slate-500 mt-1">On ₹1.89L gains (&lt;1yr)</p>
        </div>

        <div className="bg-[#eff4ff] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">LTCG Tax (10%)</p>
          <p className="text-xl font-extrabold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            ₹19,420
          </p>
          <p className="text-[11px] text-slate-500 mt-1">On ₹1.94L gains (&gt;1yr)</p>
        </div>

        <div className="bg-[#eff4ff] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Tax-Loss Offset</p>
          <p className="text-xl font-extrabold text-[#3b6d11]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            -₹12,600
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Saved via TLH strategy</p>
        </div>

        <div className="bg-[#eff4ff] rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1">Net Tax Due</p>
          <p className="text-xl font-extrabold text-[#ba1a1a]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            ₹35,220
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Advance tax by Mar 31</p>
        </div>
      </div>

      {/* TLH Opportunities */}
      <div className="bg-[#eff4ff] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-sm text-[#006591]">savings</span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#006591]">
            Tax-Loss Harvesting Opportunity
          </p>
        </div>
        <p className="text-sm text-slate-600">
          Selling <strong className="text-black">110 shares of TSLA</strong> at current price saves you{' '}
          <strong className="text-[#3b6d11]">₹42,000 in tax</strong> this year while maintaining market exposure via a
          correlated ETF.
        </p>
      </div>
    </section>
  );
}
