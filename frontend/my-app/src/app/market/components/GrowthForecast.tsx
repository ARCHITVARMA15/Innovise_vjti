'use client';

import type { GrowthForecastItem } from '@/lib/types/market';

interface Props {
  data: GrowthForecastItem[];
}

export default function GrowthForecast({ data }: Props) {
  return (
    <section className="space-y-6">
      <h3
        className="text-xl font-bold tracking-tight"
        style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
      >
        Q3 Growth Forecast
      </h3>

      <div
        className="p-6 rounded-xl space-y-6"
        style={{ backgroundColor: '#eff4ff' }}
      >
        {data.map((item, i) => (
          <div key={i} className="space-y-2">
            <div className="flex justify-between items-center">
              <span
                className="text-xs font-bold uppercase tracking-widest"
                style={{ color: '#45464d', fontFamily: 'Inter, sans-serif' }}
              >
                {item.label}
              </span>
              <span
                className="text-xs font-bold"
                style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
              >
                +{item.forecastPercent}%
              </span>
            </div>
            <div
              className="h-1.5 w-full rounded-full overflow-hidden"
              style={{ backgroundColor: '#d3e4fe' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${item.barWidthPercent}%`, backgroundColor: '#006591' }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
