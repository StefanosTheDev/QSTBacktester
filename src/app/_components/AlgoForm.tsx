// src/app/_components/AlgoForm.tsx
'use client';
import React, { useState, FormEvent } from 'react';
import { FormProp } from '../types/types';
import Stats from './Stats';

// Define TradeRecord interface
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

// Define the result type to match your BacktestResult
interface BacktestResults {
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
}

export default function AlgoForm() {
  const today = new Date().toISOString().slice(0, 10);

  // Helper function to show EST equivalent
  const getESTTime = (pstTime: string): string => {
    if (!pstTime) return '';
    const [hours, minutes] = pstTime.split(':').map(Number);
    const estHours = (hours + 3) % 24;
    return `${String(estHours).padStart(2, '0')}:${String(minutes).padStart(
      2,
      '0'
    )}`;
  };

  const [values, setValues] = useState<FormProp>({
    startDate: today,
    startTime: '06:30', // 6:30 AM PST = 9:30 AM EST
    endDate: today,
    endTime: '13:00', // 1:00 PM PST = 4:00 PM EST
    timeframe: '1min',

    barType: 'time',
    barSize: 0,
    candleType: 'traditional',
    cvdLookBackBars: 5,

    emaMovingAverage: 0,
    adxThreshold: 0,

    smaFilter: 0,
    useVWAP: false,

    contractSize: 1,
    stopLoss: 10,
    takeProfit: 20,

    maxDailyLoss: 1500,
    maxDailyProfit: 2000,

    useTrailingStop: false,
    breakevenTrigger: 3,
    trailDistance: 2,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BacktestResults | null>(null);
  const [lastRunSettings, setLastRunSettings] = useState<FormProp | null>(null);
  const [showForm, setShowForm] = useState(true);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = values;
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Server error ${res.status}: ${text}`);
      }

      const data = await res.json();

      if (data.success) {
        setResults({
          ...data.success,
          intradayStats: data.success.intradayStats || {},
        });
        setLastRunSettings(values);
        setShowForm(false);
      } else {
        throw new Error('Backtest failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err: unknown) {
      console.error('❌ Caught error in handleSubmit:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">
          CVD Trendline Backtester
        </h1>

        {/* Toggle buttons when we have results */}
        {results && (
          <div className="flex justify-center mb-6 space-x-4">
            <button
              onClick={() => setShowForm(true)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                showForm
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Settings
            </button>
            <button
              onClick={() => setShowForm(false)}
              className={`px-6 py-2 rounded-lg font-medium transition-all ${
                !showForm
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
              }`}
            >
              Results
            </button>
          </div>
        )}

        {/* Form Section */}
        {showForm && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Algorithm Settings
              </h2>

              {/* Timezone Notice */}
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
                <p className="text-sm text-blue-800">
                  <strong>📍 Time Zone:</strong> All times should be entered in{' '}
                  <strong>PST (Pacific Standard Time)</strong> to match the CSV
                  data files. The results will be displayed in EST (Eastern
                  Standard Time).
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Date & Time */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-gray-700">
                    Time Range
                  </h3>
                  {/* Quick preset buttons */}
                  <div className="flex gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => {
                        setValues((prev) => ({
                          ...prev,
                          startTime: '06:30', // 9:30 AM EST
                          endTime: '13:00', // 4:00 PM EST
                        }));
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                    >
                      Full Market Hours
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValues((prev) => ({
                          ...prev,
                          startTime: '06:30', // 9:30 AM EST
                          endTime: '11:00', // 2:00 PM EST
                        }));
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                    >
                      Morning Session
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setValues((prev) => ({
                          ...prev,
                          startTime: '11:00', // 2:00 PM EST
                          endTime: '13:00', // 4:00 PM EST
                        }));
                      }}
                      className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                    >
                      Afternoon Session
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">Start Date</span>
                      <input
                        type="date"
                        name="startDate"
                        value={values.startDate}
                        onChange={handleChange}
                        required
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        Start Time (PST)
                        {values.startTime && (
                          <span className="text-xs text-green-600 ml-2">
                            = {getESTTime(values.startTime)} EST
                          </span>
                        )}
                      </span>
                      <input
                        type="time"
                        name="startTime"
                        value={values.startTime}
                        onChange={handleChange}
                        required
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">End Date</span>
                      <input
                        type="date"
                        name="endDate"
                        value={values.endDate}
                        onChange={handleChange}
                        required
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        End Time (PST)
                        {values.endTime && (
                          <span className="text-xs text-green-600 ml-2">
                            = {getESTTime(values.endTime)} EST
                          </span>
                        )}
                      </span>
                      <input
                        type="time"
                        name="endTime"
                        value={values.endTime}
                        onChange={handleChange}
                        required
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                  </div>
                </div>

                {/* Bar Settings */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-gray-700">
                    Bar Settings
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">Bar Type</span>
                      <select
                        name="barType"
                        value={values.barType}
                        onChange={handleChange}
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      >
                        <option value="time">Time Bars</option>
                        <option value="tick">Tick Bars</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        Bar Size (
                        {values.barType === 'time' ? 'minutes' : 'ticks'})
                      </span>
                      <input
                        type="number"
                        name="barSize"
                        value={values.barSize || ''}
                        onChange={handleChange}
                        min="1"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">Candle Type</span>
                      <select
                        name="candleType"
                        value={values.candleType}
                        onChange={handleChange}
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      >
                        <option value="traditional">Traditional</option>
                        <option value="heikinashi">Heikin Ashi</option>
                      </select>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        CVD Lookback Bars
                      </span>
                      <input
                        type="number"
                        name="cvdLookBackBars"
                        value={values.cvdLookBackBars || ''}
                        onChange={handleChange}
                        min="3"
                        placeholder="5"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                  </div>
                </div>

                {/* Indicator Settings */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-gray-700">
                    Indicator Filters
                  </h3>
                  <div className="bg-blue-50 p-4 rounded-lg mb-4">
                    <p className="text-sm text-gray-700">
                      <strong>Important:</strong> When indicators are
                      configured, price must be ABOVE ALL of them for any trade
                      (LONG or SHORT).
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">EMA Filter</span>
                      <select
                        name="emaMovingAverage"
                        value={values.emaMovingAverage}
                        onChange={handleChange}
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      >
                        <option value="0">Disabled</option>
                        <option value="8">EMA 8</option>
                        <option value="9">EMA 9</option>
                        <option value="13">EMA 13</option>
                        <option value="21">EMA 21</option>
                        <option value="22">EMA 22</option>
                        <option value="100">EMA 100</option>
                        <option value="200">EMA 200</option>
                      </select>
                      <span className="text-xs text-gray-500 mt-1">
                        Price must be above EMA for trades
                      </span>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">SMA Filter</span>
                      <select
                        name="smaFilter"
                        value={values.smaFilter}
                        onChange={handleChange}
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      >
                        <option value="0">Disabled</option>
                        <option value="50">SMA 50</option>
                        <option value="100">SMA 100</option>
                        <option value="200">SMA 200</option>
                      </select>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        name="useVWAP"
                        checked={values.useVWAP}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            useVWAP: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Use VWAP Filter
                      </span>
                    </label>

                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        ADX Threshold (0 = disabled)
                      </span>
                      <input
                        type="number"
                        name="adxThreshold"
                        value={values.adxThreshold || ''}
                        onChange={handleChange}
                        placeholder="e.g. 10, 25"
                        min="0"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                      <span className="text-xs text-gray-500 mt-1">
                        Uses ADX period of 14. Set to 0 to disable ADX filter.
                      </span>
                    </label>
                  </div>
                </div>

                {/* Risk Management */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-gray-700">
                    Risk Management
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">Contracts</span>
                      <input
                        type="number"
                        name="contractSize"
                        value={values.contractSize || ''}
                        onChange={handleChange}
                        required
                        min="1"
                        placeholder="1"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        Stop Loss (pts)
                      </span>
                      <input
                        type="number"
                        name="stopLoss"
                        step="any"
                        value={values.stopLoss || ''}
                        onChange={handleChange}
                        required
                        min="1"
                        placeholder="10"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        Take Profit (pts)
                      </span>
                      <input
                        type="number"
                        name="takeProfit"
                        step="any"
                        value={values.takeProfit || ''}
                        onChange={handleChange}
                        required
                        min="1"
                        placeholder="20"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                    </label>
                  </div>

                  {/* Trailing Stop Toggle */}
                  <div className="mt-4 space-y-4">
                    <label className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        name="useTrailingStop"
                        checked={values.useTrailingStop}
                        onChange={(e) =>
                          setValues((prev) => ({
                            ...prev,
                            useTrailingStop: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Enable Trailing Stop
                      </span>
                    </label>

                    {values.useTrailingStop && (
                      <div className="ml-7 grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
                        <label className="flex flex-col">
                          <span className="text-sm text-gray-600">
                            Breakeven Trigger (pts)
                          </span>
                          <input
                            type="number"
                            name="breakevenTrigger"
                            value={values.breakevenTrigger || ''}
                            onChange={handleChange}
                            min="1"
                            placeholder="3"
                            className="mt-1 border rounded px-3 py-2 text-gray-800"
                          />
                          <span className="text-xs text-gray-500 mt-1">
                            Move stop to breakeven after this profit
                          </span>
                        </label>
                        <label className="flex flex-col">
                          <span className="text-sm text-gray-600">
                            Trail Distance (pts)
                          </span>
                          <input
                            type="number"
                            name="trailDistance"
                            value={values.trailDistance || ''}
                            onChange={handleChange}
                            min="1"
                            placeholder="2"
                            className="mt-1 border rounded px-3 py-2 text-gray-800"
                          />
                          <span className="text-xs text-gray-500 mt-1">
                            Points to trail below highest profit
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>

                {/* Daily Limits */}
                <div>
                  <h3 className="text-lg font-medium mb-2 text-gray-700">
                    Daily Limits
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        Max Daily Loss ($)
                      </span>
                      <input
                        type="number"
                        name="maxDailyLoss"
                        value={values.maxDailyLoss || ''}
                        onChange={handleChange}
                        required
                        min="0"
                        placeholder="1000"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                      <span className="text-xs text-gray-500 mt-1">
                        Stop trading if daily loss reaches this amount
                      </span>
                    </label>
                    <label className="flex flex-col">
                      <span className="text-sm text-gray-600">
                        Max Daily Profit ($)
                      </span>
                      <input
                        type="number"
                        name="maxDailyProfit"
                        value={values.maxDailyProfit || ''}
                        onChange={handleChange}
                        required
                        min="0"
                        placeholder="2000"
                        className="mt-1 border rounded px-3 py-2 text-gray-800"
                      />
                      <span className="text-xs text-gray-500 mt-1">
                        Stop trading if daily profit reaches this amount
                      </span>
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 mt-6 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Running Backtest...' : 'Run Backtest'}
                </button>

                {/* Error Display */}
                {error && (
                  <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
                    <h4 className="font-semibold">Error:</h4>
                    <p>{error}</p>
                  </div>
                )}
              </form>
            </div>
          </div>
        )}

        {/* Results Section - Full Width */}
        {results && !showForm && (
          <div className="w-full">
            <div className="bg-white p-6 rounded-2xl shadow-lg">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                Backtest Results
              </h2>
              <Stats
                results={results}
                settings={lastRunSettings || undefined}
              />
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-800">Running backtest...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
