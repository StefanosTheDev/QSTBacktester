// components/stats/StatsAccountPerformance.tsx
import React from 'react';

interface AccountStats {
  startingBalance: number;
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number;
  currentDrawdown: number;
  currentDrawdownPercent: number;
  highWaterMark: number;
  lowestBalance: number;
  returnToDrawdownRatio: number;
  numberOfDrawdowns: number;
}

interface DrawdownEvent {
  startDate: string;
  endDate: string;
  startBalance: number;
  lowestBalance: number;
  drawdownAmount: number;
  drawdownPercent: number;
  duration: number;
  recovered: boolean;
}

interface StatsAccountPerformanceProps {
  accountStats?: AccountStats;
  drawdownEvents?: DrawdownEvent[];
  equityCurve?: Array<{
    timestamp: string;
    balance: number;
    equity: number;
    drawdownPercent: number;
  }>;
}

export default function StatsAccountPerformance({
  accountStats,
  drawdownEvents = [],
  equityCurve = [],
}: StatsAccountPerformanceProps) {
  if (!accountStats) {
    return <div>No account data available</div>;
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const formatPercent = (value: number) => `${value.toFixed(2)}%`;

  // Determine account health status
  const getAccountHealth = () => {
    if (accountStats.currentDrawdownPercent > 10) return 'critical';
    if (accountStats.currentDrawdownPercent > 5) return 'warning';
    if (accountStats.totalReturnPercent < 0) return 'negative';
    return 'healthy';
  };

  const health = getAccountHealth();
  const healthColors = {
    healthy: 'text-green-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
    negative: 'text-orange-600',
  };

  return (
    <div className="space-y-6">
      {/* Account Overview */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl border border-gray-200">
        <h3 className="text-2xl font-bold text-gray-800 mb-4">
          Account Performance Analysis
        </h3>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Starting Balance</div>
            <div className="text-xl font-bold">
              {formatCurrency(accountStats.startingBalance)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Final Balance</div>
            <div
              className={`text-xl font-bold ${
                accountStats.finalBalance >= accountStats.startingBalance
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(accountStats.finalBalance)}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Total Return</div>
            <div
              className={`text-xl font-bold ${
                accountStats.totalReturn >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              {formatCurrency(accountStats.totalReturn)}
              <span className="text-sm ml-1">
                ({formatPercent(accountStats.totalReturnPercent)})
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-600">Account Status</div>
            <div className={`text-xl font-bold ${healthColors[health]}`}>
              {health.charAt(0).toUpperCase() + health.slice(1)}
            </div>
          </div>
        </div>

        {/* Drawdown Metrics */}
        <div className="bg-red-50 p-4 rounded-lg mb-4">
          <h4 className="text-lg font-semibold text-red-800 mb-3">
            Drawdown Analysis
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">Max Drawdown</div>
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(accountStats.maxDrawdown)}
                <span className="text-sm ml-1">
                  ({formatPercent(accountStats.maxDrawdownPercent)})
                </span>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Current Drawdown</div>
              <div
                className={`text-lg font-bold ${
                  accountStats.currentDrawdown > 0
                    ? 'text-orange-600'
                    : 'text-green-600'
                }`}
              >
                {accountStats.currentDrawdown > 0
                  ? `${formatCurrency(
                      accountStats.currentDrawdown
                    )} (${formatPercent(accountStats.currentDrawdownPercent)})`
                  : 'None'}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Lowest Balance</div>
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(accountStats.lowestBalance)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">High Water Mark</div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(accountStats.highWaterMark)}
              </div>
            </div>
          </div>
        </div>

        {/* Risk Metrics */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="text-lg font-semibold text-blue-800 mb-3">
            Risk Metrics
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-600">Return/Drawdown Ratio</div>
              <div className="text-lg font-bold text-blue-600">
                {accountStats.returnToDrawdownRatio === Infinity
                  ? 'N/A'
                  : accountStats.returnToDrawdownRatio.toFixed(2)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Number of Drawdowns</div>
              <div className="text-lg font-bold text-gray-700">
                {accountStats.numberOfDrawdowns}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Max DD Duration</div>
              <div className="text-lg font-bold text-gray-700">
                {accountStats.maxDrawdownDuration} days
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drawdown Events Table */}
      {drawdownEvents.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 bg-gray-50 border-b">
            <h4 className="text-lg font-semibold text-gray-800">
              Drawdown History
            </h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left p-3">Start Date</th>
                  <th className="text-left p-3">End Date</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Percent</th>
                  <th className="text-right p-3">Duration</th>
                  <th className="text-center p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {drawdownEvents.map((event, index) => (
                  <tr
                    key={index}
                    className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                  >
                    <td className="p-3">{event.startDate.split(' ')[0]}</td>
                    <td className="p-3">{event.endDate.split(' ')[0]}</td>
                    <td className="text-right p-3 text-red-600 font-medium">
                      {formatCurrency(event.drawdownAmount)}
                    </td>
                    <td className="text-right p-3 text-red-600">
                      {formatPercent(event.drawdownPercent)}
                    </td>
                    <td className="text-right p-3">{event.duration} days</td>
                    <td className="text-center p-3">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          event.recovered
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {event.recovered ? 'Recovered' : 'Active'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Risk Warning for Prop Firms */}
      {accountStats.maxDrawdownPercent > 5 && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠️ Prop Firm Risk Warning
          </h4>
          <p className="text-sm text-yellow-700">
            Your maximum drawdown of{' '}
            {formatPercent(accountStats.maxDrawdownPercent)} exceeds typical
            prop firm limits (usually 5-6% daily and 10-12% total). Consider
            adjusting your risk management parameters.
          </p>
        </div>
      )}
    </div>
  );
}
