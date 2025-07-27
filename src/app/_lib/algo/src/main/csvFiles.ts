// src/app/_lib/utils/csvFiles.ts

export type CandleType = 'traditional' | 'heikinashi';
export type BarType = 'time' | 'tick';
export type MonthKey =
  | '2025-01'
  | '2025-02'
  | '2025-03'
  | '2025-04'
  | '2025-05'
  | '2025-06'
  | '2025-07'
  | '2025-08'
  | '2025-09'
  | '2025-10'
  | '2025-11'
  | '2025-12';

export const csvFiles: Record<
  CandleType,
  Record<BarType, Record<MonthKey, string>>
> = {
  traditional: {
    time: {
      '2025-01': 'mock_2025_01_pst_trad.csv',
      '2025-02': 'mock_2025_02_pst_trad.csv',
      '2025-03': 'mock_2025_03_pst_trad.csv',
      '2025-04': 'mock_2025_04_pst_trad.csv',
      '2025-05': 'mock_2025_05_pst_trad.csv',
      '2025-06': 'mock_2025_06_pst_trad.csv',
      '2025-07': 'mock_2025_07_pst_trad.csv',
      '2025-08': 'mock_2025_08_pst_trad.csv',
      '2025-09': 'mock_2025_09_pst_trad.csv',
      '2025-10': 'mock_2025_10_pst_trad.csv',
      '2025-11': 'mock_2025_11_pst_trad.csv',
      '2025-12': 'mock_2025_12_pst_trad.csv',
    },
    tick: {
      '2025-01': 'mock_2025_01_pst_trad_tick.csv',
      '2025-02': 'mock_2025_02_pst_trad_tick.csv',
      '2025-03': 'mock_2025_03_pst_trad_tick.csv',
      '2025-04': 'mock_2025_04_pst_trad_tick.csv',
      '2025-05': 'mock_2025_05_pst_trad_tick.csv',
      '2025-06': 'mock_2025_06_pst_trad_tick.csv',
      '2025-07': 'mock_2025_07_pst_trad_tick.csv',
      '2025-08': 'mock_2025_08_pst_trad_tick.csv',
      '2025-09': 'mock_2025_09_pst_trad_tick.csv',
      '2025-10': 'mock_2025_10_pst_trad_tick.csv',
      '2025-11': 'mock_2025_11_pst_trad_tick.csv',
      '2025-12': 'mock_2025_12_pst_trad_tick.csv',
    },
  },
  heikinashi: {
    time: {
      '2025-01': 'mock_2025_01_pst_heik.csv',
      '2025-02': 'mock_2025_02_pst_heik.csv',
      '2025-03': 'mock_2025_03_pst_heik.csv',
      '2025-04': 'mock_2025_04_pst_heik.csv',
      '2025-05': 'mock_2025_05_pst_heik.csv',
      '2025-06': 'mock_2025_06_pst_heik.csv',
      '2025-07': 'mock_2025_07_pst_heik.csv',
      '2025-08': 'mock_2025_08_pst_heik.csv',
      '2025-09': 'mock_2025_09_pst_heik.csv',
      '2025-10': 'mock_2025_10_pst_heik.csv',
      '2025-11': 'mock_2025_11_pst_heik.csv',
      '2025-12': 'mock_2025_12_pst_heik.csv',
    },
    tick: {
      '2025-01': 'mock_2025_01_pst_heik_tick.csv',
      '2025-02': 'mock_2025_02_pst_heik_tick.csv',
      '2025-03': 'mock_2025_03_pst_heik_tick.csv',
      '2025-04': 'mock_2025_04_pst_heik_tick.csv',
      '2025-05': 'mock_2025_05_pst_heik_tick.csv',
      '2025-06': 'mock_2025_06_pst_heik_tick.csv',
      '2025-07': 'mock_2025_07_pst_heik_tick.csv',
      '2025-08': 'mock_2025_08_pst_heik_tick.csv',
      '2025-09': 'mock_2025_09_pst_heik_tick.csv',
      '2025-10': 'mock_2025_10_pst_heik_tick.csv',
      '2025-11': 'mock_2025_11_pst_heik_tick.csv',
      '2025-12': 'mock_2025_12_pst_heik_tick.csv',
    },
  },
};
