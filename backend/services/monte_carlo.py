"""
Monte Carlo Simulation Service – computes Brent price distribution paths
grounded in historical daily price volatility (FRED dataset).
"""
import os
import math
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Dict, Any


DATA_DIR = Path(__file__).parent.parent / "data"
CSV_PATH = DATA_DIR / "DCOILBRENTEU.csv"


def calculate_historical_volatility() -> float:
    """Calculate annualized volatility from historical FRED CSV data."""
    try:
        if not CSV_PATH.exists():
            return 0.30  # Default 30% volatility

        df = pd.read_csv(CSV_PATH)
        df.columns = ['Date', 'Price']
        
        # Clean missing values
        df = df[df['Price'] != '.']
        df['Price'] = pd.to_numeric(df['Price'], errors='coerce')
        df = df.dropna()
        
        if len(df) < 30:
            return 0.30

        # Calculate daily log returns
        df['Log_Return'] = np.log(df['Price'] / df['Price'].shift(1))
        df = df.dropna()
        
        # Annualize volatility (standard deviation * sqrt(252))
        daily_std = df['Log_Return'].std()
        ann_vol = daily_std * math.sqrt(252)
        
        # Clip to realistic limits
        return max(0.15, min(0.60, ann_vol))
    except Exception as e:
        print(f"[WARNING] Volatility calculation failed, using default: {e}")
        return 0.30


def run_gbm_price_simulation(
    current_price: float,
    days: int = 90,
    n_sims: int = 10000,
    disruption_shock: float = 0.0,
    stress_volatility_multiplier: float = 1.0
) -> Dict[str, Any]:
    """
    Run Geometric Brownian Motion simulation to forecast price distributions.
    S(t+1) = S(t) * exp((mu - sigma^2/2)*dt + sigma*sqrt(dt)*Z)
    """
    # Baseline volatility from real data
    base_vol = calculate_historical_volatility()
    sigma = base_vol * stress_volatility_multiplier
    
    # Adjust starting price for immediate shock (e.g. +15% on Hormuz closure)
    s0 = current_price * (1.0 + disruption_shock)
    dt = 1 / 252  # Trading days in a year
    mu = 0.0  # Drift assumed flat under risk neutral expectations
    
    # Pre-allocate path array
    # n_sims x (days + 1)
    paths = np.zeros((n_sims, days + 1))
    paths[:, 0] = s0
    
    # Standard normal returns
    Z = np.random.standard_normal((n_sims, days))
    
    # Vectorized GBM stepping
    for t in range(days):
        paths[:, t + 1] = paths[:, t] * np.exp(
            (mu - 0.5 * sigma**2) * dt + sigma * math.sqrt(dt) * Z[:, t]
        )
        
    final_prices = paths[:, -1]
    
    # Extract quantiles
    p10 = float(np.percentile(final_prices, 10))
    p50 = float(np.percentile(final_prices, 50))
    p90 = float(np.percentile(final_prices, 90))
    
    return {
        "paths": paths.tolist()[:100],  # Return 100 paths for visualization
        "final_prices": final_prices.tolist(),
        "p10": round(p10, 2),
        "p50": round(p50, 2),
        "p90": round(p90, 2),
        "confidence_interval": (round(float(np.percentile(final_prices, 2.5)), 2), 
                               round(float(np.percentile(final_prices, 97.5)), 2)),
        "sigma": round(sigma, 4)
    }
