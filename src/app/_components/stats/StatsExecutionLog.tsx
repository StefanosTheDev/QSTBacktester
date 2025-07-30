// components/stats/StatsExecutionLog.tsx
import React, { useState, useRef, useEffect } from 'react';

interface StatsExecutionLogProps {
  logs: string[];
}

export default function StatsExecutionLog({ logs }: StatsExecutionLogProps) {
  const [filter, setFilter] = useState<
    'all' | 'signals' | 'trades' | 'filters'
  >('all');
  const [searchTerm, setSearchTerm] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogType = (log: string): string => {
    if (log.includes('→ Initial signal:')) return 'signal';
    if (log.includes('✓ Signal validated:')) return 'signal-success';
    if (log.includes('→ filtered')) return 'filter';
    if (log.includes('📈 Entry:') || log.includes('🚪 Exit:')) return 'trade';
    if (log.includes('🔔 Signal generated:')) return 'signal';
    if (log.includes('🛑') || log.includes('⛔')) return 'limit';
    if (log.includes('⚠️')) return 'warning';
    if (log.includes('❌')) return 'error';
    if (log.includes('📊')) return 'info';
    if (log.includes('🔍')) return 'debug';
    if (log.includes('✅')) return 'success';
    if (log.includes('ADX Filter Check:')) return 'indicator';
    if (log.includes('Checking') && log.includes('indicator filter'))
      return 'indicator';
    return 'default';
  };

  const getLogColor = (type: string): string => {
    switch (type) {
      case 'signal':
        return 'text-blue-600';
      case 'signal-success':
        return 'text-green-600 font-bold';
      case 'filter':
        return 'text-orange-600';
      case 'trade':
        return 'text-purple-600 font-bold';
      case 'limit':
        return 'text-red-600 font-bold';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'info':
        return 'text-gray-700';
      case 'debug':
        return 'text-gray-500';
      case 'success':
        return 'text-green-600';
      case 'indicator':
        return 'text-indigo-600';
      default:
        return 'text-green-400';
    }
  };

  const filteredLogs = logs.filter((log) => {
    // Apply text search
    if (searchTerm && !log.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Apply category filter
    if (filter === 'all') return true;

    if (filter === 'signals') {
      return (
        log.includes('→ Initial signal:') ||
        log.includes('✓ Signal validated:') ||
        log.includes('🔔 Signal generated:')
      );
    }

    if (filter === 'trades') {
      return (
        log.includes('📈 Entry:') ||
        log.includes('🚪 Exit:') ||
        log.includes('📊 Trade Details:')
      );
    }

    if (filter === 'filters') {
      return (
        log.includes('→ filtered') ||
        log.includes('→ Checking') ||
        log.includes('✓') ||
        log.includes('✗')
      );
    }

    return true;
  });

  const downloadLogs = () => {
    const logContent = logs.join('\n');
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `execution-log-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const copyToClipboard = () => {
    const logContent = logs.join('\n');
    navigator.clipboard.writeText(logContent);
    alert('Logs copied to clipboard!');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-gray-800">
          Execution Log ({logs.length} entries)
        </h4>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
          >
            Copy to Clipboard
          </button>
          <button
            onClick={downloadLogs}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            Download Log
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('signals')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'signals'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Signals
          </button>
          <button
            onClick={() => setFilter('trades')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'trades'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Trades
          </button>
          <button
            onClick={() => setFilter('filters')}
            className={`px-3 py-1 rounded text-sm ${
              filter === 'filters'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Filters
          </button>
        </div>

        <input
          type="text"
          placeholder="Search logs..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="px-3 py-1 border rounded-lg text-sm flex-1 max-w-xs"
        />

        <span className="text-sm text-gray-500">
          Showing {filteredLogs.length} of {logs.length} logs
        </span>
      </div>

      {/* Log Display */}
      <div
        ref={logContainerRef}
        className="max-h-96 overflow-y-auto bg-gray-900 p-4 rounded-lg font-mono text-xs"
      >
        {filteredLogs.map((log, index) => {
          const logType = getLogType(log);
          const logColor = getLogColor(logType);

          // Format the log for better readability
          const formattedLog = log
            .replace(/→/g, '➜')
            .replace(/✓/g, '✅')
            .replace(/✗/g, '❌');

          return (
            <div
              key={index}
              className={`mb-1 ${logColor} ${
                logType === 'trade' || logType === 'signal-success'
                  ? 'mt-2 mb-2 py-1 border-l-4 border-green-500 pl-2'
                  : ''
              }`}
            >
              {/* Add timestamp if this is a significant event */}
              {(logType === 'trade' || logType === 'signal-success') && (
                <span className="text-gray-500 text-xs mr-2">
                  [{new Date().toLocaleTimeString()}]
                </span>
              )}

              {/* Highlight important parts */}
              <span
                dangerouslySetInnerHTML={{
                  __html: formattedLog
                    .replace(
                      /(\$[\d,.-]+)/g,
                      '<span class="font-bold">$1</span>'
                    )
                    .replace(
                      /(LONG|SHORT)/g,
                      '<span class="font-bold">$1</span>'
                    )
                    .replace(
                      /(\d+\.\d+ points)/g,
                      '<span class="font-bold">$1</span>'
                    ),
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Log Statistics */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 p-3 rounded">
          <div className="text-gray-600">Total Signals</div>
          <div className="text-xl font-bold text-blue-600">
            {logs.filter((l) => l.includes('→ Initial signal:')).length}
          </div>
        </div>
        <div className="bg-green-50 p-3 rounded">
          <div className="text-gray-600">Validated Signals</div>
          <div className="text-xl font-bold text-green-600">
            {logs.filter((l) => l.includes('✓ Signal validated:')).length}
          </div>
        </div>
        <div className="bg-orange-50 p-3 rounded">
          <div className="text-gray-600">Filtered Signals</div>
          <div className="text-xl font-bold text-orange-600">
            {logs.filter((l) => l.includes('→ filtered')).length}
          </div>
        </div>
        <div className="bg-purple-50 p-3 rounded">
          <div className="text-gray-600">Total Trades</div>
          <div className="text-xl font-bold text-purple-600">
            {logs.filter((l) => l.includes('📈 Entry:')).length}
          </div>
        </div>
      </div>
    </div>
  );
}
