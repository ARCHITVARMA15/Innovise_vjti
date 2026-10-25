import type { Metadata } from 'next';
import Sidebar from '@/app/overview/components/Sidebar';
import SharedTopNav from '@/app/components/SharedTopNav';
import './research.css';

export const metadata: Metadata = {
  title: 'Research Lab | Veritas',
  description: 'Organize research cases and collect source documents.',
};

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overview-root research-shell flex min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      <Sidebar />
      <div className="research-main flex min-w-0 flex-1 flex-col">
        <SharedTopNav showDemoNotifications={false} />
        <main className="research-content mx-auto w-full max-w-7xl p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
