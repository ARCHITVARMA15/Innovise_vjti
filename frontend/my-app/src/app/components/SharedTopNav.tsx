'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    icon: 'trending_up',
    iconColor: '#009668',
    title: 'NVDA up +4.2%',
  body: 'NVIDIA Corp surged past ₹880 on strong earnings guidance.',
    time: '2 min ago',
    unread: true,
  },
  {
    id: 'n2',
    icon: 'warning',
    iconColor: '#C9A84C',
    title: 'Portfolio Risk Alert',
    body: 'Tech exposure is 15% above your target allocation.',
    time: '18 min ago',
    unread: true,
  },
  {
    id: 'n3',
    icon: 'payments',
    iconColor: '#006591',
    title: 'Dividend received',
  body: 'AAPL dividend of ₹32.40 credited to your account.',
    time: '1 hr ago',
    unread: false,
  },
  {
    id: 'n4',
    icon: 'analytics',
    iconColor: '#7c3aed',
    title: 'AI Insight ready',
    body: 'New Q3 sector rotation analysis is available for review.',
    time: '3 hr ago',
    unread: false,
  },
];

const PAGE_SUGGESTIONS = [
  { label: 'Overview Dashboard',      href: '/overview', tag: 'Page' },
  { label: 'Investments',             href: '/investment', tag: 'Page' },
  { label: 'Portfolio Analysis',      href: '/portfolio', tag: 'Page' },
  { label: 'Markets',                 href: '/market', tag: 'Page' },
  { label: 'Learners',                href: '/learners', tag: 'Page' },
  { label: 'Reports',                 href: '/reports', tag: 'Page' },
  { label: 'Analyst Watch', href: '/analyst-watch', tag: 'Page' },
  { label: 'Financial Analytics',     href: '/financial-analytics', tag: 'Page' },
  { label: 'Microsoft FY2025 BI Report', href: '/financial-analytics/microsoft', tag: 'Page' },
  { label: 'Insights',                href: '/insights', tag: 'Page' },
];

interface StockResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

