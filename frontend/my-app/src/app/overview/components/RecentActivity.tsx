'use client';

import Link from 'next/link';
import type { ActivityItem, ActivityType } from '@/lib/types/overview';

interface Props {
  data: ActivityItem[];
}

const iconMap: Record<ActivityType, { icon: string; color: string; bg: string }> = {
  trade:    { icon: 'shopping_cart', color: '#131b2e', bg: '#e5eeff' },
  news:     { icon: 'newspaper',     color: '#006591', bg: '#e5eeff' },
  dividend: { icon: 'payments',      color: '#005236', bg: '#e5eeff' },
  alert:    { icon: 'warning',       color: '#ba1a1a', bg: '#ffdad6' },
};

export default function RecentActivity({ data }: Props) {
  return (
    <div
      className="rounded-xl flex flex-col"
      style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
    >
      {/* Header */}
      <div
        className="px-8 py-6"
        style={{ borderBottom: '1px solid rgba(198,198,205,0.08)' }}
      >
        <h3
          className="text-lg font-bold"
          style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
        >
          Recent Activity
        </h3>
      </div>

      {/* Activity list */}
      <div className="p-6 space-y-6 flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
        {data.map((item, i) => {
          const meta = iconMap[item.type] ?? iconMap.trade;
          const isLast = i === data.length - 1;
          return (
            <div key={item.id ?? i} className="flex gap-4">
              {/* Icon */}
              <div
                className="h-10 w-10 shrink-0 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: meta.bg, color: meta.color }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: '20px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                >
                  {meta.icon}
                </span>
              </div>

              {/* Content */}
              <div
                className="flex-1 pb-4"
                style={
                  !isLast
                    ? { borderBottom: '1px solid rgba(198,198,205,0.12)' }
                    : undefined
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <p
                    className="text-sm font-semibold flex-1"
                    style={{ color: '#000000', fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.title}
                  </p>
                  {item.type === 'trade' && (item as any).amount && (
                    <span
                      className="text-sm font-bold shrink-0"
                      style={{ 
                        color: (item as any).amount > 0 ? '#009668' : '#ba1a1a',
                        fontFamily: 'Manrope, sans-serif' 
                      }}
                    >
                      {(item as any).amount > 0 ? '+' : ''}₹{Math.abs((item as any).amount).toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <p
                  className="text-xs mt-1 line-clamp-2"
                  style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
                >
                  {item.description}
                </p>
                <span
                  className="text-[10px] uppercase mt-1 block"
                  style={{ color: 'rgba(69,70,77,0.5)', fontFamily: 'Inter, sans-serif' }}
                >
                  {item.timeLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer CTA */}
      <div className="p-6 pt-0">
        <Link
          href="/reports"
          className="w-full py-3 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-colors block text-center"
          style={{
            backgroundColor: '#eff4ff',
            color: '#000000',
            fontFamily: 'Inter, sans-serif',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#e5eeff';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLAnchorElement).style.backgroundColor = '#eff4ff';
          }}
        >
          History &amp; Archives
        </Link>
      </div>
    </div>
  );
}
