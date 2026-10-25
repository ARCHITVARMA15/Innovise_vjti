'use client';

import { useState, useRef, useEffect } from 'react';

interface StockSearchBarProps {
  onStockSelect: (ticker: string) => void;
  placeholder?: string;
  className?: string;
}

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export default function StockSearchBar({ onStockSelect, placeholder = "Search stocks...", className = "" }: StockSearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Search stocks from backend
  const handleSearch = async (searchQuery: string) => {
    if (searchQuery.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/yf/search?q=${encodeURIComponent(searchQuery)}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data.slice(0, 8)); // Limit to 8 results
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Stock search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    handleSearch(value);
  };

  const handleSelectStock = (ticker: string) => {
    setQuery(ticker);
    setIsOpen(false);
    onStockSelect(ticker);
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-10 rounded-lg text-sm transition-all"
          style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            color: '#0f172a',
            fontFamily: 'Inter, sans-serif',
          }}
          onFocus={() => query.length > 0 && setIsOpen(true)}
        />
        <span
          className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
          style={{ fontSize: '20px' }}
        >
          search
        </span>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full left-0 right-0 mt-2 rounded-lg shadow-2xl z-50 max-h-80 overflow-y-auto"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
          }}
        >
          {loading ? (
            <div className="p-4 text-center text-sm text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={result.symbol}
                  onClick={() => handleSelectStock(result.symbol)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-sm" style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}>
                        {result.symbol}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'Inter, sans-serif' }}>
                        {result.name}
                      </div>
                    </div>
                    <div className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#e5eeff', color: '#004666', fontFamily: 'Inter, sans-serif' }}>
                      {result.exchange}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-gray-500" style={{ fontFamily: 'Inter, sans-serif' }}>
              No stocks found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
