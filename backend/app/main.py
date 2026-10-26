import json
import logging
import time
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from starlette.responses import Response
from sse_starlette.sse import EventSourceResponse

from app.services import yfinance_service as yf_svc
from app.services import nse_service as nse_svc
from app.services import portfolio_service as portfolio_svc
from app.services import insights_service as insights_svc
from app.services import investments_service as investments_svc
from app.services import news_service as news_svc
from app.services import markets_service as markets_svc
from app.services import portfolio_analysis_service as portfolio_analysis_svc
from app.services import chart_analysis_service as chart_analysis_svc
from app.services import reports_service as reports_svc
from app.services import reports_pdf_service as reports_pdf_svc
from app.services import investor_mindset_service as mindset_svc
from app.services import learners_service as learners_svc
from app.services import future_service as future_svc
from app.services.mail_config import is_mail_configured
from app.services.mail_service import send_report_email
from app.research.router import router as research_router
from app.research.limits import ResearchIntakeLimit
from app.research.automation.runtime import automation_lifespan as application_lifespan
from app.research.automation.router import router as automation_router, AutomationIntakeLimit
from app.analyst_watch.router import router as watch_router, WatchGuard
from app.research.ecosystem.router import router as ecosystem_router
from app.research.ecosystem.limits import EcosystemIntakeLimit


REPORT_EMAIL_RECIPIENT = "architvarma25@gmail.com"


# Pydantic models for request bodies
class HoldingCreate(BaseModel):
    symbol: str
    quantity: float
    avg_buy_price: float
    asset_type: str = "equity"


class HoldingUpdate(BaseModel):
    quantity: float | None = None
    avg_buy_price: float | None = None


class TransactionCreate(BaseModel):
    type: str  # buy, sell, dividend
    symbol: str
    quantity: float | None = None
    price: float | None = None
    amount: float | None = None


class CashUpdate(BaseModel):
    amount: float


class ReportEmailRequest(BaseModel):
    to_email: str | None = None
    period: str = "1M"
    year: int | None = None
    month: int | None = None
    subject: str | None = None
    message: str | None = None


class FuturePredictionTrainRequest(BaseModel):
    ticker: str = Field(..., min_length=1, max_length=20)
    model: str = Field(default="hybrid", description="hybrid | linear | logistic | linear_stochastic | regime_switch")
    period: str = Field(default="5y", description="1mo,3mo,6mo,1y,2y,5y,10y,ytd,max")
    horizon: int = Field(default=30, ge=7, le=90)

app = FastAPI(title="CodeCrafters API", version="0.1.0", lifespan=application_lifespan)

app.include_router(research_router)
app.include_router(automation_router)
app.add_middleware(AutomationIntakeLimit)
app.include_router(ecosystem_router)
app.include_router(watch_router)
app.add_middleware(WatchGuard)
app.add_middleware(ResearchIntakeLimit)
app.add_middleware(EcosystemIntakeLimit)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


# ============== YFINANCE ENDPOINTS ==============

@app.get("/yf/search")
async def yf_search(q: str = Query(..., description="Search query for stocks")):
    """Search for stocks by ticker or name."""
    return yf_svc.search_stocks(q)


@app.get("/yf/quote/{symbol}")
async def yf_quote(symbol: str):
    """Get live quote via yfinance."""
    return yf_svc.get_stock_quote(symbol)


@app.get("/yf/fundamentals/{symbol}")
async def yf_fundamentals(symbol: str):
    """Get fundamentals via yfinance."""
    return yf_svc.get_stock_fundamentals(symbol)


@app.get("/yf/history/{symbol}")
async def yf_history(
    symbol: str,
    period: str = Query("1mo", description="1d,5d,1mo,3mo,6mo,1y,5y,max"),
    interval: str = Query("1d", description="1m,5m,15m,1h,1d,1wk,1mo"),
):
    """Get OHLCV history via yfinance."""
    return yf_svc.get_stock_history(symbol, period, interval)


@app.get("/yf/financials/{symbol}")
async def yf_financials(symbol: str):
    """Get financial statements via yfinance."""
    return yf_svc.get_financials(symbol)


@app.get("/yf/earnings/{symbol}")
async def yf_earnings(symbol: str):
    """Get earnings dates via yfinance."""
    return yf_svc.get_earnings(symbol)


