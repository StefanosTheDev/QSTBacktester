// src/app/_lib/algo/core/DailyLimitManager.ts
import { DateTimeUtils } from '../utils/DateTimeUtils';

export interface DailyStats {
  date: string; // EST date for display
  pnl: number; // Capped P&L
  actualPnl: number; // Actual P&L before limits
  trades: number;
  hitDailyStop: boolean;
  hitDailyTarget: boolean;
  tradingEnabled: boolean;
}

export class DailyLimitManager {
  private dailyStats: Map<string, DailyStats> = new Map();
  private currentDate: string = '';
  private maxDailyLoss: number;
  private maxDailyProfit: number;

  constructor(maxDailyLoss?: number, maxDailyProfit?: number) {
    this.maxDailyLoss = maxDailyLoss ? -Math.abs(maxDailyLoss) : -Infinity;
    this.maxDailyProfit = maxDailyProfit || Infinity;
  }

  /**
   * Get date key using EST for daily grouping (market days)
   */
  private getDateKey(timestamp: string): string {
    // Use display date key for EST-based daily grouping
    return DateTimeUtils.getDisplayDateKey(timestamp);
  }

  /**
   * Check if trading is allowed for the current timestamp
   */
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
          tradingEnabled: true,
        });
      }
    }

    const todayStats = this.dailyStats.get(date);
    if (!todayStats) return true;

    // Check if we've already hit limits today
    if (todayStats.hitDailyStop || todayStats.hitDailyTarget) {
      return false;
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

  /**
   * Record a trade and check for limit breaches
   */
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

    // Always update actual P&L
    todayStats.actualPnl += profit;
    todayStats.trades++;

    // Check if this trade puts us over limits
    let cappedProfit = profit;
    let hitLimit = false;
    let reason = '';

    const oldCappedPnl = todayStats.pnl;
    let newCappedPnl = oldCappedPnl + profit;

    // Check daily loss limit
    if (
      this.maxDailyLoss !== -Infinity &&
      todayStats.actualPnl <= this.maxDailyLoss
    ) {
      newCappedPnl = this.maxDailyLoss;
      cappedProfit = this.maxDailyLoss - oldCappedPnl;
      todayStats.hitDailyStop = true;
      todayStats.tradingEnabled = false;
      hitLimit = true;
      reason = `Daily stop loss hit: $${Math.abs(this.maxDailyLoss).toFixed(
        2
      )}`;
    }
    // Check daily profit target
    else if (
      this.maxDailyProfit !== Infinity &&
      todayStats.actualPnl >= this.maxDailyProfit
    ) {
      newCappedPnl = this.maxDailyProfit;
      cappedProfit = this.maxDailyProfit - oldCappedPnl;
      todayStats.hitDailyTarget = true;
      todayStats.tradingEnabled = false;
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

  /**
   * Get all daily stats sorted by date
   */
  getDailyStats(): DailyStats[] {
    const allStats = Array.from(this.dailyStats.values());
    // Use DateTimeUtils to sort dates properly
    return allStats.sort((a, b) => {
      const aDate = DateTimeUtils.parseDateKey(a.date);
      const bDate = DateTimeUtils.parseDateKey(b.date);
      return aDate.comparable - bDate.comparable;
    });
  }

  /**
   * Get daily P&L (capped at limits)
   */
  getDailyCappedPnL(): Record<string, number> {
    const dailyPnL: Record<string, number> = {};
    for (const stats of this.dailyStats.values()) {
      dailyPnL[stats.date] = stats.pnl;
    }
    return dailyPnL;
  }

  /**
   * Get actual daily P&L (uncapped)
   */
  getDailyActualPnL(): Record<string, number> {
    const dailyPnL: Record<string, number> = {};
    for (const stats of this.dailyStats.values()) {
      dailyPnL[stats.date] = stats.actualPnl;
    }
    return dailyPnL;
  }

  /**
   * Get current day's P&L
   */
  getCurrentDayPnL(timestamp: string): number {
    const date = this.getDateKey(timestamp);
    const todayStats = this.dailyStats.get(date);
    return todayStats ? todayStats.actualPnl : 0;
  }

  /**
   * Get current day's capped P&L
   */
  getCurrentDayCappedPnL(timestamp: string): number {
    const date = this.getDateKey(timestamp);
    const todayStats = this.dailyStats.get(date);
    return todayStats ? todayStats.pnl : 0;
  }

  /**
   * Check if a specific date has hit limits
   */
  hasHitLimits(date: string): boolean {
    const stats = this.dailyStats.get(date);
    return stats ? stats.hitDailyStop || stats.hitDailyTarget : false;
  }

  /**
   * Get summary statistics
   */
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
