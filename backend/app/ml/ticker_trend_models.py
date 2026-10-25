"""
CLI script to train two trend models for any ticker.

Examples:
    python app/ml/ticker_trend_models.py --ticker AAPL
    python app/ml/ticker_trend_models.py --ticker MSFT --period 3y --horizon 10
    python app/ml/ticker_trend_models.py --ticker NVDA --output data/nvda_custom_predictions.json
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[2]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.aapl_trend_models import print_console_report, run_training_pipeline


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train two stock trend prediction models and generate forecast output JSON."
    )
    parser.add_argument("--ticker", type=str, default="AAPL", help="Ticker symbol, e.g. AAPL, MSFT, NVDA")
    parser.add_argument("--period", type=str, default="5y", help="History period for yfinance, e.g. 1y, 3y, 5y")
    parser.add_argument("--horizon", type=int, default=30, help="Forecast horizon in business days")
    parser.add_argument(
        "--output",
        type=str,
        default="",
        help="Optional output JSON path. Defaults to backend/data/{ticker}_trend_model_outputs.json",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_path = Path(args.output) if args.output else None

    result = run_training_pipeline(
        ticker=args.ticker,
        period=args.period,
        horizon=args.horizon,
        output_path=output_path,
    )
    print_console_report(result)


if __name__ == "__main__":
    main()
