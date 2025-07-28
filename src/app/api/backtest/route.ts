// app/api/backtest/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FormProp } from '@/app/types/types';
import { buildParams } from '@/app/_lib/utils';
import { selectCSV } from '@/app/_lib/algo/analysis/Calculations';
import { runBacktest } from '@/app/_lib/algo/backtest/runBacktest';
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

    const results = await runBacktest(csvList, params);
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
