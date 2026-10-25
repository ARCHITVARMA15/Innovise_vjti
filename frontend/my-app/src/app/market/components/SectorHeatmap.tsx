'use client';

import { useState } from 'react';
import type { SectorItem } from '@/lib/types/market';
import SectorHeatmapModal from './SectorHeatmapModal';

interface Props {
  data: SectorItem[];
}

export default function SectorHeatmap({ data }: Props) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <h3
            className="text-xl font-bold tracking-tight"
            style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
          >
            Sector Heatmap
          </h3>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-xs font-bold uppercase tracking-widest transition-all hover:underline"
            style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
          >
            View All Sectors
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.map(sector => {
            const isUp = sector.changePercent >= 0;
            const accentColor = isUp ? '#4edea3' : '#ba1a1a';
            return (
              <div
                key={sector.id}
                className="p-5 rounded-lg"
                style={{
                  backgroundColor: '#ffffff',
                  borderLeft: `4px solid ${accentColor}`,
                  boxShadow: '0 4px 12px rgba(11,28,48,0.04)',
                }}
              >
                <div
                  className="text-[10px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
                >
                  {sector.label}
                </div>
                <div
                  className="text-lg font-bold"
                  style={{ color: isUp ? '#009668' : '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}
                >
                  {isUp ? '+' : ''}{sector.changePercent.toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sector Heatmap Modal */}
      <SectorHeatmapModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
