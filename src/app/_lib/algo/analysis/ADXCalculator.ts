// src/indicators/ADXCalculator.ts
export class ADXCalculator {
  private readonly PERIOD = 14; // Hardcoded period
  private highs: number[] = [];
  private lows: number[] = [];
  private closes: number[] = [];
  private plusDM: number[] = [];
  private minusDM: number[] = [];
  private tr: number[] = [];
  private atr: number = 0;
  private plusDMSmooth: number = 0;
  private minusDMSmooth: number = 0;
  private adxValues: number[] = [];

  update(
    high: number,
    low: number,
    close: number
  ): {
    plusDI: number | undefined;
    minusDI: number | undefined;
    adx: number | undefined;
  } {
    this.highs.push(high);
    this.lows.push(low);
    this.closes.push(close);

    if (this.highs.length < 2) {
      return { plusDI: undefined, minusDI: undefined, adx: undefined };
    }

    // Calculate +DM and -DM
    const highDiff = high - this.highs[this.highs.length - 2];
    const lowDiff = this.lows[this.lows.length - 2] - low;

    const plusDMValue = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    const minusDMValue = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    this.plusDM.push(plusDMValue);
    this.minusDM.push(minusDMValue);

    // Calculate True Range
    const prevClose = this.closes[this.closes.length - 2];
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    this.tr.push(tr);

    if (this.tr.length < this.PERIOD) {
      return { plusDI: undefined, minusDI: undefined, adx: undefined };
    }

    // Calculate initial ATR and smoothed DMs
    if (this.atr === 0) {
      // First calculation - simple average
      this.atr =
        this.tr.slice(-this.PERIOD).reduce((a, b) => a + b, 0) / this.PERIOD;
      this.plusDMSmooth =
        this.plusDM.slice(-this.PERIOD).reduce((a, b) => a + b, 0) /
        this.PERIOD;
      this.minusDMSmooth =
        this.minusDM.slice(-this.PERIOD).reduce((a, b) => a + b, 0) /
        this.PERIOD;
    } else {
      // Wilder's smoothing
      this.atr = (this.atr * (this.PERIOD - 1) + tr) / this.PERIOD;
      this.plusDMSmooth =
        (this.plusDMSmooth * (this.PERIOD - 1) + plusDMValue) / this.PERIOD;
      this.minusDMSmooth =
        (this.minusDMSmooth * (this.PERIOD - 1) + minusDMValue) / this.PERIOD;
    }

    // Calculate +DI and -DI
    const plusDI = this.atr > 0 ? (this.plusDMSmooth / this.atr) * 100 : 0;
    const minusDI = this.atr > 0 ? (this.minusDMSmooth / this.atr) * 100 : 0;

    // Calculate DX
    const diDiff = Math.abs(plusDI - minusDI);
    const diSum = plusDI + minusDI;
    const dx = diSum > 0 ? (diDiff / diSum) * 100 : 0;

    // Calculate ADX
    let adx: number | undefined = undefined;
    if (this.tr.length >= this.PERIOD * 2 - 1) {
      if (this.adxValues.length === 0) {
        // Need PERIOD DX values for first ADX
        const dxHistory: number[] = [];
        for (let i = this.PERIOD; i <= this.tr.length; i++) {
          const endIdx = i;
          const startIdx = i - this.PERIOD;

          // Calculate DX for this window
          const tempATR =
            this.tr.slice(startIdx, endIdx).reduce((a, b) => a + b, 0) /
            this.PERIOD;
          const tempPlusDM =
            this.plusDM.slice(startIdx, endIdx).reduce((a, b) => a + b, 0) /
            this.PERIOD;
          const tempMinusDM =
            this.minusDM.slice(startIdx, endIdx).reduce((a, b) => a + b, 0) /
            this.PERIOD;

          const tempPlusDI = tempATR > 0 ? (tempPlusDM / tempATR) * 100 : 0;
          const tempMinusDI = tempATR > 0 ? (tempMinusDM / tempATR) * 100 : 0;

          const tempDiDiff = Math.abs(tempPlusDI - tempMinusDI);
          const tempDiSum = tempPlusDI + tempMinusDI;
          const tempDX = tempDiSum > 0 ? (tempDiDiff / tempDiSum) * 100 : 0;

          dxHistory.push(tempDX);
        }

        if (dxHistory.length >= this.PERIOD) {
          adx =
            dxHistory.slice(-this.PERIOD).reduce((a, b) => a + b, 0) /
            this.PERIOD;
          this.adxValues.push(adx);
        }
      } else {
        // Wilder's smoothing for ADX
        const prevADX = this.adxValues[this.adxValues.length - 1];
        adx = (prevADX * (this.PERIOD - 1) + dx) / this.PERIOD;
        this.adxValues.push(adx);
      }
    }

    // Keep arrays manageable
    const maxLength = this.PERIOD * 3;
    if (this.highs.length > maxLength) {
      this.highs = this.highs.slice(-maxLength);
      this.lows = this.lows.slice(-maxLength);
      this.closes = this.closes.slice(-maxLength);
      this.plusDM = this.plusDM.slice(-maxLength);
      this.minusDM = this.minusDM.slice(-maxLength);
      this.tr = this.tr.slice(-maxLength);
      if (this.adxValues.length > this.PERIOD) {
        this.adxValues = this.adxValues.slice(-this.PERIOD);
      }
    }

    return { plusDI, minusDI, adx };
  }
}
