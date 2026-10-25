import json
from pathlib import Path
from typing import Any

from fastapi.responses import JSONResponse

from app.ml.aapl_trend_models import run_training_pipeline


DATA_DIR = Path(__file__).resolve().parents[2] / "data"
_VALID_MODELS = {"hybrid", "linear", "logistic", "linear_stochastic", "regime_switch"}
_VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"}


def _prediction_output_path(ticker: str) -> Path:
    symbol = ticker.upper().strip()
    if symbol == "AAPL":
        return DATA_DIR / "aapl_trend_model_outputs.json"
    return DATA_DIR / f"{symbol.lower()}_trend_model_outputs.json"


def _load_or_train_predictions(
    ticker: str,
    horizon: int = 30,
    period: str = "5y",
    force_retrain: bool = False,
) -> dict:
    output_path = _prediction_output_path(ticker)
    if output_path.exists() and not force_retrain:
        try:
            data = json.loads(output_path.read_text(encoding="utf-8"))
            meta = data.get("meta") or {}
            model_1 = (data.get("predictions") or {}).get("model_1_linear_trend") or []
            model_2 = (data.get("predictions") or {}).get("model_2_logistic_trend") or []
            cached_period = str(meta.get("period") or "").lower()
            if len(model_1) >= horizon and len(model_2) >= horizon and cached_period == period.lower():
                return data
        except Exception:
            pass

    return run_training_pipeline(
        ticker=ticker,
        period=period,
        horizon=horizon,
        output_path=output_path,
    )


def _normalize_inputs(model: str, period: str, horizon: int) -> tuple[str, str, int]:
    normalized_model = (model or "hybrid").strip().lower()
    normalized_period = (period or "5y").strip().lower()
    normalized_horizon = int(horizon)

    if normalized_model not in _VALID_MODELS:
        raise ValueError(f"Unsupported model '{model}'. Use one of: {', '.join(sorted(_VALID_MODELS))}.")
    if normalized_period not in _VALID_PERIODS:
        raise ValueError(
            f"Unsupported period '{period}'. Use one of: {', '.join(sorted(_VALID_PERIODS))}."
        )
    if normalized_horizon < 7 or normalized_horizon > 90:
        raise ValueError("Horizon must be between 7 and 90 business days.")

    return normalized_model, normalized_period, normalized_horizon


def _build_training_meta(result: dict, retrained: bool, model: str, period: str, horizon: int) -> dict[str, Any]:
    model_1 = result.get("model_1") or {}
    model_2 = result.get("model_2") or {}
    meta = result.get("meta") or {}
    return {
        "model": model,
        "period": str(meta.get("period") or period),
        "horizon_days": int(meta.get("horizon_days") or horizon),
        "retrained": retrained,
        "trained_at_utc": meta.get("trained_at_utc"),
        "models_available": ["hybrid", "linear", "logistic", "linear_stochastic", "regime_switch"],
        "metrics": {
            "linear": {
                "directional_accuracy": model_1.get("directional_accuracy"),
                "test_mae": model_1.get("test_mae"),
            },
            "logistic": {
                "test_accuracy": model_2.get("test_accuracy"),
                "brier_score": model_2.get("brier_score"),
            },
            "linear_stochastic": {
                "residual_std": (result.get("model_3") or {}).get("residual_std"),
            },
        },
    }


def _to_hybrid_payload(result: dict, horizon: int = 30) -> dict:
    predictions = result.get("predictions") or {}
    # Prefer diverse stochastic pair when available so hybrid captures realistic ups/downs.
    m1 = (predictions.get("model_3_linear_stochastic") or predictions.get("model_1_linear_trend") or [])[:horizon]
    m2 = (predictions.get("model_4_regime_switch") or predictions.get("model_2_logistic_trend") or [])[:horizon]
    if not m1 or not m2:
        return {"data": [], "trend_line": [], "risk_band": []}

    candles: list[dict] = []
    trend_line: list[dict] = []
    risk_band: list[dict] = []

    prev_close = float(result.get("meta", {}).get("last_close", m1[0].get("predicted_close", 100.0)))

    for i, (r1, r2) in enumerate(zip(m1, m2)):
        day = str(r1.get("date") or r2.get("date"))
        c1 = float(r1.get("predicted_close", prev_close))
        c2 = float(r2.get("predicted_close", prev_close))
        conf1 = float(r1.get("model_confidence", 55.0))
        conf2 = float(r2.get("model_confidence", 55.0))

        # Confidence-weighted blend so the chart follows both models but prefers stronger signal.
        w1 = max(conf1, 1.0)
        w2 = max(conf2, 1.0)
        blended_close = (c1 * w1 + c2 * w2) / (w1 + w2)

        open_price = prev_close
        close_price = blended_close
        body = abs(close_price - open_price)
        min_wick = max(0.0025 * close_price, 0.18)
        wick = max(min_wick, body * 0.35)
        high_price = max(open_price, close_price) + wick
        low_price = max(0.01, min(open_price, close_price) - wick)

        model_spread = abs(c1 - c2) / max(close_price, 1.0)
        avg_conf = ((conf1 + conf2) / 2.0) / 100.0
        uncertainty = min(
            0.04,
            max(0.004, model_spread * 0.45 + (1.0 - avg_conf) * 0.015 + i * 0.00025),
        )
        lower = close_price * (1.0 - 1.96 * uncertainty)
        upper = close_price * (1.0 + 1.96 * uncertainty)

        candles.append(
            {
                "time": day,
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
            }
        )
        trend_line.append({"time": day, "value": round(close_price, 2)})
        risk_band.append({"time": day, "upper": round(upper, 2), "lower": round(lower, 2)})

        prev_close = close_price

    return {
        "data": candles,
        "trend_line": trend_line,
        "risk_band": risk_band,
    }


