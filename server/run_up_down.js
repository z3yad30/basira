// node server/run_up_down.js
const path = require('path');
const fs = require('fs');

// Copy the computeUpDownStocks function from index.js here
async function computeUpDownStocks() {
  console.log('🔁 Computing up/down stocks JSON...');
  const egxPath = path.join(__dirname, 'egx_stocks.json');
  const outPath = path.join(__dirname, 'up_down_stocks.json');

  if (!fs.existsSync(egxPath)) {
    console.warn('egx_stocks.json not found, skipping up/down computation.');
    return;
  }

  const raw = fs.readFileSync(egxPath, 'utf8');
  let stocksList = [];
  try {
    stocksList = JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse egx_stocks.json:', err.message);
    return;
  }

  const up = [];
  const down = [];
  const neutral = [];

  for (const stock of stocksList) {
    try {
      const fileName = stock.fileName || stock.code;
      if (!fileName) continue;
      const csvPath = path.join(__dirname, '..', 'stock_data', 'stock_data', `${fileName}.csv`);
      if (!fs.existsSync(csvPath)) continue;

      const csvText = fs.readFileSync(csvPath, 'utf8').trim();
      const lines = csvText.split(/\r?\n/);
      if (lines.length < 2) continue;

      const headers = lines[0]
        .split(',')
        .map((h) => h.replace(/^"|"$/g, '').trim().toLowerCase());
      const openIdx = headers.findIndex((h) => h === 'open');
      const closeIdx = headers.findIndex((h) => h === 'close' || h === 'adj close');
      if (openIdx === -1 || closeIdx === -1) continue;

      const lastLine = lines[lines.length - 1];
      const values = lastLine.split(',').map((v) => v.replace(/^"|"$/g, '').trim());
      if (values.length <= Math.max(openIdx, closeIdx)) continue;

      const open = parseFloat(values[openIdx]);
      const close = parseFloat(values[closeIdx]);
      if (isNaN(open) || isNaN(close) || open === 0) continue;

      const change = close - open;
      const changePercent = (change / open) * 100;

      const stockData = {
        name: stock.name || stock.ticker || fileName,
        ticker: stock.ticker || '',
        code: stock.code || fileName,
        open,
        close,
        change: Number(change.toFixed(2)),
        changePercent: Number(changePercent.toFixed(2)),
      };

      if (close > open) up.push(stockData);
      else if (close < open) down.push(stockData);
      else neutral.push(stockData);
    } catch (err) {
      console.warn('Error processing stock for up/down:', err.message);
      continue;
    }
  }

  const topGainers = [...up].sort((a, b) => b.changePercent - a.changePercent).slice(0, 10);
  const topLosers = [...down].sort((a, b) => a.changePercent - b.changePercent).slice(0, 10);

  const out = {
    generatedAt: new Date().toISOString(),
    counts: { up: up.length, down: down.length, neutral: neutral.length },
    up,
    down,
    neutral,
    topGainers,
    topLosers,
  };

  try {
    if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
    console.log(`✅ Wrote up/down JSON to ${outPath}`);
  } catch (err) {
    console.error('Failed to write up/down JSON:', err.message);
  }
}

// Run the function
computeUpDownStocks().catch(console.error);