import { BASE_URL, apiFetch, REVALIDATE } from '@/lib/api/client';
import type { InvestorPersona, MindsetSSEEvent } from '@/lib/types/mindset';

interface PersonasResponse {
  personas: InvestorPersona[];
}

export interface MindsetSSECallbacks {
  onThinking: (step: string, status: 'running' | 'done' | 'error') => void;
  onAnswerStart: () => void;
  onAnswerChunk: (content: string) => void;
  onAnswerEnd: () => void;
  onDone: (info: { total_tokens: number; duration_ms: number }) => void;
  onError: (message: string) => void;
}

const MOCK_PERSONAS: InvestorPersona[] = [
  {
    id: 'warren_buffett',
    name: 'Warren Buffett',
    title: 'Chairman & CEO, Berkshire Hathaway',
    era: 'Value Era (1965–present)',
    image_url: '/personas/warren_buffet.png',
    core_style: 'Buy wonderful companies at fair prices and hold forever.',
    persona_summary:
      'The "Oracle of Omaha" built one of the world\'s greatest fortunes by investing in businesses with durable competitive advantages, honest management, and predictable earnings—then holding them indefinitely.',
    stocks_focus: ['AAPL', 'KO', 'BAC', 'AXP', 'OXY'],
    sectors_focus: ['Consumer Staples', 'Financials', 'Energy'],
    risk_profile: 'Low-Medium',
    time_horizon: 'Decades',
    net_worth_estimate: '₹133 B',
    famous_advice: 'Be fearful when others are greedy, and greedy when others are fearful.',
    signature_bets: ['Coca-Cola', 'American Express', 'GEICO', 'Apple', 'BNSF Railway'],
    notable_facts: [
      'Donated over ₹50 B to charity through the Giving Pledge.',
      'Bought his first stock at age 11.',
      'Lives in the same Omaha house he bought for ₹31,500 in 1958.',
    ],
    principles: [
      'Circle of competence',
      'Margin of safety',
      'Owner-operator mindset',
      'Long-term compounding',
    ],
    sample_prompts: [
      'What is your view on Apple\'s moat?',
      'How do you assess management quality?',
    ],
  },
  {
    id: 'ray_dalio',
    name: 'Ray Dalio',
    title: 'Founder, Bridgewater Associates',
    era: 'Macro Era (1975–present)',
    image_url: '/personas/ray_dalio.png',
    core_style: 'Radical transparency, macro cycles, and risk parity.',
    persona_summary:
      'Dalio built the world\'s largest hedge fund on systematic macro analysis, radical transparency, and an "All Weather" portfolio designed to perform across every economic environment.',
    stocks_focus: ['SPY', 'GLD', 'TLT', 'EEM', 'VWO'],
    sectors_focus: ['Macro', 'Global Equities', 'Commodities'],
    risk_profile: 'Medium',
    time_horizon: '3–10 years',
  net_worth_estimate: '₹15.4 B',
    famous_advice: 'He who lives by the crystal ball will eat shattered glass.',
    signature_bets: ['Gold', 'Emerging Markets', 'Risk Parity', 'Inflation-linked bonds'],
    notable_facts: [
      'Founded Bridgewater from his apartment in 1975.',
      'Authored Principles, a bestselling manifesto on life and work.',
      'Pioneer of risk-parity portfolio construction.',
    ],
    principles: [
      'Debt cycle framework',
      'Risk parity',
      'Radical transparency',
      'Diversification across uncorrelated assets',
    ],
    sample_prompts: ['How does the debt cycle affect markets now?', 'What is risk parity?'],
  },
  {
    id: 'peter_lynch',
    name: 'Peter Lynch',
    title: 'Former Manager, Fidelity Magellan Fund',
    era: 'Growth Era (1977–1990)',
    image_url: '/personas/peter_lynch.png',
    core_style: 'Invest in what you know. Tenbaggers hide in plain sight.',
    persona_summary:
      'Lynch turned Magellan into the world\'s best-performing mutual fund with a 29.2% annualised return by finding growth stories in everyday products before Wall Street noticed.',
    stocks_focus: ['SBUX', 'HD', 'ROST', 'TJX', 'NKE'],
    sectors_focus: ['Consumer Discretionary', 'Retail', 'Growth'],
    risk_profile: 'Medium-High',
    time_horizon: '2–5 years',
  net_worth_estimate: '₹450 M',
    famous_advice: 'Know what you own, and know why you own it.',
    signature_bets: ['Dunkin\' Donuts', 'Chrysler', 'Taco Bell', 'Fannie Mae'],
    notable_facts: [
      'Averaged 29.2% annual returns over 13 years at Magellan.',
      'Coined the term "tenbagger" for a stock that rises 10×.',
      'Famously invested in Hanes after his wife praised L\'eggs pantyhose.',
    ],
    principles: [
      'Invest in what you know',
      'PEG ratio over P/E',
      'Avoid "diworsification"',
      'Story-driven investing',
    ],
    sample_prompts: ['How do I find a tenbagger?', 'What PEG ratio makes a stock attractive?'],
  },
  {
    id: 'charlie_munger',
    name: 'Charlie Munger',
    title: 'Vice Chairman, Berkshire Hathaway',
    era: 'Mental Models Era (1978–2023)',
    image_url: '/personas/charlie_munger.png',
    core_style: 'Mental models, latticework of knowledge, invert always.',
    persona_summary:
      'Munger\'s multidisciplinary "latticework of mental models" shaped Buffett\'s evolution from cigar-butt investor to quality-focused owner. He was famous for brutal honesty and razor-sharp wit.',
    stocks_focus: ['BRK.B', 'BABA', 'WFC', 'USB', 'COST'],
    sectors_focus: ['Finance', 'Consumer Staples', 'Technology'],
    risk_profile: 'Low-Medium',
    time_horizon: 'Decades',
  net_worth_estimate: '₹2.6 B',
    famous_advice: 'Invert, always invert: turn a situation or problem upside down.',
    signature_bets: ['Costco', 'Alibaba', 'Daily Journal Corporation'],
    notable_facts: [
      'Co-built Berkshire Hathaway alongside Warren Buffett for 45+ years.',
      'Read voraciously — frequently cited as reading 500 pages per day.',
      'Passed away in November 2023 at 99, just weeks short of his 100th birthday.',
    ],
    principles: [
      'Latticework of mental models',
      'Inversion thinking',
      'Avoid envy and self-pity',
      'Continuous learning',
    ],
    sample_prompts: ['What mental models apply to this investment?', 'How do I invert this problem?'],
  },
  {
    id: 'cathie_wood',
    name: 'Cathie Wood',
    title: 'Founder & CIO, ARK Invest',
    era: 'Disruptive Innovation Era (2014–present)',
    image_url: '/personas/cathie_wood.png',
    core_style: 'Bet boldly on convergent disruptive technologies.',
    persona_summary:
      'Wood built ARK Invest to focus exclusively on disruptive innovation — AI, genomics, fintech, autonomous vehicles, and blockchain — with a 5-year time horizon and high conviction, concentrated positions.',
    stocks_focus: ['TSLA', 'COIN', 'ROKU', 'CRSP', 'SQ'],
    sectors_focus: ['Technology', 'Healthcare Innovation', 'Fintech'],
    risk_profile: 'High',
    time_horizon: '5 years',
  net_worth_estimate: '₹250 M',
    famous_advice: 'If we are right, the returns will be extraordinary. If we are wrong, we are wrong early.',
    signature_bets: ['Tesla', 'Coinbase', 'CRISPR Therapeutics', 'UiPath', 'Palantir'],
    notable_facts: [
      'ARK Innovation ETF returned 157% in 2020, the best year for any active ETF.',
      'Publishes all trades publicly every day — a unique transparency move.',
  'Target price for Tesla: ₹2,000+ by 2027.',
    ],
    principles: [
      'Convergence of disruptive technologies',
      'Wright\'s Law cost curves',
      'High-conviction, concentrated bets',
      '5-year investment horizon',
    ],
    sample_prompts: ['What is the AI opportunity size?', 'Why is Tesla more than a car company?'],
  },
];

