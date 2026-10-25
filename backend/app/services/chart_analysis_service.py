"""AI-powered chart analysis and reasoning service."""
from typing import Any
import random


def analyze_chart_pattern(
    symbol: str,
    bars: list[dict[str, Any]],
    rsi: float | None = None,
    macd: float | None = None,
) -> dict[str, Any]:
    """
    Generate AI-powered reasoning for chart patterns.
    
    Args:
        symbol: Stock ticker
        bars: OHLCV data (last 20-30 bars)
        rsi: Current RSI value
        macd: Current MACD value
    
    Returns:
        {
            "summary": "Brief 1-line insight",
            "trend_analysis": "Detailed trend explanation",
            "technical_signals": ["Signal 1", "Signal 2", ...],
            "risk_assessment": "Low/Medium/High with explanation",
            "key_levels": {"support": float, "resistance": float},
            "recommendation": "BUY/HOLD/SELL with reasoning"
        }
    """
    if not bars or len(bars) < 5:
        return {
            "summary": "Insufficient data for analysis",
            "trend_analysis": "Need at least 5 trading days for pattern recognition.",
            "technical_signals": [],
            "risk_assessment": "Unknown",
            "key_levels": {},
            "recommendation": "HOLD - Awaiting more data"
        }
    
    # Calculate key metrics
    closes = [b["close"] for b in bars if b.get("close")]
    if not closes:
        return {"summary": "Invalid data", "trend_analysis": "", "technical_signals": [], "risk_assessment": "Unknown", "key_levels": {}, "recommendation": "HOLD"}
    
    current_price = closes[-1]
    prev_price = closes[-2] if len(closes) > 1 else current_price
    price_change = ((current_price - prev_price) / prev_price) * 100
    
    # Trend detection
    sma_5 = sum(closes[-5:]) / min(5, len(closes))
    sma_20 = sum(closes[-20:]) / min(20, len(closes)) if len(closes) >= 20 else sma_5
    
    trend = "bullish" if sma_5 > sma_20 else "bearish" if sma_5 < sma_20 else "neutral"
    
    # Volatility
    highs = [b["high"] for b in bars[-10:] if b.get("high")]
    lows = [b["low"] for b in bars[-10:] if b.get("low")]
    volatility = (max(highs) - min(lows)) / current_price * 100 if highs and lows else 0
    
    # Support/Resistance
    recent_lows = sorted([b["low"] for b in bars[-20:] if b.get("low")])
    recent_highs = sorted([b["high"] for b in bars[-20:] if b.get("high")], reverse=True)
    support = recent_lows[len(recent_lows)//4] if recent_lows else current_price * 0.95
    resistance = recent_highs[len(recent_highs)//4] if recent_highs else current_price * 1.05
    
    # Pattern recognition
    patterns = []
    if len(closes) >= 3:
        if closes[-1] > closes[-2] > closes[-3]:
            patterns.append("Ascending momentum - three consecutive higher closes")
        elif closes[-1] < closes[-2] < closes[-3]:
            patterns.append("Descending pressure - three consecutive lower closes")
    
    # RSI signals
    if rsi is not None:
        if rsi > 70:
            patterns.append(f"RSI overbought at {rsi:.1f} - potential reversal zone")
        elif rsi < 30:
            patterns.append(f"RSI oversold at {rsi:.1f} - potential bounce opportunity")
        elif 45 <= rsi <= 55:
            patterns.append(f"RSI neutral at {rsi:.1f} - balanced momentum")
    
    # MACD signals
    if macd is not None:
        if macd > 0:
            patterns.append(f"MACD bullish crossover - positive momentum ({macd:.2f})")
        elif macd < 0:
            patterns.append(f"MACD bearish crossover - negative momentum ({macd:.2f})")
    
    # Volume analysis (if available)
    volumes = [b.get("volume", 0) for b in bars[-5:]]
    avg_volume = sum(volumes) / len(volumes) if volumes else 0
    recent_volume = volumes[-1] if volumes else 0
    if recent_volume > avg_volume * 1.5:
        patterns.append("High volume spike - increased institutional interest")
    elif recent_volume < avg_volume * 0.5:
        patterns.append("Low volume - weak conviction in current move")
    
    # Risk assessment
    if volatility > 5:
        risk = "High"
        risk_detail = f"Elevated volatility ({volatility:.1f}%) suggests increased risk. Consider tighter stops."
    elif volatility > 2.5:
        risk = "Medium"
        risk_detail = f"Moderate volatility ({volatility:.1f}%) - normal market conditions."
    else:
        risk = "Low"
        risk_detail = f"Low volatility ({volatility:.1f}%) - stable price action."
    
    # Recommendation logic
    bullish_score = 0
    bearish_score = 0
    
    if trend == "bullish":
        bullish_score += 2
    elif trend == "bearish":
        bearish_score += 2
    
    if rsi and rsi < 35:
        bullish_score += 1
    elif rsi and rsi > 65:
        bearish_score += 1
    
    if macd and macd > 0:
        bullish_score += 1
    elif macd and macd < 0:
        bearish_score += 1
    
    if price_change > 2:
        bullish_score += 1
    elif price_change < -2:
        bearish_score += 1
    
    if bullish_score > bearish_score + 1:
        recommendation = "BUY"
        rec_reason = f"Strong bullish signals ({bullish_score} vs {bearish_score}). {trend.capitalize()} trend with supportive technicals."
    elif bearish_score > bullish_score + 1:
        recommendation = "SELL"
        rec_reason = f"Bearish indicators dominate ({bearish_score} vs {bullish_score}). {trend.capitalize()} trend suggests caution."
    else:
        recommendation = "HOLD"
        rec_reason = f"Mixed signals ({bullish_score} bullish, {bearish_score} bearish). Wait for clearer direction."
    
    # Trend analysis narrative
    trend_narrative = (
        f"{symbol} is currently in a **{trend} trend** with price at ${current_price:.2f} "
        f"({'up' if price_change > 0 else 'down'} {abs(price_change):.1f}% from previous close). "
        f"The 5-day moving average (${sma_5:.2f}) is {'above' if sma_5 > sma_20 else 'below'} "
        f"the 20-day average (${sma_20:.2f}), confirming {trend} momentum. "
    )
    
    if current_price < support * 1.02:
        trend_narrative += f"Price is testing support near ${support:.2f}. "
    elif current_price > resistance * 0.98:
        trend_narrative += f"Price is approaching resistance at ${resistance:.2f}. "
    else:
        trend_narrative += f"Price is trading between support (${support:.2f}) and resistance (${resistance:.2f}). "
    
    # Summary
    summary = f"{trend.capitalize()} trend with {risk.lower()} volatility - {recommendation} signal active"
    
    return {
        "summary": summary,
        "trend_analysis": trend_narrative,
        "technical_signals": patterns if patterns else ["No significant patterns detected in current timeframe"],
        "risk_assessment": f"{risk} - {risk_detail}",
        "key_levels": {
            "support": round(support, 2),
            "resistance": round(resistance, 2),
            "current": round(current_price, 2),
        },
        "recommendation": f"{recommendation} - {rec_reason}",
        "metadata": {
            "volatility": round(volatility, 2),
            "trend": trend,
            "rsi": round(rsi, 1) if rsi else None,
            "macd": round(macd, 2) if macd else None,
        }
    }
