// // app/bookmarks/page.tsx
// 'use client';
// import React, { useState, useEffect } from 'react';
// import Link from 'next/link';

// interface BookmarkedTrade {
//   _id: string;
//   entryDate: string;
//   entryTime: string;
//   entryPrice: number;
//   exitDate: string;
//   exitTime: string;
//   exitPrice: number;
//   type: 'LONG' | 'SHORT';
//   contracts: number;
//   stopLoss: number;
//   takeProfit: number;
//   exitReason: string;
//   profitLoss: number;
//   commission: number;
//   netProfitLoss: number;
//   bookmarkedAt: string;
//   notes?: string;
//   tags?: string[];
// }

// export default function BookmarksPage() {
//   const [bookmarks, setBookmarks] = useState<BookmarkedTrade[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [editingNote, setEditingNote] = useState<string | null>(null);
//   const [noteText, setNoteText] = useState('');
//   const [sortBy, setSortBy] = useState<'date' | 'profit'>('date');
//   const [filterType, setFilterType] = useState<'all' | 'winning' | 'losing'>(
//     'all'
//   );

//   useEffect(() => {
//     loadBookmarks();
//   }, []);

//   const loadBookmarks = async () => {
//     try {
//       const res = await fetch('/api/bookmarks');
//       const data = await res.json();
//       if (data.success) {
//         setBookmarks(data.bookmarks);
//       }
//     } catch (error) {
//       console.error('Error loading bookmarks:', error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const formatCurrency = (amount: number) =>
//     new Intl.NumberFormat('en-US', {
//       style: 'currency',
//       currency: 'USD',
//     }).format(amount);

//   const removeBookmark = async (id: string) => {
//     try {
//       const res = await fetch(`/api/bookmarks?id=${id}`, {
//         method: 'DELETE',
//       });

//       if (res.ok) {
//         setBookmarks((prev) => prev.filter((b) => b._id !== id));
//       }
//     } catch (error) {
//       console.error('Error removing bookmark:', error);
//     }
//   };

//   const updateNote = async (id: string) => {
//     try {
//       const res = await fetch(`/api/bookmarks?id=${id}`, {
//         method: 'PATCH',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ notes: noteText }),
//       });

//       if (res.ok) {
//         setBookmarks((prev) =>
//           prev.map((b) => (b._id === id ? { ...b, notes: noteText } : b))
//         );
//         setEditingNote(null);
//         setNoteText('');
//       }
//     } catch (error) {
//       console.error('Error updating note:', error);
//     }
//   };

//   const exportBookmarks = () => {
//     const dataStr = JSON.stringify(bookmarks, null, 2);
//     const dataUri =
//       'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
//     const exportFileDefaultName = `bookmarked-trades-${
//       new Date().toISOString().split('T')[0]
//     }.json`;

//     const linkElement = document.createElement('a');
//     linkElement.setAttribute('href', dataUri);
//     linkElement.setAttribute('download', exportFileDefaultName);
//     linkElement.click();
//   };

//   // Filter bookmarks
//   const filteredBookmarks = bookmarks.filter((b) => {
//     if (filterType === 'winning') return b.netProfitLoss > 0;
//     if (filterType === 'losing') return b.netProfitLoss < 0;
//     return true;
//   });

//   // Sort bookmarks
//   const sortedBookmarks = [...filteredBookmarks].sort((a, b) => {
//     if (sortBy === 'profit') {
//       return b.netProfitLoss - a.netProfitLoss;
//     }
//     return (
//       new Date(b.bookmarkedAt).getTime() - new Date(a.bookmarkedAt).getTime()
//     );
//   });

//   // Calculate stats
//   const stats = {
//     total: bookmarks.length,
//     winning: bookmarks.filter((b) => b.netProfitLoss > 0).length,
//     losing: bookmarks.filter((b) => b.netProfitLoss < 0).length,
//     totalProfit: bookmarks.reduce((sum, b) => sum + b.netProfitLoss, 0),
//     avgProfit:
//       bookmarks.length > 0
//         ? bookmarks.reduce((sum, b) => sum + b.netProfitLoss, 0) /
//           bookmarks.length
//         : 0,
//     bestTrade:
//       bookmarks.length > 0
//         ? Math.max(...bookmarks.map((b) => b.netProfitLoss))
//         : 0,
//   };

//   if (loading) {
//     return (
//       <div className="min-h-screen bg-gray-50 py-10">
//         <div className="max-w-7xl mx-auto px-4">
//           <div className="flex items-center justify-center h-64">
//             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
//           </div>
//         </div>
//       </div>
//     );
//   }