export default function SharedTopNav({ showDemoNotifications = true }: { showDemoNotifications?: boolean }) {
  const router = useRouter();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [stockResults, setStockResults] = useState<StockResult[]>([]);
  const [searchingStocks, setSearchingStocks] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notifications state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(showDemoNotifications ? MOCK_NOTIFICATIONS : []);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => n.unread).length;

  // Profile dropdown state
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close panels on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search for stocks when query changes
  useEffect(() => {
    const searchStocks = async () => {
      if (searchQuery.length < 1) {
        setStockResults([]);
        return;
      }

      setSearchingStocks(true);
      try {
        const response = await fetch(`http://localhost:8000/yf/search?q=${encodeURIComponent(searchQuery)}`);
        if (response.ok) {
          const data = await response.json();
          setStockResults(data.slice(0, 6)); // Limit to 6 results
        }
      } catch (error) {
        console.error('Stock search failed:', error);
        setStockResults([]);
      } finally {
        setSearchingStocks(false);
      }
    };

    const timeoutId = setTimeout(searchStocks, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const filteredPages = searchQuery.trim()
    ? PAGE_SUGGESTIONS.filter(s =>
        s.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : PAGE_SUGGESTIONS;

  function handlePageClick(href: string) {
    setSearchOpen(false);
    setSearchQuery('');
    router.push(href);
  }

  function handleStockClick(ticker: string) {
    setSearchOpen(false);
    setSearchQuery('');
    // Navigate to market page with stock ticker as query param
    router.push(`/market?stock=${ticker}`);
  }

  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
  }

  return (
    <header
      className="w-full sticky top-0 z-40 h-16 px-8 flex justify-between items-center"
      style={{
        backgroundColor: 'rgba(248,249,255,0.92)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(11,28,48,0.05)',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      {/* ── Left: Search ── */}
      <div className="flex items-center gap-8 flex-1 max-w-lg" ref={searchRef}>
        <div className="relative w-full">
          {/* Search input */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
            style={{
              backgroundColor: '#eff4ff',
              boxShadow: searchOpen ? '0 0 0 2px rgba(0,101,145,0.35)' : 'none',
            }}
          >
            <span
              className="material-symbols-outlined shrink-0"
              style={{ fontSize: '18px', color: '#94a3b8', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
            >
              search
            </span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              placeholder="Search assets, pages..."
              className="flex-1 bg-transparent outline-none text-sm placeholder-slate-400"
              style={{ color: '#0b1c30', fontFamily: 'Inter, sans-serif' }}
              onFocus={() => { if (searchQuery.length > 0) setSearchOpen(true); }}
              onChange={e => { 
                const value = e.target.value;
                setSearchQuery(value); 
                setSearchOpen(value.length > 0);
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); inputRef.current?.blur(); }
                if (e.key === 'Enter') {
                  if (stockResults.length > 0) {
                    handleStockClick(stockResults[0].symbol);
                  } else if (filteredPages.length > 0) {
                    handlePageClick(filteredPages[0].href);
                  }
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}
                className="material-symbols-outlined shrink-0"
                style={{ fontSize: '16px', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                close
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {searchOpen && (
            <div
              className="absolute top-full left-0 right-0 mt-2 rounded-xl overflow-hidden"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 24px 48px rgba(11,28,48,0.14)',
                zIndex: 100,
              }}
            >
              {/* Stock Results Section */}
              {searchQuery && stockResults.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(226,232,240,0.5)' }}>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                    >
                      Stocks
                    </span>
                  </div>
                  {stockResults.map(stock => (
                    <button
                      key={stock.symbol}
                      onClick={() => handleStockClick(stock.symbol)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9ff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <div>
                        <div className="text-sm font-bold" style={{ color: '#0f172a' }}>{stock.symbol}</div>
                        <div className="text-xs" style={{ color: '#64748b' }}>{stock.name}</div>
                      </div>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: '#e5eeff', color: '#006591' }}
                      >
                        {stock.exchange}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* Page Suggestions Section */}
              {filteredPages.length > 0 && (
                <>
                  <div className="px-4 py-2 border-b" style={{ borderColor: 'rgba(226,232,240,0.5)' }}>
                    <span
                      className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                    >
                      {searchQuery ? 'Pages' : 'Quick access'}
                    </span>
                  </div>
                  {filteredPages.map(page => (
                    <button
                      key={page.label}
                      onClick={() => handlePageClick(page.href)}
                      className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9ff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                    >
                      <span className="text-sm font-medium" style={{ color: '#0f172a' }}>{page.label}</span>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded"
                        style={{ backgroundColor: '#e5eeff', color: '#006591' }}
                      >
                        {page.tag}
                      </span>
                    </button>
                  ))}
                </>
              )}

              {/* No Results */}
              {searchQuery && stockResults.length === 0 && filteredPages.length === 0 && !searchingStocks && (
                <div className="px-4 py-6 text-sm text-center" style={{ color: '#94a3b8' }}>
                  No results for &ldquo;{searchQuery}&rdquo;
                </div>
              )}

              {/* Loading */}
              {searchingStocks && (
                <div className="px-4 py-6 text-sm text-center" style={{ color: '#94a3b8' }}>
                  Searching...
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Bell + Profile ── */}
      <div className="flex items-center gap-2">

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }}
            className="relative p-2 rounded-full transition-colors"
            style={{ color: '#475569' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#eff4ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: '22px', fontVariationSettings: "'FILL' 0, 'wght' 300", display: 'block' }}
            >
              notifications
            </span>
            {unreadCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ backgroundColor: '#006591' }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications panel */}
          {notifOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-80 rounded-xl overflow-hidden"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 24px 48px rgba(11,28,48,0.14)',
                zIndex: 100,
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{ borderBottom: '1px solid rgba(226,232,240,0.6)' }}
              >
                <span
                  className="text-sm font-bold"
                  style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                >
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="text-[11px] font-bold transition-opacity hover:opacity-70"
                    style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification rows */}
              <div className="max-h-80 overflow-y-auto">
                {notifications.map(n => (
                  <div
                    key={n.id}
                    className="flex gap-3 px-5 py-4 transition-colors cursor-pointer"
                    style={{
                      backgroundColor: n.unread ? 'rgba(239,244,255,0.6)' : 'transparent',
                      borderBottom: '1px solid rgba(226,232,240,0.4)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9ff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = n.unread ? 'rgba(239,244,255,0.6)' : 'transparent'; }}
                    onClick={() => setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, unread: false } : x))}
                  >
                    <div
                      className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: `${n.iconColor}18` }}
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: '16px', color: n.iconColor, fontVariationSettings: "'FILL' 1, 'wght' 400" }}
                      >
                        {n.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs font-bold truncate"
                          style={{ color: '#0f172a', fontFamily: 'Inter, sans-serif' }}
                        >
                          {n.title}
                        </span>
                        {n.unread && (
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: '#006591' }}
                          />
                        )}
                      </div>
                      <p
                        className="text-[11px] mt-0.5 leading-relaxed"
                        style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                      >
                        {n.body}
                      </p>
                      <span
                        className="text-[10px] mt-1 block"
                        style={{ color: '#94a3b8', fontFamily: 'Inter, sans-serif' }}
                      >
                        {n.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div
                className="px-5 py-3"
                style={{ borderTop: '1px solid rgba(226,232,240,0.6)' }}
              >
                <button
                  className="w-full text-center text-xs font-bold py-1 transition-opacity hover:opacity-70"
                  style={{ color: '#006591', fontFamily: 'Inter, sans-serif' }}
                >
                  View all notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="relative ml-1" ref={profileRef}>
          <button
            onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors"
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#eff4ff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <div
              className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{
                backgroundColor: '#131b2e',
                color: '#ffffff',
                boxShadow: '0 0 0 2px #ffffff, 0 1px 4px rgba(11,28,48,0.15)',
              }}
            >
              AT
            </div>
            <span
              className="text-sm font-semibold hidden md:block"
              style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
            >
              Alexander Thorne
            </span>
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: '16px',
                color: '#64748b',
                fontVariationSettings: "'FILL' 0, 'wght' 300",
                transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s',
              }}
            >
              expand_more
            </span>
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-64 rounded-xl overflow-hidden"
              style={{
                backgroundColor: '#ffffff',
                boxShadow: '0 24px 48px rgba(11,28,48,0.14)',
                zIndex: 100,
              }}
            >
              {/* User info header */}
              <div
                className="px-5 py-4"
                style={{ borderBottom: '1px solid rgba(226,232,240,0.6)' }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: '#131b2e', color: '#ffffff' }}
                  >
                    AT
                  </div>
                  <div>
                    <p
                      className="text-sm font-bold"
                      style={{ color: '#0f172a', fontFamily: 'Manrope, sans-serif' }}
                    >
                      Alexander Thorne
                    </p>
                    <p
                      className="text-[11px]"
                      style={{ color: '#64748b', fontFamily: 'Inter, sans-serif' }}
                    >
                      Premium Tier · Portfolio Alpha
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              {[
                { icon: 'person',           label: 'My Profile',       href: '#' },
                { icon: 'account_balance',  label: 'Account Settings', href: '#' },
                { icon: 'donut_large',      label: 'My Portfolio',     href: '/portfolio' },
                { icon: 'shield',           label: 'Security',         href: '#' },
                { icon: 'help',             label: 'Help & Support',   href: '#' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => { setProfileOpen(false); router.push(item.href); }}
                  className="w-full flex items-center gap-3 px-5 py-3 transition-colors text-left"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#f8f9ff'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '18px', color: '#64748b', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
                  >
                    {item.icon}
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: '#334155', fontFamily: 'Inter, sans-serif' }}
                  >
                    {item.label}
                  </span>
                </button>
              ))}

              {/* Sign out */}
              <div style={{ borderTop: '1px solid rgba(226,232,240,0.6)' }}>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="w-full flex items-center gap-3 px-5 py-3 transition-colors text-left"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff5f5'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: '18px', color: '#ba1a1a', fontVariationSettings: "'FILL' 0, 'wght' 300" }}
                  >
                    logout
                  </span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: '#ba1a1a', fontFamily: 'Inter, sans-serif' }}
                  >
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
