'use client';

import { useState, useEffect } from 'react';
import type { SectorItem } from '@/lib/types/market';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// Comprehensive list of 25 sectors with realistic performance data
const ALL_SECTORS: SectorItem[] = [
  { id: 's1', label: 'Technology', changePercent: 2.45 },
  { id: 's2', label: 'Healthcare', changePercent: -0.82 },
  { id: 's3', label: 'Energy', changePercent: 1.12 },
  { id: 's4', label: 'Finance', changePercent: 0.05 },
  { id: 's5', label: 'Consumer', changePercent: 0.71 },
  { id: 's6', label: 'Industrials', changePercent: -0.33 },
  { id: 's7', label: 'Materials', changePercent: 0.18 },
  { id: 's8', label: 'Utilities', changePercent: -0.55 },
  { id: 's9', label: 'Real Estate', changePercent: -1.24 },
  { id: 's10', label: 'Telecommunications', changePercent: 0.92 },
  { id: 's11', label: 'Semiconductors', changePercent: 3.15 },
  { id: 's12', label: 'Biotechnology', changePercent: 1.87 },
  { id: 's13', label: 'Aerospace & Defense', changePercent: 0.64 },
  { id: 's14', label: 'Automotive', changePercent: -0.48 },
  { id: 's15', label: 'Banking', changePercent: 0.35 },
  { id: 's16', label: 'Insurance', changePercent: -0.21 },
  { id: 's17', label: 'Retail', changePercent: 1.42 },
  { id: 's18', label: 'Media & Entertainment', changePercent: 0.88 },
  { id: 's19', label: 'Pharmaceuticals', changePercent: 1.05 },
  { id: 's20', label: 'Oil & Gas', changePercent: 0.76 },
  { id: 's21', label: 'Renewable Energy', changePercent: 2.18 },
  { id: 's22', label: 'Cloud Computing', changePercent: 2.94 },
  { id: 's23', label: 'Cybersecurity', changePercent: 1.63 },
  { id: 's24', label: 'E-commerce', changePercent: 1.29 },
  { id: 's25', label: 'Artificial Intelligence', changePercent: 4.21 },
];

export default function SectorHeatmapModal({ isOpen, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen && !mounted) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: 'rgba(11, 28, 48, 0.6)',
          backdropFilter: 'blur(8px)',
        }}
      />

      {/* Modal Content */}
      <div
        className={`relative w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl transition-all duration-300 ${
          isOpen ? 'scale-100' : 'scale-95'
        }`}
        style={{
          backgroundColor: '#f8f9ff',
          boxShadow: '0 32px 64px rgba(11, 28, 48, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-8 py-6 border-b flex items-center justify-between"
          style={{
            backgroundColor: '#ffffff',
            borderColor: 'rgba(226, 232, 240, 0.6)',
          }}
        >
          <div>
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              All Sector Performance
            </h2>
            <p
              className="text-sm mt-1"
              style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
            >
              Real-time sector performance across 25 market segments
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full transition-colors hover:bg-slate-100"
            style={{ color: '#475569' }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '24px', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              close
            </span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-120px)] px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {ALL_SECTORS.map((sector) => {
              const isUp = sector.changePercent >= 0;
              const accentColor = isUp ? '#4edea3' : '#ba1a1a';
              const bgColor = isUp ? 'rgba(78, 222, 163, 0.08)' : 'rgba(186, 26, 26, 0.08)';
              
              return (
                <div
                  key={sector.id}
                  className="p-4 rounded-xl transition-all hover:scale-105 cursor-pointer"
                  style={{
                    backgroundColor: '#ffffff',
                    borderLeft: `4px solid ${accentColor}`,
                    boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)',
                  }}
                >
                  <div
                    className="text-[9px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: '#7c839b', fontFamily: 'Inter, sans-serif' }}
                  >
                    {sector.label}
                  </div>
                  <div
                    className="text-xl font-bold"
                    style={{ color: isUp ? '#009668' : '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}
                  >
                    {isUp ? '+' : ''}{sector.changePercent.toFixed(2)}%
                  </div>
                  
                  {/* Mini performance bar */}
                  <div
                    className="mt-3 h-1 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(148, 163, 184, 0.2)' }}
                  >
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        backgroundColor: accentColor,
                        width: `${Math.min(Math.abs(sector.changePercent) * 20, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Stats */}
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div
              className="p-5 rounded-xl"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)',
              }}
            >
              <div
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                Sectors Up
              </div>
              <div
                className="text-3xl font-bold"
                style={{ color: '#009668', fontFamily: 'Manrope, sans-serif' }}
              >
                {ALL_SECTORS.filter(s => s.changePercent > 0).length}
              </div>
            </div>

            <div
              className="p-5 rounded-xl"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)',
              }}
            >
              <div
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                Sectors Down
              </div>
              <div
                className="text-3xl font-bold"
                style={{ color: '#ba1a1a', fontFamily: 'Manrope, sans-serif' }}
              >
                {ALL_SECTORS.filter(s => s.changePercent < 0).length}
              </div>
            </div>

            <div
              className="p-5 rounded-xl"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 4px 16px rgba(11, 28, 48, 0.06)',
              }}
            >
              <div
                className="text-xs font-bold uppercase tracking-widest mb-2"
                style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
              >
                Best Performer
              </div>
              <div
                className="text-lg font-bold"
                style={{ color: '#009668', fontFamily: 'Manrope, sans-serif' }}
              >
                {ALL_SECTORS.reduce((max, s) => s.changePercent > max.changePercent ? s : max).label}
              </div>
              <div
                className="text-sm font-bold"
                style={{ color: '#009668', fontFamily: 'Inter, sans-serif' }}
              >
                +{ALL_SECTORS.reduce((max, s) => s.changePercent > max.changePercent ? s : max).changePercent.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
