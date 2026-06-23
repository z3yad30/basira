const express = require('express');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');

const app = express();
const port = process.env.PORT || 4000;
const publicDir = path.join(__dirname, '../public');

app.use(express.static(publicDir));
// Expose the server folder so client code can fetch files like egx_stocks.json
app.use('/server', express.static(path.join(__dirname)));
// Expose the stock_data folder so client can fetch CSV files
app.use('/stock_data', express.static(path.join(__dirname, '../stock_data')));

function runPythonScriptCapture(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const pythonCmd = resolvePythonCommand();
    const child = spawn(pythonCmd, [scriptPath, ...args], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

app.get('/api/analysis', async (req, res) => {
  const stock = String(req.query.stock || '').trim();
  const scenario = String(req.query.scenario || 'mean').toLowerCase();
  const allowed = ['mean', 'conservative', 'aggressive'];

  if (!stock) {
    return res.status(400).json({
      error: 'missing_stock',
      message: 'Parameter stock is required',
    });
  }

  if (!allowed.includes(scenario)) {
    return res.status(400).json({
      error: 'invalid_scenario',
      message: 'Scenario must be one of mean, conservative, aggressive',
    });
  }

  try {
    const { code, stdout, stderr } = await runPythonScriptCapture('analyze_stock.py', [stock, scenario]);
    if (code !== 0) {
      console.error(`Python analyze_stock.py failed (code ${code})`, stderr);
      return res.status(500).json({
        error: 'analysis_failed',
        message: 'فشل تشغيل تحليل السهم. حاول لاحقاً.',
        details: stderr.trim() || 'No stderr output',
      });
    }

    try {
      const parsed = JSON.parse(stdout);
      return res.json(parsed);
    } catch (parseErr) {
      console.error('Failed to parse analysis JSON:', parseErr.message);
      console.error('Python output:', stdout);
      return res.status(500).json({
        error: 'analysis_parse_failed',
        message: 'تعذر قراءة نتائج التحليل من الخادم.',
      });
    }
  } catch (err) {
    console.error('Error running analysis script:', err.message);
    return res.status(500).json({
      error: 'analysis_execution_error',
      message: 'تعذر تشغيل تحليل السهم.',
      details: err.message,
    });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

function resolvePythonCommand() {
  const candidates = [process.env.PYTHON, 'python', 'python3'].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ['--version'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      if (result.status === 0) {
        return candidate;
      }
    } catch (err) {
      // ignore and try next candidate
    }
  }

  return 'python';
}

function runPythonScript(scriptName) {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, scriptName);
    const pythonCmd = resolvePythonCommand();
    console.log(`🕒 Running ${scriptName} using ${pythonCmd}`);

    const child = spawn(pythonCmd, [scriptPath], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: false,
    });

    child.on('error', (error) => {
      console.error(`❌ Failed to launch ${scriptName}:`, error.message);
      resolve(1);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        console.error(`❌ ${scriptName} exited with code ${code}`);
      } else {
        console.log(`✅ ${scriptName} completed successfully.`);
      }
      resolve(code);
    });
  });
}

const UPDATE_INTERVAL_MS = 15 * 60 * 1000;

async function runStockUpdate() {
  console.log('📆 EGX stock update started.');

  const exitCode = await runPythonScript('update_data.py');
  if (exitCode !== 0) {
    console.error('⚠️ EGX stock update failed.');
    return;
  }

  console.log('📆 EGX stock update finished.');
  try {
    await computeUpDownStocks();
  } catch (err) {
    console.error('❌ Error computing up/down stocks:', err.message);
  }
}

async function runCommodityUpdate() {
  console.log('🥇 Commodity update started (gold, silver, Brent).');
  const exitCode = await runPythonScript('update_commodities.py');
  if (exitCode !== 0) {
    console.error('⚠️ Commodity update failed.');
    return;
  }
  console.log('🥇 Commodity update finished.');
}

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
      // continue on per-stock errors
      console.warn('Error processing stock for up/down:', err.message);
      continue;
    }
  }

  // sort and compute top movers
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

function getCairoDatePartsAt(timestamp = Date.now()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
    hour12: false,
  });

  const parts = formatter.formatToParts(new Date(timestamp));
  const lookup = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') lookup[part.type] = part.value;
  });

  const weekdayNames = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return {
    day: weekdayNames[lookup.weekday] ?? 0,
    hour: Number(lookup.hour),
    minute: Number(lookup.minute),
    second: Number(lookup.second),
  };
}

function getCairoTimeParts() {
  return getCairoDatePartsAt(Date.now());
}

function isMarketOpenCairo() {
  const { day, hour, minute } = getCairoTimeParts();
  const currentMinutes = hour * 60 + minute;
  const openMinutes = 10 * 60;
  const closeMinutes = 14 * 60 + 30;
  const isTradingDay = day >= 0 && day <= 4;
  return isTradingDay && currentMinutes >= openMinutes && currentMinutes < closeMinutes;
}

function msUntilNextOpenCairo() {
  const now = Date.now();
  const oneMinute = 60 * 1000;
  const oneWeek = 7 * 24 * 60 * oneMinute;

  for (let t = now + oneMinute; t <= now + oneWeek; t += oneMinute) {
    const { day, hour, minute } = getCairoDatePartsAt(t);
    const isTradingDay = day >= 0 && day <= 4;
    if (isTradingDay && hour === 10 && minute === 0) {
      return t - now;
    }
  }

  return oneWeek;
}

function scheduleCommodityUpdates() {
  console.log(`⏱ Scheduling next commodity update in ${UPDATE_INTERVAL_MS / 1000} seconds (always on).`);

  setTimeout(async () => {
    try {
      await runCommodityUpdate();
    } catch (err) {
      console.error('Commodity update failed:', err);
    }

    scheduleCommodityUpdates();
  }, UPDATE_INTERVAL_MS);
}

function scheduleStockUpdates() {
  const marketOpen = isMarketOpenCairo();
  const nextDelay = marketOpen ? UPDATE_INTERVAL_MS : msUntilNextOpenCairo();
  const mode = marketOpen ? 'open' : 'closed';

  console.log(`⏱ Scheduling next EGX stock update in ${Math.round(nextDelay / 1000)} seconds while market is ${mode}.`);

  setTimeout(async () => {
    if (!isMarketOpenCairo()) {
      console.log('⏸ Cairo market closed; skipping EGX stock update until next open.');
      scheduleStockUpdates();
      return;
    }

    try {
      await runStockUpdate();
    } catch (err) {
      console.error('EGX stock update failed:', err);
    }

    scheduleStockUpdates();
  }, nextDelay);
}

scheduleCommodityUpdates();
scheduleStockUpdates();

app.listen(port, () => {
  console.log(`Basira app server running on http://localhost:${port}`);
});