@app.get("/yf/recommendations/{symbol}")
async def yf_recommendations(symbol: str):
    """Get analyst recommendations via yfinance."""
    return yf_svc.get_recommendations(symbol)


@app.post("/yf/batch-quotes")
async def yf_batch_quotes(symbols: list[str]):
    """Get quotes for multiple symbols."""
    return yf_svc.get_batch_quotes(symbols)


@app.get("/yf/index/{symbol}")
async def yf_index(symbol: str):
    """Get index quote (^NSEI, ^BSESN, ^NSEBANK)."""
    return yf_svc.get_index_quote(symbol)


@app.get("/yf/index-history/{symbol}")
async def yf_index_history(
    symbol: str,
    period: str = Query("1mo"),
    interval: str = Query("1d"),
):
    """Get index history."""
    return yf_svc.get_index_history(symbol, period, interval)


@app.get("/yf/options/{symbol}")
async def yf_options(symbol: str, expiry: str | None = None):
    """Get option chain via yfinance."""
    return yf_svc.get_option_chain(symbol, expiry)


@app.get("/yf/option-expiries/{symbol}")
async def yf_option_expiries(symbol: str):
    """Get available option expiries."""
    return yf_svc.get_option_expiries(symbol)


@app.get("/yf/iv-surface/{symbol}")
async def yf_iv_surface(symbol: str):
    """Get IV surface via yfinance."""
    return yf_svc.get_iv_surface(symbol)


@app.post("/yf/analyze-chart")
async def yf_analyze_chart(payload: dict):
    """
    AI-powered chart pattern analysis and reasoning.
    
    Payload:
        {
            "symbol": "AAPL",
            "bars": [{"date": "...", "open": ..., "high": ..., "low": ..., "close": ..., "volume": ...}, ...],
            "rsi": 45.2,
            "macd": 0.15
        }
    """
    symbol = payload.get("symbol", "UNKNOWN")
    bars = payload.get("bars", [])
    rsi = payload.get("rsi")
    macd = payload.get("macd")
    
    return chart_analysis_svc.analyze_chart_pattern(symbol, bars, rsi, macd)


# ============== NSE INDIA ENDPOINTS ==============

@app.get("/nse/quote/{symbol}")
async def nse_quote(symbol: str):
    """Get live NSE quote."""
    return nse_svc.get_stock_quote(symbol)


@app.get("/nse/indices")
async def nse_indices():
    """Get all NSE indices."""
    return nse_svc.get_all_indices()


@app.get("/nse/nifty50")
async def nse_nifty50():
    """Get all Nifty 50 stocks live data."""
    return nse_svc.get_nifty50_stocks()


@app.get("/nse/market-status")
async def nse_market_status():
    """Get NSE market status."""
    return nse_svc.get_market_status()


@app.get("/nse/options/{symbol}")
async def nse_options(symbol: str, is_index: bool = True):
    """Get NSE option chain."""
    return nse_svc.get_option_chain(symbol, is_index)


@app.get("/nse/pcr/{symbol}")
async def nse_pcr(symbol: str, is_index: bool = True):
    """Get Put-Call Ratio."""
    return nse_svc.get_pcr(symbol, is_index)


@app.get("/nse/iv-surface/{symbol}")
async def nse_iv_surface(symbol: str, is_index: bool = True):
    """Get IV surface from NSE."""
    return nse_svc.get_iv_surface(symbol, is_index)


# ============== PORTFOLIO ENDPOINTS ==============

@app.get("/portfolio")
async def get_portfolio():
    """Get full portfolio with live prices."""
    return portfolio_svc.get_holdings()


@app.get("/portfolio/unified-investments")
async def get_unified_investments():
    """Get unified active holdings and watchlist."""
    return portfolio_svc.get_unified_investments()


from pydantic import BaseModel

class HoldingBuyRequest(BaseModel):
    symbol: str
    quantity: float
    avg_buy_price: float
    buy_date: str

@app.post("/portfolio/holdings/add")
async def add_holding_endpoint(req: HoldingBuyRequest):
    """Add new active holding."""
    return portfolio_svc.add_holding(
        req.symbol, req.quantity, req.avg_buy_price, req.buy_date
    )

@app.delete("/portfolio/holdings/remove/{symbol}")
async def remove_holding_endpoint(symbol: str):
    """Delete an active holding."""
    return portfolio_svc.remove_holding(symbol)

