"""Technical indicators from OHLCV CSV data."""
import numpy as np
import pandas as pd


def load_ohlcv(file_path: str) -> pd.DataFrame:
    df = pd.read_csv(file_path)
    df.columns = [str(c).strip() for c in df.columns]
    df["Date"] = pd.to_datetime(df["Date"])
    for col in ("Open", "High", "Low", "Close", "Volume"):
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["Close"]).sort_values("Date").reset_index(drop=True)
    return df


def rsi(series: pd.Series, period: int = 14) -> float:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, np.nan)
    val = 100 - (100 / (1 + rs))
    last = val.iloc[-1]
    return float(last) if pd.notna(last) else 50.0


def macd_signal(close: pd.Series) -> tuple[float, float, str]:
    ema12 = close.ewm(span=12, adjust=False).mean()
    ema26 = close.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal = macd_line.ewm(span=9, adjust=False).mean()
    hist = macd_line - signal
    last_hist = float(hist.iloc[-1]) if pd.notna(hist.iloc[-1]) else 0.0
    label = "إيجابي" if last_hist > 0 else "سلبي" if last_hist < 0 else "محايد"
    return float(macd_line.iloc[-1]), float(signal.iloc[-1]), label


def ma_trend(close: pd.Series) -> tuple[str, float, float]:
    sma20 = close.rolling(20).mean().iloc[-1]
    sma50 = close.rolling(50).mean().iloc[-1]
    price = float(close.iloc[-1])
    if pd.isna(sma20) or pd.isna(sma50):
        return "غير محدد", price, price
    if price > sma20 > sma50:
        return "اتجاه صعودي", float(sma20), float(sma50)
    if price < sma20 < sma50:
        return "اتجاه هبوطي", float(sma20), float(sma50)
    return "اتجاه جانبي", float(sma20), float(sma50)


def volume_label(volume: pd.Series, window: int = 20) -> tuple[str, float]:
    avg = volume.rolling(window).mean().iloc[-1]
    last = float(volume.iloc[-1])
    if pd.isna(avg) or avg == 0:
        return "عادي", last
    ratio = last / avg
    if ratio >= 1.35:
        return "مرتفع", ratio
    if ratio <= 0.65:
        return "منخفض", ratio
    return "عادي", ratio


def support_resistance(close: pd.Series, low: pd.Series, high: pd.Series, lookback: int = 60) -> tuple[float, float]:
    recent_low = low.tail(lookback).min()
    recent_high = high.tail(lookback).max()
    return float(recent_low), float(recent_high)


def risk_metrics(close: pd.Series) -> dict:
    returns = close.pct_change().dropna()
    if returns.empty:
        return {
            "sharpe": 0.0,
            "sortino": 0.0,
            "var95": 0.0,
            "var99": 0.0,
            "var15d": 0.0,
        }

    mean = returns.mean()
    std = returns.std(ddof=1)
    downside = returns[returns < 0]
    downside_std = downside.std(ddof=1) if len(downside) > 1 else std
    sharpe = (mean / std * np.sqrt(252)) if std > 0 else 0.0
    sortino = (mean / downside_std * np.sqrt(252)) if downside_std > 0 else 0.0
    var95 = max(0.0, -np.percentile(returns, 5) * 100)
    var99 = max(0.0, -np.percentile(returns, 1) * 100)
    var15d = min(var95 * np.sqrt(15), 100.0)

    return {
        "sharpe": round(sharpe, 2),
        "sortino": round(sortino, 2),
        "var95": round(var95, 2),
        "var99": round(var99, 2),
        "var15d": round(var15d, 2),
    }


def liquidity_health(close: pd.Series, volume: pd.Series, window: int = 20) -> tuple[str, float]:
    if len(close) < window or len(volume) < window:
        return "غير متاح", 0.0

    recent_vol = volume.tail(window)
    avg_vol = recent_vol.mean()
    last_vol = float(volume.iloc[-1])
    returns_pct = close.pct_change().dropna().tail(window)
    vol_pct = float(returns_pct.std() * 100) if len(returns_pct) > 0 else 0.0

    score = (last_vol / avg_vol) / (vol_pct + 0.01)
    if score >= 2.0:
        label = "جيدة"
    elif score >= 1.0:
        label = "مقبولة"
    else:
        label = "ضعيفة"
    return label, round(score, 2)


