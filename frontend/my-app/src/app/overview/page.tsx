import { getOverviewData } from '@/lib/data/mockOverview';
import PortfolioHero from './components/PortfolioHero';
import AssetAllocation from './components/AssetAllocation';
import TopHoldings from './components/TopHoldings';
import RecentActivity from './components/RecentActivity';
import NewsSection from './components/NewsSection';

export default async function OverviewPage() {
  const data = await getOverviewData();

  return (
    <>
      {/* ── Section 1: Portfolio Hero + Asset Allocation ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <PortfolioHero data={data.portfolio} />
        <AssetAllocation data={data.allocation} />
      </section>

      {/* ── Section 2: Top Holdings + Recent Activity ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <TopHoldings data={data.holdings} />
        <RecentActivity data={data.activity} />
      </section>

      {/* ── Section 3: Real-time Market News (from GET /news via Finnhub) ── */}
      <NewsSection data={data.news} />
    </>
  );
}
