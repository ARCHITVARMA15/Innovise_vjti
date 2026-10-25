'use client';

import { useState } from 'react';
import StockSearchBar from '@/components/StockSearchBar';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

const RECOMMENDED_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corp.' },
  { symbol: 'NVDA', name: 'Nvidia Corp.' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'RELIANCE', name: 'Reliance Industries' }
];

export default function BuyAssetModal({ onClose, onSuccess }: Props) {
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [buyPrice, setBuyPrice] = useState<string>('');
  const [buyDate, setBuyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSelect = (ticker: string) => {
    setSelectedTicker(ticker);
  };

  const handleSubmit = async () => {
    if (!selectedTicker || !quantity || !buyPrice || !buyDate) return;
    setIsLoading(true);
    
    try {
      const res = await fetch(`http://localhost:8000/portfolio/holdings/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedTicker,
          quantity: parseFloat(quantity),
          avg_buy_price: parseFloat(buyPrice),
          buy_date: buyDate
        })
      });
      if (res.ok) {
        setIsSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1500);
      } else {
        console.error("Failed to buy asset");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl p-8 w-full max-w-xl shadow-2xl relative flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-extrabold text-[#0f172a]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Buy New Asset
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg text-[#64748b] hover:bg-[#f1f5f9] transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          {/* Step 1: Select Asset */}
          {!selectedTicker ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-[#64748b] mb-2 uppercase tracking-wider text-[10px] font-bold">Search Market</label>
                <div className="relative border border-[#e2e8f0] rounded-xl overflow-visible z-50 bg-[#f8fafc]">
                  <StockSearchBar onStockSelect={handleSelect} placeholder="Search ticker or company name..." />
                </div>
              </div>

              <div>
                <label className="block text-sm text-[#64748b] mb-3 uppercase tracking-wider text-[10px] font-bold">Recommended Picks</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {RECOMMENDED_STOCKS.map(stock => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleSelect(stock.symbol)}
                      className="text-left p-3 rounded-xl border border-[#e2e8f0] hover:border-[#006591] hover:bg-[#eff4ff] transition-all group"
                    >
                      <div className="font-bold text-[#0f172a] group-hover:text-[#006591]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                        {stock.symbol}
                      </div>
                      <div className="text-[10px] text-[#64748b] truncate mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {stock.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Step 2: Order Details */
            <div className="space-y-5 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              <div className="flex items-center justify-between p-4 bg-[#eff4ff] rounded-xl border border-[#bae6fd]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center font-bold text-[#006591] text-xs shadow-sm">
                    {selectedTicker}
                  </div>
                  <div>
                    <div className="font-bold text-[#0f172a] text-sm">{selectedTicker}</div>
                    <div className="text-[10px] tracking-wider uppercase text-[#006591]">Selected Asset</div>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedTicker(null)}
                  className="text-xs font-bold text-[#64748b] hover:text-[#0f172a] underline underline-offset-2"
                >
                  Change
                </button>
              </div>

              <div>
                <label className="block text-sm text-[#64748b] mb-1.5 uppercase tracking-wider text-[10px] font-bold">Quantity / Shares</label>
                <input 
                  type="number" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006591] transition-all" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#64748b] mb-1.5 uppercase tracking-wider text-[10px] font-bold">Avg. Buy Price ($)</label>
                  <input 
                    type="number"
                    value={buyPrice}
                    onChange={(e) => setBuyPrice(e.target.value)}
                    placeholder="e.g. 150.00"
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006591] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#64748b] mb-1.5 uppercase tracking-wider text-[10px] font-bold">Date of Purchase</label>
                  <input 
                    type="date" 
                    value={buyDate}
                    onChange={(e) => setBuyDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006591] transition-all" 
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedTicker && (
          <div className="mt-8 pt-6 border-t border-[#f1f5f9] flex gap-4 shrink-0">
            <button 
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 rounded-xl font-bold transition-all bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0f172a]"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              Cancel
            </button>
            <button 
              onClick={handleSubmit}
              disabled={isLoading || isSuccess || !quantity || !buyPrice || !buyDate}
              className={`flex-1 py-3 rounded-xl font-bold transition-all text-white shadow-lg flex justify-center items-center ${
                isSuccess 
                  ? 'bg-gradient-to-r from-[#009668] to-[#00b27b] shadow-[#009668]/30 scale-[1.02]' 
                  : 'bg-[#009668] hover:bg-[#007a55] shadow-[#009668]/20 disabled:opacity-50'
              }`}
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isSuccess ? (
                <span className="flex items-center gap-2">Order Executed <span className="material-symbols-outlined text-[18px]">check_circle</span></span>
              ) : (
                'Execute Order'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
