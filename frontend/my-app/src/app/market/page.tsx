import { getMarketData } from '@/lib/data/mockMarket';
import MarketPageClient from './components/MarketPageClient';

// React Server Component that fetches initial data
// Client component handles search and dynamic chart updates

export default async function MarketPage() {
  const data = await getMarketData();

  return <MarketPageClient initialData={data} />;
}
