export default function AssetAllocation() {
  return (
    <div className="bg-white rounded-xl glass-card-edge p-7 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
        Allocation Breakdown
      </p>
      <h3 className="text-lg font-bold text-black mb-6" style={{ fontFamily: 'Manrope, sans-serif' }}>
        Asset Class Distribution
      </h3>
      <div className="flex items-center gap-8">
        <svg width="130" height="130" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r="52" fill="none" stroke="#eff4ff" strokeWidth="20" />
          {/* Equity 55% */}
          <circle
            cx="65"
            cy="65"
            r="52"
            fill="none"
            stroke="#131b2e"
            strokeWidth="20"
            strokeDasharray="179.6 326.7"
            strokeDashoffset="81.7"
            transform="rotate(-90 65 65)"
          />
          {/* MF 20% */}
          <circle
            cx="65"
            cy="65"
            r="52"
            fill="none"
            stroke="#006591"
            strokeWidth="20"
            strokeDasharray="65.3 441"
            strokeDashoffset="-97.9"
            transform="rotate(-90 65 65)"
          />
          {/* Bonds 15% */}
          <circle
            cx="65"
            cy="65"
            r="52"
            fill="none"
            stroke="#39b8fd"
            strokeWidth="20"
            strokeDasharray="49 457.3"
            strokeDashoffset="-163.2"
            transform="rotate(-90 65 65)"
          />
          {/* Crypto 10% */}
          <circle
            cx="65"
            cy="65"
            r="52"
            fill="none"
            stroke="#4edea3"
            strokeWidth="20"
            strokeDasharray="32.7 473.6"
            strokeDashoffset="-212.2"
            transform="rotate(-90 65 65)"
          />
          <text x="65" y="61" textAnchor="middle" fontFamily="Manrope" fontWeight="800" fontSize="16" fill="#0b1c30">
            55%
          </text>
          <text x="65" y="76" textAnchor="middle" fontFamily="Inter" fontSize="9" fill="#76777d">
            EQUITY
          </text>
        </svg>
        <div className="space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#131b2e] inline-block"></span>
              <span className="text-[12px] font-medium text-black">Equities</span>
            </div>
            <span className="text-[12px] font-bold text-black">55% · ₹23.57L</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#006591] inline-block"></span>
              <span className="text-[12px] font-medium text-black">Mutual Funds</span>
            </div>
            <span className="text-[12px] font-bold text-black">20% · ₹8.57L</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#39b8fd] inline-block"></span>
              <span className="text-[12px] font-medium text-black">Bonds</span>
            </div>
            <span className="text-[12px] font-bold text-black">15% · ₹6.43L</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4edea3] inline-block"></span>
              <span className="text-[12px] font-medium text-black">Crypto</span>
            </div>
            <span className="text-[12px] font-bold text-black">10% · ₹4.29L</span>
          </div>
        </div>
      </div>
    </div>
  );
}
