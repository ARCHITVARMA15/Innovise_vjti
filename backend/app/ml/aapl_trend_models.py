"""
Train two standalone stock trend prediction models.

This module is intentionally NOT wired into API endpoints.
Run directly to train and produce a side-by-side prediction report:

    python app/ml/aapl_trend_models.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import yfinance as yf


DEFAULT_OUTPUT_PATH = Path(__file__).resolve().parents[2] / "data" / "aapl_trend_model_outputs.json"


@dataclass
class Dataset:
    X: np.ndarray
    y_reg: np.ndarray
    y_cls: np.ndarray
    feature_names: list[str]
    close_prices: np.ndarray
    dates: np.ndarray


class StandardScaler:
    def __init__(self) -> None:
        self.mean_: np.ndarray | None = None
        self.std_: np.ndarray | None = None

    def fit(self, X: np.ndarray) -> "StandardScaler":
        self.mean_ = X.mean(axis=0)
        self.std_ = X.std(axis=0)
        self.std_[self.std_ == 0] = 1.0
        return self

    def transform(self, X: np.ndarray) -> np.ndarray:
        if self.mean_ is None or self.std_ is None:
            raise ValueError("Scaler must be fitted before transform.")
        return (X - self.mean_) / self.std_


class RidgeLikeRegressor:
    """Closed-form linear regression with L2 regularization."""

    def __init__(self, l2: float = 0.5) -> None:
        self.l2 = l2
        self.weights_: np.ndarray | None = None
        self.bias_: float = 0.0

    def fit(self, X: np.ndarray, y: np.ndarray) -> "RidgeLikeRegressor":
        ones = np.ones((X.shape[0], 1))
        X_aug = np.hstack([ones, X])
        identity = np.eye(X_aug.shape[1])
        identity[0, 0] = 0.0

        w = np.linalg.pinv(X_aug.T @ X_aug + self.l2 * identity) @ X_aug.T @ y
        self.bias_ = float(w[0])
        self.weights_ = w[1:]
        return self

    def predict(self, X: np.ndarray) -> np.ndarray:
        if self.weights_ is None:
            raise ValueError("Model must be fitted before predict.")
        return X @ self.weights_ + self.bias_


class LogisticTrendClassifier:
    """Binary logistic regression trained with gradient descent."""

    def __init__(self, lr: float = 0.05, epochs: int = 700, l2: float = 0.01) -> None:
        self.lr = lr
        self.epochs = epochs
        self.l2 = l2
        self.weights_: np.ndarray | None = None
        self.bias_: float = 0.0

    @staticmethod
    def _sigmoid(z: np.ndarray) -> np.ndarray:
        z = np.clip(z, -500, 500)
        return 1.0 / (1.0 + np.exp(-z))

    def fit(self, X: np.ndarray, y: np.ndarray) -> "LogisticTrendClassifier":
        n_samples, n_features = X.shape
        self.weights_ = np.zeros(n_features, dtype=float)
        self.bias_ = 0.0

        for _ in range(self.epochs):
            logits = X @ self.weights_ + self.bias_
            probs = self._sigmoid(logits)

            error = probs - y
            dw = (X.T @ error) / n_samples + self.l2 * self.weights_
            db = float(error.mean())

            self.weights_ -= self.lr * dw
            self.bias_ -= self.lr * db

        return self

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        if self.weights_ is None:
            raise ValueError("Model must be fitted before predict_proba.")
        return self._sigmoid(X @ self.weights_ + self.bias_)

    def predict(self, X: np.ndarray) -> np.ndarray:
        return (self.predict_proba(X) >= 0.5).astype(int)


def load_price_history(ticker: str, period: str = "5y") -> tuple[np.ndarray, np.ndarray]:
    """Load daily close prices for a ticker from yfinance."""
    symbol = ticker.upper().strip()
    candidates = [symbol]

    # Try Indian exchange suffixes when user passes plain symbols like RELIANCE/TCS/INFY.
    if "." not in symbol and symbol.isalpha() and len(symbol) <= 12:
        candidates.extend([f"{symbol}.NS", f"{symbol}.BO"])

    for candidate in candidates:
        hist = yf.Ticker(candidate).history(period=period, interval="1d", auto_adjust=True)
        if hist.empty:
            continue
        closes = hist["Close"].to_numpy(dtype=float)
        dates = hist.index.to_numpy()
        return closes, dates

    raise RuntimeError(f"No data returned from yfinance for {ticker}. Tried: {', '.join(candidates)}")


def engineer_features(closes: np.ndarray, dates: np.ndarray) -> Dataset:
    """
    Build trend features and both targets:
    - y_reg: next-day return
    - y_cls: next-day up/down direction
    """
    if len(closes) < 60:
        raise RuntimeError("Not enough data points to train trend models.")

    ret_1d = closes[1:] / closes[:-1] - 1.0

    rows: list[np.ndarray] = []
    y_reg: list[float] = []
    y_cls: list[int] = []
    kept_dates: list[np.datetime64] = []
    kept_closes: list[float] = []

    for t in range(25, len(closes) - 1):
        r1 = ret_1d[t - 1]
        r5 = closes[t] / closes[t - 5] - 1.0
        sma5 = closes[t - 4 : t + 1].mean()
        sma20 = closes[t - 19 : t + 1].mean()
        vol5 = ret_1d[t - 4 : t + 1].std()

        features = np.array(
            [
                r1,
                r5,
                (closes[t] / sma5) - 1.0,
                (closes[t] / sma20) - 1.0,
                vol5,
            ],
            dtype=float,
        )

        next_ret = closes[t + 1] / closes[t] - 1.0

        rows.append(features)
        y_reg.append(float(next_ret))
        y_cls.append(int(next_ret > 0))
        kept_dates.append(dates[t])
        kept_closes.append(float(closes[t]))

    X = np.vstack(rows)
    return Dataset(
        X=X,
        y_reg=np.array(y_reg, dtype=float),
        y_cls=np.array(y_cls, dtype=int),
        feature_names=["ret_1d", "ret_5d", "sma5_gap", "sma20_gap", "vol_5d"],
        close_prices=np.array(kept_closes, dtype=float),
        dates=np.array(kept_dates),
    )


def train_test_split_time(dataset: Dataset, train_ratio: float = 0.8) -> dict[str, np.ndarray]:
    split_idx = int(len(dataset.X) * train_ratio)
    return {
        "X_train": dataset.X[:split_idx],
        "X_test": dataset.X[split_idx:],
        "y_reg_train": dataset.y_reg[:split_idx],
        "y_reg_test": dataset.y_reg[split_idx:],
        "y_cls_train": dataset.y_cls[:split_idx],
        "y_cls_test": dataset.y_cls[split_idx:],
        "close_train": dataset.close_prices[:split_idx],
        "close_test": dataset.close_prices[split_idx:],
        "dates_train": dataset.dates[:split_idx],
        "dates_test": dataset.dates[split_idx:],
    }


def directional_accuracy(y_true_returns: np.ndarray, y_pred_returns: np.ndarray) -> float:
    true_dir = (y_true_returns > 0).astype(int)
    pred_dir = (y_pred_returns > 0).astype(int)
    return float((true_dir == pred_dir).mean())


def brier_score(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    return float(np.mean((y_prob - y_true) ** 2))


def make_feature_vector_from_prices(price_series: list[float]) -> np.ndarray:
    """Recompute the latest feature vector from simulated close prices."""
    if len(price_series) < 26:
        raise ValueError("Need at least 26 prices to build features.")

    close_t = price_series[-1]
    close_t_1 = price_series[-2]
    close_t_5 = price_series[-6]

    ret_1d = close_t / close_t_1 - 1.0
    ret_5d = close_t / close_t_5 - 1.0
    sma5 = float(np.mean(price_series[-5:]))
    sma20 = float(np.mean(price_series[-20:]))

    recent_returns = np.array(
        [price_series[i] / price_series[i - 1] - 1.0 for i in range(len(price_series) - 5, len(price_series))],
        dtype=float,
    )
    vol5 = float(recent_returns.std())

    return np.array([ret_1d, ret_5d, (close_t / sma5) - 1.0, (close_t / sma20) - 1.0, vol5], dtype=float)


def future_business_dates(last_date: np.datetime64, horizon: int) -> list[str]:
    last_dt = datetime.fromisoformat(str(last_date).replace("Z", ""))
    out: list[str] = []
    cursor = last_dt
    while len(out) < horizon:
        cursor += timedelta(days=1)
        if cursor.weekday() < 5:
            out.append(cursor.date().isoformat())
    return out


def _clip_return(value: float, low: float = -0.06, high: float = 0.06) -> float:
    return float(min(high, max(low, value)))


def build_forecasts(
    raw_closes: np.ndarray,
    scaler: StandardScaler,
    reg_model: RidgeLikeRegressor,
    cls_model: LogisticTrendClassifier,
    train_returns: np.ndarray,
    reg_residual_std: float,
    avg_up_return: float,
    avg_down_return: float,
    seed: int,
    horizon: int = 7,
) -> dict[str, list[dict[str, float | str]]]:
    """Generate recursive forecasts from deterministic and stochastic model variants."""
    simulated_for_reg = list(raw_closes[-60:].astype(float))
    simulated_for_cls = list(raw_closes[-60:].astype(float))
    simulated_for_lin_stoch = list(raw_closes[-60:].astype(float))
    simulated_for_regime = list(raw_closes[-60:].astype(float))

    rng = np.random.default_rng(seed)

    pos_returns = train_returns[train_returns > 0]
    neg_returns = train_returns[train_returns <= 0]

    if pos_returns.size == 0:
        pos_returns = np.array([max(avg_up_return, 0.001)], dtype=float)
    if neg_returns.size == 0:
        neg_returns = np.array([min(avg_down_return, -0.001)], dtype=float)

    residual_scale = max(0.0015, min(0.03, float(reg_residual_std)))

    dates = future_business_dates(np.datetime64(datetime.now(UTC).date()), horizon)

    reg_predictions: list[dict[str, float | str]] = []
    cls_predictions: list[dict[str, float | str]] = []
    lin_stoch_predictions: list[dict[str, float | str]] = []
    regime_predictions: list[dict[str, float | str]] = []

    for i in range(horizon):
        fv_reg = make_feature_vector_from_prices(simulated_for_reg)
        fv_reg_scaled = scaler.transform(fv_reg.reshape(1, -1))
        pred_ret_reg = _clip_return(float(reg_model.predict(fv_reg_scaled)[0]), low=-0.05, high=0.05)

        next_close_reg = simulated_for_reg[-1] * (1.0 + pred_ret_reg)
        simulated_for_reg.append(next_close_reg)

        reg_predictions.append(
            {
                "date": dates[i],
                "predicted_close": round(next_close_reg, 2),
                "predicted_return_pct": round(pred_ret_reg * 100.0, 3),
                "trend": "UP" if pred_ret_reg >= 0 else "DOWN",
                "model_confidence": round(min(95.0, max(50.0, 50.0 + abs(pred_ret_reg) * 4500.0)), 2),
            }
        )

        fv_cls = make_feature_vector_from_prices(simulated_for_cls)
        fv_cls_scaled = scaler.transform(fv_cls.reshape(1, -1))
        prob_up = float(cls_model.predict_proba(fv_cls_scaled)[0])

        expected_ret = _clip_return(prob_up * avg_up_return + (1.0 - prob_up) * avg_down_return, low=-0.045, high=0.045)
        next_close_cls = simulated_for_cls[-1] * (1.0 + expected_ret)
        simulated_for_cls.append(next_close_cls)

        cls_predictions.append(
            {
                "date": dates[i],
                "predicted_close": round(next_close_cls, 2),
                "predicted_return_pct": round(expected_ret * 100.0, 3),
                "trend": "UP" if prob_up >= 0.5 else "DOWN",
                "model_confidence": round(max(prob_up, 1.0 - prob_up) * 100.0, 2),
                "probability_up_pct": round(prob_up * 100.0, 2),
            }
        )

        # Linear stochastic variant: linear mean + residual shock + mild mean reversion.
        fv_lin_stoch = make_feature_vector_from_prices(simulated_for_lin_stoch)
        fv_lin_stoch_scaled = scaler.transform(fv_lin_stoch.reshape(1, -1))
        mean_ret_lin = float(reg_model.predict(fv_lin_stoch_scaled)[0])
        shock = float(rng.normal(0.0, residual_scale))
        recent_mean = float(np.mean(simulated_for_lin_stoch[-20:]))
        deviation = (simulated_for_lin_stoch[-1] / recent_mean) - 1.0 if recent_mean > 0 else 0.0
        reversion = -0.25 * deviation
        pred_ret_lin_stoch = _clip_return(mean_ret_lin + shock + reversion, low=-0.06, high=0.06)

        next_close_lin_stoch = simulated_for_lin_stoch[-1] * (1.0 + pred_ret_lin_stoch)
        simulated_for_lin_stoch.append(next_close_lin_stoch)

        lin_stoch_conf = max(40.0, min(92.0, 72.0 - (abs(shock) / max(residual_scale, 1e-6)) * 10.0))
        lin_stoch_predictions.append(
            {
                "date": dates[i],
                "predicted_close": round(next_close_lin_stoch, 2),
                "predicted_return_pct": round(pred_ret_lin_stoch * 100.0, 3),
                "trend": "UP" if pred_ret_lin_stoch >= 0 else "DOWN",
                "model_confidence": round(lin_stoch_conf, 2),
            }
        )

        # Regime-switch variant: direction from classifier, magnitude from empirical up/down returns.
        fv_regime = make_feature_vector_from_prices(simulated_for_regime)
        fv_regime_scaled = scaler.transform(fv_regime.reshape(1, -1))
        prob_up_regime = float(cls_model.predict_proba(fv_regime_scaled)[0])

        is_up = bool(rng.random() < prob_up_regime)
        base_pool = pos_returns if is_up else neg_returns
        sampled_ret = float(rng.choice(base_pool))
        sampled_ret += float(rng.normal(0.0, residual_scale * 0.2))
        sampled_ret = _clip_return(sampled_ret, low=-0.07, high=0.07)

        next_close_regime = simulated_for_regime[-1] * (1.0 + sampled_ret)
        simulated_for_regime.append(next_close_regime)

        regime_predictions.append(
            {
                "date": dates[i],
                "predicted_close": round(next_close_regime, 2),
                "predicted_return_pct": round(sampled_ret * 100.0, 3),
                "trend": "UP" if sampled_ret >= 0 else "DOWN",
                "model_confidence": round(max(prob_up_regime, 1.0 - prob_up_regime) * 100.0, 2),
                "probability_up_pct": round(prob_up_regime * 100.0, 2),
            }
        )

    return {
        "model_1_linear_trend": reg_predictions,
        "model_2_logistic_trend": cls_predictions,
        "model_3_linear_stochastic": lin_stoch_predictions,
        "model_4_regime_switch": regime_predictions,
    }


def run_training_pipeline(
    ticker: str = "AAPL",
    period: str = "5y",
    horizon: int = 30,
    output_path: Path | None = None,
) -> dict:
    normalized_ticker = ticker.upper().strip()
    closes, dates = load_price_history(ticker=normalized_ticker, period=period)
    dataset = engineer_features(closes, dates)
    split = train_test_split_time(dataset, train_ratio=0.8)

    scaler = StandardScaler().fit(split["X_train"])
    X_train_scaled = scaler.transform(split["X_train"])
    X_test_scaled = scaler.transform(split["X_test"])

    model_1 = RidgeLikeRegressor(l2=0.8).fit(X_train_scaled, split["y_reg_train"])
    model_2 = LogisticTrendClassifier(lr=0.06, epochs=900, l2=0.02).fit(X_train_scaled, split["y_cls_train"])

    reg_test_pred = model_1.predict(X_test_scaled)
    cls_test_prob = model_2.predict_proba(X_test_scaled)
    cls_test_pred = (cls_test_prob >= 0.5).astype(int)
    reg_train_pred = model_1.predict(X_train_scaled)
    reg_residual_std = float(np.std(split["y_reg_train"] - reg_train_pred))

    avg_up = float(np.mean(split["y_reg_train"][split["y_reg_train"] > 0]))
    avg_down = float(np.mean(split["y_reg_train"][split["y_reg_train"] <= 0]))

    last_close = float(closes[-1])
    seed = abs(hash((normalized_ticker, period, int(round(last_close * 100))))) % (2 ** 32)

    forecast_block = build_forecasts(
        raw_closes=closes,
        scaler=scaler,
        reg_model=model_1,
        cls_model=model_2,
        train_returns=split["y_reg_train"],
        reg_residual_std=reg_residual_std,
        avg_up_return=avg_up,
        avg_down_return=avg_down,
        seed=seed,
        horizon=horizon,
    )

    output = {
        "meta": {
            "ticker": normalized_ticker,
            "trained_at_utc": datetime.now(UTC).isoformat(),
            "period": period,
            "horizon_days": int(horizon),
            "train_samples": int(len(split["X_train"])),
            "test_samples": int(len(split["X_test"])),
            "last_close": round(last_close, 2),
            "feature_names": dataset.feature_names,
        },
        "model_1": {
            "name": "Linear Trend Regressor",
            "type": "regression",
            "target": "next_day_return",
            "test_mae": round(float(np.mean(np.abs(split["y_reg_test"] - reg_test_pred))), 6),
            "directional_accuracy": round(directional_accuracy(split["y_reg_test"], reg_test_pred), 4),
        },
        "model_2": {
            "name": "Logistic Trend Classifier",
            "type": "classification",
            "target": "next_day_direction_up_down",
            "test_accuracy": round(float((cls_test_pred == split["y_cls_test"]).mean()), 4),
            "brier_score": round(brier_score(split["y_cls_test"], cls_test_prob), 6),
        },
        "model_3": {
            "name": "Linear Stochastic Regressor",
            "type": "regression_stochastic",
            "target": "next_day_return_with_residual_noise",
            "residual_std": round(reg_residual_std, 6),
        },
        "model_4": {
            "name": "Regime Switch Simulator",
            "type": "classification_sampling",
            "target": "direction_probability_with_empirical_return_sampling",
        },
        "predictions": forecast_block,
    }

    if output_path is None:
        output_path = (
            DEFAULT_OUTPUT_PATH
            if normalized_ticker == "AAPL"
            else Path(__file__).resolve().parents[2] / "data" / f"{normalized_ticker.lower()}_trend_model_outputs.json"
        )

    output["meta"]["output_path"] = str(output_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(output, indent=2), encoding="utf-8")
    return output


def print_console_report(result: dict) -> None:
    m1_rows = result.get("predictions", {}).get("model_1_linear_trend", [])
    m2_rows = result.get("predictions", {}).get("model_2_logistic_trend", [])
    horizon = max(len(m1_rows), len(m2_rows))

    print("=" * 72)
    print("STOCK TREND PREDICTION MODELS")
    print("=" * 72)
    print(f"Ticker: {result['meta']['ticker']}")
    print(f"Trained at: {result['meta']['trained_at_utc']}")
    print(f"Train/Test samples: {result['meta']['train_samples']}/{result['meta']['test_samples']}")
    print(f"Last close: ${result['meta']['last_close']}")
    print("-")
    print("Model 1 - Linear Trend Regressor")
    print(f"  MAE: {result['model_1']['test_mae']}")
    print(f"  Directional accuracy: {result['model_1']['directional_accuracy'] * 100:.2f}%")
    print("Model 2 - Logistic Trend Classifier")
    print(f"  Accuracy: {result['model_2']['test_accuracy'] * 100:.2f}%")
    print(f"  Brier score: {result['model_2']['brier_score']}")
    print("-")

    print(f"{horizon}-Day Forecasts (Model 1)")
    for row in m1_rows:
        print(
            f"  {row['date']}  close=${row['predicted_close']:>8}  ret={row['predicted_return_pct']:>7}%  "
            f"trend={row['trend']:<4}  conf={row['model_confidence']:>6}%"
        )

    print(f"{horizon}-Day Forecasts (Model 2)")
    for row in m2_rows:
        print(
            f"  {row['date']}  close=${row['predicted_close']:>8}  ret={row['predicted_return_pct']:>7}%  "
            f"trend={row['trend']:<4}  conf={row['model_confidence']:>6}%  up_prob={row['probability_up_pct']:>6}%"
        )

    print("-")
    print(f"Saved report to: {result['meta'].get('output_path', 'N/A')}")


if __name__ == "__main__":
    output = run_training_pipeline(ticker="AAPL", period="5y", horizon=30, output_path=DEFAULT_OUTPUT_PATH)
    print_console_report(output)