class WatchlistAddRequest(BaseModel):
    symbol: str
    quantity: float = 0.0
    buy_date: str | None = None
    sell_date: str | None = None

@app.post("/portfolio/watchlist/add")
async def add_to_watchlist(req: WatchlistAddRequest):
    """Add symbol to watchlist."""
    return portfolio_svc.add_to_watchlist(
        req.symbol, req.quantity, req.buy_date, req.sell_date
    )


@app.delete("/portfolio/watchlist/remove/{symbol}")
async def remove_from_watchlist(symbol: str):
    """Remove symbol from watchlist."""
    return portfolio_svc.remove_from_watchlist(symbol)


@app.get("/portfolio/summary")
async def get_portfolio_summary():
    """Get portfolio summary with totals and allocation."""
    return portfolio_svc.get_portfolio_summary()


@app.get("/portfolio/top-performers")
async def get_top_performers(limit: int = Query(5)):
    """Get top performing holdings by daily change."""
    return portfolio_svc.get_top_performers(limit)


@app.get("/portfolio/activity")
async def get_activity(limit: int = Query(10)):
    """Get recent transactions."""
    return portfolio_svc.get_activity(limit)


@app.post("/portfolio/holding")
async def add_holding(holding: HoldingCreate):
    """Add a new holding."""
    return portfolio_svc.add_holding(
        holding.symbol,
        holding.quantity,
        holding.avg_buy_price,
        holding.asset_type,
    )


@app.put("/portfolio/holding/{symbol}")
async def update_holding(symbol: str, holding: HoldingUpdate):
    """Update a holding."""
    return portfolio_svc.update_holding(symbol, holding.quantity, holding.avg_buy_price)


@app.delete("/portfolio/holding/{symbol}")
async def remove_holding(symbol: str):
    """Remove a holding."""
    return portfolio_svc.remove_holding(symbol)


@app.post("/portfolio/transaction")
async def add_transaction(txn: TransactionCreate):
    """Add a transaction (buy/sell/dividend)."""
    return portfolio_svc.add_transaction(
        txn.type,
        txn.symbol,
        txn.quantity,
        txn.price,
        txn.amount,
    )


@app.put("/portfolio/cash")
async def update_cash(cash: CashUpdate):
    """Update cash balance."""
    return portfolio_svc.update_cash_balance(cash.amount)


@app.post("/portfolio/buy")
async def buy_stock(symbol: str, amount: float):
    """Buy stock with specified dollar amount."""
    return portfolio_svc.buy_stock(symbol, amount)


@app.post("/portfolio/sell")
async def sell_stock(symbol: str, amount: float):
    """Sell stock worth specified dollar amount."""
    return portfolio_svc.sell_stock(symbol, amount)


# ============== INSIGHTS ENDPOINTS ==============

@app.get("/insights")
async def get_insights():
    """Get AI-driven insights."""
    return insights_svc.get_ai_insights()


@app.get("/insights/risk-score")
async def get_risk_score():
    """Get portfolio risk score."""
    holdings = portfolio_svc.get_holdings()
    return insights_svc.get_risk_score(holdings)


@app.get("/insights/rebalancing")
async def get_rebalancing():
    """Get rebalancing suggestions."""
    holdings = portfolio_svc.get_holdings()
    summary = portfolio_svc.get_portfolio_summary()
    return insights_svc.get_rebalancing_suggestions(holdings, summary.get("allocation", {}))


# ============== INVESTMENTS PAGE ENDPOINTS ==============

@app.get("/investments/future-predictions/{ticker}")
async def get_future_prediction_chart(
    ticker: str,
    model: str = Query("hybrid", description="hybrid | linear | logistic | linear_stochastic | regime_switch"),
    period: str = Query("5y", description="1mo,3mo,6mo,1y,2y,5y,10y,ytd,max"),
    horizon: int = Query(30, ge=7, le=90, description="Forecast horizon in business days"),
    retrain: bool = Query(False, description="If true, retrain model before generating chart"),
):
    """Get model-based future prediction chart payload for a ticker."""
    return future_svc.generate_future_chart(
        ticker=ticker,
        model=model,
        period=period,
        horizon=horizon,
        retrain=retrain,
    )