//   return (
//     <div className="min-h-screen bg-gray-50 py-10">
//       <div className="max-w-7xl mx-auto px-4">
//         {/* Header */}
//         <div className="mb-8">
//           <div className="flex justify-between items-center mb-4">
//             <h1 className="text-3xl font-bold text-gray-800">
//               Bookmarked Trades
//             </h1>
//             <Link
//               href="/"
//               className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
//             >
//               Back to Backtester
//             </Link>
//           </div>

//           {/* Stats Cards */}
//           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
//             <div className="bg-white p-4 rounded-lg shadow">
//               <div className="text-sm text-gray-600">Total Bookmarks</div>
//               <div className="text-2xl font-bold">{stats.total}</div>
//             </div>
//             <div className="bg-green-50 p-4 rounded-lg shadow">
//               <div className="text-sm text-gray-600">Winning Trades</div>
//               <div className="text-2xl font-bold text-green-600">
//                 {stats.winning}
//               </div>
//             </div>
//             <div className="bg-red-50 p-4 rounded-lg shadow">
//               <div className="text-sm text-gray-600">Losing Trades</div>
//               <div className="text-2xl font-bold text-red-600">
//                 {stats.losing}
//               </div>
//             </div>
//             <div className="bg-blue-50 p-4 rounded-lg shadow">
//               <div className="text-sm text-gray-600">Total P&L</div>
//               <div
//                 className={`text-2xl font-bold ${
//                   stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
//                 }`}
//               >
//                 {formatCurrency(stats.totalProfit)}
//               </div>
//             </div>
//             <div className="bg-purple-50 p-4 rounded-lg shadow">
//               <div className="text-sm text-gray-600">Avg P&L</div>
//               <div
//                 className={`text-2xl font-bold ${
//                   stats.avgProfit >= 0 ? 'text-green-600' : 'text-red-600'
//                 }`}
//               >
//                 {formatCurrency(stats.avgProfit)}
//               </div>
//             </div>
//             <div className="bg-yellow-50 p-4 rounded-lg shadow">
//               <div className="text-sm text-gray-600">Best Trade</div>
//               <div className="text-2xl font-bold text-green-600">
//                 {formatCurrency(stats.bestTrade)}
//               </div>
//             </div>
//           </div>

//           {/* Controls */}
//           <div className="flex flex-wrap gap-4 items-center">
//             <div className="flex gap-2">
//               <button
//                 onClick={() => setFilterType('all')}
//                 className={`px-4 py-2 rounded ${
//                   filterType === 'all'
//                     ? 'bg-blue-600 text-white'
//                     : 'bg-white text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 All ({stats.total})
//               </button>
//               <button
//                 onClick={() => setFilterType('winning')}
//                 className={`px-4 py-2 rounded ${
//                   filterType === 'winning'
//                     ? 'bg-green-600 text-white'
//                     : 'bg-white text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Winning ({stats.winning})
//               </button>
//               <button
//                 onClick={() => setFilterType('losing')}
//                 className={`px-4 py-2 rounded ${
//                   filterType === 'losing'
//                     ? 'bg-red-600 text-white'
//                     : 'bg-white text-gray-700 hover:bg-gray-100'
//                 }`}
//               >
//                 Losing ({stats.losing})
//               </button>
//             </div>

//             <select
//               value={sortBy}
//               onChange={(e) => setSortBy(e.target.value as 'date' | 'profit')}
//               className="px-4 py-2 border rounded"
//             >
//               <option value="date">Sort by Date</option>
//               <option value="profit">Sort by Profit</option>
//             </select>

//             {bookmarks.length > 0 && (
//               <button
//                 onClick={exportBookmarks}
//                 className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
//               >
//                 Export JSON
//               </button>
//             )}
//           </div>
//         </div>

//         {/* Bookmarks Table */}
//         {sortedBookmarks.length === 0 ? (
//           <div className="bg-white p-12 rounded-lg shadow text-center">
//             <svg
//               className="w-24 h-24 mx-auto mb-4 text-gray-300"
//               fill="currentColor"
//               viewBox="0 0 20 20"
//             >
//               <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
//             </svg>
//             <h3 className="text-xl font-medium text-gray-600 mb-2">
//               No bookmarked trades yet
//             </h3>
//             <p className="text-gray-500">
//               Star your best trades to save them here!
//             </p>
//           </div>
//         ) : (
//           <div className="bg-white rounded-lg shadow overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gray-100">
//                   <tr>
//                     <th className="text-left p-3 font-medium text-gray-700">
//                       Date
//                     </th>
//                     <th className="text-center p-3 font-medium text-gray-700">
//                       Type
//                     </th>
//                     <th className="text-right p-3 font-medium text-gray-700">
//                       Entry
//                     </th>
//                     <th className="text-right p-3 font-medium text-gray-700">
//                       Exit
//                     </th>
//                     <th className="text-right p-3 font-medium text-gray-700">
//                       Points
//                     </th>
//                     <th className="text-right p-3 font-medium text-gray-700">
//                       Net P&L
//                     </th>
//                     <th className="text-center p-3 font-medium text-gray-700">
//                       Exit Reason
//                     </th>
//                     <th className="text-center p-3 font-medium text-gray-700">
//                       Notes
//                     </th>
//                     <th className="text-center p-3 font-medium text-gray-700">
//                       Actions
//                     </th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {sortedBookmarks.map((bookmark) => {
//                     const points =
//                       bookmark.type === 'LONG'
//                         ? bookmark.exitPrice - bookmark.entryPrice
//                         : bookmark.entryPrice - bookmark.exitPrice;

