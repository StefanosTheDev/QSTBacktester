// src/strategy/validation/TradeValidator.ts
import { TradeRecord } from '../trading/PositionTypes';
import { ProfitCalculator } from '../trading/ProfitCalculator';

export interface ValidationResult {
  totalAnomalies: number;
  extremeAnomalies: number;
  anomalousTrades: Array<{
    index: number;
    trade: TradeRecord;
    expectedPL: number;
    deviation: number;
    isExtreme: boolean;
  }>;
}

export class TradeValidator {
  private static readonly TOLERANCE = 50; // $50 tolerance for normal slippage
  private static readonly EXTREME_MULTIPLIER = 2; // 2x expected P&L is extreme

  /**
   * Validate all trades against expected P&L
   */
  static validateTrades(
    trades: TradeRecord[],
    stopLoss: number,
    takeProfit: number,
    contractSize: number
  ): ValidationResult {
    const calculator = new ProfitCalculator(contractSize);
    const expectedWinPL = calculator.getExpectedPL(takeProfit, true);
    const expectedLossPL = calculator.getExpectedPL(stopLoss, false);

    const result: ValidationResult = {
      totalAnomalies: 0,
      extremeAnomalies: 0,
      anomalousTrades: [],
    };

    trades.forEach((trade, index) => {
      const isWin = trade.netProfitLoss > 0;
      const expectedPL = isWin ? expectedWinPL : expectedLossPL;
      const deviation = Math.abs(trade.netProfitLoss - expectedPL);

      if (deviation > this.TOLERANCE) {
        const isExtreme =
          Math.abs(trade.netProfitLoss) >
          Math.abs(expectedPL) * this.EXTREME_MULTIPLIER;

        result.totalAnomalies++;
        if (isExtreme) {
          result.extremeAnomalies++;
        }

        result.anomalousTrades.push({
          index,
          trade,
          expectedPL,
          deviation,
          isExtreme,
        });
      }
    });

    return result;
  }

  /**
   * Generate validation summary for logging
   */
  static generateValidationSummary(
    validation: ValidationResult,
    stopLoss: number,
    takeProfit: number,
    contractSize: number
  ): string[] {
    const logs: string[] = [];
    const calculator = new ProfitCalculator(contractSize);

    logs.push(`\n🔍 Trade Validation Summary:`);
    logs.push(
      `   - Expected Win P&L: $${calculator
        .getExpectedPL(takeProfit, true)
        .toFixed(2)} (${takeProfit} points)`
    );
    logs.push(
      `   - Expected Loss P&L: $${calculator
        .getExpectedPL(stopLoss, false)
        .toFixed(2)} (${stopLoss} points)`
    );

    if (validation.totalAnomalies > 0) {
      logs.push(
        `   ⚠️ Found ${validation.totalAnomalies} trades with unexpected P&L (${validation.extremeAnomalies} extreme)`
      );

      // Log extreme anomalies
      validation.anomalousTrades
        .filter((a) => a.isExtreme)
        .forEach(({ index, trade, expectedPL }) => {
          const pointsMoved = Math.abs(trade.exitPrice - trade.entryPrice);
          logs.push(
            `   ⚠️ EXTREME ANOMALY - Trade #${index + 1}: ${pointsMoved.toFixed(
              2
            )} points, ` +
              `P&L: $${trade.netProfitLoss.toFixed(
                2
              )} (Expected: $${expectedPL.toFixed(2)}), ` +
              `Exit: ${trade.exitReason}, ` +
              `Entry: ${trade.entryDate} ${trade.entryTime} @ ${trade.entryPrice}, ` +
              `Exit: ${trade.exitDate} ${trade.exitTime} @ ${trade.exitPrice}`
          );
        });

      logs.push(
        `   💡 This may indicate data issues or extreme market conditions`
      );
    } else {
      logs.push(
        `   ✅ All trades within expected P&L ranges (±$${this.TOLERANCE})`
      );
    }

    return logs;
  }
}