@app.post("/investments/future-predictions/train")
async def train_future_prediction_models(payload: FuturePredictionTrainRequest):
    """Train/retrain prediction model(s) for ticker and return chart-ready output."""
    return future_svc.train_future_models(
        ticker=payload.ticker,
        model=payload.model,
        period=payload.period,
        horizon=payload.horizon,
    )

@app.get("/investments/stats")
async def get_investment_stats():
    """Get investment page top stats (total value, profit, day's change, buying power)."""
    return investments_svc.get_investment_stats()


@app.get("/investments/holdings")
async def get_holdings_table():
    """Get holdings table with trend sparkline data."""
    return investments_svc.get_holdings_table()


@app.get("/investments/performance")
async def get_performance_history(period: str = Query("1M", description="1M, 3M, 1Y, ALL")):
    """Get portfolio performance history for chart."""
    return investments_svc.get_performance_history(period)


@app.get("/investments/breakdown")
async def get_asset_breakdown():
    """Get asset breakdown for pie chart."""
    return investments_svc.get_asset_breakdown()


@app.get("/investments/opportunities")
async def get_opportunities():
    """Get investment opportunities (mock)."""
    return investments_svc.get_opportunities()


@app.get("/investments/alerts")
async def get_portfolio_alerts():
    """Get portfolio risk alerts."""
    return investments_svc.get_portfolio_alerts()


# ============== NEWS ENDPOINTS ==============

@app.get("/news")
async def get_news(
    category: str | None = Query(None, description="Filter by category: macro, equity, commodity, crypto"),
    ticker: str | None = Query(None, description="Filter by ticker symbol"),
    limit: int = Query(20, description="Max articles to return"),
    refresh: bool = Query(False, description="Force refresh from API"),
):
    """Get news articles with optional filters."""
    return news_svc.get_news(category=category, ticker=ticker, limit=limit, refresh=refresh)


@app.post("/news/refresh")
async def refresh_news():
    """Force refresh news from Finnhub API."""
    return news_svc.fetch_and_store()


@app.get("/news/flashcards")
async def get_news_flashcards(refresh: bool = Query(False)):
    """Get lightweight news flashcards for UI ticker."""
    return news_svc.get_flashcards(refresh=refresh)


@app.get("/news/sentiment")
async def get_news_sentiment(refresh: bool = Query(False)):
    """Get aggregated sentiment summary by category and ticker."""
    return news_svc.get_sentiment_summary(refresh=refresh)


@app.get("/news/ticker/{ticker}")
async def get_ticker_news(ticker: str, limit: int = Query(10)):
    """Get news for a specific ticker."""
    return news_svc.get_ticker_news(ticker=ticker, limit=limit)


@app.get("/news/market-intelligence")
async def get_market_intelligence_feed(
    domain: str = Query("all", description="Filter by domain: all, macro, equity, commodity, crypto"),
    limit: int = Query(10, description="Max articles to return"),
):
    """Get Market Intelligence Feed for Overview page with domain filtering."""
    return news_svc.get_market_intelligence_feed(domain=domain, limit=limit)


# ============== MARKETS PAGE ENDPOINTS ==============

@app.get("/markets")
async def get_markets_data():
    """Get all market data for the Markets page."""
    return markets_svc.get_full_market_data()


@app.get("/markets/indices")
async def get_market_indices():
    """Get market indices (S&P 500, NASDAQ, BTC, ETH)."""
    return markets_svc.get_market_indices()


@app.get("/markets/chart")
async def get_chart_data(symbol: str = Query("QQQ", description="Symbol for chart data")):
    """Get candlestick chart data for all periods."""
    return markets_svc.get_chart_data(symbol)


@app.get("/markets/sectors")
async def get_sector_heatmap():
    """Get sector performance heatmap."""
    return markets_svc.get_sector_heatmap()


@app.get("/markets/signals")
async def get_algorithmic_signals():
    """Get algorithmic trading signals."""
    return markets_svc.get_algorithmic_signals()


@app.get("/markets/forecasts")
async def get_growth_forecasts():
    """Get growth forecasts for sectors."""
    return markets_svc.get_growth_forecasts()


@app.get("/markets/assets")
async def get_asset_explorer(tab: str = Query("STOCKS", description="STOCKS, OPTIONS, or CRYPTO")):
    """Get assets for the explorer table."""
    return markets_svc.get_asset_explorer(tab)


