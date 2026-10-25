import type { Metadata } from 'next';
import Sidebar from '../overview/components/Sidebar';
import SharedTopNav from '../components/SharedTopNav';
import './financial-analytics.css';

export const metadata: Metadata = {
  title: 'Financial Analytics | Veritas',
  description: 'Microsoft financial reporting and company transaction analytics',
};

export default function FinancialAnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <div className="overview-root financial-shell flex min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
    <Sidebar />
    <div className="financial-main flex min-w-0 flex-1 flex-col ml-64">
      <SharedTopNav showDemoNotifications={false} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  </div>;
}
