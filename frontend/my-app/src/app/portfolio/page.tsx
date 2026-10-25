import { getPortfolioData } from '@/lib/data/mockPortfolio';
import DiversificationHero from './components/DiversificationHero';
import AllocationRatios from './components/AllocationRatios';
import RebalancingSection from './components/RebalancingSection';
import GoalTrackers from './components/GoalTrackers';
import StrategyEditorSection from './components/StrategyEditorSection';

// React Server Component.
// When backend is ready, replace getPortfolioData() in src/lib/data/mockPortfolio.ts
// with real parallel API calls. See that file's header comments for the exact
// fetch pattern aligned to the /yf/* and /nse/* endpoints in backend_doc.md.

export default async function PortfolioPage() {
  const data = await getPortfolioData();

  return (
    <>
      {/* ── Section 1: Diversification Score + Current Strategy ── */}
      <DiversificationHero
        score={data.diversification}
        strategy={data.currentStrategy}
      />

      {/* ── Section 2: Asset Allocation Current vs. Target ── */}
      <AllocationRatios data={data.allocation} />

      {/* ── Section 3: Rebalancing Recommendations + Strategy Advisor ── */}
      <RebalancingSection
        recommendations={data.rebalancing}
        advisor={data.strategyAdvisor}
      />

      {/* ── Section 3.5: Strategy Maker / Editor ── */}
      <StrategyEditorSection initialCurrentStrategy={data.currentStrategy} />

      {/* ── Section 4: Goal Trackers ── */}
      <GoalTrackers data={data.goals} />
    </>
  );
}