# ============== PORTFOLIO ANALYSIS ENDPOINTS ==============

@app.get("/portfolio/analysis")
async def get_portfolio_analysis():
    """Get full portfolio analysis for the Portfolio page."""
    return portfolio_analysis_svc.get_full_portfolio_analysis()


@app.get("/portfolio/diversification")
async def get_diversification_score():
    """Get portfolio diversification score."""
    return portfolio_analysis_svc.compute_diversification_score()


@app.get("/portfolio/allocation")
async def get_allocation():
    """Get current vs target allocation."""
    return portfolio_analysis_svc.compute_allocation()


@app.put("/portfolio/allocation/targets")
async def update_allocation_targets(targets: dict[str, float]):
    """Update target allocation percentages."""
    return portfolio_analysis_svc.update_allocation_targets(targets)


@app.get("/portfolio/rebalancing")
async def get_rebalancing_recommendations():
    """Get rebalancing recommendations."""
    return portfolio_analysis_svc.compute_rebalancing_recommendations()


@app.get("/portfolio/strategy")
async def get_current_strategy():
    """Get current investment strategy."""
    return portfolio_analysis_svc.get_current_strategy()


class StrategyUpdate(BaseModel):
    name: str
    description: str
    ctaLabel: str = "Change Strategy"


class StrategyDraftUpdate(BaseModel):
    name: str
    description: str
    ctaLabel: str = "Apply Strategy"
    source: str = "manual"
    notes: str | None = None
    objective: str | None = None
    time_horizon: str | None = None
    risk_profile: str | None = None
    rebalance_rule: str | None = None
    max_drawdown_pct: float | None = None
    max_single_position_pct: float | None = None
    max_sector_exposure_pct: float | None = None
    stop_loss_rule: str | None = None
    entry_rule: str | None = None
    validation_metrics: list[str] = Field(default_factory=list)
    allocation_targets: dict[str, float] = Field(default_factory=dict)
    suggested_actions: list[str] = Field(default_factory=list)


@app.put("/portfolio/strategy")
async def update_strategy(strategy: StrategyUpdate):
    """Update current investment strategy."""
    return portfolio_analysis_svc.update_current_strategy(strategy.model_dump())


@app.get("/portfolio/strategy/advisor")
async def get_strategy_advisor():
    """Get strategy advisor recommendation."""
    return portfolio_analysis_svc.get_strategy_advisor()


@app.get("/portfolio/strategy/editor")
async def get_strategy_editor_state():
    """Get active strategy and pending draft for editor UI."""
    return portfolio_analysis_svc.get_strategy_editor_state()


@app.post("/portfolio/strategy/draft")
async def save_strategy_draft(payload: StrategyDraftUpdate):
    """Save strategy draft from manual editor or Veritas apply action."""
    return portfolio_analysis_svc.save_strategy_draft(payload.model_dump())


@app.post("/portfolio/strategy/accept")
async def accept_strategy_draft():
    """Accept pending strategy draft and apply it as current strategy."""
    return portfolio_analysis_svc.accept_strategy_draft()


@app.get("/portfolio/goals")
async def get_goals():
    """Get investment goals with progress."""
    return portfolio_analysis_svc.get_goals()


class GoalUpdate(BaseModel):
    id: str
    icon: str = "flag"
    iconBg: str = "#e5eeff"
    iconColor: str = "#131b2e"
    label: str
    targetValue: float
    progressBarColor: str = "#000000"


@app.put("/portfolio/goals")
async def update_goals(goals: list[GoalUpdate]):
    """Update investment goals."""
    return portfolio_analysis_svc.update_goals([g.model_dump() for g in goals])


# ============== REPORTS PAGE ENDPOINTS ==============

@app.get("/reports")
async def get_reports(period: str = Query("1M", description="1M, 3M, 6M, 1Y, ALL"), year: int | None = None, month: int | None = None):
    """Get full reports-page payload derived from user portfolio data."""
    return reports_svc.get_full_report(period=period, year=year, month=month)


@app.get("/reports/summary")
async def get_reports_summary(period: str = Query("1M", description="1M, 3M, 6M, 1Y, ALL")):
    """Get reports KPIs summary (portfolio value, realized/unrealized P&L, dividends, XIRR)."""
    return reports_svc.get_reports_summary(period=period)


