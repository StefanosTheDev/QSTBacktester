// // src/app/api/bookmarks/route.ts
// import { NextRequest, NextResponse } from 'next/server';
// import clientPromise from '@/app/_lib/db/mongodb';
// import { ObjectId } from 'mongodb';

// // GET all bookmarks
// export async function GET(request: NextRequest) {
//   try {
//     const client = await clientPromise;
//     const db = client.db('trading-backtester');

//     const bookmarks = await db
//       .collection('bookmarks')
//       .find({ userId: 'default' })
//       .sort({ bookmarkedAt: -1 })
//       .toArray();

//     return NextResponse.json({ success: true, bookmarks });
//   } catch (error) {
//     console.error('Error fetching bookmarks:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to fetch bookmarks' },
//       { status: 500 }
//     );
//   }
// }

// // POST new bookmark
// export async function POST(request: NextRequest) {
//   try {
//     const body = await request.json();
//     const client = await clientPromise;
//     const db = client.db('trading-backtester');

//     const bookmark = {
//       ...body,
//       userId: 'default',
//       bookmarkedAt: new Date(),
//       createdAt: new Date(),
//       updatedAt: new Date(),
//     };

//     const result = await db.collection('bookmarks').insertOne(bookmark);

//     return NextResponse.json({
//       success: true,
//       bookmark: { ...bookmark, _id: result.insertedId },
//     });
//   } catch (error) {
//     console.error('Error creating bookmark:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to create bookmark' },
//       { status: 500 }
//     );
//   }
// }

// // DELETE bookmark
// export async function DELETE(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const id = searchParams.get('id');

//     if (!id) {
//       return NextResponse.json(
//         { success: false, error: 'ID is required' },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db('trading-backtester');

//     const result = await db.collection('bookmarks').deleteOne({
//       _id: new ObjectId(id),
//     });

//     if (result.deletedCount === 0) {
//       return NextResponse.json(
//         { success: false, error: 'Bookmark not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error('Error deleting bookmark:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to delete bookmark' },
//       { status: 500 }
//     );
//   }
// }

// // PATCH update bookmark (for notes/tags)
// export async function PATCH(request: NextRequest) {
//   try {
//     const { searchParams } = new URL(request.url);
//     const id = searchParams.get('id');
//     const body = await request.json();

//     if (!id) {
//       return NextResponse.json(
//         { success: false, error: 'ID is required' },
//         { status: 400 }
//       );
//     }

//     const client = await clientPromise;
//     const db = client.db('trading-backtester');

//     const updateData = {
//       ...body,
//       updatedAt: new Date(),
//     };

//     const result = await db
//       .collection('bookmarks')
//       .updateOne({ _id: new ObjectId(id) }, { $set: updateData });

//     if (result.matchedCount === 0) {
//       return NextResponse.json(
//         { success: false, error: 'Bookmark not found' },
//         { status: 404 }
//       );
//     }

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error('Error updating bookmark:', error);
//     return NextResponse.json(
//       { success: false, error: 'Failed to update bookmark' },
//       { status: 500 }
//     );
//   }
// }
