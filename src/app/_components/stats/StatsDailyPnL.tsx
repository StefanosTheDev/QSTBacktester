// components/stats/StatsDailyPnL.tsx
import React from 'react';

interface StatsDailyPnLProps {
  statistics: {
    dailyPnL: Record<string, number>;
  };
  logs: string[];
}

export default function StatsDailyPnL({
  statistics,
  logs,
}: StatsDailyPnLProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  // FIXED: Parse date string without using Date object
  const parseDateString = (
    dateStr: string
  ): { month: number; day: number; year: number; comparable: number } => {
    // Handle MM/DD/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/').map(Number);
      return {
        month,
        day,
        year,
        comparable: year * 10000 + month * 100 + day,
      };
    }
    // Handle YYYY-MM-DD format (shouldn't happen but just in case)
    else if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return {
        year,
        month,
        day,
        comparable: year * 10000 + month * 100 + day,
      };
    }
    throw new Error(`Cannot parse date: ${dateStr}`);
  };

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-800">
        Daily Profit & Loss
      </h4>
      <div className="overflow-x-auto">
        <div className="max-h-96 overflow-y-auto bg-gray-50 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left p-3 font-medium text-gray-700">
                  Date
                </th>
                <th className="text-right p-3 font-medium text-gray-700">
                  P&L
                </th>
                <th className="text-right p-3 font-medium text-gray-700">
                  Cumulative
                </th>
                <th className="text-center p-3 font-medium text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(statistics.dailyPnL)
                .sort(([a], [b]) => {
                  // FIXED: Sort using manual date parsing
                  const aDate = parseDateString(a);
                  const bDate = parseDateString(b);
                  return aDate.comparable - bDate.comparable;
                })
                .reduce((acc, [date, pnl], index) => {
                  const cumulative =
                    index === 0 ? pnl : acc[index - 1].cumulative + pnl;
                  acc.push({ date, pnl, cumulative });
                  return acc;
                }, [] as Array<{ date: string; pnl: number; cumulative: number }>)
                .map(({ date, pnl, cumulative }, index) => {
                  // Check if this day hit limits based on log messages
                  const dayLogs = logs.filter((log) => log.includes(date));
                  const hitStop = dayLogs.some((log) =>
                    log.includes('Daily stop loss hit')
                  );
                  const hitTarget = dayLogs.some((log) =>
                    log.includes('Daily profit target hit')
                  );

                  return (
                    <tr
                      key={date}
                      className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    >
                      <td className="p-3 text-gray-800">{date}</td>
                      <td
                        className={`p-3 text-right font-medium ${
                          pnl >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(pnl)}
                      </td>
                      <td
                        className={`p-3 text-right font-medium ${
                          cumulative >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatCurrency(cumulative)}
                      </td>
                      <td className="p-3 text-center">
                        {hitStop && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                            Stop Hit
                          </span>
                        )}
                        {hitTarget && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                            Target Hit
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