@app.get("/reports/pl-calendar")
async def get_reports_pl_calendar(year: int = Query(datetime.now().year), month: int = Query(datetime.now().month, ge=1, le=12)):
    """Get daily realized P&L calendar for a month."""
    return reports_svc.get_pl_calendar(year=year, month=month)


@app.get("/reports/active-holdings")
async def get_reports_active_holdings():
    """Get active holdings report table data."""
    return reports_svc.get_active_holdings()


@app.get("/reports/asset-allocation")
async def get_reports_asset_allocation():
    """Get asset allocation distribution for reports page."""
    return reports_svc.get_asset_allocation()


@app.get("/reports/sector-exposure")
async def get_reports_sector_exposure():
    """Get sector exposure distribution for reports page."""
    return reports_svc.get_sector_exposure()


@app.get("/reports/tax-summary")
async def get_reports_tax_summary(fy: str | None = Query(None, description="Financial year like 2025-26")):
    """Get realized gains/losses based tax summary for selected financial year."""
    return reports_svc.get_tax_summary(fy=fy)


@app.get("/reports/dividend-history")
async def get_reports_dividend_history(limit: int = Query(20, ge=1, le=200)):
    """Get dividend and interest payout history."""
    return reports_svc.get_dividend_history(limit=limit)


@app.get("/reports/closed-positions")
async def get_reports_closed_positions(limit: int = Query(50, ge=1, le=500)):
    """Get closed positions with realized P&L and annualized return."""
    return reports_svc.get_closed_positions(limit=limit)


@app.get("/reports/portfolio-doctor")
async def get_reports_portfolio_doctor():
    """Get AI portfolio doctor insights derived from allocation/diversification analysis."""
    return reports_svc.get_ai_portfolio_doctor()


@app.get("/reports/pdf")
async def download_reports_pdf(
    period: str = Query("1M", description="1M, 3M, 6M, 1Y, ALL"),
    year: int | None = None,
    month: int | None = None,
):
    """Generate and download the portfolio report PDF."""
    payload = reports_svc.get_full_report(period=period, year=year, month=month)
    pdf_bytes = reports_pdf_svc.build_portfolio_report_pdf(payload, period=period)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"portfolio_report_{period}_{stamp}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/reports/send-email")
async def send_reports_email(request: ReportEmailRequest):
    """Generate report PDF and send it to an email recipient as attachment."""
    if not is_mail_configured():
        raise HTTPException(status_code=400, detail="Email settings are missing. Configure MAIL_* values in .env")

    if request.to_email and request.to_email.lower() != REPORT_EMAIL_RECIPIENT:
        raise HTTPException(status_code=400, detail=f"Recipient is locked to {REPORT_EMAIL_RECIPIENT}")

    recipient = REPORT_EMAIL_RECIPIENT

    payload = reports_svc.get_full_report(period=request.period, year=request.year, month=request.month)
    pdf_bytes = reports_pdf_svc.build_portfolio_report_pdf(payload, period=request.period)

    stamp = datetime.now().strftime("%Y%m%d")
    filename = f"portfolio_report_{request.period}_{stamp}.pdf"
    subject = request.subject or f"Your Portfolio Report ({request.period})"

    custom_message = request.message or "Your latest portfolio report is attached."
    body = (
        "<h3>Portfolio Report</h3>"
        f"<p>{custom_message}</p>"
        "<p>This report is generated from your current holdings and transaction history.</p>"
    )

    await send_report_email(
        to_email=recipient,
        subject=subject,
        html_body=body,
        pdf_bytes=pdf_bytes,
        filename=filename,
    )

    return {
        "status": "sent",
        "to": recipient,
        "subject": subject,
        "filename": filename,
    }


# ============== VERITAS AGENT ENDPOINTS ==============

from app.agent.graph import create_agent_graph
from app.agent.session import SessionStore

_agent_sessions = SessionStore()
_log = logging.getLogger("veritas.endpoint")


class AgentChatRequest(BaseModel):
    query: str = Field(..., description="User's question or command")
    session_id: str = Field(default="default", description="Session ID for multi-turn")
    include_portfolio_context: bool = Field(
        default=False,
        description="When true, agent can use user's portfolio as strategy context",
    )
    max_iterations: int = Field(default=3, ge=1, le=6, description="Max loop iterations for agent workflow")