def _to_single_model_payload(result: dict, model: str, horizon: int = 30) -> dict:
    predictions = result.get("predictions") or {}
    key_map = {
        "linear": "model_1_linear_trend",
        "logistic": "model_2_logistic_trend",
        "linear_stochastic": "model_3_linear_stochastic",
        "regime_switch": "model_4_regime_switch",
    }
    key = key_map.get(model, "model_1_linear_trend")
    rows = (predictions.get(key) or [])[:horizon]
    if not rows:
        return {"data": [], "trend_line": [], "risk_band": []}

    candles: list[dict] = []
    trend_line: list[dict] = []
    risk_band: list[dict] = []

    prev_close = float(result.get("meta", {}).get("last_close", rows[0].get("predicted_close", 100.0)))
    for i, row in enumerate(rows):
        day = str(row.get("date"))
        close_price = float(row.get("predicted_close", prev_close))
        confidence_pct = float(row.get("model_confidence", 55.0))

        open_price = prev_close
        body = abs(close_price - open_price)
        wick = max(0.15, body * 0.35, close_price * 0.002)

        high_price = max(open_price, close_price) + wick
        low_price = max(0.01, min(open_price, close_price) - wick)

        confidence = min(0.99, max(0.5, confidence_pct / 100.0))
        uncertainty = min(
            0.035,
            max(0.0035, (1.0 - confidence) * 0.02 + i * 0.0002),
        )

        candles.append(
            {
                "time": day,
                "open": round(open_price, 2),
                "high": round(high_price, 2),
                "low": round(low_price, 2),
                "close": round(close_price, 2),
            }
        )
        trend_line.append({"time": day, "value": round(close_price, 2)})
        risk_band.append(
            {
                "time": day,
                "upper": round(close_price * (1.0 + 1.96 * uncertainty), 2),
                "lower": round(close_price * (1.0 - 1.96 * uncertainty), 2),
            }
        )

        prev_close = close_price

    return {
        "data": candles,
        "trend_line": trend_line,
        "risk_band": risk_band,
    }


def _build_chart_payload(result: dict, model: str, horizon: int) -> dict:
    if model == "hybrid":
        return _to_hybrid_payload(result, horizon=horizon)
    return _to_single_model_payload(result, model=model, horizon=horizon)

def generate_future_chart(
    ticker: str,
    model: str = "hybrid",
    horizon: int = 30,
    period: str = "5y",
    retrain: bool = False,
) -> JSONResponse:
    try:
        normalized_model, normalized_period, normalized_horizon = _normalize_inputs(model, period, horizon)
        result = _load_or_train_predictions(
            ticker=ticker,
            horizon=normalized_horizon,
            period=normalized_period,
            force_retrain=retrain,
        )
        payload = _build_chart_payload(result, model=normalized_model, horizon=normalized_horizon)
        training_meta = _build_training_meta(
            result,
            retrained=retrain,
            model=normalized_model,
            period=normalized_period,
            horizon=normalized_horizon,
        )
        return JSONResponse(
            content={
                "ticker": ticker.upper().strip(),
                **training_meta,
                **payload,
            }
        )
    except ValueError as exc:
        return JSONResponse(
            status_code=400,
            content={
                "error": str(exc),
                "ticker": ticker.upper().strip(),
                "data": [],
                "trend_line": [],
                "risk_band": [],
            },
        )
    except Exception as exc:
        return JSONResponse(
            status_code=500,
            content={
                "error": f"Failed to generate model-driven prediction for {ticker}: {exc}",
                "ticker": ticker.upper().strip(),
                "horizon_days": horizon,
                "data": [],
                "trend_line": [],
                "risk_band": [],
            },
        )


def train_future_models(
    ticker: str,
    model: str = "hybrid",
    period: str = "5y",
    horizon: int = 30,
) -> JSONResponse:
    return generate_future_chart(
        ticker=ticker,
        model=model,
        horizon=horizon,
        period=period,
        retrain=True,
    )
