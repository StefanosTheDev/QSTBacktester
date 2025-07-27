// src/strategy/DailyLimitManager.ts
export interface DailyStats {
  date: string;
  pnl: number;
  actualPnl: number; // Track actual P&L before limits
  trades: number;
  hitDailyStop: boolean;
  hitDailyTarget: boolean;
}

export class DailyLimitManager {
  private dailyStats: Map<string, DailyStats> = new Map();
  private currentDate: string = '';
  private maxDailyLoss: number;
  private maxDailyProfit: number;

  constructor(maxDailyLoss?: number, maxDailyProfit?: number) {
    // Convert to negative for easier comparison
    this.maxDailyLoss = maxDailyLoss ? -Math.abs(maxDailyLoss) : -Infinity;
    this.maxDailyProfit = maxDailyProfit || Infinity;
  }

  canTrade(timestamp: string): boolean {
    const date = new Date(timestamp).toLocaleDateString('en-US');

    // Initialize new day if needed
    if (date !== this.currentDate) {
      this.currentDate = date;
      if (!this.dailyStats.has(date)) {
        this.dailyStats.set(date, {
          date,
          pnl: 0,
          actualPnl: 0,
          trades: 0,
          hitDailyStop: false,
          hitDailyTarget: false,
        });
      }
    }

    const todayStats = this.dailyStats.get(date);
    if (!todayStats) return true;

    // Can always trade, but profits/losses will be capped
    return true;
  }

  recordTrade(
    timestamp: string,
    profit: number
  ): {
    allowed: boolean;
    reason?: string;
    cappedProfit?: number;
  } {
    const date = new Date(timestamp).toLocaleDateString('en-US');
    let todayStats = this.dailyStats.get(date);

    if (!todayStats) {
      todayStats = {
        date,
        pnl: 0,
        actualPnl: 0,
        trades: 0,
        hitDailyStop: false,
        hitDailyTarget: false,
      };
      this.dailyStats.set(date, todayStats);
    }

    // Update actual P&L (uncapped)
    todayStats.actualPnl += profit;
    todayStats.trades++;

    // Calculate capped P&L
    const oldPnl = todayStats.pnl;
    let newPnl = oldPnl + profit;
    let cappedProfit = profit;
    let hitLimit = false;
    let reason = '';

    // Check if we hit the daily loss limit
    if (this.maxDailyLoss !== -Infinity && newPnl <= this.maxDailyLoss) {
      newPnl = this.maxDailyLoss;
      cappedProfit = this.maxDailyLoss - oldPnl;
      todayStats.hitDailyStop = true;
      hitLimit = true;
      reason = `Daily stop loss hit: $${Math.abs(this.maxDailyLoss).toFixed(
        2
      )}`;
    }
    // Check if we hit the daily profit target
    else if (
      this.maxDailyProfit !== Infinity &&
      newPnl >= this.maxDailyProfit
    ) {
      newPnl = this.maxDailyProfit;
      cappedProfit = this.maxDailyProfit - oldPnl;
      todayStats.hitDailyTarget = true;
      hitLimit = true;
      reason = `Daily profit target hit: $${this.maxDailyProfit.toFixed(2)}`;
    }

    // Update capped P&L
    todayStats.pnl = newPnl;

    return {
      allowed: !hitLimit,
      reason: hitLimit ? reason : undefined,
      cappedProfit: cappedProfit,
    };
  }

  getDailyStats(): DailyStats[] {
    return Array.from(this.dailyStats.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  getDailyCappedPnL(): Record<string, number> {
    const dailyPnL: Record<string, number> = {};

    for (const stats of this.dailyStats.values()) {
      // Use the capped P&L, not the actual P&L
      dailyPnL[stats.date] = stats.pnl;
    }

    return dailyPnL;
  }

  getCurrentDayPnL(timestamp: string): number {
    const date = new Date(timestamp).toLocaleDateString('en-US');
    const todayStats = this.dailyStats.get(date);
    return todayStats ? todayStats.pnl : 0;
  }

  getSummary(): {
    totalDays: number;
    profitableDays: number;
    losingDays: number;
    daysHitStop: number;
    daysHitTarget: number;
    bestDay: number;
    worstDay: number;
    totalCappedPnL: number;
    totalActualPnL: number;
  } {
    const allDays = this.getDailyStats();
    const profitableDays = allDays.filter((d) => d.pnl > 0);
    const losingDays = allDays.filter((d) => d.pnl < 0);

    return {
      totalDays: allDays.length,
      profitableDays: profitableDays.length,
      losingDays: losingDays.length,
      daysHitStop: allDays.filter((d) => d.hitDailyStop).length,
      daysHitTarget: allDays.filter((d) => d.hitDailyTarget).length,
      bestDay: Math.max(...allDays.map((d) => d.pnl), 0),
      worstDay: Math.min(...allDays.map((d) => d.pnl), 0),
      totalCappedPnL: allDays.reduce((sum, d) => sum + d.pnl, 0),
      totalActualPnL: allDays.reduce((sum, d) => sum + d.actualPnl, 0),
    };
  }
}