class MindsetChatRequest(BaseModel):
    query: str = Field(..., description="User question for persona-guided mentoring")
    persona_id: str = Field(..., description="Selected investor persona id")
    extra_context: str | None = Field(default=None, description="Optional additional context")


class LearnersQuizSubmitRequest(BaseModel):
    card_id: str = Field(..., description="Quiz card identifier")
    selected_index: int = Field(..., ge=0, description="User selected option index")


class LearnersProgressUpdateRequest(BaseModel):
    action: str = Field(..., description="Supported actions: lesson_started, lesson_completed, daily_visit")
    resource_id: str | None = Field(default=None, description="Resource id for completion action")


@app.post("/agent/chat")
async def agent_chat(request: AgentChatRequest):
    """Stream Veritas agent response via SSE."""

    async def event_generator():
        start_time = time.time()

        try:
            history = _agent_sessions.get_history(request.session_id)

            initial_state = {
                "query": request.query,
                "session_id": request.session_id,
                "conversation_history": history,
                "portfolio_context_enabled": bool(request.include_portfolio_context),
                "intent": "general",
                "intent_confidence": 0.0,
                "entities": [],
                "needs_portfolio": False,
                "tool_results": [],
                "tool_summaries": [],
                "sources": [],
                "data_snapshots": [],
                "thinking_steps": [],
                "iteration": 0,
                "max_iterations": request.max_iterations,
                "stop_reason": None,
                "traces": [],
                "iteration_outputs": [],
                "evidence_items": [],
                "answer": "",
                "verification_result": None,
                "regulatory_result": None,
                "error": None,
            }

            graph = create_agent_graph()

            yield {"data": json.dumps({"type": "thinking", "step": "Classifying your query...", "tool": None, "status": "running"})}

            final_state = None
            workflow_iterations = 0
            workflow_stop_reason = None
            async for event in graph.astream(initial_state, stream_mode="updates"):
                for node_name, node_output in event.items():
                    if "iteration" in node_output:
                        try:
                            workflow_iterations = max(workflow_iterations, int(node_output.get("iteration", 0)))
                        except (TypeError, ValueError):
                            pass
                    if node_output.get("stop_reason"):
                        workflow_stop_reason = node_output.get("stop_reason")

                    for trace in node_output.get("traces", []):
                        yield {"data": json.dumps({"type": "layer_trace", "trace": trace})}

                    for layer_output in node_output.get("iteration_outputs", []):
                        yield {"data": json.dumps({"type": "iteration_output", "output": layer_output})}

                    for evidence in node_output.get("evidence_items", []):
                        yield {"data": json.dumps({"type": "evidence_item", "evidence": evidence})}

                    for step in node_output.get("thinking_steps", []):
                        yield {"data": json.dumps({"type": "thinking", **step})}

                    for source in node_output.get("sources", []):
                        yield {"data": json.dumps({"type": "source", "source": source})}

                    for snapshot in node_output.get("data_snapshots", []):
                        yield {"data": json.dumps({"type": "data_snapshot", "snapshot": snapshot})}

                    if node_output.get("answer"):
                        final_state = node_output

            answer = (final_state or {}).get("answer", "I could not generate a response. Please try again.")

            yield {"data": json.dumps({"type": "answer_start"})}

            chunk_size = 50
            for i in range(0, len(answer), chunk_size):
                yield {"data": json.dumps({"type": "answer_chunk", "content": answer[i:i + chunk_size]})}

            yield {"data": json.dumps({"type": "answer_end"})}

            if (final_state or {}).get("verification_result"):
                yield {"data": json.dumps({"type": "verification", "result": final_state["verification_result"]})}

            if (final_state or {}).get("regulatory_result"):
                yield {"data": json.dumps({"type": "regulatory", "result": final_state["regulatory_result"]})}

            if final_state:
                yield {
                    "data": json.dumps(
                        {
                            "type": "workflow_done",
                            "summary": {
                                "iterations": workflow_iterations or int(final_state.get("iteration", 0)),
                                "stop_reason": workflow_stop_reason or final_state.get("stop_reason") or "answer_ready",
                            },
                        }
                    )
                }

            _agent_sessions.add_turn(request.session_id, "user", request.query)
            _agent_sessions.add_turn(request.session_id, "assistant", answer)

            duration_ms = int((time.time() - start_time) * 1000)
            yield {"data": json.dumps({"type": "done", "total_tokens": 0, "duration_ms": duration_ms})}

        except Exception as exc:
            _log.exception("Agent error: %s", exc)
            yield {"data": json.dumps({"type": "error", "message": str(exc)})}

    return EventSourceResponse(event_generator())


