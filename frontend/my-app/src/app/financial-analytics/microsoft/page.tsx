import type { Metadata } from 'next';
import MicrosoftBI from './MicrosoftBI';

export const metadata: Metadata = {
  title: 'Microsoft FY2025 | Veritas Financial Analytics',
  description: 'Interactive Microsoft financial statements, cash flow, segments and ratio analysis from official FY2025 reports.',
};
export default function MicrosoftReportPage() {
  return <MicrosoftBI />;
}
