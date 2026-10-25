/**
 * Generate realistic mock performance data with natural market fluctuations
 * Creates a moving average line with ups and downs
 */

export interface PerformanceDataPoint {
  date: string;
  value: number;
}

/**
 * Generate realistic portfolio performance data with natural fluctuations
 * Simulates market volatility with upward trend and realistic variations
 */
export function generatePerformanceData(
  period: '1M' | '3M' | '1Y' | 'ALL',
  baseValue: number = 500000
): PerformanceDataPoint[] {
  const now = new Date();
  const dataPoints: PerformanceDataPoint[] = [];
  
  // Determine number of days and starting value based on period
  let days: number;
  let startValue: number;
  let trend: number; // Overall growth trend
  
  switch (period) {
    case '1M':
      days = 30;
      startValue = baseValue * 0.95; // Start 5% lower
      trend = 0.05; // 5% growth over period
      break;
    case '3M':
      days = 90;
      startValue = baseValue * 0.88; // Start 12% lower
      trend = 0.12;
      break;
    case '1Y':
      days = 365;
      startValue = baseValue * 0.75; // Start 25% lower
      trend = 0.25;
      break;
    case 'ALL':
      days = 730; // 2 years
      startValue = baseValue * 0.60; // Start 40% lower
      trend = 0.40;
      break;
  }
  
  // Generate data points with realistic fluctuations
  let currentValue = startValue;
  const dailyTrend = trend / days; // Average daily growth
  
  for (let i = 0; i <= days; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - i));
    
    // Add trend component (overall upward movement)
    const trendComponent = startValue * dailyTrend * i;
    
    // Add cyclical component (market cycles)
    const cycleFrequency = 2 * Math.PI / 30; // 30-day cycle
    const cyclicalComponent = startValue * 0.03 * Math.sin(i * cycleFrequency);
    
    // Add random volatility (daily fluctuations)
    const volatility = startValue * 0.015; // 1.5% daily volatility
    const randomComponent = (Math.random() - 0.5) * volatility;
    
    // Add occasional larger movements (simulate news events)
    const eventProbability = 0.05; // 5% chance of event
    const eventComponent = Math.random() < eventProbability 
      ? (Math.random() - 0.5) * startValue * 0.04 // ±4% event
      : 0;
    
    // Combine all components
    currentValue = startValue + trendComponent + cyclicalComponent + randomComponent + eventComponent;
    
    // Apply smoothing to prevent too sharp changes
    if (i > 0) {
      const prevValue = dataPoints[i - 1].value;
      const maxChange = prevValue * 0.03; // Max 3% change per day
      const change = currentValue - prevValue;
      
      if (Math.abs(change) > maxChange) {
        currentValue = prevValue + (change > 0 ? maxChange : -maxChange);
      }
    }
    
    dataPoints.push({
      date: date.toISOString().split('T')[0],
      value: Math.round(currentValue * 100) / 100, // Round to 2 decimals
    });
  }
  
  return dataPoints;
}

/**
 * Calculate moving average for smoother line
 */
export function calculateMovingAverage(
  data: PerformanceDataPoint[],
  windowSize: number = 5
): PerformanceDataPoint[] {
  const result: PerformanceDataPoint[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - Math.floor(windowSize / 2));
    const end = Math.min(data.length, i + Math.ceil(windowSize / 2));
    const window = data.slice(start, end);
    
    const avgValue = window.reduce((sum, point) => sum + point.value, 0) / window.length;
    
    result.push({
      date: data[i].date,
      value: Math.round(avgValue * 100) / 100,
    });
  }
  
  return result;
}

/**
 * Get mock performance history for all periods
 */
export function getMockPerformanceHistory(baseValue: number = 500000) {
  return {
    '1M': {
      period: '1M' as const,
      points: generatePerformanceData('1M', baseValue).map(p => ({
        date: p.date,
        open: p.value * 0.998,
        high: p.value * 1.002,
        low: p.value * 0.996,
        close: p.value,
        volume: 0,
      })),
      peakValue: baseValue * 1.02,
    },
    '3M': {
      period: '3M' as const,
      points: generatePerformanceData('3M', baseValue).map(p => ({
        date: p.date,
        open: p.value * 0.998,
        high: p.value * 1.002,
        low: p.value * 0.996,
        close: p.value,
        volume: 0,
      })),
      peakValue: baseValue * 1.05,
    },
    '1Y': {
      period: '1Y' as const,
      points: generatePerformanceData('1Y', baseValue).map(p => ({
        date: p.date,
        open: p.value * 0.998,
        high: p.value * 1.002,
        low: p.value * 0.996,
        close: p.value,
        volume: 0,
      })),
      peakValue: baseValue * 1.15,
    },
    'ALL': {
      period: 'ALL' as const,
      points: generatePerformanceData('ALL', baseValue).map(p => ({
        date: p.date,
        open: p.value * 0.998,
        high: p.value * 1.002,
        low: p.value * 0.996,
        close: p.value,
        volume: 0,
      })),
      peakValue: baseValue * 1.25,
    },
  };
}
