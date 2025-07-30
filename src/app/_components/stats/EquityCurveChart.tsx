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

  // Calculate chart dimensions and scaling
  const padding = { top: 20, right: 60, bottom: 40, left: 80 };
  const width = 1200;
  const height = 400;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Find min and max values for scaling
  const balances = equityCurve.map((d) => d.balance);
  const minBalance = Math.min(...balances, startingBalance);
  const maxBalance = Math.max(...balances, startingBalance);
  const balanceRange = maxBalance - minBalance;
  const paddedMin = minBalance - balanceRange * 0.1;
  const paddedMax = maxBalance + balanceRange * 0.1;

  // Create scales
  const xScale = (index: number) =>
    (index / (equityCurve.length - 1)) * chartWidth;
  const yScale = (value: number) =>
    chartHeight - ((value - paddedMin) / (paddedMax - paddedMin)) * chartHeight;

  // Create path for the equity curve
  const pathData = equityCurve
    .map(
      (point, i) =>
        `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(point.balance)}`
    )
    .join(' ');

  // Create path for drawdown areas
  //   const drawdownPath =
  //     equityCurve
  //       .map((point, i) => {
  //         const y = yScale(point.balance);
  //         const baseline = yScale(startingBalance);
  //         return `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${
  //           point.balance < startingBalance ? y : baseline
  //         }`;
  //       })
  //       .join(' ') +
  //     ` L ${xScale(equityCurve.length - 1)} ${yScale(startingBalance)} L ${xScale(
  //       0
  //     )} ${yScale(startingBalance)} Z`;

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

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h3 className="text-xl font-bold mb-4">Account Equity Curve</h3>

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
              equityCurve
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
              equityCurve
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
          {equityCurve.map((point, i) => (
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

          {/* Labels */}
          <text
            x={padding.left}
            y={padding.top - 5}
            className="text-sm font-medium text-gray-700"
          >
            Account Balance
          </text>

          {/* Tooltip */}
          {hoveredPoint !== null && (
            <g>
              <rect
                x={xScale(hoveredPoint) + padding.left - 60}
                y={yScale(equityCurve[hoveredPoint].balance) + padding.top - 40}
                width="120"
                height="35"
                fill="white"
                stroke="#E5E7EB"
                strokeWidth="1"
                rx="4"
              />
              <text
                x={xScale(hoveredPoint) + padding.left}
                y={yScale(equityCurve[hoveredPoint].balance) + padding.top - 20}
                textAnchor="middle"
                className="text-xs font-medium"
              >
                {formatCurrency(equityCurve[hoveredPoint].balance)}
              </text>
              <text
                x={xScale(hoveredPoint) + padding.left}
                y={yScale(equityCurve[hoveredPoint].balance) + padding.top - 8}
                textAnchor="middle"
                className="text-xs text-gray-500"
              >
                Trade #{hoveredPoint + 1}
              </text>
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
              equityCurve[equityCurve.length - 1].balance >= startingBalance
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            {formatCurrency(equityCurve[equityCurve.length - 1].balance)}
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
    </div>
  );
}
