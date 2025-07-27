// src/strategy/TradeStatistics.ts
import { StrategyTrade } from './types';

export class TradeStatistics {
  private trades: StrategyTrade[] = [];
  private startingCapital: number = 100000; // $100k starting capital for Sharpe calculation

  logTrade(trade: StrategyTrade): void {
    this.trades.push(trade);
  }

  getTradeCount(): number {
    return this.trades.length;
  }

  getWinRate(): number {
    if (this.trades.length === 0) return 0;
    const wins = this.trades.filter((t) => t.profit > 0).length;
    return (wins / this.trades.length) * 100;
  }

  getAverageProfit(): number {
    if (this.trades.length === 0) return 0;
    const totalProfit = this.trades.reduce((sum, t) => sum + t.profit, 0);
    return totalProfit / this.trades.length;
  }

  getSharpeRatio(): number {
    if (this.trades.length < 2) return 0;

    // Calculate returns based on account equity
    let equity = this.startingCapital;
    const returns: number[] = [];

    for (const trade of this.trades) {
      // Calculate return as percentage of current equity
      const returnPct = trade.profit / equity;
      returns.push(returnPct);
      equity += trade.profit;
    }

    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
      (returns.length - 1);
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    // Estimate annualization factor based on average trades per year
    // This is more accurate than using 252 days
    const firstTradeDate = new Date(this.trades[0].entryTime);
    const lastTradeDate = new Date(
      this.trades[this.trades.length - 1].exitTime
    );
    const tradingDays =
      (lastTradeDate.getTime() - firstTradeDate.getTime()) /
      (1000 * 60 * 60 * 24);
    const tradesPerDay = this.trades.length / tradingDays;
    const estimatedTradesPerYear = tradesPerDay * 252; // 252 trading days per year
    const annualizationFactor = Math.sqrt(estimatedTradesPerYear);

    return (meanReturn * annualizationFactor) / stdDev;
  }

  getDailyPnL(): Record<string, number> {
    const dailyPnL: Record<string, number> = {};

    for (const trade of this.trades) {
      const exitDate = new Date(trade.exitTime).toISOString().split('T')[0];
      // Profit is already in dollars (calculated with commission in PositionManager)
      dailyPnL[exitDate] = (dailyPnL[exitDate] || 0) + trade.profit;
    }

    return dailyPnL;
  }

  getMaxDrawdown(): number {
    if (this.trades.length === 0) return 0;

    let equity = this.startingCapital;
    let peak = equity;
    let maxDrawdown = 0;

    for (const trade of this.trades) {
      equity += trade.profit;
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown * 100; // Return as percentage
  }

  getConsecutiveWinsLosses(): { maxWins: number; maxLosses: number } {
    let maxWins = 0;
    let maxLosses = 0;
    let currentWins = 0;
    let currentLosses = 0;

    for (const trade of this.trades) {
      if (trade.profit > 0) {
        currentWins++;
        currentLosses = 0;
        maxWins = Math.max(maxWins, currentWins);
      } else {
        currentLosses++;
        currentWins = 0;
        maxLosses = Math.max(maxLosses, currentLosses);
      }
    }

    return { maxWins, maxLosses };
  }

  getAverageWinLoss(): {
    avgWin: number;
    avgLoss: number;
    avgWinPoints: number;
    avgLossPoints: number;
  } {
    const wins = this.trades.filter((t) => t.profit > 0);
    const losses = this.trades.filter((t) => t.profit < 0);

    const avgWin =
      wins.length > 0
        ? wins.reduce((sum, t) => sum + t.profit, 0) / wins.length
        : 0;

    const avgLoss =
      losses.length > 0
        ? losses.reduce((sum, t) => sum + t.profit, 0) / losses.length
        : 0;

    // Calculate average points (before commission)
    const avgWinPoints =
      wins.length > 0
        ? wins.reduce(
            (sum, t) => sum + Math.abs(t.exitPrice - t.entryPrice),
            0
          ) / wins.length
        : 0;

    const avgLossPoints =
      losses.length > 0
        ? losses.reduce(
            (sum, t) => sum + Math.abs(t.exitPrice - t.entryPrice),
            0
          ) / losses.length
        : 0;

    return { avgWin, avgLoss, avgWinPoints, avgLossPoints };
  }

  getStatistics() {
    const stats = {
      totalTrades: this.getTradeCount(),
      winRate: this.getWinRate(),
      averageProfit: this.getAverageProfit(),
      sharpeRatio: this.getSharpeRatio(),
      dailyPnL: this.getDailyPnL(),
      maxDrawdown: this.getMaxDrawdown(),
      consecutiveStats: this.getConsecutiveWinsLosses(),
    };

    // Add profit factor
    const wins = this.trades.filter((t) => t.profit > 0);
    const losses = this.trades.filter((t) => t.profit < 0);
    const totalWins = wins.reduce((sum, t) => sum + t.profit, 0);
    const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.profit, 0));

    // Get average win/loss analysis
    const avgWinLoss = this.getAverageWinLoss();

    return {
      ...stats,
      profitFactor:
        totalLosses > 0
          ? totalWins / totalLosses
          : totalWins > 0
          ? Infinity
          : 0,
      totalProfit: this.trades.reduce((sum, t) => sum + t.profit, 0),
      avgWinLoss: avgWinLoss,
    };
  }

  reset(): void {
    this.trades = [];
  }
}