//                     return (
//                       <tr
//                         key={bookmark._id}
//                         className="border-t hover:bg-gray-50"
//                       >
//                         <td className="p-3">
//                           <div className="text-sm">
//                             <div className="font-medium">
//                               {bookmark.entryDate}
//                             </div>
//                             <div className="text-gray-500">
//                               {bookmark.entryTime}
//                             </div>
//                           </div>
//                         </td>
//                         <td className="text-center p-3">
//                           <span
//                             className={`px-2 py-1 rounded text-xs font-medium ${
//                               bookmark.type === 'LONG'
//                                 ? 'bg-green-100 text-green-800'
//                                 : 'bg-red-100 text-red-800'
//                             }`}
//                           >
//                             {bookmark.type}
//                           </span>
//                         </td>
//                         <td className="text-right p-3 font-medium">
//                           ${bookmark.entryPrice.toFixed(2)}
//                         </td>
//                         <td className="text-right p-3 font-medium">
//                           ${bookmark.exitPrice.toFixed(2)}
//                         </td>
//                         <td
//                           className={`text-right p-3 font-medium ${
//                             points >= 0 ? 'text-green-600' : 'text-red-600'
//                           }`}
//                         >
//                           {points >= 0 ? '+' : ''}
//                           {points.toFixed(2)}
//                         </td>
//                         <td
//                           className={`text-right p-3 font-bold ${
//                             bookmark.netProfitLoss >= 0
//                               ? 'text-green-600'
//                               : 'text-red-600'
//                           }`}
//                         >
//                           {formatCurrency(bookmark.netProfitLoss)}
//                         </td>
//                         <td className="text-center p-3 text-sm">
//                           {bookmark.exitReason}
//                         </td>
//                         <td className="text-center p-3">
//                           {editingNote === bookmark._id ? (
//                             <div className="flex gap-1">
//                               <input
//                                 type="text"
//                                 value={noteText}
//                                 onChange={(e) => setNoteText(e.target.value)}
//                                 className="px-2 py-1 border rounded text-sm"
//                                 placeholder="Add note..."
//                                 onKeyPress={(e) => {
//                                   if (e.key === 'Enter') {
//                                     updateNote(bookmark._id);
//                                   }
//                                 }}
//                               />
//                               <button
//                                 onClick={() => updateNote(bookmark._id)}
//                                 className="px-2 py-1 bg-green-600 text-white rounded text-xs"
//                               >
//                                 Save
//                               </button>
//                               <button
//                                 onClick={() => {
//                                   setEditingNote(null);
//                                   setNoteText('');
//                                 }}
//                                 className="px-2 py-1 bg-gray-600 text-white rounded text-xs"
//                               >
//                                 Cancel
//                               </button>
//                             </div>
//                           ) : (
//                             <div
//                               onClick={() => {
//                                 setEditingNote(bookmark._id);
//                                 setNoteText(bookmark.notes || '');
//                               }}
//                               className="cursor-pointer hover:bg-gray-100 p-1 rounded"
//                             >
//                               {bookmark.notes ? (
//                                 <span className="text-sm">
//                                   {bookmark.notes}
//                                 </span>
//                               ) : (
//                                 <span className="text-sm text-gray-400">
//                                   Click to add note
//                                 </span>
//                               )}
//                             </div>
//                           )}
//                         </td>
//                         <td className="text-center p-3">
//                           <button
//                             onClick={() => removeBookmark(bookmark._id)}
//                             className="text-red-600 hover:text-red-800"
//                             title="Remove bookmark"
//                           >
//                             <svg
//                               className="w-5 h-5"
//                               fill="none"
//                               stroke="currentColor"
//                               viewBox="0 0 24 24"
//                             >
//                               <path
//                                 strokeLinecap="round"
//                                 strokeLinejoin="round"
//                                 strokeWidth={2}
//                                 d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
//                               />
//                             </svg>
//                           </button>
//                         </td>
//                       </tr>
//                     );
//                   })}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
