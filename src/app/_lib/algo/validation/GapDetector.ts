// src/strategy/validation/GapDetector.ts
import { CsvBar } from '../types/types';

export interface GapResult {
  hasGap: boolean;
  gapPoints: number;
  gapPercent: number;
  isSignificant: boolean;
  isExtreme: boolean;
}

export class GapDetector {
  private static readonly SIGNIFICANT_GAP_PERCENT = 0.5; // 0.5%
  private static readonly EXTREME_GAP_PERCENT = 1.0; // 1%

  /**
   * Detect gap between bars
   */
  static detectGap(currentBar: CsvBar, previousBar: CsvBar): GapResult {
    const gapPoints = Math.abs(currentBar.open - previousBar.close);
    const gapPercent = (gapPoints / previousBar.close) * 100;

    return {
      hasGap: gapPoints > 0,
      gapPoints,
      gapPercent,
      isSignificant: gapPercent > this.SIGNIFICANT_GAP_PERCENT,
      isExtreme: gapPercent > this.EXTREME_GAP_PERCENT,
    };
  }

  /**
   * Check if entry should be allowed given gap
   */
  static shouldAllowEntry(gapResult: GapResult): boolean {
    return !gapResult.isExtreme;
  }

  /**
   * Check if gap is within tolerance for entry
   */
  static isGapWithinTolerance(
    signalBarClose: number,
    entryBarOpen: number,
    maxTolerancePercent: number = 1.0
  ): boolean {
    const gapPercent =
      (Math.abs(entryBarOpen - signalBarClose) / signalBarClose) * 100;
    return gapPercent < maxTolerancePercent;
  }
}
