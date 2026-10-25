import { apiFetch, REVALIDATE } from '@/lib/api/client';
import ReportsHero from './components/ReportsHero';
import PLCalendar from './components/PLCalendar';
import ActiveHoldingsTable from './components/ActiveHoldingsTable';
import AssetAllocation from './components/AssetAllocation';
import SectorExposure from './components/SectorExposure';
import TaxSummary from './components/TaxSummary';
import DividendHistory from './components/DividendHistory';
import ClosedPositions from './components/ClosedPositions';
import AIPortfolioDoctor from './components/AIPortfolioDoctor';
import TransactionHistory from './components/TransactionHistory';

async function getTransactions() {
  try {
    const transactions = await apiFetch<any[]>('/portfolio/activity?limit=100', { revalidate: REVALIDATE.LIVE });
    return transactions || [];
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

export default async function ReportsPage() {
  const transactions = await getTransactions();
  return (
    <main className="p-8 space-y-10 max-w-7xl mx-auto w-full">
      {/* Page Header */}
      <ReportsHero />

      {/* Summary KPI Row */}
      <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-xl glass-card-edge p-5 shadow-[0_24px_40px_rgba(11,28,48,0.05)] lg:col-span-2">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Total Portfolio Value
          </p>
          <p className="text-3xl font-extrabold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            ₹42,85,190
          </p>
          <span className="inline-flex items-center gap-1 bg-[#4edea3] text-[#002113] text-xs font-bold px-2 py-0.5 rounded mt-2">
            <span className="material-symbols-outlined text-sm">trending_up</span>+12.4% overall
          </span>
        </div>
        
        <div className="bg-white rounded-xl glass-card-edge p-5 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Realised P&L
          </p>
          <p className="text-2xl font-extrabold text-[#3b6d11]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            +₹3,84,200
          </p>
          <p className="text-[11px] text-slate-500 mt-1">From closed positions</p>
        </div>

        <div className="bg-white rounded-xl glass-card-edge p-5 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Unrealised P&L
          </p>
          <p className="text-2xl font-extrabold text-[#006591]" style={{ fontFamily: 'Manrope, sans-serif' }}>
            +₹1,38,402
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Live open positions</p>
        </div>

        <div className="bg-white rounded-xl glass-card-edge p-5 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            Dividends YTD
          </p>
          <p className="text-2xl font-extrabold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            ₹38,412
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Across 6 holdings</p>
        </div>

        <div className="bg-white rounded-xl glass-card-edge p-5 shadow-[0_24px_40px_rgba(11,28,48,0.05)]">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mb-1" style={{ fontFamily: 'Inter, sans-serif' }}>
            XIRR
          </p>
          <p className="text-2xl font-extrabold text-black" style={{ fontFamily: 'Manrope, sans-serif' }}>
            18.4%
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Annualised return</p>
        </div>
      </section>

      {/* P&L Calendar Heatmap */}
      <PLCalendar />

      {/* Active Holdings */}
      <ActiveHoldingsTable />

      {/* Asset Allocation & Sector Split */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AssetAllocation />
        <SectorExposure />
      </section>

      {/* Tax Summary */}
      <TaxSummary />

      {/* Dividend History */}
      <DividendHistory />

      {/* Transaction History - All Transactions */}
      <TransactionHistory transactions={transactions} />

      {/* Closed Positions */}
      <ClosedPositions />

      {/* AI Portfolio Doctor */}
      <AIPortfolioDoctor />
    </main>
  );
}