def price_volume_profile(close: pd.Series, volume: pd.Series, lookback: int = 60, buckets: int = 5) -> str:
    recent_close = close.tail(lookback)
    recent_vol = volume.tail(lookback)
    if len(recent_close) < 5 or recent_vol.sum() == 0:
        return "غير متوفر"

    values = np.linspace(recent_close.min(), recent_close.max(), buckets + 1)
    bins = pd.cut(recent_close, values, include_lowest=True)
    volume_by_bin = recent_vol.groupby(bins).sum().sort_values(ascending=False)
    top_levels = volume_by_bin.head(2).index

    labels = []
    for level in top_levels:
        low = float(level.left)
        high = float(level.right)
        labels.append(f"{low:.2f}-{high:.2f}")

    return f"أثقل مستويات التداول خلال آخر {lookback} يوماً: {', '.join(labels)}"


def daily_change(close: pd.Series) -> tuple[float, float]:
    if len(close) < 2:
        p = float(close.iloc[-1])
        return p, 0.0
    prev = float(close.iloc[-2])
    curr = float(close.iloc[-1])
    pct = ((curr - prev) / prev * 100) if prev else 0.0
    return curr, pct


def compute_technical(file_path: str) -> dict:
    df = load_ohlcv(file_path)
    close = df["Close"]
    low = df["Low"] if "Low" in df.columns else close
    high = df["High"] if "High" in df.columns else close
    volume = df["Volume"] if "Volume" in df.columns else pd.Series([0] * len(df))

    price, change_pct = daily_change(close)
    rsi_val = rsi(close)
    _, _, macd_label = macd_signal(close)
    ma_label, sma20, sma50 = ma_trend(close)
    vol_label, vol_ratio = volume_label(volume)
    liquidity_label, liquidity_score = liquidity_health(close, volume)
    volume_profile = price_volume_profile(close, volume)
    risk = risk_metrics(close)
    support, resistance = support_resistance(close, low, high)

    bullets = []
    if rsi_val >= 70:
        bullets.append("• مؤشر RSI يشير إلى تشبع شرائي محتمل")
    elif rsi_val <= 30:
        bullets.append("• مؤشر RSI يشير إلى تشبع بيعي محتمل")
    else:
        bullets.append(f"• مؤشر RSI عند {rsi_val:.0f} — منطقة متوسطة")

    if vol_ratio and vol_ratio != 1.0:
        pct_vol = f"{vol_ratio * 100:.0f}%"
        bullets.append(
            f"• حجم التداول {'أعلى' if vol_label == 'مرتفع' else 'أقل' if vol_label == 'منخفض' else 'قريب من'} المتوسط ({pct_vol} من متوسط 20 يوم)"
        )
    else:
        bullets.append("• حجم التداول ضمن المعدل الطبيعي")

    if liquidity_label != "غير متاح":
        bullets.append(f"• صحة السيولة: {liquidity_label} — مؤشر {liquidity_score}")

    bullets.append(f"• الدعم القوي عند {support:.2f} جنيه")
    bullets.append(f"• المقاومة الرئيسية عند {resistance:.2f} جنيه")

    return {
        "price": round(price, 2),
        "changePercent": round(change_pct, 2),
        "rsi": round(rsi_val, 1),
        "macd": macd_label,
        "ma": ma_label,
        "sma20": round(sma20, 2),
        "sma50": round(sma50, 2),
        "volume": vol_label,
        "volumeRatio": round(vol_ratio, 2) if vol_ratio else 1.0,
        "liquidity": liquidity_label,
        "liquidityScore": liquidity_score,
        "volumeProfile": volume_profile,
        "risk": risk,
        "support": round(support, 2),
        "resistance": round(resistance, 2),
        "bullets": bullets,
        "lastDate": df["Date"].iloc[-1].strftime("%Y-%m-%d"),
    }
