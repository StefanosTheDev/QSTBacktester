// src/strategy/utils/BacktestLogger.ts
import { DateTime } from 'luxon';

export class BacktestLogger {
  private logs: string[] = [];

  constructor() {
    this.logs = [];
  }

  // Timezone diagnostics
  logTimezoneDiagnostics(): void {
    this.logs.push(`\n🌍 ENHANCED TIMEZONE DIAGNOSTICS:`);
    this.logs.push(
      `   - Server Timezone: ${
        Intl.DateTimeFormat().resolvedOptions().timeZone
      }`
    );
    this.logs.push(
      `   - Server Time Now: ${DateTime.now()
        .setZone('America/Los_Angeles')
        .toString()}`
    );
    this.logs.push(
      `   - Server UTC Offset: ${
        DateTime.now().setZone('America/Los_Angeles').offset
      } minutes`
    );
    this.logs.push(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    this.logs.push(`   - TZ env var: ${process.env.TZ || 'not set'}`);
  }

  // Trade logging
  logEntry(
    type: string,
    price: number,
    date: string,
    time: string,
    stop: number,
    target: number
  ): void {
    this.logs.push(
      `📈 Entry: ${type.toUpperCase()} @ ${price.toFixed(
        2
      )} on ${date} ${time} | ` +
        `Stop: ${stop.toFixed(2)} | Target: ${target.toFixed(2)}`
    );
  }

  logExit(
    reason: string,
    price: number,
    date: string,
    time: string,
    profit: number,
    points: number
  ): void {
    this.logs.push(
      `🚪 Exit: ${reason} @ ${price.toFixed(2)} on ${date} ${time} - ` +
        `Profit: $${profit.toFixed(2)} (${points.toFixed(2)} points)`
    );
  }

  logSignal(type: string, date: string, time: string): void {
    this.logs.push(
      `🔔 Signal generated: ${type.toUpperCase()} on ${date} ${time} - Will enter on next bar open`
    );
  }

  logGap(
    gapPoints: number,
    gapPercent: number,
    prevClose: number,
    currOpen: number
  ): void {
    this.logs.push(
      `⚠️ SIGNIFICANT GAP DETECTED: ${gapPoints.toFixed(
        2
      )} points (${gapPercent.toFixed(2)}%) - ` +
        `Previous close: ${prevClose.toFixed(
          2
        )}, Current open: ${currOpen.toFixed(2)}`
    );
  }

  logDailyLimit(reason: string): void {
    this.logs.push(`🛑 ${reason}`);
    this.logs.push(`⛔ STOPPING TRADING FOR THE DAY - Daily limit reached`);
  }

  // Summary logging
  logBacktestSummary(
    count: number,
    trades: number,
    winRate: number,
    avgProfit: number
  ): void {
    this.logs.push(`\n🎉 Backtest complete. Processed ${count} bars.`);
    this.logs.push(
      `📊 Results: ${trades} trades, ${winRate.toFixed(
        2
      )}% win rate, ${avgProfit.toFixed(2)} avg profit`
    );
  }

  logWinLossAnalysis(
    avgWin: number,
    avgLoss: number,
    avgWinPoints: number,
    avgLossPoints: number,
    expectedWin: number,
    expectedLoss: number
  ): void {
    this.logs.push(`\n📈 Win/Loss Analysis:`);
    this.logs.push(
      `   - Avg Win: ${avgWin.toFixed(2)} (${avgWinPoints.toFixed(2)} points)`
    );
    this.logs.push(
      `   - Avg Loss: ${avgLoss.toFixed(2)} (${avgLossPoints.toFixed(
        2
      )} points)`
    );
    this.logs.push(
      `   - Expected Win Points: ${expectedWin.toFixed(
        2
      )}, Actual: ${avgWinPoints.toFixed(2)}`
    );
    this.logs.push(
      `   - Expected Loss Points: ${expectedLoss.toFixed(
        2
      )}, Actual: ${avgLossPoints.toFixed(2)}`
    );
  }

  // Custom logging
  log(message: string): void {
    this.logs.push(message);
  }

  // Get all logs
  getLogs(): string[] {
    return this.logs;
  }
}
