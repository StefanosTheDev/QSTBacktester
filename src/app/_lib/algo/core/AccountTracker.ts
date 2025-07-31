// src/app/_lib/algo/core/AccountTracker.ts - Key updates only
import { DateTimeUtils } from '../utils/DateTimeUtils';

export interface AccountSnapshot {
  timestamp: string;
  balance: number;
  equity: number;
  drawdown: number;
  drawdownPercent: number;
  highWaterMark: number;
  openPnL: number;
  realizedPnL: number;
  tradeCount: number;
}

export interface DrawdownEvent {
  startDate: string;
  endDate: string;
  startBalance: number;
  lowestBalance: number;
  drawdownAmount: number;
  drawdownPercent: number;
  duration: number; // in days
  recovered: boolean;
}

export class AccountTracker {
  private startingBalance: number;
  private currentBalance: number;
  private highWaterMark: number;
  private snapshots: AccountSnapshot[] = [];
  private drawdownEvents: DrawdownEvent[] = [];
  private currentDrawdownEvent: DrawdownEvent | null = null;
  private openPositionValue: number = 0;
  private totalTrades: number = 0;

  constructor(startingBalance: number = 50000) {
    this.startingBalance = startingBalance;
    this.currentBalance = startingBalance;
    this.highWaterMark = startingBalance;

    // Record initial snapshot with a sample timestamp
    this.recordSnapshot('2025-01-01 06:30:00 AM'); // PST
  }

  recordTrade(
    timestamp: string,
    netProfitLoss: number,
    isClosing: boolean = true
  ): void {
    if (isClosing) {
      // Closing trade - update balance
      this.currentBalance += netProfitLoss;
      this.totalTrades++;

      // Update high water mark
      if (this.currentBalance > this.highWaterMark) {
        this.highWaterMark = this.currentBalance;

        // End current drawdown event if we've recovered
        if (this.currentDrawdownEvent && !this.currentDrawdownEvent.recovered) {
          this.currentDrawdownEvent.endDate = timestamp;
          this.currentDrawdownEvent.recovered = true;
          this.currentDrawdownEvent.duration = this.calculateDaysBetween(
            this.currentDrawdownEvent.startDate,
            this.currentDrawdownEvent.endDate
          );
        }
      }

      // Check for drawdown
      const currentDrawdown = this.highWaterMark - this.currentBalance;
      const currentDrawdownPercent =
        (currentDrawdown / this.highWaterMark) * 100;

      // Start new drawdown event if we're in drawdown and don't have an active one
      if (
        currentDrawdown > 0 &&
        (!this.currentDrawdownEvent || this.currentDrawdownEvent.recovered)
      ) {
        this.currentDrawdownEvent = {
          startDate: timestamp,
          endDate: timestamp,
          startBalance: this.highWaterMark,
          lowestBalance: this.currentBalance,
          drawdownAmount: currentDrawdown,
          drawdownPercent: currentDrawdownPercent,
          duration: 0,
          recovered: false,
        };
        this.drawdownEvents.push(this.currentDrawdownEvent);
      }

      // Update current drawdown event if active
      if (this.currentDrawdownEvent && !this.currentDrawdownEvent.recovered) {
        if (this.currentBalance < this.currentDrawdownEvent.lowestBalance) {
          this.currentDrawdownEvent.lowestBalance = this.currentBalance;
          this.currentDrawdownEvent.drawdownAmount =
            this.currentDrawdownEvent.startBalance - this.currentBalance;
          this.currentDrawdownEvent.drawdownPercent =
            (this.currentDrawdownEvent.drawdownAmount /
              this.currentDrawdownEvent.startBalance) *
            100;
        }
        this.currentDrawdownEvent.endDate = timestamp;
      }
    }

    // Record snapshot
    this.recordSnapshot(timestamp);
  }

  updateOpenPosition(openPnL: number): void {
    this.openPositionValue = openPnL;
  }

  private recordSnapshot(timestamp: string): void {
    const equity = this.currentBalance + this.openPositionValue;
    const drawdown = this.highWaterMark - equity;
    const drawdownPercent =
      this.highWaterMark > 0 ? (drawdown / this.highWaterMark) * 100 : 0;

    this.snapshots.push({
      timestamp,
      balance: this.currentBalance,
      equity,
      drawdown: Math.max(0, drawdown),
      drawdownPercent: Math.max(0, drawdownPercent),
      highWaterMark: this.highWaterMark,
      openPnL: this.openPositionValue,
      realizedPnL: this.currentBalance - this.startingBalance,
      tradeCount: this.totalTrades,
    });
  }

  /**
   * UPDATED: Use DateTimeUtils for consistent day calculation
   */
  private calculateDaysBetween(start: string, end: string): number {
    return DateTimeUtils.getDaysBetween(start, end);
  }

