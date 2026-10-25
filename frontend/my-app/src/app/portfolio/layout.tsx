import type { Metadata } from 'next';
import Sidebar from '@/app/overview/components/Sidebar';
import SharedTopNav from '@/app/components/SharedTopNav';

export const metadata: Metadata = {
  title: 'Portfolio | Veritas Ledger',
  description: 'Diversification score, allocation ratios, rebalancing recommendations, and goal trackers',
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overview-root flex min-h-screen"
      style={{ fontFamily: 'var(--font-inter), sans-serif' }}
    >
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <SharedTopNav />
        <div className="p-8 space-y-12">
          {children}
        </div>
      </main>
    </div>
  );
}
