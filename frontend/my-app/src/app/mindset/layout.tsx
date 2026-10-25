import type { Metadata } from 'next';
import Sidebar from '@/app/overview/components/Sidebar';
import SharedTopNav from '@/app/components/SharedTopNav';

export const metadata: Metadata = {
  title: 'Investors Mindset | Veritas',
  description: 'Persona-guided investment exploration with top investor mental models',
};

export default function MindsetLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="overview-root flex min-h-screen" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col min-w-0">
        <SharedTopNav />
        <div className="px-8 pt-3 pb-6 flex-1">{children}</div>
      </main>
    </div>
  );
}
