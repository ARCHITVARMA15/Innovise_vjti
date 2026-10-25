import type { Metadata } from 'next';
import Sidebar from './components/Sidebar';
import SharedTopNav from '@/app/components/SharedTopNav';

export const metadata: Metadata = {
  title: 'Overview | Veritas Ledger',
  description: 'Portfolio overview dashboard',
};

export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overview-root flex min-h-screen"
      style={{ fontFamily: 'var(--font-inter), sans-serif' }}
    >
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen min-w-0">
        <SharedTopNav />
        <main className="flex-1 p-6 w-full overflow-x-hidden min-w-0">
          <div className="space-y-8 w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
