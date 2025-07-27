// app/api/backtest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FormProp } from '@/app/types/types';
import { buildParams } from '@/app/_lib/utils';
import { selectCSV } from '@/app/_lib/algo/src/utils';
import { run } from '@/app/_lib/algo/src/main/csvMain';

export async function POST(request: NextRequest) {
  try {
    const formData: FormProp = await request.json();
    const params = buildParams(formData);

    // pick exactly the months we need
    const csvList = selectCSV(
      formData.barType,
      formData.candleType,
      params.start,
      params.end
    );

    const results = await run(csvList, params);
    return NextResponse.json({ success: results });
  } catch (error) {
    console.error('Backtest error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
