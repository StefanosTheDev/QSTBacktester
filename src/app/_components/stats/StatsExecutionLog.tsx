// components/stats/StatsExecutionLog.tsx
import React from 'react';

interface StatsExecutionLogProps {
  logs: string[];
}

export default function StatsExecutionLog({ logs }: StatsExecutionLogProps) {
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-800">Execution Log</h4>
      <div className="max-h-96 overflow-y-auto bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-xs">
        {logs.map((log, index) => (
          <div
            key={index}
            className={`mb-1 ${
              log.includes('🛑') ? 'text-red-400 font-bold' : ''
            } ${
              log.includes('Daily') && log.includes('hit')
                ? 'text-yellow-400'
                : ''
            }`}
          >
            {log}
          </div>
        ))}
      </div>
    </div>
  );
}
