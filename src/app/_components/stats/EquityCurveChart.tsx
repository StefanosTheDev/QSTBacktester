// components/stats/EquityCurveChart.tsx
import React, { useState } from 'react';

interface EquityData {
  timestamp: string;
  balance: number;
  equity: number;
  drawdownPercent: number;
}

interface EquityCurveChartProps {
  equityCurve: EquityData[];
  startingBalance: number;
}

export default function EquityCurveChart({
  equityCurve,
  startingBalance,
}: EquityCurveChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  if (!equityCurve || equityCurve.length === 0) {
    return <div>No equity data available</div>;
  }

  // Group equity data by day and get end-of-day values
  const dailyEquityMap = new Map<string, EquityData>();

  equityCurve.forEach((point) => {
    // Extract date from timestamp (assuming EST display format)
    const date = point.timestamp.split(' ')[0]; // Gets "MM/DD/YYYY" part

    // Keep the last (end-of-day) value for each date
    dailyEquityMap.set(date, point);
  });

  // Convert to array and sort by date
  const dailyEquity = Array.from(dailyEquityMap.entries())
    .sort((a, b) => {
      // Parse MM/DD/YYYY format for sorting
      const [aMonth, aDay, aYear] = a[0].split('/').map(Number);
      const [bMonth, bDay, bYear] = b[0].split('/').map(Number);
      const aDate = aYear * 10000 + aMonth * 100 + aDay;
      const bDate = bYear * 10000 + bMonth * 100 + bDay;
      return aDate - bDate;
    })
    .map(([date, data]) => ({ date, ...data }));

  // Calculate chart dimensions and scaling
  const padding = { top: 20, right: 60, bottom: 60, left: 80 };
  const width = 1200;
  const height = 400;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min and max values for scaling
  const balances = dailyEquity.map((d) => d.balance);
  const minBalance = Math.min(...balances, startingBalance);
  const maxBalance = Math.max(...balances, startingBalance);
  const balanceRange = maxBalance - minBalance;
  const paddedMin = minBalance - balanceRange * 0.1;
  const paddedMax = maxBalance + balanceRange * 0.1;

  // Create scales
  const xScale = (index: number) =>
    (index / (dailyEquity.length - 1)) * chartWidth;
  const yScale = (value: number) =>
    chartHeight - ((value - paddedMin) / (paddedMax - paddedMin)) * chartHeight;

  // Create path for the equity curve
  const pathData = dailyEquity
    .map(
      (point, i) =>
        `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(point.balance)}`
    )
    .join(' ');

  // Format currency
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);

  // Y-axis ticks
  const yTicks = [];
  const tickCount = 5;
  for (let i = 0; i <= tickCount; i++) {
    const value = paddedMin + (paddedMax - paddedMin) * (i / tickCount);
    yTicks.push({ value, y: yScale(value) });
  }

  // Calculate X-axis labels (show every Nth date to avoid crowding)
  const xLabelInterval = Math.ceil(dailyEquity.length / 10); // Show ~10 labels
  const xLabels = dailyEquity.filter(
    (_, i) => i % xLabelInterval === 0 || i === dailyEquity.length - 1
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">Daily Account Equity</h3>

      <div className="relative overflow-x-auto">
        <svg width={width} height={height} className="min-w-full">
          {/* Grid lines */}
          <g className="text-gray-200">
            {yTicks.map((tick, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={tick.y + padding.top}
                x2={width - padding.right}
                y2={tick.y + padding.top}
                stroke="currentColor"
                strokeDasharray="2,2"
              />
            ))}
          </g>

          {/* Starting balance line */}
          <line
            x1={padding.left}
            y1={yScale(startingBalance) + padding.top}
            x2={width - padding.right}
            y2={yScale(startingBalance) + padding.top}
            stroke="#6B7280"
            strokeWidth="2"
            strokeDasharray="5,5"
          />

          {/* Drawdown fill */}
          <path
            d={
              `M ${padding.left} ${yScale(startingBalance) + padding.top} ` +
              dailyEquity
                .map(
                  (point, i) =>
                    `L ${xScale(i) + padding.left} ${
                      Math.max(yScale(point.balance), yScale(startingBalance)) +
                      padding.top
                    }`
                )
                .join(' ') +
              ` L ${width - padding.right} ${
                yScale(startingBalance) + padding.top
              } Z`
            }
            fill="rgba(239, 68, 68, 0.1)"
          />

          {/* Profit fill */}
          <path
            d={
              `M ${padding.left} ${yScale(startingBalance) + padding.top} ` +
              dailyEquity
                .map(
                  (point, i) =>
                    `L ${xScale(i) + padding.left} ${
                      Math.min(yScale(point.balance), yScale(startingBalance)) +
                      padding.top
                    }`
                )
                .join(' ') +
              ` L ${width - padding.right} ${
                yScale(startingBalance) + padding.top
              } Z`
            }
            fill="rgba(34, 197, 94, 0.1)"
          />

          {/* Equity curve line */}
          <path
            d={pathData}
            transform={`translate(${padding.left}, ${padding.top})`}
            fill="none"
            stroke="#2563EB"
            strokeWidth="2"
          />

          {/* Interactive points */}
          {dailyEquity.map((point, i) => (
            <circle
              key={i}
              cx={xScale(i) + padding.left}
              cy={yScale(point.balance) + padding.top}
              r="3"
              fill="#2563EB"
              className="cursor-pointer hover:r-5"
              onMouseEnter={() => setHoveredPoint(i)}
              onMouseLeave={() => setHoveredPoint(null)}
            />
          ))}

          {/* Y-axis */}
          <g className="text-gray-600">
            {yTicks.map((tick, i) => (
              <g key={i}>
                <text
                  x={padding.left - 10}
                  y={tick.y + padding.top + 5}
                  textAnchor="end"
                  className="text-xs"
                >
                  {formatCurrency(tick.value)}
                </text>
              </g>
            ))}
          </g>

          {/* X-axis labels */}
          <g className="text-gray-600">
            {xLabels.map((label, labelIndex) => {
              const actualIndex = dailyEquity.findIndex(
                (d) => d.date === label.date
              );
              return (
                <text
                  key={labelIndex}
                  x={xScale(actualIndex) + padding.left}
                  y={height - padding.bottom + 20}
                  textAnchor="middle"
                  className="text-xs"
                  transform={`rotate(-45, ${
                    xScale(actualIndex) + padding.left
                  }, ${height - padding.bottom + 20})`}
                >
                  {label.date}
                </text>
              );
            })}
          </g>

          {/* Labels */}
          <text
            x={padding.left}
            y={padding.top - 5}
            className="text-sm font-medium text-gray-700"
          >
            Account Balance ($)
          </text>

          {/* Tooltip */}
          {hoveredPoint !== null && (
            <g>
              <rect
                x={Math.min(
                  xScale(hoveredPoint) + padding.left - 80,
                  width - 180
                )}
                y={yScale(dailyEquity[hoveredPoint].balance) + padding.top - 50}
                width="160"
                height="45"
                fill="white"
                stroke="#E5E7EB"
                strokeWidth="1"
                rx="4"
                style={{ filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))' }}
              />
              <text
                x={
                  Math.min(
                    xScale(hoveredPoint) + padding.left - 80,
                    width - 180
                  ) + 80
                }
                y={yScale(dailyEquity[hoveredPoint].balance) + padding.top - 30}
                textAnchor="middle"
                className="text-xs font-medium"
              >
                {dailyEquity[hoveredPoint].date}
              </text>
              <text
                x={
                  Math.min(
                    xScale(hoveredPoint) + padding.left - 80,
                    width - 180
                  ) + 80
                }
                y={yScale(dailyEquity[hoveredPoint].balance) + padding.top - 15}
                textAnchor="middle"
                className="text-sm font-bold"
              >
                {formatCurrency(dailyEquity[hoveredPoint].balance)}
              </text>
              {dailyEquity[hoveredPoint].drawdownPercent > 0 && (
                <text
                  x={
                    Math.min(
                      xScale(hoveredPoint) + padding.left - 80,
                      width - 180
                    ) + 80
                  }
                  y={
                    yScale(dailyEquity[hoveredPoint].balance) + padding.top - 2
                  }
                  textAnchor="middle"
                  className="text-xs text-red-600"
                >
                  -{dailyEquity[hoveredPoint].drawdownPercent.toFixed(1)}%
                  drawdown
                </text>
              )}
            </g>
          )}
        </svg>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t">
        <div>
          <span className="text-sm text-gray-600">Starting</span>
          <div className="font-bold">{formatCurrency(startingBalance)}</div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Current</span>
          <div
            className={`font-bold ${
              dailyEquity[dailyEquity.length - 1].balance >= startingBalance
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {formatCurrency(dailyEquity[dailyEquity.length - 1].balance)}
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Lowest</span>
          <div className="font-bold text-red-600">
            {formatCurrency(Math.min(...balances))}
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-600">Highest</span>
          <div className="font-bold text-green-600">
            {formatCurrency(Math.max(...balances))}
          </div>
        </div>
      </div>

      {/* Days summary */}
      <div className="text-sm text-gray-600 mt-2">
        Showing {dailyEquity.length} trading days
      </div>
    </div>
  );
}
