'use client';

const tickers = [
  { symbol: 'AAPL', price: '182.52', change: '+0.4%', color: '#00e5cc' },
  { symbol: 'MSFT', price: '415.10', change: '-0.2%', color: '#ef4444' },
  { symbol: 'AMZN', price: '178.22', change: '+1.1%', color: '#00e5cc' },
  { symbol: 'GOOGL', price: '152.45', change: '+0.8%', color: '#00e5cc' },
  { symbol: 'META', price: '484.03', change: '-1.4%', color: '#ef4444' },
  { symbol: 'TSLA', price: '175.66', change: '+2.3%', color: '#00e5cc' },
  { symbol: 'BTC/USD', price: '67,432.12', change: '+5.4%', color: '#C9A84C' },
];

export default function TickerTape() {
  return (
    <div
      className="w-full border-y py-3 overflow-hidden whitespace-nowrap z-20 relative"
      style={{ backgroundColor: 'rgba(5,8,16,0.8)', borderColor: 'rgba(255,255,255,0.05)' }}
    >
      <div className="ticker-scroll">
        {[...Array(2)].map((_, dupIdx) => (
          <div key={dupIdx} className="flex gap-12 px-6 items-center">
            {tickers.map((t, i) => (
              <span key={i} className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-dm-mono)' }}>
                {t.symbol}{' '}
                <span style={{ color: t.color }}>
                  {t.price} {t.change}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
