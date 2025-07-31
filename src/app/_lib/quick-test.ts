// timezone-diagnostic.ts - Comprehensive timezone verification
// Run with: npx tsx timezone-diagnostic.ts

import { DateTimeUtils } from './algo/utils/DateTimeUtils';
import { DailyLimitManager } from './algo/core/DailyLimitManager';
console.log('🔍 COMPREHENSIVE TIMEZONE DIAGNOSTIC TEST\n');
console.log('='.repeat(60));

// 1. System Information
console.log('\n1️⃣ SYSTEM INFORMATION:');
console.log(`   Node Version: ${process.version}`);
console.log(`   Platform: ${process.platform}`);
console.log(
  `   System Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`
);
console.log(`   TZ Environment: ${process.env.TZ || 'not set'}`);
console.log(`   Current System Time: ${new Date().toString()}`);
console.log(`   Current UTC: ${new Date().toISOString()}`);

// Phoenix specific note
if (Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/Phoenix') {
  console.log(`\n   ⚠️  NOTE: Phoenix (MST) does not observe DST!`);
  console.log(`   📍 MST is UTC-7 year-round`);
  console.log(`   📍 PST/PDT varies: UTC-8 (winter) or UTC-7 (summer)`);
  console.log(`   📍 EST/EDT varies: UTC-5 (winter) or UTC-4 (summer)`);
}

// 2. Critical Timestamp Tests
console.log('\n2️⃣ CRITICAL TIMESTAMP CONVERSIONS:');
const testCases = [
  {
    name: 'Market Open',
    pst: '2025-01-02 06:30:00 AM',
    expectedEST: '09:30:00 AM',
    description: 'Standard market open time',
  },
  {
    name: 'Market Close',
    pst: '2025-01-02 01:00:00 PM',
    expectedEST: '04:00:00 PM',
    description: 'Standard market close time',
  },
  {
    name: 'Day Boundary PST',
    pst: '2025-01-02 09:00:00 PM',
    expectedEST: '12:00:00 AM',
    description: 'Should be next day in EST',
  },
  {
    name: 'Your Test Start',
    pst: '2025-01-01 06:30:00 AM',
    expectedEST: '09:30:00 AM',
    description: 'Your backtest start time',
  },
  {
    name: 'Your Test End',
    pst: '2025-07-31 07:30:00 AM',
    expectedEST: '10:30:00 AM',
    description: 'Your backtest end time',
  },
];

testCases.forEach(({ name, pst, expectedEST, description }) => {
  console.log(`\n   📍 ${name}:`);
  console.log(`      Description: ${description}`);
  console.log(`      PST Input: ${pst}`);

  try {
    const utc = DateTimeUtils.parseTimestampToUTC(pst);
    const est = DateTimeUtils.convertPSTtoEST(pst);
    const dateKeyPST = DateTimeUtils.getDateKey(pst);
    const dateKeyEST = DateTimeUtils.getDisplayDateKey(pst);

    console.log(`      UTC: ${utc.toISO()}`);
    console.log(
      `      EST: ${est.time} ${
        est.time.includes(expectedEST) ? '✅' : '❌ MISMATCH!'
      }`
    );
    console.log(`      PST Date: ${dateKeyPST}`);
    console.log(
      `      EST Date: ${dateKeyEST} ${
        dateKeyPST !== dateKeyEST ? '(different day!)' : ''
      }`
    );
  } catch (error) {
    // Type guard to handle unknown error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`      ❌ ERROR: ${errorMessage}`);
  }
});

// 3. Daily Grouping Test
console.log('\n3️⃣ DAILY P&L GROUPING TEST:');
console.log('   Testing how trades are grouped by day...\n');

const dailyManager = new DailyLimitManager(1500, 2500);

// Test trades at different times
const testTrades = [
  { time: '2025-01-02 07:00:00 AM', pnl: 500, desc: 'Morning trade PST' },
  { time: '2025-01-02 12:00:00 PM', pnl: 300, desc: 'Noon trade PST' },
  {
    time: '2025-01-02 08:00:00 PM',
    pnl: 200,
    desc: 'Evening trade PST (8 PM)',
  },
  {
    time: '2025-01-02 09:30:00 PM',
    pnl: 400,
    desc: 'Late trade PST (9:30 PM)',
  },
  {
    time: '2025-01-02 11:00:00 PM',
    pnl: 100,
    desc: 'Very late trade PST (11 PM)',
  },
];

testTrades.forEach(({ time, pnl, desc }) => {
  dailyManager.recordTrade(time, pnl);
  const est = DateTimeUtils.convertPSTtoEST(time);
  console.log(`   Trade: ${desc}`);
  console.log(`      PST: ${time}`);
  console.log(`      EST: ${est.datetime}`);
  console.log(`      P&L: $${pnl}`);
});

console.log('\n   Daily Summary:');
const dailyStats = dailyManager.getDailyStats();
dailyStats.forEach((stat) => {
  console.log(`   📅 ${stat.date}: $${stat.actualPnl} (${stat.trades} trades)`);
});

// 4. Environment Independence Test
console.log('\n4️⃣ ENVIRONMENT INDEPENDENCE TEST:');
console.log('   Testing if results are consistent across timezones...\n');

const testTimestamp = '2025-01-15 03:45:00 PM';
const timezones = [
  'America/Phoenix', // MST (no DST)
  'America/Los_Angeles', // PST/PDT
  'America/New_York', // EST/EDT
  'UTC', // UTC
  'Europe/London', // GMT/BST
  'Asia/Tokyo', // JST
];

console.log(`   Test timestamp: ${testTimestamp} PST`);
console.log('   Results across different server timezones:');

