// src/strategy/PositionManager.ts - With Trailing Stop Feature and Timezone Fix
import { CsvBar, Position, StrategyTrade, TradeRecord } from './types';
import { TradeStatistics } from './TradeStatistics';

interface TrailingStopConfig {
  enabled: boolean;
  breakevenTrigger: number;
  trailDistance: number;
}

interface ExtendedPosition extends Position {
  initialStopPrice: number;
  highestProfit: number;
  stopMovedToBreakeven: boolean;
  isTrailing: boolean;
}

// Helper to convert PST timestamp to EST display without timezone issues
function convertPSTtoESTDisplay(timestamp: string): {
  date: string;
  time: string;
} {
  // Parse the PST timestamp components
  const parts = timestamp.split(' ');
  if (parts.length !== 3) {
    return { date: 'Invalid', time: 'Invalid' };
  }

  const [datePart, timePart, ampm] = parts;
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);

  // Convert to 24-hour format
  let hour24 = hour;
  if (ampm === 'PM' && hour !== 12) hour24 += 12;
  if (ampm === 'AM' && hour === 12) hour24 = 0;

  // Add 3 hours for PST to EST conversion
  let estHour = hour24 + 3;
  let estDay = day;
  let estMonth = month;
  let estYear = year;

  // Handle day rollover
  if (estHour >= 24) {
    estHour -= 24;
    estDay++;

    // Handle month rollover
    const daysInMonth = new Date(year, month, 0).getDate();
    if (estDay > daysInMonth) {
      estDay = 1;
      estMonth++;

      // Handle year rollover
      if (estMonth > 12) {
        estMonth = 1;
        estYear++;
      }
    }
  }

  // Format the date as MM/DD/YYYY
  const dateStr = `${estMonth.toString().padStart(2, '0')}/${estDay
    .toString()
    .padStart(2, '0')}/${estYear}`;

  // Format the time as HH:MM:SS AM/PM
  let displayHour = estHour;
  let displayAmPm = 'AM';
  if (estHour >= 12) {
    displayAmPm = 'PM';
    if (estHour > 12) displayHour = estHour - 12;
  }
  if (displayHour === 0) displayHour = 12;

  const timeStr = `${displayHour.toString().padStart(2, '0')}:${minute
    .toString()
    .padStart(2, '0')}:${second.toString().padStart(2, '0')} ${displayAmPm}`;

  return { date: dateStr, time: timeStr };
}

export class PositionManager {
  private position: ExtendedPosition | null = null;
  private statistics: TradeStatistics = new TradeStatistics();
  private stopLoss: number;
  private takeProfit: number;
  private contractSize: number;
  private trailingConfig: TrailingStopConfig;

  // ES Mini futures constants
  private readonly TICK_SIZE = 0.25;
  private readonly TICK_VALUE = 12.5; // $12.50 per tick
  private readonly COMMISSION_PER_CONTRACT = 2.5; // Round trip commission

  constructor(
    stopLoss: number,
    takeProfit: number,
    contractSize: number,
    useTrailingStop: boolean = false,
    breakevenTrigger: number = 3,
    trailDistance: number = 2
  ) {
    this.stopLoss = stopLoss;
    this.takeProfit = takeProfit;
    this.contractSize = contractSize;
    this.trailingConfig = {
      enabled: useTrailingStop,
      breakevenTrigger,
      trailDistance,
    };
  }

  forceExit(
    bar: CsvBar,
    reason: string
  ): {
    exited: boolean;
    reason?: string;
    profit?: number;
    exitPrice?: number;
    tradeRecord?: TradeRecord;
  } {
    if (!this.position) return { exited: false };

    // Exit at current bar's close price for end-of-day exits
    const exitPrice = bar.close;

    const profitPoints =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    const totalProfit = this.calculateProfit(profitPoints);
    const tradeRecord = this.createTradeRecord(
      bar,
      exitPrice,
      totalProfit,
      reason
    );
    this.logTrade(bar, reason, exitPrice, totalProfit);
    this.position = null;

    return {
      exited: true,
      reason,
      profit: totalProfit,
      exitPrice,
      tradeRecord,
    };
  }

  hasPosition(): boolean {
    return this.position !== null;
  }

