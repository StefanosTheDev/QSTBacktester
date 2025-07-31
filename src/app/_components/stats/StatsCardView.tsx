// components/stats/StatsCardView.tsx
import React, { useState, useMemo } from 'react';

interface TradeRecord {
  entryDate: string;
  entryTime: string;
  entryPrice: number;
  exitDate: string;
  exitTime: string;
  exitPrice: number;
  type: 'LONG' | 'SHORT';
  contracts: number;
  stopLoss: number;
  takeProfit: number;
  exitReason: string;
  profitLoss: number;
  commission: number;
  netProfitLoss: number;
}

interface StatsCardViewProps {
  statistics: {
    dailyPnL: Record<string, number>;
  };
  trades: TradeRecord[];
  intradayStats?: Record<
    string,
    {
      date: string;
      maxHigh: number;
      maxLow: number;
      finalPnL: number;
      trades: number;
    }
  >;
}

type ViewLevel = 'month' | 'week' | 'day';

export default function StatsCardView({
  statistics,
  trades,
  intradayStats = {},
}: StatsCardViewProps) {
  const [viewLevel, setViewLevel] = useState<ViewLevel>('month');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  // FIXED: Helper function to parse date WITHOUT using Date object
  const parseDate = (
    dateStr: string
  ): { year: number; month: number; day: number; comparable: number } => {
    // Handle "MM/DD/YYYY" format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/').map((p) => parseInt(p));
      return {
        year,
        month,
        day,
        comparable: year * 10000 + month * 100 + day,
      };
    }
    // Handle "YYYY-MM-DD" format
    else if (dateStr.includes('-')) {
      const [year, month, day] = dateStr.split('-').map((p) => parseInt(p));
      return {
        year,
        month,
        day,
        comparable: year * 10000 + month * 100 + day,
      };
    }
    // Fallback
    throw new Error(`Cannot parse date: ${dateStr}`);
  };

  // FIXED: Get day of week without Date object (0 = Sunday, 6 = Saturday)
  const getDayOfWeek = (year: number, month: number, day: number): number => {
    // Zeller's congruence algorithm
    const m = month < 3 ? month + 12 : month;
    const y = month < 3 ? year - 1 : year;
    const k = y % 100;
    const j = Math.floor(y / 100);
    const h =
      (day +
        Math.floor((13 * (m + 1)) / 5) +
        k +
        Math.floor(k / 4) +
        Math.floor(j / 4) -
        2 * j) %
      7;
    return (h + 6) % 7; // Convert to 0 = Sunday
  };

  // FIXED: Format date for display
  const formatDateDisplay = (
    year: number,
    month: number,
    day: number,
    format: 'full' | 'month' | 'short'
  ): string => {
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];
    const monthNamesShort = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    switch (format) {
      case 'full':
        return `${monthNames[month - 1]} ${day}, ${year}`;
      case 'month':
        return monthNames[month - 1];
      case 'short':
        return `${monthNamesShort[month - 1]} ${day}`;
      default:
        return `${month}/${day}/${year}`;
    }
  };

  // Group data by month with proper date parsing
  const monthlyData = useMemo(() => {
    const months: Record<
      string,
      {
        monthKey: string;
        monthName: string;
        year: number;
        days: string[];
        totalPnL: number;
        tradingDays: number;
        greenDays: number;
        redDays: number;
        totalTrades: number;
      }
    > = {};

    Object.entries(statistics.dailyPnL).forEach(([dateStr, pnl]) => {
      const parsed = parseDate(dateStr);
      const monthKey = `${parsed.year}-${parsed.month
        .toString()
        .padStart(2, '0')}`;
      const monthName = formatDateDisplay(
        parsed.year,
        parsed.month,
        1,
        'month'
      );

      if (!months[monthKey]) {
        months[monthKey] = {
          monthKey,
          monthName,
          year: parsed.year,
          days: [],
          totalPnL: 0,
          tradingDays: 0,
          greenDays: 0,
          redDays: 0,
          totalTrades: 0,
        };
      }

      months[monthKey].days.push(dateStr);
      months[monthKey].totalPnL += pnl;
      months[monthKey].tradingDays++;
      if (pnl > 0) {
        months[monthKey].greenDays++;
      } else if (pnl < 0) {
        months[monthKey].redDays++;
      }

      // Count trades for this day
      const dayTrades = trades.filter((t) => t.exitDate === dateStr).length;
      months[monthKey].totalTrades += dayTrades;
    });

    return months;
  }, [statistics.dailyPnL, trades]);

  // Group data by week
  const getWeeklyData = (monthKey: string) => {
    const weeks: Record<
      string,
      {
        weekKey: string;
        weekStart: { year: number; month: number; day: number };
        weekEnd: { year: number; month: number; day: number };
        weekLabel: string;
        weekNumber: number;
        days: string[];
        totalPnL: number;
        tradingDays: number;
        greenDays: number;
        totalTrades: number;
        bestDay: { date: string; pnl: number };
        worstDay: { date: string; pnl: number };
      }
    > = {};

    const monthDays = monthlyData[monthKey]?.days || [];

    // Sort days chronologically first
    const sortedDays = [...monthDays].sort((a, b) => {
      const aDate = parseDate(a);
      const bDate = parseDate(b);
      return aDate.comparable - bDate.comparable;
    });

    sortedDays.forEach((dateStr) => {
      const parsed = parseDate(dateStr);
      const dayOfWeek = getDayOfWeek(parsed.year, parsed.month, parsed.day);

      // Calculate start of week (Sunday)
      let weekStartDay = parsed.day - dayOfWeek;
      let weekStartMonth = parsed.month;
      let weekStartYear = parsed.year;

      // Handle month boundary
      if (weekStartDay < 1) {
        weekStartMonth--;
        if (weekStartMonth < 1) {
          weekStartMonth = 12;
          weekStartYear--;
        }
        // Get days in previous month
        const daysInPrevMonth = new Date(
          weekStartYear,
          weekStartMonth,
          0
        ).getDate();
        weekStartDay = daysInPrevMonth + weekStartDay;
      }

      // Get week number in month
      const firstDayOfMonth = getDayOfWeek(parsed.year, parsed.month, 1);
      const weekNumber = Math.ceil((parsed.day + firstDayOfMonth) / 7);

      const weekKey = `${weekStartYear}-${weekStartMonth
        .toString()
        .padStart(2, '0')}-${weekStartDay.toString().padStart(2, '0')}`;

      if (!weeks[weekKey]) {
        const weekEnd = {
          year: weekStartYear,
          month: weekStartMonth,
          day: weekStartDay + 6,
        };

        // Handle month boundary for week end
        const daysInMonth = new Date(weekEnd.year, weekEnd.month, 0).getDate();
        if (weekEnd.day > daysInMonth) {
          weekEnd.day = weekEnd.day - daysInMonth;
          weekEnd.month++;
          if (weekEnd.month > 12) {
            weekEnd.month = 1;
            weekEnd.year++;
          }
        }

        weeks[weekKey] = {
          weekKey,
          weekStart: {
            year: weekStartYear,
            month: weekStartMonth,
            day: weekStartDay,
          },
          weekEnd,
          weekLabel: `Week ${weekNumber}`,
          weekNumber,
          days: [],
          totalPnL: 0,
          tradingDays: 0,
          greenDays: 0,
          totalTrades: 0,
          bestDay: { date: '', pnl: -Infinity },
          worstDay: { date: '', pnl: Infinity },
        };
      }

      const pnl = statistics.dailyPnL[dateStr];
      weeks[weekKey].days.push(dateStr);
      weeks[weekKey].totalPnL += pnl;
      weeks[weekKey].tradingDays++;
      if (pnl > 0) weeks[weekKey].greenDays++;

      // Count trades
      const dayTrades = trades.filter((t) => t.exitDate === dateStr).length;
      weeks[weekKey].totalTrades += dayTrades;

      // Track best/worst days
      if (pnl > weeks[weekKey].bestDay.pnl) {
        weeks[weekKey].bestDay = { date: dateStr, pnl };
      }
      if (pnl < weeks[weekKey].worstDay.pnl) {
        weeks[weekKey].worstDay = { date: dateStr, pnl };
      }
    });

    return weeks;
  };

  // Get days for display (either all days in a month or week)
  const getDaysToDisplay = () => {
    if (selectedWeek && selectedMonth) {
      return getWeeklyData(selectedMonth)[selectedWeek]?.days || [];
    } else if (selectedMonth) {
      return monthlyData[selectedMonth]?.days || [];
    }
    return [];
  };

  // Render month card
  const renderMonthCard = (
    monthKey: string,
    data: (typeof monthlyData)[string]
  ) => (
    <div
      key={monthKey}
      className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-200 hover:border-blue-300"
      onClick={() => {
        setSelectedMonth(monthKey);
        setViewLevel('week');
      }}
    >
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-2xl font-bold text-gray-800">{data.monthName}</h3>
        <span className="text-lg text-gray-500">{data.year}</span>
      </div>

      <div
        className={`text-3xl font-bold mb-6 ${
          data.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {formatCurrency(data.totalPnL)}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50 p-3 rounded-lg">
          <span className="text-xs text-gray-500 block">Trading Days</span>
          <span className="text-lg font-semibold text-gray-800">
            {data.tradingDays}
          </span>
        </div>
        <div className="bg-gray-50 p-3 rounded-lg">
          <span className="text-xs text-gray-500 block">Total Trades</span>
          <span className="text-lg font-semibold text-gray-800">
            {data.totalTrades}
          </span>
        </div>
        <div className="bg-green-50 p-3 rounded-lg">
          <span className="text-xs text-gray-500 block">Green Days</span>
          <span className="text-lg font-semibold text-green-600">
            {data.greenDays}
          </span>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <span className="text-xs text-gray-500 block">Red Days</span>
          <span className="text-lg font-semibold text-red-600">
            {data.redDays}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Win Rate</span>
          <span className="text-lg font-semibold text-green-600">
            {data.tradingDays > 0
              ? ((data.greenDays / data.tradingDays) * 100).toFixed(1)
              : '0'}
            %
          </span>
        </div>
      </div>
    </div>
  );

  // Render week card
  const renderWeekCard = (
    weekKey: string,
    data: ReturnType<typeof getWeeklyData>[string]
  ) => (
    <div
      key={weekKey}
      className="bg-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all cursor-pointer border border-gray-200 hover:border-blue-300"
      onClick={() => {
        setSelectedWeek(weekKey);
        setViewLevel('day');
      }}
    >
      <h3 className="text-2xl font-bold mb-2 text-gray-800">
        {data.weekLabel}
      </h3>
      <p className="text-sm text-gray-500 mb-4">
        {formatDateDisplay(
          data.weekStart.year,
          data.weekStart.month,
          data.weekStart.day,
          'short'
        )}
        {' - '}
        {formatDateDisplay(
          data.weekEnd.year,
          data.weekEnd.month,
          data.weekEnd.day,
          'short'
        )}
      </p>

      <div
        className={`text-3xl font-bold mb-6 ${
          data.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'
        }`}
      >
        {formatCurrency(data.totalPnL)}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="text-sm text-gray-600">Trading Days</span>
          <span className="font-semibold">{data.tradingDays}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="text-sm text-gray-600">Total Trades</span>
          <span className="font-semibold">{data.totalTrades}</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-green-50 rounded">
          <span className="text-sm text-gray-600">Best Day</span>
          <span className="font-semibold text-green-600">
            {data.bestDay.pnl !== -Infinity
              ? formatCurrency(data.bestDay.pnl)
              : 'N/A'}
          </span>
        </div>
        <div className="flex justify-between items-center p-2 bg-red-50 rounded">
          <span className="text-sm text-gray-600">Worst Day</span>
          <span className="font-semibold text-red-600">
            {data.worstDay.pnl !== Infinity
              ? formatCurrency(data.worstDay.pnl)
              : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );

  // Render day card
  const renderDayCard = (dateStr: string) => {
    const pnl = statistics.dailyPnL[dateStr];
    const dayTrades = trades.filter((t) => t.exitDate === dateStr);
    const stats = intradayStats[dateStr] || { maxHigh: 0, maxLow: 0 };
    const parsed = parseDate(dateStr);
    const dayOfWeek = getDayOfWeek(parsed.year, parsed.month, parsed.day);
    const dayNames = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ];

    return (
      <div
        key={dateStr}
        className="bg-white p-6 rounded-xl shadow-lg border border-gray-200"
      >
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            {dayNames[dayOfWeek]}
          </h3>
          <p className="text-gray-500">
            {formatDateDisplay(parsed.year, parsed.month, parsed.day, 'full')}
          </p>
        </div>

        <div
          className={`text-3xl font-bold mb-6 ${
            pnl >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {formatCurrency(pnl)}
        </div>

        {/* Intraday Stats */}
        <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-lg mb-6">
          <h4 className="font-semibold text-gray-700 mb-3 text-sm uppercase tracking-wide">
            Intraday Performance
          </h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Max High</div>
              <div className="text-lg font-bold text-green-600">
                {formatCurrency(stats.maxHigh)}
              </div>
            </div>
            <div className="text-center border-l border-r border-gray-300">
              <div className="text-xs text-gray-500 mb-1">Max Low</div>
              <div className="text-lg font-bold text-red-600">
                {formatCurrency(stats.maxLow)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500 mb-1">Final P&L</div>
              <div
                className={`text-lg font-bold ${
                  pnl >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(pnl)}
              </div>
            </div>
          </div>
        </div>

        {/* Trades List */}
        <div>
          <h4 className="font-semibold text-gray-700 mb-3 flex justify-between items-center">
            <span>Trade Details</span>
            <span className="text-sm font-normal text-gray-500">
              {dayTrades.length} trades
            </span>
          </h4>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {dayTrades.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No trades on this day
              </p>
            ) : (
              dayTrades.map((trade, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 p-4 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`font-bold text-lg ${
                        trade.type === 'LONG'
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {trade.type}
                    </span>
                    <span
                      className={`font-bold text-lg ${
                        trade.netProfitLoss >= 0
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {formatCurrency(trade.netProfitLoss)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Entry:</span>{' '}
                      {trade.entryTime} @ ${trade.entryPrice.toFixed(2)}
                    </div>
                    <div>
                      <span className="font-medium">Exit:</span>{' '}
                      {trade.exitTime} @ ${trade.exitPrice.toFixed(2)}
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Exit Reason:</span>{' '}
                      <span className="text-gray-700">{trade.exitReason}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* View Level Controls */}
      <div className="bg-gray-50 p-4 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex space-x-2">
            <button
              onClick={() => {
                setViewLevel('month');
                setSelectedMonth(null);
                setSelectedWeek(null);
              }}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                viewLevel === 'month'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Month View
            </button>
            <button
              onClick={() => setViewLevel('week')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                viewLevel === 'week'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              } ${!selectedMonth ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!selectedMonth}
            >
              Week View
            </button>
            <button
              onClick={() => setViewLevel('day')}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                viewLevel === 'day'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              } ${!selectedMonth ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={!selectedMonth}
            >
              Day View
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        {(selectedMonth || selectedWeek) && (
          <div className="text-sm text-gray-600">
            <span
              className="cursor-pointer hover:text-blue-600 hover:underline font-medium"
              onClick={() => {
                setViewLevel('month');
                setSelectedMonth(null);
                setSelectedWeek(null);
              }}
            >
              All Months
            </span>
            {selectedMonth && (
              <>
                <span className="mx-2">→</span>
                <span
                  className="cursor-pointer hover:text-blue-600 hover:underline font-medium"
                  onClick={() => {
                    setViewLevel('week');
                    setSelectedWeek(null);
                  }}
                >
                  {monthlyData[selectedMonth]?.monthName}{' '}
                  {monthlyData[selectedMonth]?.year}
                </span>
              </>
            )}
            {selectedWeek && viewLevel === 'day' && (
              <>
                <span className="mx-2">→</span>
                <span className="font-medium">
                  {getWeeklyData(selectedMonth!)[selectedWeek]?.weekLabel}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Cards Grid - Responsive with proper sizing */}
      <div
        className={`grid gap-6 ${
          viewLevel === 'day'
            ? 'grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3'
            : viewLevel === 'week'
            ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4'
            : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
        }`}
      >
        {viewLevel === 'month' &&
          Object.entries(monthlyData)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([monthKey, data]) => renderMonthCard(monthKey, data))}

        {viewLevel === 'week' &&
          selectedMonth &&
          Object.entries(getWeeklyData(selectedMonth))
            .sort((a, b) => a[1].weekNumber - b[1].weekNumber)
            .map(([weekKey, data]) => renderWeekCard(weekKey, data))}

        {viewLevel === 'day' &&
          getDaysToDisplay()
            .sort((a, b) => {
              const aDate = parseDate(a);
              const bDate = parseDate(b);
              return aDate.comparable - bDate.comparable;
            })
            .map((dateStr) => renderDayCard(dateStr))}
      </div>
    </div>
  );
}