@app.get("/agent/health")
async def agent_health():
    """Check if Groq API is reachable and agent is ready."""
    try:
        from app.agent.config import _get_groq_api_key
        api_key = _get_groq_api_key()
        if not api_key:
            return {"status": "error", "message": "GROQ_API_KEY not set in .env"}

        from app.agent.config import ROUTER_MODEL, safe_llm_call
        await safe_llm_call([{"role": "user", "content": "Reply READY only."}],model=ROUTER_MODEL,max_tokens=8)
        return {"status": "ok", "model": ROUTER_MODEL, "groq": "connected"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}


@app.get("/agent/sessions")
async def list_agent_sessions():
    """List active agent sessions."""
    return _agent_sessions.list_sessions()


@app.delete("/agent/session/{session_id}")
async def clear_agent_session(session_id: str):
    """Clear a conversation session."""
    _agent_sessions.clear(session_id)
    return {"status": "cleared", "session_id": session_id}


# ============== INVESTOR MINDSET ENDPOINTS ==============

@app.get("/mindset/personas")
async def get_investor_personas():
    """Get curated investor personas for the Mindset page."""
    return {"personas": mindset_svc.list_personas()}


@app.post("/mindset/chat")
async def mindset_chat(request: MindsetChatRequest):
    """Stream persona-guided answer via SSE without using the LangGraph agent flow."""

    async def event_generator():
        start_time = time.time()

        try:
            yield {"data": json.dumps({"type": "thinking", "step": "Loading persona context...", "status": "running"})}

            answer = await mindset_svc.generate_persona_answer(
                query=request.query,
                persona_id=request.persona_id,
                extra_context=request.extra_context,
            )

            yield {"data": json.dumps({"type": "thinking", "step": "Generating mindset response...", "status": "done"})}
            yield {"data": json.dumps({"type": "answer_start"})}

            chunk_size = 60
            for i in range(0, len(answer), chunk_size):
                yield {"data": json.dumps({"type": "answer_chunk", "content": answer[i:i + chunk_size]})}

            yield {"data": json.dumps({"type": "answer_end"})}

            duration_ms = int((time.time() - start_time) * 1000)
            yield {"data": json.dumps({"type": "done", "total_tokens": 0, "duration_ms": duration_ms})}
        except ValueError as exc:
            yield {"data": json.dumps({"type": "error", "message": str(exc)})}
        except Exception as exc:
            _log.exception("Mindset error: %s", exc)
            yield {"data": json.dumps({"type": "error", "message": str(exc)})}

    return EventSourceResponse(event_generator())


# ============== LEARNERS ENDPOINTS ==============

@app.get("/learners/overview")
async def get_learners_overview(
    query: str | None = Query(None, description="Topic search query"),
    resource_type: str = Query("all", description="all, video, book, podcast, story"),
    investor_id: str = Query("all", description="Investor filter id"),
    limit: int = Query(24, ge=1, le=100, description="Maximum resources to return"),
):
    """Get Learners page payload: progress, investor list, filtered resources, and quiz stats."""
    return learners_svc.get_overview(
        query=query,
        resource_type=resource_type,
        investor_id=investor_id,
        limit=limit,
    )


@app.get("/learners/quiz/cards")
async def get_learners_quiz_cards(limit: int = Query(5, ge=1, le=25)):
    """Get static concept quiz cards for the Learners page."""
    return {"cards": learners_svc.get_quiz_cards(limit=limit)}


@app.post("/learners/quiz/submit")
async def submit_learners_quiz_answer(request: LearnersQuizSubmitRequest):
    """Submit answer for one quiz card and update static progress data."""
    try:
        return learners_svc.submit_quiz_answer(request.card_id, request.selected_index)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/learners/progress")
async def get_learners_progress():
    """Get static progress state for the Learners page."""
    return learners_svc.get_progress()


@app.post("/learners/progress")
async def update_learners_progress(request: LearnersProgressUpdateRequest):
    """Update Learners progress with lightweight gamification actions."""
    return learners_svc.update_progress(action=request.action, resource_id=request.resource_id)
