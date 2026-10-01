// Pure quantitative signal functions. No IO, no allocation beyond outputs.

const TRADING_DAYS_PER_YEAR = 252;

function toSeries(dailyBars) {
  // dailyBars: [{ date: "YYYY-MM-DD", close: number }] sorted ascending.
  return dailyBars.map((bar) => bar.close);
}

function dailyReturns(closes) {
  const returns = [];
  for (let index = 1; index < closes.length; index += 1) {
    const previous = closes[index - 1];
    if (previous > 0) {
      returns.push(closes[index] / previous - 1);
    }
  }
  return returns;
}

function momentum(closes, windowDays) {
  if (closes.length <= windowDays) {
    return null;
  }
  const start = closes[closes.length - 1 - windowDays];
  const end = closes[closes.length - 1];
  if (start <= 0) {
    return null;
  }
  return end / start - 1;
}

function simpleMovingAverage(closes, windowDays) {
  if (closes.length < windowDays) {
    return null;
  }
  let sum = 0;
  for (let index = closes.length - windowDays; index < closes.length; index += 1) {
    sum += closes[index];
  }
  return sum / windowDays;
}

function rsi(closes, period = 14) {
  if (closes.length <= period) {
    return null;
  }
  let gains = 0;
  let losses = 0;
  for (let index = closes.length - period; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses -= change;
    }
  }
  if (losses === 0) {
    return 100;
  }
  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function annualizedVolatility(closes) {
  const returns = dailyReturns(closes);
  if (returns.length < 2) {
    return null;
  }
  let mean = 0;
  for (const value of returns) {
    mean += value;
  }
  mean /= returns.length;
  let variance = 0;
  for (const value of returns) {
    variance += (value - mean) ** 2;
  }
  variance /= returns.length - 1;
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

function maxDrawdown(closes) {
  let peak = -Infinity;
  let worst = 0;
  for (const close of closes) {
    if (close > peak) {
      peak = close;
    }
    if (peak > 0) {
      const drawdown = close / peak - 1;
      if (drawdown < worst) {
        worst = drawdown;
      }
    }
  }
  return worst;
}

function annualizedReturn(closes) {
  const returns = dailyReturns(closes);
  if (returns.length === 0) {
    return null;
  }
  let compounded = 1;
  for (const value of returns) {
    compounded *= 1 + value;
  }
  const years = returns.length / TRADING_DAYS_PER_YEAR;
  if (years <= 0 || compounded <= 0) {
    return null;
  }
  return compounded ** (1 / years) - 1;
}

function beta(stockCloses, marketCloses) {
  const stockReturns = dailyReturns(stockCloses);
  const marketReturns = dailyReturns(marketCloses);
  const count = Math.min(stockReturns.length, marketReturns.length);
  if (count < 2) {
    return null;
  }
  const stock = stockReturns.slice(-count);
  const market = marketReturns.slice(-count);

  let stockMean = 0;
  let marketMean = 0;
  for (let index = 0; index < count; index += 1) {
    stockMean += stock[index];
    marketMean += market[index];
  }
  stockMean /= count;
  marketMean /= count;

  let covariance = 0;
  let marketVariance = 0;
  for (let index = 0; index < count; index += 1) {
    const marketDelta = market[index] - marketMean;
    covariance += (stock[index] - stockMean) * marketDelta;
    marketVariance += marketDelta ** 2;
  }
  if (marketVariance === 0) {
    return null;
  }
  return covariance / marketVariance;
}

function correlation(closesA, closesB) {
  const returnsA = dailyReturns(closesA);
  const returnsB = dailyReturns(closesB);
  const count = Math.min(returnsA.length, returnsB.length);
  if (count < 2) {
    return null;
  }
  const a = returnsA.slice(-count);
  const b = returnsB.slice(-count);

  let meanA = 0;
  let meanB = 0;
  for (let index = 0; index < count; index += 1) {
    meanA += a[index];
    meanB += b[index];
  }
  meanA /= count;
  meanB /= count;

  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (let index = 0; index < count; index += 1) {
    const deltaA = a[index] - meanA;
    const deltaB = b[index] - meanB;
    covariance += deltaA * deltaB;
    varianceA += deltaA ** 2;
    varianceB += deltaB ** 2;
  }
  const denominator = Math.sqrt(varianceA * varianceB);
  if (denominator === 0) {
    return null;
  }
  return covariance / denominator;
}

function alignByDate(stockBars, marketBars) {
  // Position-based slicing pairs returns from different dates when calendars
  // differ (halts, holidays). Join on date instead.
  const marketByDate = new Map(marketBars.map((bar) => [bar.date, bar.close]));
  const stock = [];
  const market = [];
  for (const bar of stockBars) {
    const marketClose = marketByDate.get(bar.date);
    if (marketClose !== undefined) {
      stock.push(bar.close);
      market.push(marketClose);
    }
  }
  return { stock, market };
}

function computeSignals(dailyBars, marketBars = null) {
  const closes = toSeries(dailyBars);
  if (closes.length === 0) {
    return null;
  }
  const lastClose = closes[closes.length - 1];
  const signals = {
    lastClose,
    bars: closes.length,
    momentum1m: momentum(closes, 21),
    momentum3m: momentum(closes, 63),
    momentum6m: momentum(closes, 126),
    momentum12m: momentum(closes, 252),
    sma50: simpleMovingAverage(closes, 50),
    sma200: simpleMovingAverage(closes, 200),
    aboveSma50: null,
    aboveSma200: null,
    rsi14: rsi(closes, 14),
    annualizedVolatility: annualizedVolatility(closes),
    annualizedReturn: annualizedReturn(closes),
    maxDrawdown: maxDrawdown(closes),
    beta: null,
    marketCorrelation: null,
  };
  if (signals.sma50 !== null) {
    signals.aboveSma50 = lastClose > signals.sma50;
  }
  if (signals.sma200 !== null) {
    signals.aboveSma200 = lastClose > signals.sma200;
  }
  if (marketBars && marketBars.length > 1) {
    const aligned = alignByDate(dailyBars, marketBars);
    signals.beta = beta(aligned.stock, aligned.market);
    signals.marketCorrelation = correlation(aligned.stock, aligned.market);
  }
  return signals;
}

export {
  alignByDate,
  dailyReturns,
  momentum,
  simpleMovingAverage,
  rsi,
  annualizedVolatility,
  annualizedReturn,
  maxDrawdown,
  beta,
  correlation,
  computeSignals,
};