  getAccountSummary(): {
    startingBalance: number;
    finalBalance: number;
    totalReturn: number;
    totalReturnPercent: number;
    maxDrawdown: number;
    maxDrawdownPercent: number;
    maxDrawdownDuration: number;
    averageDrawdown: number;
    averageDrawdownPercent: number;
    numberOfDrawdowns: number;
    currentDrawdown: number;
    currentDrawdownPercent: number;
    profitFactor: number;
    returnToDrawdownRatio: number;
    highWaterMark: number;
    lowestBalance: number;
    largestWinningStreak: number;
    largestLosingStreak: number;
  } {
    const finalBalance = this.currentBalance;
    const totalReturn = finalBalance - this.startingBalance;
    const totalReturnPercent = (totalReturn / this.startingBalance) * 100;

    // Calculate max drawdown from all events
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    let maxDrawdownDuration = 0;
    let totalDrawdown = 0;
    let totalDrawdownPercent = 0;

    this.drawdownEvents.forEach((event) => {
      if (event.drawdownAmount > maxDrawdown) {
        maxDrawdown = event.drawdownAmount;
        maxDrawdownPercent = event.drawdownPercent;
        maxDrawdownDuration = event.duration;
      }
      totalDrawdown += event.drawdownAmount;
      totalDrawdownPercent += event.drawdownPercent;
    });

    const numberOfDrawdowns = this.drawdownEvents.length;
    const averageDrawdown =
      numberOfDrawdowns > 0 ? totalDrawdown / numberOfDrawdowns : 0;
    const averageDrawdownPercent =
      numberOfDrawdowns > 0 ? totalDrawdownPercent / numberOfDrawdowns : 0;

    // Current drawdown
    const currentDrawdown = Math.max(
      0,
      this.highWaterMark - this.currentBalance
    );
    const currentDrawdownPercent =
      this.highWaterMark > 0 ? (currentDrawdown / this.highWaterMark) * 100 : 0;

    // Calculate profit factor from snapshots
    let grossProfit = 0;
    let grossLoss = 0;
    let winningStreak = 0;
    let losingStreak = 0;
    let maxWinningStreak = 0;
    let maxLosingStreak = 0;

    for (let i = 1; i < this.snapshots.length; i++) {
      const pnlChange =
        this.snapshots[i].balance - this.snapshots[i - 1].balance;
      if (pnlChange > 0) {
        grossProfit += pnlChange;
        winningStreak++;
        losingStreak = 0;
        maxWinningStreak = Math.max(maxWinningStreak, winningStreak);
      } else if (pnlChange < 0) {
        grossLoss += Math.abs(pnlChange);
        losingStreak++;
        winningStreak = 0;
        maxLosingStreak = Math.max(maxLosingStreak, losingStreak);
      }
    }

    const profitFactor =
      grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
    const returnToDrawdownRatio =
      maxDrawdownPercent > 0
        ? totalReturnPercent / maxDrawdownPercent
        : Infinity;

    // Find lowest balance
    const lowestBalance = Math.min(...this.snapshots.map((s) => s.balance));

    return {
      startingBalance: this.startingBalance,
      finalBalance,
      totalReturn,
      totalReturnPercent,
      maxDrawdown,
      maxDrawdownPercent,
      maxDrawdownDuration,
      averageDrawdown,
      averageDrawdownPercent,
      numberOfDrawdowns,
      currentDrawdown,
      currentDrawdownPercent,
      profitFactor,
      returnToDrawdownRatio,
      highWaterMark: this.highWaterMark,
      lowestBalance,
      largestWinningStreak: maxWinningStreak,
      largestLosingStreak: maxLosingStreak,
    };
  }

  getDrawdownEvents(): DrawdownEvent[] {
    // Convert drawdown event dates to EST for display
    return this.drawdownEvents.map((event) => ({
      ...event,
      startDate: DateTimeUtils.convertPSTtoEST(event.startDate).date,
      endDate: DateTimeUtils.convertPSTtoEST(event.endDate).date,
    }));
  }

  getEquityCurve(): Array<{
    timestamp: string;
    balance: number;
    equity: number;
    drawdownPercent: number;
  }> {
    return this.snapshots.map((s) => ({
      timestamp: s.timestamp,
      balance: s.balance,
      equity: s.equity,
      drawdownPercent: s.drawdownPercent,
    }));
  }

  /**
   * UPDATED: Get daily account balances with EST dates for display
   */
  getDailyBalances(): Record<
    string,
    {
      balance: number;
      equity: number;
      drawdown: number;
      drawdownPercent: number;
      trades: number;
    }
  > {
    const dailyData: Record<
      string,
      {
        balance: number;
        equity: number;
        drawdown: number;
        drawdownPercent: number;
        trades: number;
        previousTradeCount?: number;
      }
    > = {};

    this.snapshots.forEach((snapshot) => {
      // Use EST date for grouping
      const date = DateTimeUtils.getDisplayDateKey(snapshot.timestamp);

      if (!dailyData[date]) {
        dailyData[date] = {
          balance: snapshot.balance,
          equity: snapshot.equity,
          drawdown: snapshot.drawdown,
          drawdownPercent: snapshot.drawdownPercent,
          trades: 0,
        };
      } else {
        // Update to end of day values
        dailyData[date].balance = snapshot.balance;
        dailyData[date].equity = snapshot.equity;
        dailyData[date].drawdown = snapshot.drawdown;
        dailyData[date].drawdownPercent = snapshot.drawdownPercent;
      }

      if (snapshot.tradeCount > (dailyData[date].previousTradeCount || 0)) {
        dailyData[date].trades++;
        dailyData[date].previousTradeCount = snapshot.tradeCount;
      }
    });

    return dailyData;
  }
}