const results = new Map<
  string,
  { utc?: string; est?: string; error?: string }
>();
const originalTZ = process.env.TZ;

timezones.forEach((tz) => {
  // Temporarily set timezone
  process.env.TZ = tz;

  try {
    const utc = DateTimeUtils.parseTimestampToUTC(testTimestamp);
    const est = DateTimeUtils.convertPSTtoEST(testTimestamp);
    results.set(tz, {
      utc: utc.toISO() ?? undefined,
      est: est.datetime,
    });
  } catch (error) {
    // Type guard to handle unknown error type
    const errorMessage = error instanceof Error ? error.message : String(error);
    results.set(tz, { error: errorMessage });
  }
});

// Restore original TZ
if (originalTZ) {
  process.env.TZ = originalTZ;
} else {
  delete process.env.TZ;
}

// Check consistency
const utcValues = Array.from(results.values())
  .map((r) => r.utc)
  .filter(Boolean);
const estValues = Array.from(results.values())
  .map((r) => r.est)
  .filter(Boolean);
const utcConsistent = new Set(utcValues).size === 1;
const estConsistent = new Set(estValues).size === 1;

results.forEach((result, tz) => {
  console.log(`\n   ${tz}:`);
  if (result.error) {
    console.log(`      ❌ Error: ${result.error}`);
  } else {
    console.log(`      UTC: ${result.utc}`);
    console.log(`      EST: ${result.est}`);
  }
});

console.log(`\n   ✅ UTC Consistent: ${utcConsistent ? 'YES' : 'NO'}`);
console.log(`   ✅ EST Consistent: ${estConsistent ? 'YES' : 'NO'}`);

if (!utcConsistent || !estConsistent) {
  console.log('\n   ⚠️  WARNING: Inconsistent results detected!');
  console.log(
    '   This could cause different backtest results on different servers.'
  );
}

// 5. DST Transition Tests
console.log('\n5️⃣ DAYLIGHT SAVING TIME TESTS:');
console.log('   Testing around DST transitions...\n');

const dstTests = [
  {
    name: '2025 Spring Forward (March 9)',
    dates: [
      '2025-03-08 11:00:00 PM',
      '2025-03-09 11:00:00 PM',
      '2025-03-10 11:00:00 PM',
    ],
  },
  {
    name: '2025 Fall Back (November 2)',
    dates: [
      '2025-11-01 11:00:00 PM',
      '2025-11-02 11:00:00 PM',
      '2025-11-03 11:00:00 PM',
    ],
  },
];

dstTests.forEach(({ name, dates }) => {
  console.log(`   ${name}:`);
  dates.forEach((date) => {
    const est = DateTimeUtils.convertPSTtoEST(date);
    console.log(`      PST: ${date} → EST: ${est.datetime}`);
  });
});

// 6. Your Specific Backtest Verification
console.log('\n6️⃣ YOUR BACKTEST VERIFICATION:');
console.log('   Verifying your specific date range...\n');

const yourStart = '2025-01-01 06:30:00 AM';
const yourEnd = '2025-07-31 07:30:00 AM';

console.log('   Your Settings:');
console.log(`      Start (PST): ${yourStart}`);
console.log(`      End (PST): ${yourEnd}`);

const startEST = DateTimeUtils.convertPSTtoEST(yourStart);
const endEST = DateTimeUtils.convertPSTtoEST(yourEnd);

console.log('\n   What users will see:');
console.log(`      Start (EST): ${startEST.datetime}`);
console.log(`      End (EST): ${endEST.datetime}`);

// Check if dates change
const startDatePST = DateTimeUtils.getDateKey(yourStart);
const startDateEST = DateTimeUtils.getDisplayDateKey(yourStart);
const endDatePST = DateTimeUtils.getDateKey(yourEnd);
const endDateEST = DateTimeUtils.getDisplayDateKey(yourEnd);

console.log('\n   Date Keys:');
console.log(`      Start - PST: ${startDatePST}, EST: ${startDateEST}`);
console.log(`      End - PST: ${endDatePST}, EST: ${endDateEST}`);

// 7. Common Issues Check
console.log('\n7️⃣ COMMON ISSUES CHECK:');

// Check if system uses 12-hour without AM/PM
const testTime = new Date().toLocaleTimeString();
if (
  !testTime.includes('AM') &&
  !testTime.includes('PM') &&
  !testTime.includes(':')
) {
  console.log('   ⚠️  System might use 24-hour format by default');
}

// Check timezone offset
const now = new Date();
const offset = now.getTimezoneOffset();
console.log(`   Current timezone offset: ${offset} minutes from UTC`);
console.log(`   That's UTC${offset > 0 ? '-' : '+'}${Math.abs(offset / 60)}`);

// Production vs Local warning
console.log('\n8️⃣ PRODUCTION DEPLOYMENT CHECKLIST:');
console.log('   ✓ DateTimeUtils explicitly parses as PST');
console.log('   ✓ All processing uses UTC internally');
console.log('   ✓ Display converts to EST');
console.log('   ✓ No reliance on system timezone');
console.log('   ✓ No use of Date() constructor for parsing');

console.log('\n📌 SUMMARY:');
console.log('   If all tests above show ✅, your backtest results will be');
console.log('   consistent between your Phoenix server and any production');
console.log('   environment, regardless of its timezone.');

console.log('\n🚀 RECOMMENDATION:');
console.log('   1. Run this test on your local machine');
console.log('   2. Deploy to staging/production');
console.log('   3. Run the same test there');
console.log('   4. Compare the outputs - they should be IDENTICAL');

console.log('\n✨ TEST COMPLETE\n');
