// src/app/_lib/models/Bookmark.ts
import mongoose from 'mongoose';

const BookmarkSchema = new mongoose.Schema(
  {
    // Trade details
    entryDate: { type: String, required: true },
    entryTime: { type: String, required: true },
    entryPrice: { type: Number, required: true },
    exitDate: { type: String, required: true },
    exitTime: { type: String, required: true },
    exitPrice: { type: Number, required: true },
    type: { type: String, enum: ['LONG', 'SHORT'], required: true },
    contracts: { type: Number, required: true },
    stopLoss: { type: Number, required: true },
    takeProfit: { type: Number, required: true },
    exitReason: { type: String, required: true },
    profitLoss: { type: Number, required: true },
    commission: { type: Number, required: true },
    netProfitLoss: { type: Number, required: true },

    // Bookmark specific fields
    bookmarkedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '' },
    tags: [{ type: String }],

    // User field (for future multi-user support)
    userId: { type: String, default: 'default' },
  },
  {
    timestamps: true,
  }
);

// Create indexes for better query performance
BookmarkSchema.index({ userId: 1, bookmarkedAt: -1 });
BookmarkSchema.index({ netProfitLoss: -1 });
BookmarkSchema.index({ type: 1 });

export default mongoose.models.Bookmark ||
  mongoose.model('Bookmark', BookmarkSchema);
