// src/app/_lib/algo/utils/BackTestLogger.ts
import { DateTime } from 'luxon';

export class BacktestLogger {
  private logs: string[] = [];
  private originalConsoleLog: typeof console.log;
  private isCapturing: boolean = false;

  constructor() {
    this.logs = [];
    this.originalConsoleLog = console.log;
  }

  // Start capturing console.log outputs
  startCapture(): void {
    if (this.isCapturing) return;

    this.isCapturing = true;
    // Using property instead of alias to fix ESLint error
    const originalLog = this.originalConsoleLog;
    const logArray = this.logs;

    // Override console.log
    console.log = function (...args: unknown[]) {
      // Fix for @typescript-eslint/no-explicit-any
      // Call original console.log
      originalLog.apply(console, args);

      // Capture to our logs
      const message = args
        .map((arg) =>
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(' ');

      logArray.push(message);
    };
  }

  // Stop capturing and restore original console.log
  stopCapture(): void {
    if (!this.isCapturing) return;

    console.log = this.originalConsoleLog;
    this.isCapturing = false;
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

  // Format logs for display
  getFormattedLogs(): string[] {
    return this.logs.map((log) => {
      // Add color coding based on log type
      if (log.includes('→')) return log; // Signal analysis logs
      if (log.includes('✓')) return log; // Validation logs
      if (log.includes('✗')) return log; // Filter logs
      if (log.includes('📊')) return log; // Trade logs
      if (log.includes('🔍')) return log; // Debug logs
      return log;
    });
  }
}
