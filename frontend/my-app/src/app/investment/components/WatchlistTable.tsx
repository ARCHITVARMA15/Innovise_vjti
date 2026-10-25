'use client';

import { useState, useEffect } from 'react';
import StockSearchBar from '@/components/StockSearchBar';

interface UnifiedHolding {
  symbol: string;
  quantity: number;
  avg_buy_price: number;
  current_price: number;
  current_value: number;
  invested_value: number;
  pnl_percent: number;
  buy_date: string;
  sell_date: string;
  status: string;
}

export default function WatchlistTable() {
  const [isLoading, setIsLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  
  // Modal State
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [buyDate, setBuyDate] = useState<string>('');
  const [sellDate, setSellDate] = useState<string>('');

  const [watchlist, setWatchlist] = useState<UnifiedHolding[]>([]);

  const fetchWatchlistData = async () => {
    try {
      const res = await fetch('http://localhost:8000/portfolio/unified-investments');
      const data = await res.json();
      setWatchlist(data.watchlist || []);
    } catch (err) {
      console.error("Failed to fetch watchlist", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlistData();
  }, []);

  const handleStockSelect = (ticker: string) => {
    setSelectedTicker(ticker);
    setShowSearch(false);
    // Reset form
    setQuantity('');
    setBuyDate(new Date().toISOString().split('T')[0]);
    setSellDate('');
  };

  const submitWatchlistDetails = async () => {
    if (!selectedTicker) return;
    setIsLoading(true);
    setSelectedTicker(null);
    try {
      await fetch(`http://localhost:8000/portfolio/watchlist/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selectedTicker,
          quantity: quantity ? parseFloat(quantity) : 0,
          buy_date: buyDate || null,
          sell_date: sellDate || null
        })
      });
      await fetchWatchlistData();
    } catch (err) {
      console.error("Failed to add to watchlist", err);
      setIsLoading(false);
    }
  };

  return (
    <section className="space-y-6 mt-12">
      <div className="flex justify-between items-center">
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Watchlist
        </h3>
        
        <div className="relative">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-sm font-bold flex items-center gap-2 transition-all hover:opacity-80 px-4 py-2 rounded-lg"
            style={{ backgroundColor: '#131b2e', color: '#fff', fontFamily: 'Manrope, sans-serif' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
              {showSearch ? 'close' : 'add'}
            </span>
            {showSearch ? 'Cancel' : 'Add to Watchlist'}
          </button>
          
          {showSearch && (
            <div className="absolute right-0 top-full mt-2 w-80 z-50">
              <StockSearchBar 
                onStockSelect={handleStockSelect} 
                placeholder="Search symbol to watch..."
              />
            </div>
          )}
        </div>
      </div>

      {selectedTicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1c30]/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold mb-6 text-[#0f172a]" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Track {selectedTicker}
            </h2>
            
            <div className="space-y-4 font-medium" style={{ fontFamily: 'Inter, sans-serif' }}>
              <div>
                <label className="block text-sm text-[#64748b] mb-1 uppercase tracking-wider text-[10px] font-bold">Quantity / Shares</label>
                <input 
                  type="number" 
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006591] transition-all" 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#64748b] mb-1 uppercase tracking-wider text-[10px] font-bold">Buy Date</label>
                  <input 
                    type="date"
                    value={buyDate}
                    onChange={(e) => setBuyDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006591] transition-all" 
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#64748b] mb-1 uppercase tracking-wider text-[10px] font-bold">Sell Date (Optional)</label>
                  <input 
                    type="date" 
                    value={sellDate}
                    onChange={(e) => setSellDate(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-[#e2e8f0] px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#006591] transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button 
                onClick={() => setSelectedTicker(null)}
                className="flex-1 py-3 rounded-xl font-bold transition-all bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#0f172a]"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Cancel
              </button>
              <button 
                onClick={submitWatchlistDetails}
                className="flex-1 py-3 rounded-xl font-bold transition-all bg-[#006591] hover:bg-[#004666] text-white shadow-lg shadow-[#006591]/20"
                style={{ fontFamily: 'Manrope, sans-serif' }}
              >
                Start Tracking
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className="rounded-xl overflow-hidden min-h-[300px] relative"
        style={{ backgroundColor: '#ffffff', boxShadow: '24px 0 40px rgba(11,28,48,0.03)' }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
            <div className="w-8 h-8 border-4 border-[#006591]/20 border-t-[#006591] rounded-full animate-spin" />
          </div>
        ) : null}

        <table className="w-full text-left border-collapse">
          <thead>
            <tr style={{ backgroundColor: '#eff4ff' }}>
              {['Ticker / Asset', 'Shares', 'Added On', 'Status', 'Price', 'Market Value', 'Return %'].map(
                (col, i) => (
                  <th
                    key={col}
                    className={`py-5 px-6 text-[10px] tracking-widest uppercase font-bold ${
                      i === 0 ? '' : 'text-right'
                    }`}
                    style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                  >
                    {col}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {watchlist.length === 0 && !isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400 font-medium">
                  Your watchlist is empty.
                </td>
              </tr>
            ) : null}

            {watchlist.map((h, i) => {
              const isPositive = h.pnl_percent >= 0;
              return (
                <tr
                  key={h.symbol}
                  className="transition-colors"
                  style={{ borderTop: i > 0 ? '1px solid #f1f5f9' : 'none' }}
                  onMouseEnter={e =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(239,244,255,0.6)')
                  }
                  onMouseLeave={e =>
                    ((e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent')
                  }
                >
                  <td className="py-5 px-6">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs"
                        style={{
                          backgroundColor: '#e5eeff',
                          color: '#000000',
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {h.symbol}
                      </div>
                      <div>
                        <div
                          className="font-bold text-sm"
                          style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                        >
                          {h.symbol}
                        </div>
                        <div
                          className="text-[10px] tracking-wider uppercase"
                          style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                        >
                          WATCHING
                        </div>
                      </div>
                    </div>
                  </td>

                  <td
                    className="py-5 px-6 text-right font-medium text-sm"
                    style={{ color: '#0b1c30', fontFamily: 'Inter, sans-serif' }}
                  >
                    {h.quantity === 0 ? '—' : h.quantity.toFixed(2)}
                  </td>

                  <td
                    className="py-5 px-6 text-right font-medium text-sm"
                    style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                  >
                    {h.buy_date}
                  </td>

                  <td
                    className="py-5 px-6 text-right font-medium text-sm text-[10px] tracking-wider"
                    style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
                  >
                    {h.sell_date}
                  </td>

                  <td
                    className="py-5 px-6 text-right font-bold text-sm"
                    style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                  >
                    ${h.current_price.toFixed(2)}
                  </td>

                  <td
                    className="py-5 px-6 text-right font-bold text-sm"
                    style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                  >
                    {h.current_value === 0 ? '—' : `$${h.current_value.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </td>

                  <td className="py-5 px-6 text-right">
                    <span
                      className="font-bold text-sm"
                      style={{ color: h.quantity === 0 ? '#94a3b8' : (isPositive ? '#009668' : '#ba1a1a') }}
                    >
                      {h.quantity === 0 ? '—' : `${isPositive ? '+' : ''}${h.pnl_percent.toFixed(1)}%`}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
