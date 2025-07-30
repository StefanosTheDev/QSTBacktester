// src/app/_components/Stats.tsx
import React, { useState } from 'react';
import { FormProp } from '../types/types';
import StatsOverview from './stats/StatsOverView';
import StatsCardView from './stats/StatsCardView';
import StatsTradeDetails from './stats/StatsTradeDetails';
import StatsDailyPnL from './stats/StatsDailyPnL';
import StatsExecutionLog from './stats/StatsExecutionLog';
import StatsSettingsDisplay from './stats/StatsSettingsDisplay';
import StatsAccountPerformance from './stats/StatsAccountPerformance'; // Make sure this import exists!

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

interface StatsProps {
  results: {
    count: number;
    logs: string[];
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
      accountStats?: {
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
      };
    };
    trades?: TradeRecord[];
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
    equityCurve?: Array<{
      timestamp: string;
      balance: number;
      equity: number;
      drawdownPercent: number;
    }>;
    drawdownEvents?: Array<{
      startDate: string;
      endDate: string;
      startBalance: number;
      lowestBalance: number;
      drawdownAmount: number;
      drawdownPercent: number;
      duration: number;
      recovered: boolean;
    }>;
    dailyAccountData?: Record<
      string,
      {
        balance: number;
        equity: number;
        drawdown: number;
        drawdownPercent: number;
        trades: number;
      }
    >;
  };
  settings?: FormProp;
}

export default function Stats({ results, settings }: StatsProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trades' | 'daily' | 'cards' | 'account' | 'logs'
  >('overview');

  const {
    count,
    logs,
    statistics,
    trades = [],
    intradayStats = {},
    equityCurve = [],
    drawdownEvents = [],
    // Removed dailyAccountData since it's not used
  } = results;

  // Debug log to see what data we have
  console.log('Stats Component - Account Data:', {
    accountStats: statistics.accountStats,
    equityCurve: equityCurve.length,
    drawdownEvents: drawdownEvents.length,
  });

  // Export functionality
  const exportResults = () => {
    const dataStr = JSON.stringify(results, null, 2);
    const dataUri =
      'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `backtest-results-${
      new Date().toISOString().split('T')[0]
    }.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportLogs = () => {
    const logStr = logs.join('\n');
    const dataUri =
      'data:text/plain;charset=utf-8,' + encodeURIComponent(logStr);
    const exportFileDefaultName = `backtest-log-${
      new Date().toISOString().split('T')[0]
    }.txt`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-6">
      {/* Settings Display - Always visible at top */}
      {settings && (
        <div className="mb-6">
          <StatsSettingsDisplay settings={settings} />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('account')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'account'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Account ($50k)
          {statistics.accountStats && (
            <span
              className={`ml-1 text-xs ${
                statistics.accountStats.totalReturnPercent >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}
            >
              ({statistics.accountStats.totalReturnPercent > 0 ? '+' : ''}
              {statistics.accountStats.totalReturnPercent.toFixed(1)}%)
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('trades')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'trades'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Trade Details
        </button>
        <button
          onClick={() => setActiveTab('daily')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'daily'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Daily P&L
        </button>
        <button
          onClick={() => setActiveTab('cards')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'cards'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Card View
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Execution Log
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <StatsOverview statistics={statistics} count={count} />
      )}

      {activeTab === 'account' && (
        <>
          {statistics.accountStats ? (
            <StatsAccountPerformance
              accountStats={statistics.accountStats}
              drawdownEvents={drawdownEvents}
              equityCurve={equityCurve}
            />
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-lg">
              <h3 className="text-lg font-semibold text-yellow-800 mb-2">
                Account Data Not Available
              </h3>
              <p className="text-yellow-700">
                The account tracking feature may not be properly initialized.
                Please ensure your backtest is using the latest version with
                AccountTracker.
              </p>
              <p className="text-sm text-yellow-600 mt-2">
                Check the console for any errors or missing data.
              </p>
            </div>
          )}
        </>
      )}

      {activeTab === 'trades' && <StatsTradeDetails trades={trades} />}

      {activeTab === 'daily' && (
        <StatsDailyPnL statistics={statistics} logs={logs} />
      )}

      {activeTab === 'cards' && (
        <StatsCardView
          statistics={statistics}
          trades={trades}
          intradayStats={intradayStats}
        />
      )}

      {activeTab === 'logs' && <StatsExecutionLog logs={logs} />}

      {/* Quick Action Buttons */}
      <div className="flex space-x-4 pt-4 border-t">
        <button
          onClick={exportResults}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
        >
          Export Results (JSON)
        </button>
        <button
          onClick={exportLogs}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
        >
          Export Log (TXT)
        </button>
      </div>

      {/* Debug Info - Remove this after testing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-4 bg-gray-100 rounded text-xs">
          <h4 className="font-bold">Debug Info:</h4>
          <pre>
            {JSON.stringify(
              {
                hasAccountStats: !!statistics.accountStats,
                equityCurveLength: equityCurve.length,
                drawdownEventsLength: drawdownEvents.length,
                activeTab: activeTab,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}
