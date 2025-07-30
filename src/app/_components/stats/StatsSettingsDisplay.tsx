// components/stats/StatsSettingsDisplay.tsx
import React from 'react';

interface SettingsDisplayProps {
  settings: {
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    barType: string;
    barSize: number;
    candleType: string;
    cvdLookBackBars?: number;
    emaMovingAverage?: number;
    smaFilter?: number;
    useVWAP?: boolean;
    adxThreshold?: number;
    adxPeriod?: number;
    contractSize: number;
    stopLoss: number;
    takeProfit: number;
    maxDailyLoss?: number;
    maxDailyProfit?: number;
    useTrailingStop?: boolean;
    breakevenTrigger?: number;
    trailDistance?: number;
  };
}

export default function StatsSettingsDisplay({
  settings,
}: SettingsDisplayProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Count active filters
  const activeFilters = [
    settings.emaMovingAverage && settings.emaMovingAverage > 0,
    settings.smaFilter && settings.smaFilter > 0,
    settings.useVWAP,
    settings.adxThreshold && settings.adxThreshold > 0,
  ].filter(Boolean).length;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
      <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
        <svg
          className="w-5 h-5 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Trading Settings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Time Range */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Time Range
          </h4>
          <div className="space-y-1">
            <div className="text-sm">
              <span className="text-gray-600">Start:</span>{' '}
              <span className="font-medium">
                {formatDate(settings.startDate)} {settings.startTime}
              </span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">End:</span>{' '}
              <span className="font-medium">
                {formatDate(settings.endDate)} {settings.endTime}
              </span>
            </div>
          </div>
        </div>

        {/* Bar Settings */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Bar Settings
          </h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-600">Type:</span>{' '}
              <span className="font-medium capitalize">
                {settings.barType} Bars
              </span>
            </div>
            <div>
              <span className="text-gray-600">Size:</span>{' '}
              <span className="font-medium">
                {settings.barSize}{' '}
                {settings.barType === 'time' ? 'min' : 'ticks'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Candles:</span>{' '}
              <span className="font-medium capitalize">
                {settings.candleType}
              </span>
            </div>
            <div>
              <span className="text-gray-600">CVD Lookback:</span>{' '}
              <span className="font-medium">
                {settings.cvdLookBackBars || 5} bars
              </span>
            </div>
          </div>
        </div>

        {/* Indicators - UPDATED */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Indicators ({activeFilters} active)
          </h4>
          <div className="space-y-1 text-sm">
            {/* EMA */}
            <div
              className={
                settings.emaMovingAverage && settings.emaMovingAverage > 0
                  ? ''
                  : 'opacity-50'
              }
            >
              <span className="text-gray-600">EMA:</span>{' '}
              <span className="font-medium">
                {settings.emaMovingAverage && settings.emaMovingAverage > 0
                  ? `${settings.emaMovingAverage} period`
                  : 'Disabled'}
              </span>
            </div>

            {/* SMA */}
            <div
              className={
                settings.smaFilter && settings.smaFilter > 0 ? '' : 'opacity-50'
              }
            >
              <span className="text-gray-600">SMA:</span>{' '}
              <span className="font-medium">
                {settings.smaFilter && settings.smaFilter > 0
                  ? `${settings.smaFilter} period`
                  : 'Disabled'}
              </span>
            </div>

            {/* VWAP */}
            <div className={settings.useVWAP ? '' : 'opacity-50'}>
              <span className="text-gray-600">VWAP:</span>{' '}
              <span
                className={`font-medium ${
                  settings.useVWAP ? 'text-green-600' : ''
                }`}
              >
                {settings.useVWAP ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* ADX */}
            <div
              className={
                settings.adxThreshold && settings.adxThreshold > 0
                  ? ''
                  : 'opacity-50'
              }
            >
              <span className="text-gray-600">ADX:</span>{' '}
              <span className="font-medium">
                {settings.adxThreshold && settings.adxThreshold > 0
                  ? `> ${settings.adxThreshold} (Period 14)`
                  : 'Disabled'}
              </span>
            </div>
          </div>
        </div>

        {/* Risk Management */}
        <div className="bg-white p-4 rounded-lg">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Risk Management
          </h4>
          <div className="space-y-1 text-sm">
            <div>
              <span className="text-gray-600">Contracts:</span>{' '}
              <span className="font-medium">{settings.contractSize}</span>
            </div>
            <div>
              <span className="text-gray-600">Stop Loss:</span>{' '}
              <span className="font-medium text-red-600">
                {settings.stopLoss} pts
              </span>
            </div>
            <div>
              <span className="text-gray-600">Take Profit:</span>{' '}
              <span className="font-medium text-green-600">
                {settings.takeProfit} pts
              </span>
            </div>
            {settings.useTrailingStop && (
              <div>
                <span className="text-gray-600">Trailing:</span>{' '}
                <span className="font-medium text-blue-600">Enabled</span>
              </div>
            )}
          </div>
        </div>

        {/* Daily Limits */}
        {(settings.maxDailyLoss || settings.maxDailyProfit) && (
          <div className="bg-white p-4 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Daily Limits
            </h4>
            <div className="space-y-1 text-sm">
              {settings.maxDailyLoss && (
                <div>
                  <span className="text-gray-600">Max Loss:</span>{' '}
                  <span className="font-medium text-red-600">
                    ${settings.maxDailyLoss.toLocaleString()}
                  </span>
                </div>
              )}
              {settings.maxDailyProfit && (
                <div>
                  <span className="text-gray-600">Max Profit:</span>{' '}
                  <span className="font-medium text-green-600">
                    ${settings.maxDailyProfit.toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trailing Stop Details - Only show if enabled */}
        {settings.useTrailingStop && (
          <div className="bg-white p-4 rounded-lg">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Trailing Stop Details
            </h4>
            <div className="space-y-1 text-sm">
              <div>
                <span className="text-gray-600">BE Trigger:</span>{' '}
                <span className="font-medium">
                  {settings.breakevenTrigger || 3} pts
                </span>
              </div>
              <div>
                <span className="text-gray-600">Trail Distance:</span>{' '}
                <span className="font-medium">
                  {settings.trailDistance || 2} pts
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Summary - NEW */}
      {activeFilters > 0 && (
        <div className="mt-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">📊 Filter Logic:</span> With{' '}
            {activeFilters} indicator{activeFilters > 1 ? 's' : ''} active, ALL
            must agree for trades. LONG trades require price above all
            indicators, SHORT trades require price below all indicators.
          </p>
        </div>
      )}
    </div>
  );
}
