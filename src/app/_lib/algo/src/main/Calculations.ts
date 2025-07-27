export function calculateLinearRegression(y: number[]): {
  slope: number;
  residuals: number[];
} {
  const N = y.length;
  const x = Array.from({ length: N }, (_, i) => i);
  const meanX = x.reduce((a, b) => a + b, 0) / N;
  const meanY = y.reduce((a, b) => a + b, 0) / N;
  const covXY = x.reduce((s, xi, i) => s + (xi - meanX) * (y[i] - meanY), 0);
  const varX = x.reduce((s, xi) => s + (xi - meanX) ** 2, 0);
  const slope = covXY / varX;
  const residuals = y.map((yi, i) => yi - slope * i);

  return { slope, residuals };
}
