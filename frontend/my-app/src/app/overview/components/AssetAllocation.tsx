'use client';

import Link from 'next/link';
import type { AllocationItem } from '@/lib/types/overview';

interface Props {
  data: AllocationItem[];
}

export default function AssetAllocation({ data }: Props) {
  return (
    <div
      className="p-8 rounded-xl flex flex-col h-full"
      style={{ backgroundColor: '#ffffff', boxShadow: '0 24px 40px rgba(11,28,48,0.05)' }}
    >
      <h3
        className="text-lg font-bold mb-6"
        style={{ color: '#000000', fontFamily: 'Manrope, sans-serif' }}
      >
        Asset Allocation
      </h3>

      <div className="space-y-5 flex-1">
        {data.map((item, i) => (
          <div key={i} className="space-y-1.5">
            <div
              className="flex justify-between text-[11px] font-bold uppercase tracking-wider"
              style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
            >
              <span>{item.label}</span>
              <span>{item.percentage}%</span>
            </div>
            <div
              className="h-2 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: '#e5eeff' }}
            >
              <div
                className={`h-full rounded-full ${item.colorClass}`}
                style={{ width: `${item.percentage}%`, transition: 'width 0.8s ease' }}
              />
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/reports"
        className="mt-auto pt-6 text-sm font-semibold flex items-center gap-1 hover:underline transition-all"
        style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
      >
        Detailed rebalancing report
        <span
          className="material-symbols-outlined"
          style={{ fontSize: '16px', fontVariationSettings: "'FILL' 0, 'wght' 400" }}
        >
          chevron_right
        </span>
      </Link>
    </div>
  );
}
