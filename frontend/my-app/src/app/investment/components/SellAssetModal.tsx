'use client';

import { useState } from 'react';

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  costBasis: number;
}

interface Props {
  holdings: Holding[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function SellAssetModal({ holdings, onClose, onSuccess }: Props) {
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successSymbol, setSuccessSymbol] = useState<string | null>(null);

  const handleSell = async (symbol: string) => {
    setIsDeleting(true);
    setSellingSymbol(symbol);
    try {
      const res = await fetch(`http://localhost:8000/portfolio/holdings/remove/${symbol}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setSuccessSymbol(symbol);
        setIsDeleting(false); // Stop spinning immediately
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        console.error("Failed to sell asset");
      }
    } catch (err) {
      console.error(err);
      setIsDeleting(false);
      setSellingSymbol(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-extrabold text-[#0f172a]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Sell Active Holding
            </h2>
            <p className="text-sm text-[#64748b] mt-1" style={{ fontFamily: 'Inter, sans-serif' }}>
              Select an asset below to liquidate your position and remove it from your portfolio.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition-colors self-start border border-transparent hover:border-[#e2e8f0]">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-3">
          {holdings.length === 0 ? (
            <div className="text-center py-12 text-[#64748b]">
              <span className="material-symbols-outlined text-4xl mb-3 opacity-50">inventory_2</span>
              <p>You have no active holdings to sell.</p>
            </div>
          ) : (
            holdings.map(holding => (
              <div 
                key={holding.ticker}
                className="flex items-center justify-between p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-xl hover:bg-[#fff0f2] hover:border-[#fda4af] transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-lg border border-[#e2e8f0] flex items-center justify-center font-bold text-[#ba1a1a] shadow-sm">
                    {holding.ticker}
                  </div>
                  <div>
                    <div className="font-bold text-[#0f172a] text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      {holding.ticker}
                    </div>
                    <div className="text-xs text-[#64748b]" style={{ fontFamily: 'Inter, sans-serif' }}>
                      {holding.shares} Shares @ ${holding.costBasis.toLocaleString()}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleSell(holding.ticker)}
                  disabled={isDeleting || successSymbol !== null}
                  className={`px-5 py-2.5 font-bold rounded-lg transition-all shadow-sm text-sm flex items-center shrink-0 disabled:opacity-50 ${
                    successSymbol === holding.ticker
                      ? 'bg-gradient-to-r from-[#ba1a1a] to-[#e43a3a] text-white border-transparent scale-[1.02]'
                      : 'bg-white border border-[#fda4af] text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white group-hover:shadow-md'
                  }`}
                  style={{ fontFamily: 'Manrope, sans-serif' }}
                >
                  {isDeleting && sellingSymbol === holding.ticker ? (
                    <div className="w-4 h-4 border-2 border-[#ba1a1a]/30 border-t-[#ba1a1a] rounded-full animate-spin" />
                  ) : successSymbol === holding.ticker ? (
                    <span className="flex items-center gap-1.5">Liquidated <span className="material-symbols-outlined text-[16px]">check_circle</span></span>
                  ) : (
                    'Liquidate'
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
