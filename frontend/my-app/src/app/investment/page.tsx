import { getInvestmentData } from '@/lib/data/mockInvestment';
import HeroStats from './components/HeroStats';
import PerformanceChart from './components/PerformanceChart';
import AssetBreakdown from './components/AssetBreakdown';
import ActiveHoldings from './components/ActiveHoldings';
import WatchlistTable from './components/WatchlistTable';
import Opportunities from './components/Opportunities';
import FuturePredictionSection from './components/FuturePredictionSection';

// React Server Component.
// When backend is ready, getInvestmentData() in src/lib/data/mockInvestment.ts
// is the single swap point — replace the mock with real parallel API fetches.
// All types are aligned with /yf/quote/{symbol} and /yf/history/{symbol} responses.

export default async function InvestmentPage() {
  const data = await getInvestmentData();

  return (
    <>
      {/* ── Section 1: Hero Stats ── */}
      <HeroStats data={data.summary} />

      {/* ── Section 2: Performance Chart + Asset Breakdown ── */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8">
          <PerformanceChart data={data.history} />
        </div>
        <div className="lg:col-span-4 flex flex-col gap-6">
          <FuturePredictionSection holdings={data.holdings} />
          <AssetBreakdown data={data.breakdown} />
        </div>
      </section>

      {/* ── Section 3: Active Holdings ── */}
      <ActiveHoldings data={data.holdings} />

      {/* ── Section 4: Watchlist ── */}
      <WatchlistTable />

      {/* ── Section 4: Opportunities ── */}
      <Opportunities opportunities={data.opportunities} riskAlert={data.riskAlert} />
    </>
  );
}
