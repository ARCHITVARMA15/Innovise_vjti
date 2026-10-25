'use client';

import { useState } from 'react';
import StockSearchBar from './StockSearchBar';
import StockDetailsPopup from './StockDetailsPopup';

interface GlobalStockSearchProps {
  showInMarketPage?: boolean;
}

export default function GlobalStockSearch({ showInMarketPage = false }: GlobalStockSearchProps) {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);

  const handleStockSelect = (ticker: string) => {
    // For non-Market pages, show popup
    if (!showInMarketPage) {
      setSelectedStock(ticker);
    }
  };

  const handleClosePopup = () => {
    setSelectedStock(null);
  };

  // Don't render on Market page (it has its own search integration)
  if (showInMarketPage) {
    return null;
  }

  return (
    <>
      <div className="mb-8">
        <StockSearchBar
          onStockSelect={handleStockSelect}
          placeholder="Search assets, pages..."
          className="max-w-md"
        />
      </div>

      {selectedStock && (
        <StockDetailsPopup
          ticker={selectedStock}
          onClose={handleClosePopup}
        />
      )}
    </>
  );
}
