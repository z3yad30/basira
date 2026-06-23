"""Regenerate egx_stocks.json from CSV filenames in stock_data/stock_data."""
from pathlib import Path
import json
import os
import sys

BASE_DIR = Path(__file__).resolve().parent
STOCK_DIR = BASE_DIR.parent / "stock_data" / "stock_data"
OUT = BASE_DIR / "egx_stocks.json"

try:
    from update_data import sanitize_filename
except Exception:
    import re

    def sanitize_filename(name: str) -> str:
        name = name.strip()
        name = re.sub(r"\s+", "_", name)
        name = re.sub(r"[^0-9A-Za-z_]", "", name)
        return name

stocks = []
if not STOCK_DIR.exists():
    print(f"Stock directory {STOCK_DIR} not found", file=sys.stderr)
else:
    for p in sorted(STOCK_DIR.iterdir()):
        if p.suffix.lower() != ".csv":
            continue
        stem = p.stem
        code = stem
        ticker = f"{code}.CA"
        name = stem.replace("_", " ")
        fileName = sanitize_filename(stem)
        stocks.append({"ticker": ticker, "code": code, "name": name, "fileName": fileName})

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(stocks, f, ensure_ascii=False, indent=2)
print(f"Wrote {len(stocks)} stocks to {OUT}")
