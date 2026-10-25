'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import type { RebalanceRecommendation, RebalanceAction, StrategyAdvisorRecommendation } from '@/lib/types/portfolio';

interface Props {
  recommendations: RebalanceRecommendation[];
  advisor: StrategyAdvisorRecommendation;
}

const actionConfig: Record<RebalanceAction, { icon: string; iconColor: string; iconBg: string; amountPrefix: string; amountColor: string }> = {
  SELL:    { icon: 'arrow_downward', iconColor: '#ba1a1a', iconBg: '#ffdad6', amountPrefix: 'Sell ₹',    amountColor: '#ba1a1a' },
  BUY:     { icon: 'arrow_upward',   iconColor: '#009668', iconBg: '#d7f4e8', amountPrefix: 'Buy ₹',     amountColor: '#009668' },
  REALLOC: { icon: 'swap_horiz',     iconColor: '#006591', iconBg: '#eff4ff', amountPrefix: 'Re-alloc ₹', amountColor: '#006591' },
};

export default function RebalancingSection({ recommendations, advisor }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleBuySell = async (rec: RebalanceRecommendation) => {
    if (loading) return;
    
    setLoading(rec.id);
    
    try {
      const endpoint = rec.action === 'BUY' ? '/portfolio/buy' : '/portfolio/sell';
      const symbol = extractSymbol(rec.title);
      
      const response = await fetch(`http://localhost:8000${endpoint}?symbol=${symbol}&amount=${rec.amount}`, {
        method: 'POST',
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message, { position: 'top-right' });
        setTimeout(() => window.location.reload(), 2000);
      } else if (data.error) {
        toast.error(data.error, { position: 'top-right' });
      }
    } catch (error) {
      toast.error('Transaction failed. Please check if backend is running.', { position: 'top-right' });
      console.error('Transaction error:', error);
    } finally {
      setLoading(null);
    }
  };

  const extractSymbol = (title: string): string => {
    // Map recommendation titles to real US ETF tickers
    if (title.includes('Domestic')) return 'SPY';
    if (title.includes('International')) return 'VXUS';
    if (title.includes('Cash')) return 'BIL';
    return 'SPY';
  };

  const handleApplyStrategy = () => {
    router.push('/insights');
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left: Rebalancing Recommendations (2 cols) */}
      <div className="lg:col-span-2 space-y-5">
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Rebalancing Recommendations
        </h3>

        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
        >
          {recommendations.map((rec, i) => {
            const cfg = actionConfig[rec.action];
            const isLast = i === recommendations.length - 1;
            return (
              <div
                key={rec.id}
                className="flex items-center gap-5 px-8 py-6"
                style={{ borderBottom: !isLast ? '1px solid rgba(226,232,240,0.5)' : 'none' }}
              >
                {/* Action icon */}
                <div
                  className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: cfg.iconBg }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: '18px',
                      color: cfg.iconColor,
                      fontVariationSettings: "'FILL' 0, 'wght' 500",
                    }}
                  >
                    {cfg.icon}
                  </span>
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                  >
                    {rec.title}
                  </p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                  >
                    {rec.subtitle}
                  </p>
                </div>

                {/* Amount + CTA */}
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <button
                    onClick={() => handleBuySell(rec)}
                    disabled={loading === rec.id}
                    className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-80 disabled:opacity-50 cursor-pointer"
                    style={{
                      color: '#ffffff',
                      backgroundColor: cfg.amountColor,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {loading === rec.id ? 'Processing...' : `${cfg.amountPrefix}${rec.amount.toLocaleString()}`}
                  </button>
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest"
                    style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
                  >
                    {rec.ctaLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Strategy Advisor */}
      <div className="space-y-5">
        <h3
          className="text-xl font-extrabold tracking-tight"
          style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
        >
          Strategy Advisor
        </h3>

        <div
          className="rounded-xl p-8 flex flex-col gap-6"
          style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
        >
          <div>
            <p
              className="text-[10px] uppercase tracking-widest font-bold mb-2"
              style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
            >
              Recommended For You
            </p>
            <h4
              className="text-xl font-extrabold"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              {advisor.label}
            </h4>
            <p
              className="text-sm mt-2 leading-relaxed"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              {advisor.rationale}
            </p>
          </div>

          {/* Stats grid */}
          <div className="space-y-3">
            {[
              { label: 'Expected Return', value: `+${advisor.expectedReturnPA}% p.a.`, valueColor: '#009668' },
              { label: 'Risk Level',      value: advisor.riskLevel,                    valueColor: '#ba1a1a' },
              { label: 'Horizon',         value: advisor.horizonYears,                 valueColor: '#0f172a' },
            ].map(row => (
              <div
                key={row.label}
                className="flex justify-between items-center py-2"
                style={{ borderBottom: '1px solid rgba(226,232,240,0.5)' }}
              >
                <span
                  className="text-xs font-medium"
                  style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                >
                  {row.label}
                </span>
                <span
                  className="text-xs font-bold"
                  style={{ color: row.valueColor, fontFamily: 'Inter, sans-serif' }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleApplyStrategy}
            className="w-full py-3 rounded-lg text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#0f172a', fontFamily: 'Inter, sans-serif' }}
          >
            Apply Strategy
          </button>
        </div>
      </div>
    </section>
  );
}
