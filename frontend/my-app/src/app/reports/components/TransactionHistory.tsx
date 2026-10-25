'use client';

interface Transaction {
  id: string;
  type: 'buy' | 'sell' | 'dividend';
  symbol: string;
  name?: string;
  quantity?: number;
  price?: number;
  total_amount?: number;
  amount?: number;
  timestamp: string;
  date: string;
  time: string;
}

interface Props {
  transactions: Transaction[];
}

export default function TransactionHistory({ transactions }: Props) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    return `${hours}:${minutes}`;
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'buy':
        return { bg: 'bg-[#e5f6f0]', text: 'text-[#009668]', label: 'BUY' };
      case 'sell':
        return { bg: 'bg-[#fde8e8]', text: 'text-[#ba1a1a]', label: 'SELL' };
      case 'dividend':
        return { bg: 'bg-[#eff4ff]', text: 'text-[#006591]', label: 'DIVIDEND' };
      default:
        return { bg: 'bg-[#f1f5f9]', text: 'text-[#64748b]', label: type.toUpperCase() };
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 bg-[#131b2e] text-white text-[10px] font-extrabold tracking-[.08em] uppercase px-3.5 py-1 rounded-full">
          <span className="material-symbols-outlined text-sm text-[#4edea3]">receipt_long</span>
          Transaction History
        </div>
        <div className="text-[11px] text-slate-500 font-medium">
          Showing all {transactions.length} transactions
        </div>
      </div>

      <div className="bg-white rounded-xl glass-card-edge shadow-[0_24px_40px_rgba(11,28,48,0.05)] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-12 px-6 py-3 bg-[#eff4ff] text-[10px] uppercase tracking-widest font-bold text-slate-500" style={{ fontFamily: 'Inter, sans-serif' }}>
          <div className="col-span-1">Type</div>
          <div className="col-span-3">Stock</div>
          <div className="col-span-2">Date & Time</div>
          <div className="col-span-2 text-right">Quantity</div>
          <div className="col-span-2 text-right">Price</div>
          <div className="col-span-2 text-right">Total Amount</div>
        </div>

        {/* Transaction rows */}
        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-slate-500">
            <span className="material-symbols-outlined text-4xl mb-2 block">receipt</span>
            <p className="text-sm">No transactions found</p>
          </div>
        ) : (
          transactions.map((txn, i) => {
            const typeStyle = getTypeStyle(txn.type);
            const stockName = txn.name || txn.symbol.replace('.NS', '');
            const isLast = i === transactions.length - 1;

            return (
              <div
                key={txn.id}
                className={`grid grid-cols-12 px-6 py-4 hover:bg-[#eff4ff] transition-all ${
                  !isLast ? 'border-b border-slate-200/10' : ''
                }`}
              >
                {/* Type Badge */}
                <div className="col-span-1 flex items-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}>
                    {typeStyle.label}
                  </span>
                </div>

                {/* Stock Name & Symbol */}
                <div className="col-span-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#e5eeff] flex items-center justify-center text-[10px] font-extrabold text-slate-500" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {txn.symbol.substring(0, 3)}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-black">{stockName}</p>
                    <p className="text-[11px] text-slate-500">{txn.symbol}</p>
                  </div>
                </div>

                {/* Date & Time */}
                <div className="col-span-2 flex items-center">
                  <div>
                    <p className="text-[12px] font-medium text-black">{formatDate(txn.date || txn.timestamp)}</p>
                    <p className="text-[10px] text-slate-500">{formatTime(txn.time || '')}</p>
                  </div>
                </div>

                {/* Quantity */}
                <div className="col-span-2 text-right flex items-center justify-end text-[13px] font-medium text-black">
                  {txn.quantity ? txn.quantity.toLocaleString('en-IN') : '—'}
                </div>

                {/* Price */}
                <div className="col-span-2 text-right flex items-center justify-end text-[13px] font-medium text-black">
                  {txn.price ? `₹${txn.price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </div>

                {/* Total Amount */}
                <div className="col-span-2 text-right flex items-center justify-end">
                  <span className={`text-[14px] font-bold ${
                    txn.type === 'buy' ? 'text-[#009668]' : 
                    txn.type === 'sell' ? 'text-[#ba1a1a]' : 
                    'text-[#006591]'
                  }`} style={{ fontFamily: 'Manrope, sans-serif' }}>
                    {txn.type === 'sell' && '-'}
                    {txn.type === 'buy' && '+'}
                    ₹{(txn.total_amount || txn.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
