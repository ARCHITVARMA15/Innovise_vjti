import {formatFinancialAmount} from '../financial-overview';
// ─── Number & Date Formatting Utilities ──────────────────────────────────────

export function formatCurrency(value: number, compact = false): string {
  if (Math.abs(value) >= 1_000_000 || compact) return `₹${formatFinancialAmount(value)}`;
  // Default to Indian Rupee formatting

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, alwaysSign = true): string {
  const sign = alwaysSign && value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}