  checkExit(bar: CsvBar): {
    exited: boolean;
    reason?: string;
    profit?: number;
    exitPrice?: number;
    tradeRecord?: TradeRecord;
  } {
    if (!this.position) return { exited: false };

    const { type, stopPrice, targetPrice, entryPrice } = this.position;
    let exitPrice: number | undefined;
    let reason: string | undefined;
    let currentStopPrice = stopPrice;

    // Update trailing stop if enabled
    if (this.trailingConfig.enabled) {
      currentStopPrice = this.updateTrailingStop(bar);
    }

    // MAXIMUM SLIPPAGE PROTECTION
    const MAX_SLIPPAGE_POINTS = 0.25; // Maximum 0.25 points (1 tick) of slippage allowed
    const MAX_SLIPPAGE_PERCENT = 0.0002; // Maximum 0.02% slippage allowed (tightened from 2%)

    if (type === 'bullish') {
      // Check stop loss (including trailing stop)
      if (bar.low <= currentStopPrice) {
        // If bar opened below stop (gap down), check for excessive slippage
        if (bar.open <= currentStopPrice) {
          const slippagePoints = currentStopPrice - bar.open;
          const slippagePercent = slippagePoints / entryPrice;

          // Check if slippage is excessive
          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            console.log(
              `⚠️ EXCESSIVE SLIPPAGE DETECTED: ${slippagePoints.toFixed(
                2
              )} points (${(slippagePercent * 100).toFixed(2)}%)`
            );
            console.log(
              `   Entry: ${entryPrice}, Stop: ${currentStopPrice}, Open: ${bar.open}`
            );

            // Exit at maximum allowed slippage
            exitPrice = currentStopPrice - MAX_SLIPPAGE_POINTS;
            reason = 'stop-loss-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'stop-loss-gapped';
          }
        } else {
          exitPrice = currentStopPrice;
          reason = this.position.isTrailing
            ? 'trailing-stop'
            : this.position.stopMovedToBreakeven
            ? 'breakeven-stop'
            : 'stop-loss';
        }
      }
      // Check take profit
      else if (bar.high >= targetPrice) {
        if (bar.open >= targetPrice) {
          const slippagePoints = bar.open - targetPrice;
          const slippagePercent = slippagePoints / entryPrice;

          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            exitPrice = targetPrice + MAX_SLIPPAGE_POINTS;
            reason = 'take-profit-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'take-profit-gapped';
          }
        } else {
          exitPrice = targetPrice;
          reason = 'take-profit';
        }
      }
    } else {
      // bearish position
      // Check stop loss (including trailing stop)
      if (bar.high >= currentStopPrice) {
        // If bar opened above stop (gap up), check for excessive slippage
        if (bar.open >= currentStopPrice) {
          const slippagePoints = bar.open - currentStopPrice;
          const slippagePercent = slippagePoints / entryPrice;

          // Check if slippage is excessive
          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            console.log(
              `⚠️ EXCESSIVE SLIPPAGE DETECTED: ${slippagePoints.toFixed(
                2
              )} points (${(slippagePercent * 100).toFixed(2)}%)`
            );
            console.log(
              `   Entry: ${entryPrice}, Stop: ${currentStopPrice}, Open: ${bar.open}`
            );

            // Exit at maximum allowed slippage
            exitPrice = currentStopPrice + MAX_SLIPPAGE_POINTS;
            reason = 'stop-loss-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'stop-loss-gapped';
          }
        } else {
          exitPrice = currentStopPrice;
          reason = this.position.isTrailing
            ? 'trailing-stop'
            : this.position.stopMovedToBreakeven
            ? 'breakeven-stop'
            : 'stop-loss';
        }
      }
      // Check take profit
      else if (bar.low <= targetPrice) {
        if (bar.open <= targetPrice) {
          const slippagePoints = targetPrice - bar.open;
          const slippagePercent = slippagePoints / entryPrice;

          if (
            slippagePoints > MAX_SLIPPAGE_POINTS ||
            slippagePercent > MAX_SLIPPAGE_PERCENT
          ) {
            exitPrice = targetPrice - MAX_SLIPPAGE_POINTS;
            reason = 'take-profit-max-slippage';
          } else {
            exitPrice = bar.open;
            reason = 'take-profit-gapped';
          }
        } else {
          exitPrice = targetPrice;
          reason = 'take-profit';
        }
      }
    }

    if (exitPrice !== undefined && reason) {
      const profitPoints =
        type === 'bullish' ? exitPrice - entryPrice : entryPrice - exitPrice;

      const totalProfit = this.calculateProfit(profitPoints);

      // Log if this was a gap situation
      if (reason.includes('gapped') || reason.includes('max-slippage')) {
        console.log(
          `📊 Gap Exit: ${type.toUpperCase()} ` +
            `Entry: ${entryPrice.toFixed(2)} → Exit: ${exitPrice.toFixed(2)} ` +
            `(${Math.abs(profitPoints).toFixed(2)} points) ` +
            `Reason: ${reason}`
        );
      }

      const tradeRecord = this.createTradeRecord(
        bar,
        exitPrice,
        totalProfit,
        reason
      );
      this.logTrade(bar, reason, exitPrice, totalProfit);
      this.position = null;

      return {
        exited: true,
        reason,
        profit: totalProfit,
        exitPrice,
        tradeRecord,
      };
    }

    return { exited: false };
  }

  private updateTrailingStop(bar: CsvBar): number {
    if (!this.position) {
      throw new Error('updateTrailingStop called without an active position');
    }

    const { type, entryPrice, stopPrice } = this.position;
    let currentProfit: number;
    let newStopPrice = stopPrice;

    if (type === 'bullish') {
      currentProfit = bar.high - entryPrice;

      // Update highest profit
      if (currentProfit > this.position.highestProfit) {
        this.position.highestProfit = currentProfit;
      }

      // Move to breakeven
      if (
        !this.position.stopMovedToBreakeven &&
        this.position.highestProfit >= this.trailingConfig.breakevenTrigger
      ) {
        newStopPrice = entryPrice;
        this.position.stopMovedToBreakeven = true;
        this.position.stopPrice = newStopPrice;
        console.log(
          `   → Stop moved to breakeven at ${newStopPrice.toFixed(2)}`
        );
      }

      // Start trailing
      if (
        this.position.stopMovedToBreakeven &&
        this.position.highestProfit >=
          this.trailingConfig.breakevenTrigger +
            this.trailingConfig.trailDistance
      ) {
        const trailStopPrice =
          entryPrice +
          this.position.highestProfit -
          this.trailingConfig.trailDistance;
        if (trailStopPrice > this.position.stopPrice) {
          newStopPrice =
            Math.round(trailStopPrice / this.TICK_SIZE) * this.TICK_SIZE;
          this.position.stopPrice = newStopPrice;
          this.position.isTrailing = true;
          console.log(
            `   → Trailing stop updated to ${newStopPrice.toFixed(2)}`
          );
        }
      }
    } else {
      // bearish position
      currentProfit = entryPrice - bar.low;

      // Update highest profit
      if (currentProfit > this.position.highestProfit) {
        this.position.highestProfit = currentProfit;
      }

      // Move to breakeven
      if (
        !this.position.stopMovedToBreakeven &&
        this.position.highestProfit >= this.trailingConfig.breakevenTrigger
      ) {
        newStopPrice = entryPrice;
        this.position.stopMovedToBreakeven = true;
        this.position.stopPrice = newStopPrice;
        console.log(
          `   → Stop moved to breakeven at ${newStopPrice.toFixed(2)}`
        );
      }

      // Start trailing
      if (
        this.position.stopMovedToBreakeven &&
        this.position.highestProfit >=
          this.trailingConfig.breakevenTrigger +
            this.trailingConfig.trailDistance
      ) {
        const trailStopPrice =
          entryPrice -
          this.position.highestProfit +
          this.trailingConfig.trailDistance;
        if (trailStopPrice < this.position.stopPrice) {
          newStopPrice =
            Math.round(trailStopPrice / this.TICK_SIZE) * this.TICK_SIZE;
          this.position.stopPrice = newStopPrice;
          this.position.isTrailing = true;
          console.log(
            `   → Trailing stop updated to ${newStopPrice.toFixed(2)}`
          );
        }
      }
    }

    return this.position.stopPrice;
  }

  private calculateProfit(profitPoints: number): number {
    // Convert points to ticks
    const ticks = Math.round(profitPoints / this.TICK_SIZE);

    // Calculate gross profit
    const grossProfit = ticks * this.TICK_VALUE * this.contractSize;

    // Subtract commission
    const commission = this.COMMISSION_PER_CONTRACT * this.contractSize;

    return grossProfit - commission;
  }

  private createTradeRecord(
    exitBar: CsvBar,
    exitPrice: number,
    netProfit: number,
    exitReason: string
  ): TradeRecord {
    if (!this.position) throw new Error('No position to create trade record');

    // Convert PST timestamps to EST for display
    const entryEST = convertPSTtoESTDisplay(this.position.timestamp);
    const exitEST = convertPSTtoESTDisplay(exitBar.timestamp);

    const profitPoints =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    const grossProfit =
      (profitPoints / this.TICK_SIZE) * this.TICK_VALUE * this.contractSize;
    const commission = this.COMMISSION_PER_CONTRACT * this.contractSize;

    return {
      entryDate: entryEST.date,
      entryTime: entryEST.time,
      entryPrice: this.position.entryPrice,
      exitDate: exitEST.date,
      exitTime: exitEST.time,
      exitPrice: exitPrice,
      type: this.position.type === 'bullish' ? 'LONG' : 'SHORT',
      contracts: this.contractSize,
      stopLoss: this.stopLoss,
      takeProfit: this.takeProfit,
      exitReason: exitReason,
      profitLoss: grossProfit,
      commission: commission,
      netProfitLoss: netProfit,
    };
  }

  private logTrade(
    bar: CsvBar,
    reason: string,
    exitPrice: number,
    totalProfit: number
  ): void {
    if (!this.position) return;

    // Calculate actual points moved for logging
    const actualPointsMoved =
      this.position.type === 'bullish'
        ? exitPrice - this.position.entryPrice
        : this.position.entryPrice - exitPrice;

    // Log detailed trade info for debugging
    console.log(
      `   📊 Trade Details: ${this.position.type.toUpperCase()} ` +
        `Entry: ${this.position.entryPrice.toFixed(
          2
        )} → Exit: ${exitPrice.toFixed(2)} ` +
        `(${actualPointsMoved.toFixed(2)} points) ` +
        `P&L: ${totalProfit.toFixed(2)} ` +
        `Reason: ${reason}`
    );

    const trade: StrategyTrade = {
      type: this.position.type,
      entryPrice: this.position.entryPrice,
      exitPrice: exitPrice,
      profit: totalProfit,
      entryTime: this.position.timestamp,
      exitTime: bar.timestamp,
      reason,
      winLoss: totalProfit > 0 ? 'W' : 'L',
    };
    this.statistics.logTrade(trade);
  }

  enterPosition(
    signal: 'bullish' | 'bearish',
    entryPrice: number,
    bar: CsvBar
  ): ExtendedPosition {
    // Round entry price to nearest tick
    const entry = Math.round(entryPrice / this.TICK_SIZE) * this.TICK_SIZE;

    // Calculate stop and target prices (already in points from parameters)
    const stopPrice =
      signal === 'bullish' ? entry - this.stopLoss : entry + this.stopLoss;
    const targetPrice =
      signal === 'bullish' ? entry + this.takeProfit : entry - this.takeProfit;

    this.position = {
      type: signal,
      entryPrice: entry,
      stopPrice: Math.round(stopPrice / this.TICK_SIZE) * this.TICK_SIZE,
      targetPrice: Math.round(targetPrice / this.TICK_SIZE) * this.TICK_SIZE,
      timestamp: bar.timestamp,
      initialStopPrice: Math.round(stopPrice / this.TICK_SIZE) * this.TICK_SIZE,
      highestProfit: 0,
      stopMovedToBreakeven: false,
      isTrailing: false,
    };

    return this.position;
  }

  getStatistics(): TradeStatistics {
    return this.statistics;
  }

  getContractSize(): number {
    return this.contractSize;
  }

  reset(): void {
    this.position = null;
    this.statistics.reset();
  }
}
