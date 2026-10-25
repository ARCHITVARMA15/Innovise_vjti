import type { Metadata } from 'next';
import Sidebar from '@/app/overview/components/Sidebar';
import SharedTopNav from '@/app/components/SharedTopNav';

export const metadata: Metadata = {
  title: 'Markets | Veritas Ledger',
  description: 'Global market indices, candle charts, sector heatmap, algorithmic signals, and asset explorer',
};

export default function MarketLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overview-root flex min-h-screen"
      style={{ fontFamily: 'var(--font-inter), sans-serif' }}
    >
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col">
        <SharedTopNav />
        <div className="px-8 pt-8 pb-16 max-w-7xl mx-auto w-full space-y-12">
          {children}
        </div>
      </main>
    </div>
  );
}
