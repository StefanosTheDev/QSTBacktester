// components/Stats.tsx - Main container component
import React, { useState } from 'react';
import { FormProp } from '../types/types';
import StatsOverview from './stats/StatsOverView';
import StatsCardView from './stats/StatsCardView';
import StatsTradeDetails from './stats/StatsTradeDetails';
import StatsDailyPnL from './stats/StatsDailyPnL';
import StatsExecutionLog from './stats/StatsExecutionLog';
import StatsSettingsDisplay from './stats/StatsSettingsDisplay';

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
  };
  settings?: FormProp; // Trading settings from the form
}

export default function Stats({ results, settings }: StatsProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'trades' | 'daily' | 'cards' | 'logs'
  >('overview');

  const { count, logs, statistics, trades = [], intradayStats = {} } = results;

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
    </div>
  );
}