export async function getMindsetPersonas(): Promise<InvestorPersona[]> {
  try {
    const response = await apiFetch<PersonasResponse>('/mindset/personas', {
      revalidate: REVALIDATE.SLOW,
    });
    if (response.personas && response.personas.length > 0) return response.personas;
    return MOCK_PERSONAS;
  } catch {
    return MOCK_PERSONAS;
  }
}

export async function streamMindsetChat(
  query: string,
  personaId: string,
  callbacks: MindsetSSECallbacks,
  signal?: AbortSignal,
  extraContext?: string,
): Promise<void> {
  const response = await fetch(`${BASE_URL}/mindset/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, persona_id: personaId, extra_context: extraContext ?? null }),
    signal,
  });

  if (!response.ok) {
    callbacks.onError(`HTTP ${response.status}: ${response.statusText}`);
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError('No response stream available');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const jsonStr = trimmed.slice(5).trim();
        if (!jsonStr || jsonStr === '[DONE]') continue;

        try {
          const event = JSON.parse(jsonStr) as MindsetSSEEvent;

          switch (event.type) {
            case 'thinking':
              callbacks.onThinking(event.step, event.status);
              break;
            case 'answer_start':
              callbacks.onAnswerStart();
              break;
            case 'answer_chunk':
              callbacks.onAnswerChunk(event.content);
              break;
            case 'answer_end':
              callbacks.onAnswerEnd();
              break;
            case 'done':
              callbacks.onDone(event);
              break;
            case 'error':
              callbacks.onError(event.message);
              break;
            default:
              break;
          }
        } catch {
          // Ignore malformed stream events.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
