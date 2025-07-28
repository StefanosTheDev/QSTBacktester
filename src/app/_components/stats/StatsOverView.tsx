// components/stats/StatsOverview.tsx
import React from 'react';

interface StatsOverviewProps {
  statistics: {
    totalTrades: number;
    winRate: number;
    averageProfit: number;
    sharpeRatio: number;
    dailyPnL: Record<string, number>;
    maxDrawdown?: number;
    consecutiveStats?: { maxWins: number; maxLosses: number };
    profitFactor?: number;
    totalProfit?: number;
    daysHitStop?: number;
    daysHitTarget?: number;
    totalTradingDays?: number;
    actualTotalProfit?: number;
    actualDailyPnL?: Record<string, number>;
    longShortStats?: {
      longTrades: number;
      longWins: number;
      longLosses: number;
      longWinRate: number;
      shortTrades: number;
      shortWins: number;
      shortLosses: number;
      shortWinRate: number;
      longAvgProfit: number;
      shortAvgProfit: number;
    };
  };
  count: number;
}

export default function StatsOverview({
  statistics,
  count,
}: StatsOverviewProps) {
  // Use actual P&L if available, otherwise fall back to regular P&L
  const dailyPnL = statistics.actualDailyPnL || statistics.dailyPnL;
  const totalPnL =
    statistics.actualTotalProfit !== undefined
      ? statistics.actualTotalProfit
      : statistics.totalProfit ||
        Object.values(dailyPnL).reduce((sum, pnl) => sum + pnl, 0);

  // Calculate green vs red days percentage
  const profitableDays = Object.values(dailyPnL).filter(
    (pnl) => pnl > 0
  ).length;
  const losingDays = Object.values(dailyPnL).filter((pnl) => pnl < 0).length;
  const totalDays = Object.keys(dailyPnL).length;

  const greenPercent =
    totalDays > 0 ? ((profitableDays / totalDays) * 100).toFixed(1) : '0';
  const redPercent =
    totalDays > 0 ? ((losingDays / totalDays) * 100).toFixed(1) : '0';

  // Calculate additional metrics
  const bestDay = Math.max(...Object.values(dailyPnL), 0);
  const worstDay = Math.min(...Object.values(dailyPnL));

  // Format currency
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  // Format percentage
  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  // Check if limits affected results
  const hasLimits =
    statistics.daysHitStop !== undefined ||
    statistics.daysHitTarget !== undefined;
  const limitsImpacted =
    hasLimits &&
    statistics.actualTotalProfit !== undefined &&
    statistics.totalProfit !== undefined &&
    Math.abs(statistics.actualTotalProfit - statistics.totalProfit) > 0.01;

  return (
    <div className="space-y-4">
      {/* Warning if daily limits affected results */}
      {limitsImpacted && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠️ Note: Results shown are ACTUAL performance
          </h4>
          <p className="text-sm text-yellow-700">
            Daily limits would have capped P&L at{' '}
            {formatCurrency(statistics.totalProfit || 0)}, but actual P&L was{' '}
            {formatCurrency(totalPnL)}
          </p>
        </div>
      )}

      {/* Green vs Red Days Display */}
      <div className="bg-gradient-to-r from-green-50 to-red-50 p-4 rounded-lg border border-gray-200">
        <h4 className="text-lg font-semibold mb-3 text-gray-800">
          Trading Day Analysis
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {greenPercent}%
            </div>
            <div className="text-sm text-gray-600">
              Green Days ({profitableDays} days)
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-600">{redPercent}%</div>
            <div className="text-sm text-gray-600">
              Red Days ({losingDays} days)
            </div>
          </div>
        </div>
      </div>

      {/* Long vs Short Analysis */}
      {statistics.longShortStats && (
        <div className="bg-gradient-to-r from-blue-50 to-orange-50 p-4 rounded-lg border border-gray-200">
          <h4 className="text-lg font-semibold mb-3 text-gray-800">
            Long vs Short Performance
          </h4>
          <div className="grid grid-cols-2 gap-4">
            {/* Long Stats */}
            <div className="bg-blue-100 p-3 rounded">
              <h5 className="font-medium text-blue-800 mb-2">LONG Trades</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-medium">
                    {statistics.longShortStats.longTrades}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Wins:</span>
                  <span className="font-medium text-green-600">
                    {statistics.longShortStats.longWins} (
                    {statistics.longShortStats.longWinRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Losses:</span>
                  <span className="font-medium text-red-600">
                    {statistics.longShortStats.longLosses} (
                    {(100 - statistics.longShortStats.longWinRate).toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg P/L:</span>
                  <span
                    className={`font-medium ${
                      statistics.longShortStats.longAvgProfit >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(statistics.longShortStats.longAvgProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Short Stats */}
            <div className="bg-orange-100 p-3 rounded">
              <h5 className="font-medium text-orange-800 mb-2">SHORT Trades</h5>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Total:</span>
                  <span className="font-medium">
                    {statistics.longShortStats.shortTrades}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Wins:</span>
                  <span className="font-medium text-green-600">
                    {statistics.longShortStats.shortWins} (
                    {statistics.longShortStats.shortWinRate.toFixed(1)}%)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Losses:</span>
                  <span className="font-medium text-red-600">
                    {statistics.longShortStats.shortLosses} (
                    {(100 - statistics.longShortStats.shortWinRate).toFixed(1)}
                    %)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg P/L:</span>
                  <span
                    className={`font-medium ${
                      statistics.longShortStats.shortAvgProfit >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(statistics.longShortStats.shortAvgProfit)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Summary Comparison */}
          <div className="mt-3 pt-3 border-t border-gray-300">
            <div className="text-sm text-gray-600">
              {statistics.longShortStats.longWinRate >
              statistics.longShortStats.shortWinRate ? (
                <p className="font-medium">
                  📊 Long trades perform better with{' '}
                  {statistics.longShortStats.longWinRate.toFixed(1)}% win rate
                  vs {statistics.longShortStats.shortWinRate.toFixed(1)}% for
                  shorts
                </p>
              ) : statistics.longShortStats.shortWinRate >
                statistics.longShortStats.longWinRate ? (
                <p className="font-medium">
                  📊 Short trades perform better with{' '}
                  {statistics.longShortStats.shortWinRate.toFixed(1)}% win rate
                  vs {statistics.longShortStats.longWinRate.toFixed(1)}% for
                  longs
                </p>
              ) : (
                <p className="font-medium">
                  📊 Long and short trades have similar performance
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="text-sm font-medium text-green-800">
            Total P&L{' '}
            {statistics.actualTotalProfit !== undefined ? '(Actual)' : ''}
          </h4>
          <p
            className={`text-2xl font-bold ${
              totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(totalPnL)}
          </p>
        </div>
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-800">Win Rate</h4>
          <p className="text-2xl font-bold text-blue-600">
            {formatPercent(statistics.winRate)}
          </p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
          <h4 className="text-sm font-medium text-purple-800">Sharpe Ratio</h4>
          <p className="text-2xl font-bold text-purple-600">
            {statistics.sharpeRatio.toFixed(2)}
          </p>
        </div>
        <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
          <h4 className="text-sm font-medium text-orange-800">Total Trades</h4>
          <p className="text-2xl font-bold text-orange-600">
            {statistics.totalTrades}
          </p>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="text-lg font-semibold mb-3 text-gray-800">
          Performance Details
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Bars Processed:</span>
            <span className="font-medium">{count.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg Profit/Trade:</span>
            <span className="font-medium">
              {formatCurrency(statistics.averageProfit)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Best Day:</span>
            <span className="font-medium text-green-600">
              {formatCurrency(bestDay)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Worst Day:</span>
            <span className="font-medium text-red-600">
              {formatCurrency(worstDay)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Max Drawdown:</span>
            <span className="font-medium text-red-600">
              {statistics.maxDrawdown
                ? formatPercent(statistics.maxDrawdown)
                : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Profit Factor:</span>
            <span className="font-medium">
              {statistics.profitFactor?.toFixed(2) || 'N/A'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Trading Days:</span>
            <span className="font-medium">
              {statistics.totalTradingDays || Object.keys(dailyPnL).length}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Max Consecutive:</span>
            <span className="font-medium">
              {statistics.consecutiveStats
                ? `${statistics.consecutiveStats.maxWins}W / ${statistics.consecutiveStats.maxLosses}L`
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Daily Limits Card */}
      {(statistics.daysHitStop !== undefined ||
        statistics.daysHitTarget !== undefined) && (
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <h4 className="text-lg font-semibold mb-3 text-yellow-800">
            Daily Limit Statistics
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {statistics.daysHitStop !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Days Hit Stop Loss:</span>
                <span className="font-medium text-red-600">
                  {statistics.daysHitStop} days
                </span>
              </div>
            )}
            {statistics.daysHitTarget !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-600">Days Hit Profit Target:</span>
                <span className="font-medium text-green-600">
                  {statistics.daysHitTarget} days
                </span>
              </div>
            )}
            {statistics.totalTradingDays &&
              statistics.daysHitStop !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Stop Hit Rate:</span>
                  <span className="font-medium">
                    {(
                      (statistics.daysHitStop / statistics.totalTradingDays) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
            {statistics.totalTradingDays &&
              statistics.daysHitTarget !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Target Hit Rate:</span>
                  <span className="font-medium">
                    {(
                      (statistics.daysHitTarget / statistics.totalTradingDays) *
                      100
                    ).toFixed(1)}
                    %
                  </span>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
