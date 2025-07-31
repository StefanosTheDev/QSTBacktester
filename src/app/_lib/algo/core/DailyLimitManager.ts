// src/strategy/DailyLimitManager.ts
export interface DailyStats {
  date: string;
  pnl: number;
  actualPnl: number; // Track actual P&L before limits
  trades: number;
  hitDailyStop: boolean;
  hitDailyTarget: boolean;
  tradingEnabled: boolean; // Track if trading is allowed
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

  // FIXED: Consistent date key function that NEVER uses Date objects
  private getDateKey(timestamp: string): string {
    // The timestamp is like "2025-01-15 09:30:00 AM"
    // Extract just the date part and convert to MM/DD/YYYY format
    const datePart = timestamp.split(' ')[0]; // Gets "2025-01-15"

    if (datePart && datePart.includes('-')) {
      const [year, month, day] = datePart.split('-');
      return `${month.padStart(2, '0')}/${day.padStart(2, '0')}/${year}`;
    }

    // If we get here, the timestamp format is unexpected
    console.error('Unexpected timestamp format:', timestamp);
    throw new Error(`Cannot parse timestamp: ${timestamp}`);
  }

  // Check if trading is allowed for the current timestamp
  canTrade(timestamp: string): boolean {
    const date = this.getDateKey(timestamp);

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
          tradingEnabled: true, // Start each day with trading enabled
        });
      }
    }

    const todayStats = this.dailyStats.get(date);
    if (!todayStats) return true;

    // Check if we've already hit limits today
    if (todayStats.hitDailyStop || todayStats.hitDailyTarget) {
      return false; // No more trading allowed today
    }

    // Check current P&L against limits
    if (
      this.maxDailyLoss !== -Infinity &&
      todayStats.actualPnl <= this.maxDailyLoss
    ) {
      return false;
    }
    if (
      this.maxDailyProfit !== Infinity &&
      todayStats.actualPnl >= this.maxDailyProfit
    ) {
      return false;
    }

    return todayStats.tradingEnabled;
  }

  recordTrade(
    timestamp: string,
    profit: number
  ): {
    allowed: boolean;
    reason?: string;
    cappedProfit?: number;
  } {
    const date = this.getDateKey(timestamp);
    let todayStats = this.dailyStats.get(date);

    if (!todayStats) {
      todayStats = {
        date,
        pnl: 0,
        actualPnl: 0,
        trades: 0,
        hitDailyStop: false,
        hitDailyTarget: false,
        tradingEnabled: true,
      };
      this.dailyStats.set(date, todayStats);
    }

    // IMPORTANT: Always update actual P&L
    todayStats.actualPnl += profit;
    todayStats.trades++;

    // Check if this trade puts us over limits
    let cappedProfit = profit;
    let hitLimit = false;
    let reason = '';

    // For capped P&L calculation
    const oldCappedPnl = todayStats.pnl;
    let newCappedPnl = oldCappedPnl + profit;

    // Check if we hit the daily loss limit
    if (
      this.maxDailyLoss !== -Infinity &&
      todayStats.actualPnl <= this.maxDailyLoss
    ) {
      // Cap the displayed P&L at the limit
      newCappedPnl = this.maxDailyLoss;
      cappedProfit = this.maxDailyLoss - oldCappedPnl;
      todayStats.hitDailyStop = true;
      todayStats.tradingEnabled = false; // Disable further trading
      hitLimit = true;
      reason = `Daily stop loss hit: $${Math.abs(this.maxDailyLoss).toFixed(
        2
      )}`;
    }
    // Check if we hit the daily profit target
    else if (
      this.maxDailyProfit !== Infinity &&
      todayStats.actualPnl >= this.maxDailyProfit
    ) {
      // Cap the displayed P&L at the limit
      newCappedPnl = this.maxDailyProfit;
      cappedProfit = this.maxDailyProfit - oldCappedPnl;
      todayStats.hitDailyTarget = true;
      todayStats.tradingEnabled = false; // Disable further trading
      hitLimit = true;
      reason = `Daily profit target hit: $${this.maxDailyProfit.toFixed(2)}`;
    }

    // Update capped P&L
    todayStats.pnl = newCappedPnl;

    return {
      allowed: !hitLimit,
      reason: hitLimit ? reason : undefined,
      cappedProfit: cappedProfit,
    };
  }

  // Check if a specific date has hit limits
  hasHitLimits(date: string): boolean {
    const stats = this.dailyStats.get(date);
    return stats ? stats.hitDailyStop || stats.hitDailyTarget : false;
  }

  getDailyStats(): DailyStats[] {
    return Array.from(this.dailyStats.values()).sort((a, b) => {
      // FIXED: Parse MM/DD/YYYY format WITHOUT using Date objects
      const parseDate = (dateStr: string) => {
        const [month, day, year] = dateStr.split('/').map((n) => parseInt(n));
        // Return a comparable number: YYYYMMDD
        return year * 10000 + month * 100 + day;
      };

      return parseDate(a.date) - parseDate(b.date);
    });
  }

  getDailyCappedPnL(): Record<string, number> {
    const dailyPnL: Record<string, number> = {};

    for (const stats of this.dailyStats.values()) {
      // Use the capped P&L for display
      dailyPnL[stats.date] = stats.pnl;
    }

    return dailyPnL;
  }

  // Get actual (uncapped) daily P&L
  getDailyActualPnL(): Record<string, number> {
    const dailyPnL: Record<string, number> = {};

    for (const stats of this.dailyStats.values()) {
      // Use the actual P&L
      dailyPnL[stats.date] = stats.actualPnl;
    }

    return dailyPnL;
  }

  getCurrentDayPnL(timestamp: string): number {
    const date = this.getDateKey(timestamp);
    const todayStats = this.dailyStats.get(date);
    return todayStats ? todayStats.actualPnl : 0; // Return actual P&L, not capped
  }

  getCurrentDayCappedPnL(timestamp: string): number {
    const date = this.getDateKey(timestamp);
    const todayStats = this.dailyStats.get(date);
    return todayStats ? todayStats.pnl : 0; // Return capped P&L
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

    // Use actual P&L for determining profitable/losing days
    const profitableDays = allDays.filter((d) => d.actualPnl > 0);
    const losingDays = allDays.filter((d) => d.actualPnl < 0);

    return {
      totalDays: allDays.length,
      profitableDays: profitableDays.length,
      losingDays: losingDays.length,
      daysHitStop: allDays.filter((d) => d.hitDailyStop).length,
      daysHitTarget: allDays.filter((d) => d.hitDailyTarget).length,
      bestDay: Math.max(...allDays.map((d) => d.actualPnl), 0),
      worstDay: Math.min(...allDays.map((d) => d.actualPnl), 0),
      totalCappedPnL: allDays.reduce((sum, d) => sum + d.pnl, 0),
      totalActualPnL: allDays.reduce((sum, d) => sum + d.actualPnl, 0),
    };
  }
}
