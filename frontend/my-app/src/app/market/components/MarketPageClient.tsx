'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import type { MarketData, ChartAsset } from '@/lib/types/market';
import MarketIndexCards from './MarketIndexCards';
import CandleChart from './CandleChart';
import AlgorithmicSignals from './AlgorithmicSignals';
import SectorHeatmap from './SectorHeatmap';
import GrowthForecast from './GrowthForecast';
import AssetExplorer from './AssetExplorer';

interface Props {
  initialData: MarketData;
}

export default function MarketPageClient({ initialData }: Props) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<MarketData>(initialData);
  const [searchedStock, setSearchedStock] = useState<ChartAsset | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  // Load stock from URL query parameter
  useEffect(() => {
    const stockTicker = searchParams.get('stock');
    if (stockTicker) {
      handleStockSearch(stockTicker);
    }
  }, [searchParams]);

  const handleStockSearch = async (ticker: string) => {
    setLoadingStock(true);
    try {
      // Fetch stock quote for basic info
      const quoteResponse = await fetch(`http://localhost:8000/yf/quote/${ticker}`);
      if (!quoteResponse.ok) throw new Error('Failed to fetch stock quote');
      const quoteData = await quoteResponse.json();

      // Fetch candle data for all periods
      const periodMap = {
        '1D': { period: '1d', interval: '5m' },
        '1W': { period: '5d', interval: '1h' },
        '1M': { period: '1mo', interval: '1d' },
        '1Y': { period: '1y', interval: '1d' },
      };

      const candlePromises = Object.entries(periodMap).map(async ([key, { period, interval }]) => {
        const response = await fetch(
          `http://localhost:8000/yf/history/${ticker}?period=${period}&interval=${interval}`
        );
        if (!response.ok) throw new Error(`Failed to fetch ${key} candles`);
        const candles = await response.json();
        return [key, candles];
      });

      const candleResults = await Promise.all(candlePromises);
      const candles = Object.fromEntries(candleResults);

      // Create ChartAsset object
      const stockChart: ChartAsset = {
        symbol: ticker,
        name: quoteData.name || ticker,
        volatility: 1.5, // Could calculate from candle data
        rsi: 50, // Could calculate from candle data
        candles: candles as any,
      };

      setSearchedStock(stockChart);
    } catch (error) {
      console.error('Failed to fetch stock data:', error);
      alert(`Failed to load data for ${ticker}. Please try another stock.`);
    } finally {
      setLoadingStock(false);
    }
  };

  const handleResetChart = () => {
    setSearchedStock(null);
  };

  const currentChart = searchedStock || data.chart;

  return (
    <>
      {/* ── Section 1: Global Market Index Cards ── */}
      <MarketIndexCards data={data.indices} />

      {/* ── Section 2: Main 8/4 Grid — Chart + Right sidebar ── */}
      <div className="grid grid-cols-12 gap-12">
        {/* Left: Chart + Sector Heatmap */}
        <div className="col-span-12 xl:col-span-8 space-y-8">
          <CandleChart data={currentChart} />
          <SectorHeatmap data={data.sectors} />
        </div>

        {/* Right: Algo Signals + Growth Forecast */}
        <div className="col-span-12 xl:col-span-4 space-y-12">
          <AlgorithmicSignals data={data.signals} />
          <GrowthForecast data={data.growthForecasts} />
        </div>
      </div>

      {/* ── Section 3: Asset Explorer ── */}
      <AssetExplorer data={data.assets} />
    </>
  );
}
