import type { Metadata } from 'next';
import Sidebar from '../overview/components/Sidebar';
import SharedTopNav from '../components/SharedTopNav';

export const metadata: Metadata = {
  title: 'Reports | Veritas',
  description: 'Investment portfolio reports and analytics',
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[#f8f9ff]">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64">
        <SharedTopNav />
        {children}
      </div>
    </div>
  );
}
