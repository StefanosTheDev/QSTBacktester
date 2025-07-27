// components/stats/StatsTradeDetails.tsx
import React from 'react';

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

interface StatsTradeDetailsProps {
  trades: TradeRecord[];
}

export default function StatsTradeDetails({ trades }: StatsTradeDetailsProps) {
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);

  const exportTradesToCSV = () => {
    const headers = [
      'Entry Date',
      'Entry Time',
      'Entry Price',
      'Exit Date',
      'Exit Time',
      'Exit Price',
      'Type',
      'Contracts',
      'Stop Loss',
      'Take Profit',
      'Exit Reason',
      'P&L',
      'Commission',
      'Net P&L',
    ];

    const csvContent = [
      headers.join(','),
      ...trades.map((trade) =>
        [
          trade.entryDate,
          trade.entryTime,
          trade.entryPrice,
          trade.exitDate,
          trade.exitTime,
          trade.exitPrice,
          trade.type,
          trade.contracts,
          trade.stopLoss,
          trade.takeProfit,
          trade.exitReason,
          trade.profitLoss,
          trade.commission,
          trade.netProfitLoss,
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-gray-800">
          Trade Details ({trades.length} trades)
        </h4>
        {trades.length > 0 && (
          <button
            onClick={exportTradesToCSV}
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            Export to CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <div className="max-h-96 overflow-y-auto bg-gray-50 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium text-gray-700">#</th>
                <th className="text-left p-2 font-medium text-gray-700">
                  Entry
                </th>
                <th className="text-left p-2 font-medium text-gray-700">
                  Exit
                </th>
                <th className="text-center p-2 font-medium text-gray-700">
                  Type
                </th>
                <th className="text-right p-2 font-medium text-gray-700">
                  Entry $
                </th>
                <th className="text-right p-2 font-medium text-gray-700">
                  Exit $
                </th>
                <th className="text-center p-2 font-medium text-gray-700">
                  Reason
                </th>
                <th className="text-right p-2 font-medium text-gray-700">
                  Net P&L
                </th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade, index) => (
                <tr
                  key={index}
                  className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                    trade.exitReason.includes('Daily') ? 'font-semibold' : ''
                  }`}
                >
                  <td className="p-2 text-gray-800">{index + 1}</td>
                  <td className="p-2 text-gray-800">
                    {trade.entryDate} {trade.entryTime}
                  </td>
                  <td className="p-2 text-gray-800">
                    {trade.exitDate} {trade.exitTime}
                  </td>
                  <td
                    className={`p-2 text-center font-medium ${
                      trade.type === 'LONG' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {trade.type}
                  </td>
                  <td className="p-2 text-right">
                    {trade.entryPrice.toFixed(2)}
                  </td>
                  <td className="p-2 text-right">
                    {trade.exitPrice.toFixed(2)}
                  </td>
                  <td className="p-2 text-center text-gray-600 text-xs">
                    {trade.exitReason}
                  </td>
                  <td
                    className={`p-2 text-right font-medium ${
                      trade.netProfitLoss >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(trade.netProfitLoss)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
