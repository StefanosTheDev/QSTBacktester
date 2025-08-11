#!/usr/bin/env node

/**
 * FULL GENETIC ALGORITHM OPTIMIZER
 *
 * Production-ready genetic optimizer for CVD strategy
 * Place this file in your project root and run with: npx ts-node geneticOptimizer.ts
 */

import { ApiParams } from './types/types';
import { runBacktest } from './backtest/runBacktest';
import { selectCSV } from './analysis/Calculations';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';
import * as os from 'os';

// ==================== CONFIGURATION ====================
const CONFIG = {
  // Genetic Algorithm Settings
  POPULATION_SIZE: 100,
  GENERATIONS: 50,
  MUTATION_RATE: 0.15,
  CROSSOVER_RATE: 0.7,
  ELITISM_COUNT: 10,
  TOURNAMENT_SIZE: 5,

  // Parallel Processing
  MAX_WORKERS: Math.max(1, os.cpus().length - 1),

  // Output
  OUTPUT_DIR: './genetic_optimization_results',
  CHECKPOINT_INTERVAL: 5,

  // Backtest Period
  START_DATE: '2025-01-01',
  END_DATE: '2025-03-31', // 3 months

  // Constraints
  MIN_TRADES_FOR_VALIDITY: 20,
  MAX_ACCEPTABLE_DRAWDOWN: 30, // %
  MIN_ACCEPTABLE_WIN_RATE: 35, // %

  // Parameter Ranges
  PARAMS: {
    cvdLookback: { min: 3, max: 15, step: 1 },
    stopLoss: { min: 4, max: 15, step: 0.5 },
    takeProfit: { min: 4, max: 15, step: 0.5 },
    emaFilter: { values: [0, 8, 9, 13, 21, 50] },
    adxThreshold: { values: [0, 15, 20, 25, 30, 35] },
    smaFilter: { values: [0, 50, 100, 200] },
    useVWAP: [true, false],
    timeWindows: [
      { name: 'EarlyMorning', start: '06:30', end: '08:00' },
      { name: 'Morning', start: '06:30', end: '10:00' },
      { name: 'MidDay', start: '08:00', end: '11:00' },
      { name: 'LateDay', start: '10:00', end: '13:00' },
      { name: 'FullDay', start: '06:30', end: '13:00' },
    ],
    useTrailingStop: [true, false],
    tradeDirection: ['both', 'long', 'short'] as ('both' | 'long' | 'short')[],
  },
};

// ==================== TYPES ====================
interface Chromosome {
  id: string;
  cvdLookback: number;
  stopLoss: number;
  takeProfit: number;
  emaFilter: number;
  adxThreshold: number;
  smaFilter: number;
  useVWAP: boolean;
  timeWindow: (typeof CONFIG.PARAMS.timeWindows)[number];
  useTrailingStop: boolean;
  tradeDirection: 'both' | 'long' | 'short';

  // Results
  fitness?: number;
  results?: BacktestResult;
  evaluatedAt?: Date;
}

interface BacktestResult {
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnL: number;
  sharpeRatio: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  longWinRate?: number;
  shortWinRate?: number;
  totalBars: number;
  daysTraded: number;
  avgTradesPerDay: number;
}

interface GenerationStats {
  generation: number;
  bestFitness: number;
  avgFitness: number;
  stdDevFitness: number;
  bestChromosome: Chromosome;
  top10Avg: number;
  convergence: number;
  diversityScore: number;
  timestamp: Date;
}

// ==================== GENETIC ALGORITHM ====================
class GeneticOptimizer {
  private population: Chromosome[] = [];
  private generation = 0;
  private history: GenerationStats[] = [];
  private evaluationCache = new Map<string, BacktestResult>();
  private totalBacktests = 0;
  private cacheHits = 0;

  constructor() {
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory() {
    if (!fs.existsSync(CONFIG.OUTPUT_DIR)) {
      fs.mkdirSync(CONFIG.OUTPUT_DIR, { recursive: true });
    }
  }

  // Generate unique ID for chromosome
  private getChromosomeId(c: Chromosome): string {
    return `${c.cvdLookback}-${c.stopLoss}-${c.takeProfit}-${c.emaFilter}-${c.adxThreshold}-${c.smaFilter}-${c.useVWAP}-${c.timeWindow.name}-${c.useTrailingStop}-${c.tradeDirection}`;
  }

  // Initialize population with diverse strategies
  initializePopulation(): void {
    console.log('🧬 Initializing diverse population...');

    // Add some known good configurations
    const seedConfigs = [
      { cvdLookback: 5, stopLoss: 10, takeProfit: 20, rrRatio: '1:2' },
      { cvdLookback: 8, stopLoss: 8, takeProfit: 12, rrRatio: '1:1.5' },
      { cvdLookback: 3, stopLoss: 12, takeProfit: 24, rrRatio: '1:2' },
    ];

    // Create seed chromosomes
    seedConfigs.forEach((config) => {
      const chromosome = this.createChromosome();
      chromosome.cvdLookback = config.cvdLookback;
      chromosome.stopLoss = config.stopLoss;
      chromosome.takeProfit = config.takeProfit;
      this.population.push(chromosome);
    });

    // Fill rest with random
    while (this.population.length < CONFIG.POPULATION_SIZE) {
      this.population.push(this.createRandomChromosome());
    }

    console.log(
      `✅ Created ${CONFIG.POPULATION_SIZE} chromosomes (${seedConfigs.length} seeded)`
    );
  }

  private createChromosome(): Chromosome {
    const chromosome = this.createRandomChromosome();
    chromosome.id = this.getChromosomeId(chromosome);
    return chromosome;
  }

  private createRandomChromosome(): Chromosome {
    const { PARAMS } = CONFIG;

    // Ensure reasonable R:R ratios
    let stopLoss = this.randomInRange(
      PARAMS.stopLoss.min,
      PARAMS.stopLoss.max,
      PARAMS.stopLoss.step
    );
    let takeProfit = this.randomInRange(
      PARAMS.takeProfit.min,
      PARAMS.takeProfit.max,
      PARAMS.takeProfit.step
    );

    // Enforce minimum R:R of 1:0.8
    if (takeProfit < stopLoss * 0.8) {
      takeProfit = stopLoss * this.randomChoice([1, 1.5, 2, 2.5]);
      takeProfit = Math.min(takeProfit, PARAMS.takeProfit.max);
    }

    const chromosome: Chromosome = {
      id: '',
      cvdLookback: this.randomInRange(
        PARAMS.cvdLookback.min,
        PARAMS.cvdLookback.max,
        PARAMS.cvdLookback.step
      ),
      stopLoss,
      takeProfit,
      emaFilter: this.randomChoice(PARAMS.emaFilter.values),
      adxThreshold: this.randomChoice(PARAMS.adxThreshold.values),
      smaFilter: this.randomChoice(PARAMS.smaFilter.values),
      useVWAP: this.randomChoice(PARAMS.useVWAP),
      timeWindow: this.randomChoice(PARAMS.timeWindows),
      useTrailingStop: this.randomChoice(PARAMS.useTrailingStop),
      tradeDirection: this.randomChoice(PARAMS.tradeDirection),
    };

    chromosome.id = this.getChromosomeId(chromosome);
    return chromosome;
  }

  // Main evolution loop
  async evolve(): Promise<void> {
    console.log('🚀 Starting genetic optimization...\n');

    this.initializePopulation();

    for (
      this.generation = 1;
      this.generation <= CONFIG.GENERATIONS;
      this.generation++
    ) {
      const genStart = Date.now();

      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 GENERATION ${this.generation}/${CONFIG.GENERATIONS}`);
      console.log(`${'='.repeat(60)}`);

      // Evaluate fitness
      await this.evaluatePopulation();

      // Sort by fitness
      this.population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

      // Calculate and log statistics
      const stats = this.calculateGenerationStats();
      this.history.push(stats);
      this.logGenerationStats(stats);

      // Save checkpoint
      if (this.generation % CONFIG.CHECKPOINT_INTERVAL === 0) {
        await this.saveCheckpoint();
      }

      // Create next generation
      if (this.generation < CONFIG.GENERATIONS) {
        this.population = this.createNextGeneration();
      }

      const genTime = (Date.now() - genStart) / 1000;
      console.log(`\n⏱️  Generation completed in ${genTime.toFixed(1)}s`);
    }

    // Generate final report
    await this.generateFinalReport();
  }

  // Parallel evaluation with caching
  private async evaluatePopulation(): Promise<void> {
    console.log('\n🧪 Evaluating population fitness...');

    // Filter chromosomes that need evaluation
    const toEvaluate = this.population.filter((c) => !c.fitness);
    const cached = this.population.length - toEvaluate.length;

    if (cached > 0) {
      console.log(`   ♻️  Using ${cached} cached evaluations`);
    }

    // Batch process for efficiency
    const batchSize = Math.ceil(toEvaluate.length / CONFIG.MAX_WORKERS);
    const batches: Chromosome[][] = [];

    for (let i = 0; i < toEvaluate.length; i += batchSize) {
      batches.push(toEvaluate.slice(i, i + batchSize));
    }

    // Process batches in parallel
    const promises = batches.map((batch, idx) =>
      this.evaluateBatch(batch, idx, batches.length)
    );

    await Promise.all(promises);

    console.log(`\n✅ Evaluation complete (${this.cacheHits} cache hits)`);
  }

  private async evaluateBatch(
    batch: Chromosome[],
    batchIdx: number,
    totalBatches: number
  ): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const chromosome = batch[i];

      // Check cache first
      const cached = this.evaluationCache.get(chromosome.id);
      if (cached) {
        chromosome.results = cached;
        chromosome.fitness = this.calculateFitness(cached);
        this.cacheHits++;
        continue;
      }

      try {
        // Run backtest
        const result = await this.runBacktest(chromosome);

        // Cache result
        this.evaluationCache.set(chromosome.id, result);

        // Calculate fitness
        chromosome.results = result;
        chromosome.fitness = this.calculateFitness(result);
        chromosome.evaluatedAt = new Date();

        this.totalBacktests++;

        // Progress update
        const progress = (
          ((batchIdx * batch.length + i + 1) / (totalBatches * batch.length)) *
          100
        ).toFixed(1);
        process.stdout.write(
          `\r   ⚡ Progress: ${progress}% | Backtests: ${this.totalBacktests} | Cache hits: ${this.cacheHits}`
        );
      } catch (error) {
        console.error(`\n❌ Error evaluating chromosome:`, error);
        chromosome.fitness = 0;
      }
    }
  }

  // Advanced fitness function
  private calculateFitness(result: BacktestResult): number {
    // Disqualify if too few trades
    if (result.totalTrades < CONFIG.MIN_TRADES_FOR_VALIDITY) {
      return 0;
    }

    // Multi-objective optimization
    const objectives = {
      // Primary objectives
      sharpeRatio: this.normalize(result.sharpeRatio, -1, 3),
      profitFactor: this.normalize(result.profitFactor, 0, 3),
      winRate: this.normalize(result.winRate, 30, 70),

      // Secondary objectives
      consistency: this.normalize(result.avgTradesPerDay, 0.5, 5),
      riskAdjustedReturn: this.normalize(
        result.totalPnL / Math.max(1, result.maxDrawdown),
        -10,
        10
      ),

      // Activity level
      tradingActivity: this.normalize(result.totalTrades, 20, 200),
    };

    // Weights (sum to 1.0)
    const weights = {
      sharpeRatio: 0.3,
      profitFactor: 0.25,
      winRate: 0.2,
      consistency: 0.1,
      riskAdjustedReturn: 0.1,
      tradingActivity: 0.05,
    };

    // Calculate base fitness
    let fitness = 0;
    for (const [key, weight] of Object.entries(weights)) {
      fitness += objectives[key as keyof typeof objectives] * weight;
    }

    // Apply penalties
    fitness *= this.calculatePenalties(result);

    return Math.max(0, Math.min(100, fitness * 100));
  }

  private normalize(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private calculatePenalties(result: BacktestResult): number {
    let penalty = 1.0;

    // Excessive drawdown penalty
    if (result.maxDrawdown > CONFIG.MAX_ACCEPTABLE_DRAWDOWN) {
      penalty *= 0.5;
    } else if (result.maxDrawdown > 20) {
      penalty *= 0.8;
    }

    // Low win rate penalty
    if (result.winRate < CONFIG.MIN_ACCEPTABLE_WIN_RATE) {
      penalty *= 0.6;
    }

    // Negative P&L penalty
    if (result.totalPnL < 0) {
      penalty *= 0.3;
    }

    // Poor profit factor penalty
    if (result.profitFactor < 1) {
      penalty *= 0.7;
    }

    return penalty;
  }

  // Evolution operations
  private createNextGeneration(): Chromosome[] {
    const nextGen: Chromosome[] = [];

    // Elitism
    console.log(`\n🏆 Preserving top ${CONFIG.ELITISM_COUNT} chromosomes`);
    for (let i = 0; i < CONFIG.ELITISM_COUNT; i++) {
      const elite = this.cloneChromosome(this.population[i]);
      elite.id = this.getChromosomeId(elite);
      nextGen.push(elite);
    }

    // Adaptive mutation rate
    const diversity = this.calculateDiversity();
    const adaptiveMutationRate =
      diversity < 0.2 ? CONFIG.MUTATION_RATE * 1.5 : CONFIG.MUTATION_RATE;

    console.log(
      `🧬 Creating offspring (mutation rate: ${(
        adaptiveMutationRate * 100
      ).toFixed(1)}%)`
    );

    // Create offspring
    while (nextGen.length < CONFIG.POPULATION_SIZE) {
      if (Math.random() < CONFIG.CROSSOVER_RATE) {
        // Crossover
        const parent1 = this.tournamentSelect();
        const parent2 = this.tournamentSelect();
        const [child1, child2] = this.crossover(parent1, parent2);

        nextGen.push(this.mutate(child1, adaptiveMutationRate));
        if (nextGen.length < CONFIG.POPULATION_SIZE) {
          nextGen.push(this.mutate(child2, adaptiveMutationRate));
        }
      } else {
        // Mutation only
        const parent = this.tournamentSelect();
        nextGen.push(
          this.mutate(this.cloneChromosome(parent), adaptiveMutationRate)
        );
      }
    }

    return nextGen;
  }

  private tournamentSelect(): Chromosome {
    const tournament: Chromosome[] = [];

    for (let i = 0; i < CONFIG.TOURNAMENT_SIZE; i++) {
      const idx = Math.floor(Math.random() * this.population.length);
      tournament.push(this.population[idx]);
    }

    return tournament.reduce((best, current) =>
      (current.fitness || 0) > (best.fitness || 0) ? current : best
    );
  }

  private crossover(
    parent1: Chromosome,
    parent2: Chromosome
  ): [Chromosome, Chromosome] {
    const child1 = this.cloneChromosome(parent1);
    const child2 = this.cloneChromosome(parent2);

    // Two-point crossover for better mixing
    const genes: (keyof Chromosome)[] = [
      'cvdLookback',
      'stopLoss',
      'takeProfit',
      'emaFilter',
      'adxThreshold',
      'smaFilter',
      'useVWAP',
      'timeWindow',
      'useTrailingStop',
      'tradeDirection',
    ];

    const point1 = Math.floor(Math.random() * genes.length);
    const point2 = Math.floor(Math.random() * genes.length);
    const [start, end] = [Math.min(point1, point2), Math.max(point1, point2)];

    for (let i = start; i <= end; i++) {
      const gene = genes[i];
      // @ts-ignore
      [child1[gene], child2[gene]] = [child2[gene], child1[gene]];
    }

    // Update IDs
    child1.id = this.getChromosomeId(child1);
    child2.id = this.getChromosomeId(child2);

    return [child1, child2];
  }

  private mutate(chromosome: Chromosome, mutationRate: number): Chromosome {
    const mutated = this.cloneChromosome(chromosome);
    const { PARAMS } = CONFIG;
    let mutationOccurred = false;

    // Mutate each gene
    if (Math.random() < mutationRate) {
      mutated.cvdLookback = this.randomInRange(
        PARAMS.cvdLookback.min,
        PARAMS.cvdLookback.max,
        PARAMS.cvdLookback.step
      );
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.stopLoss = this.randomInRange(
        PARAMS.stopLoss.min,
        PARAMS.stopLoss.max,
        PARAMS.stopLoss.step
      );
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.takeProfit = this.randomInRange(
        PARAMS.takeProfit.min,
        PARAMS.takeProfit.max,
        PARAMS.takeProfit.step
      );

      // Ensure reasonable R:R
      if (mutated.takeProfit < mutated.stopLoss * 0.8) {
        mutated.takeProfit =
          mutated.stopLoss * this.randomChoice([1, 1.5, 2, 2.5]);
        mutated.takeProfit = Math.min(
          mutated.takeProfit,
          PARAMS.takeProfit.max
        );
      }
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.emaFilter = this.randomChoice(PARAMS.emaFilter.values);
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.adxThreshold = this.randomChoice(PARAMS.adxThreshold.values);
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.smaFilter = this.randomChoice(PARAMS.smaFilter.values);
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.useVWAP = this.randomChoice(PARAMS.useVWAP);
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.timeWindow = this.randomChoice(PARAMS.timeWindows);
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.useTrailingStop = this.randomChoice(PARAMS.useTrailingStop);
      mutationOccurred = true;
    }

    if (Math.random() < mutationRate) {
      mutated.tradeDirection = this.randomChoice(PARAMS.tradeDirection);
      mutationOccurred = true;
    }

    // Update ID and clear fitness if mutated
    if (mutationOccurred) {
      mutated.id = this.getChromosomeId(mutated);
      delete mutated.fitness;
      delete mutated.results;
      delete mutated.evaluatedAt;
    }

    return mutated;
  }

  // Backtest integration
  private async runBacktest(chromosome: Chromosome): Promise<BacktestResult> {
    // Build API parameters
    const apiParams: ApiParams = {
      start: `${CONFIG.START_DATE} ${chromosome.timeWindow.start}:00 AM`,
      end: `${CONFIG.END_DATE} ${chromosome.timeWindow.end}:00 PM`,
      barType: 'time',
      barSize: 1,
      candleType: 'traditional',
      cvdLookBackBars: chromosome.cvdLookback,
      stopLoss: chromosome.stopLoss,
      takeProfit: chromosome.takeProfit,
      emaMovingAverage: chromosome.emaFilter || undefined,
      adxThreshold: chromosome.adxThreshold || undefined,
      smaFilter: chromosome.smaFilter || undefined,
      useVWAP: chromosome.useVWAP,
      contractSize: 1,
      useTrailingStop: chromosome.useTrailingStop,
      breakevenTrigger: 3,
      trailDistance: 2,
      tradeDirection: chromosome.tradeDirection,
      maxDailyLoss: 1500,
      maxDailyProfit: 3000,
    };

    // Get CSV files
    const csvList = selectCSV(
      apiParams.barType,
      apiParams.candleType,
      apiParams.start,
      apiParams.end
    );

    // Run backtest
    const result = await runBacktest(csvList, apiParams);

    // Extract metrics
    const stats = result.statistics;
    const tradingDays = Object.keys(stats.dailyPnL).length;

    return {
      totalTrades: stats.totalTrades,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor || 0,
      totalPnL: stats.totalProfit || 0,
      sharpeRatio: stats.sharpeRatio,
      maxDrawdown: stats.maxDrawdown || 0,
      avgWin: stats.avgWinLoss?.avgWin || 0,
      avgLoss: Math.abs(stats.avgWinLoss?.avgLoss || 0),
      longWinRate: stats.longShortStats?.longWinRate,
      shortWinRate: stats.longShortStats?.shortWinRate,
      totalBars: result.count,
      daysTraded: tradingDays,
      avgTradesPerDay: tradingDays > 0 ? stats.totalTrades / tradingDays : 0,
    };
  }

  // Statistics and reporting
  private calculateGenerationStats(): GenerationStats {
    const fitnesses = this.population.map((c) => c.fitness || 0);
    const bestFitness = Math.max(...fitnesses);
    const avgFitness = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
    const stdDev = Math.sqrt(
      fitnesses.reduce((sum, f) => sum + Math.pow(f - avgFitness, 2), 0) /
        fitnesses.length
    );

    const top10 = this.population.slice(0, 10);
    const top10Avg = top10.reduce((sum, c) => sum + (c.fitness || 0), 0) / 10;

    return {
      generation: this.generation,
      bestFitness,
      avgFitness,
      stdDevFitness: stdDev,
      bestChromosome: this.cloneChromosome(this.population[0]),
      top10Avg,
      convergence: stdDev / avgFitness,
      diversityScore: this.calculateDiversity(),
      timestamp: new Date(),
    };
  }

  private calculateDiversity(): number {
    // Calculate genetic diversity
    const uniqueConfigs = new Set(this.population.map((c) => c.id));
    return uniqueConfigs.size / this.population.length;
  }

  private logGenerationStats(stats: GenerationStats): void {
    console.log('\n📈 Generation Summary:');
    console.log(`   🏆 Best Fitness: ${stats.bestFitness.toFixed(2)}`);
    console.log(
      `   📊 Avg Fitness: ${stats.avgFitness.toFixed(
        2
      )} (±${stats.stdDevFitness.toFixed(2)})`
    );
    console.log(`   🔝 Top 10 Avg: ${stats.top10Avg.toFixed(2)}`);
    console.log(`   🧬 Diversity: ${(stats.diversityScore * 100).toFixed(1)}%`);
    console.log(`   📉 Convergence: ${stats.convergence.toFixed(3)}`);

    const best = stats.bestChromosome;
    console.log('\n🏆 Best Configuration:');
    console.log(`   - CVD Lookback: ${best.cvdLookback} bars`);
    console.log(
      `   - Stop/Target: ${best.stopLoss}/${best.takeProfit} pts (1:${(
        best.takeProfit / best.stopLoss
      ).toFixed(2)})`
    );
    console.log(
      `   - Filters: EMA=${best.emaFilter || 'None'}, ADX=${
        best.adxThreshold || 'None'
      }, SMA=${best.smaFilter || 'None'}, VWAP=${best.useVWAP}`
    );
    console.log(
      `   - Time: ${best.timeWindow.name} (${best.timeWindow.start}-${best.timeWindow.end})`
    );
    console.log(
      `   - Direction: ${best.tradeDirection}, Trailing: ${best.useTrailingStop}`
    );

    if (best.results) {
      console.log('\n📊 Best Performance:');
      console.log(
        `   - Trades: ${
          best.results.totalTrades
        } (${best.results.avgTradesPerDay.toFixed(1)}/day)`
      );
      console.log(`   - Win Rate: ${best.results.winRate.toFixed(1)}%`);
      console.log(
        `   - Profit Factor: ${best.results.profitFactor.toFixed(2)}`
      );
      console.log(`   - Sharpe Ratio: ${best.results.sharpeRatio.toFixed(2)}`);
      console.log(`   - Total P&L: $${best.results.totalPnL.toFixed(2)}`);
      console.log(`   - Max Drawdown: ${best.results.maxDrawdown.toFixed(1)}%`);
    }
  }

  private async saveCheckpoint(): Promise<void> {
    const filename = path.join(
      CONFIG.OUTPUT_DIR,
      `checkpoint_gen_${this.generation}.json`
    );

    const checkpoint = {
      generation: this.generation,
      population: this.population,
      history: this.history,
      cacheSize: this.evaluationCache.size,
      totalBacktests: this.totalBacktests,
      config: CONFIG,
      timestamp: new Date(),
    };

    fs.writeFileSync(filename, JSON.stringify(checkpoint, null, 2));
    console.log(`\n💾 Checkpoint saved: ${filename}`);
  }

  private async generateFinalReport(): Promise<void> {
    console.log('\n\n' + '='.repeat(80));
    console.log('🏆 GENETIC OPTIMIZATION COMPLETE');
    console.log('='.repeat(80));

    // Sort final population
    this.population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

    // Top performers
    console.log('\n📊 TOP 20 CONFIGURATIONS:\n');

    const top20 = this.population.slice(0, 20);

    // Table header
    console.log(
      'Rank | Fitness | CVD | SL/TP  | R:R  | Filters | Time   | Dir  | Trades | Win% | PF   | Sharpe | P&L'
    );
    console.log('-'.repeat(110));

    top20.forEach((chr, idx) => {
      if (!chr.results) return;

      const filters =
        [
          chr.emaFilter ? `E${chr.emaFilter}` : '',
          chr.adxThreshold ? `A${chr.adxThreshold}` : '',
          chr.smaFilter ? `S${chr.smaFilter}` : '',
          chr.useVWAP ? 'V' : '',
        ]
          .filter(Boolean)
          .join(',') || 'None';

      console.log(
        `${(idx + 1).toString().padStart(4)} | ` +
          `${chr.fitness?.toFixed(1).padStart(7)} | ` +
          `${chr.cvdLookback.toString().padStart(3)} | ` +
          `${chr.stopLoss}/${chr.takeProfit}`.padEnd(6) +
          ' | ' +
          `1:${(chr.takeProfit / chr.stopLoss).toFixed(1)}`.padEnd(4) +
          ' | ' +
          `${filters.padEnd(7)} | ` +
          `${chr.timeWindow.name.substring(0, 6).padEnd(6)} | ` +
          `${chr.tradeDirection.substring(0, 3).padEnd(4)} | ` +
          `${chr.results.totalTrades.toString().padStart(6)} | ` +
          `${chr.results.winRate.toFixed(1)}%`.padStart(4) +
          ' | ' +
          `${chr.results.profitFactor.toFixed(2).padStart(4)} | ` +
          `${chr.results.sharpeRatio.toFixed(2).padStart(6)} | ` +
          `$${chr.results.totalPnL.toFixed(0).padStart(6)}`
      );
    });

    // Summary statistics
    console.log('\n📈 OPTIMIZATION SUMMARY:');
    console.log(`   - Total Generations: ${CONFIG.GENERATIONS}`);
    console.log(`   - Population Size: ${CONFIG.POPULATION_SIZE}`);
    console.log(`   - Total Backtests: ${this.totalBacktests}`);
    console.log(
      `   - Cache Efficiency: ${(
        (this.cacheHits / (this.totalBacktests + this.cacheHits)) *
        100
      ).toFixed(1)}%`
    );
    console.log(`   - Test Period: ${CONFIG.START_DATE} to ${CONFIG.END_DATE}`);

    // Evolution metrics
    const firstGen = this.history[0];
    const lastGen = this.history[this.history.length - 1];
    console.log('\n🧬 EVOLUTION METRICS:');
    console.log(
      `   - Starting Best Fitness: ${firstGen.bestFitness.toFixed(2)}`
    );
    console.log(`   - Final Best Fitness: ${lastGen.bestFitness.toFixed(2)}`);
    console.log(
      `   - Improvement: ${(
        ((lastGen.bestFitness - firstGen.bestFitness) / firstGen.bestFitness) *
        100
      ).toFixed(1)}%`
    );
    console.log(
      `   - Final Diversity: ${(lastGen.diversityScore * 100).toFixed(1)}%`
    );

    // Save comprehensive report
    const reportData = {
      summary: {
        optimizationDate: new Date(),
        totalGenerations: CONFIG.GENERATIONS,
        populationSize: CONFIG.POPULATION_SIZE,
        totalBacktests: this.totalBacktests,
        cacheHits: this.cacheHits,
        testPeriod: {
          start: CONFIG.START_DATE,
          end: CONFIG.END_DATE,
        },
      },
      bestConfiguration: top20[0],
      top20Configurations: top20,
      evolutionHistory: this.history,
      parameterDistribution: this.analyzeParameterDistribution(top20),
    };

    const reportFile = path.join(CONFIG.OUTPUT_DIR, 'optimization_report.json');
    fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));

    // Save CSV for analysis
    const csvFile = path.join(CONFIG.OUTPUT_DIR, 'optimization_results.csv');
    this.saveResultsAsCSV(top20, csvFile);

    // Plot evolution
    this.plotEvolution();

    console.log(`\n📁 Results saved to:`);
    console.log(`   - ${reportFile}`);
    console.log(`   - ${csvFile}`);

    // Recommended settings
    console.log('\n');
    console.log('╔' + '═'.repeat(78) + '╗');
    console.log(
      '║' + ' '.repeat(20) + '💡 RECOMMENDED SETTINGS' + ' '.repeat(35) + '║'
    );
    console.log('╚' + '═'.repeat(78) + '╝');

    const best = top20[0];
    console.log(`\n🎯 OPTIMAL CONFIGURATION:`);
    console.log(`   module.exports = {`);
    console.log(`     cvdLookbackBars: ${best.cvdLookback},`);
    console.log(`     stopLoss: ${best.stopLoss},`);
    console.log(`     takeProfit: ${best.takeProfit},`);
    console.log(`     emaFilter: ${best.emaFilter},`);
    console.log(`     adxThreshold: ${best.adxThreshold},`);
    console.log(`     smaFilter: ${best.smaFilter},`);
    console.log(`     useVWAP: ${best.useVWAP},`);
    console.log(
      `     timeWindow: { start: '${best.timeWindow.start}', end: '${best.timeWindow.end}' },`
    );
    console.log(`     useTrailingStop: ${best.useTrailingStop},`);
    console.log(`     tradeDirection: '${best.tradeDirection}',`);
    console.log(`   };`);

    if (best.results) {
      console.log(`\n📊 EXPECTED PERFORMANCE:`);
      console.log(`   - Win Rate: ${best.results.winRate.toFixed(1)}%`);
      console.log(
        `   - Profit Factor: ${best.results.profitFactor.toFixed(2)}`
      );
      console.log(`   - Sharpe Ratio: ${best.results.sharpeRatio.toFixed(2)}`);
      console.log(
        `   - Average Daily P&L: $${(
          best.results.totalPnL / best.results.daysTraded
        ).toFixed(2)}`
      );
      console.log(
        `   - Trades per Day: ${best.results.avgTradesPerDay.toFixed(1)}`
      );
    }
  }

  private analyzeParameterDistribution(topChromosomes: Chromosome[]): any {
    const dist: any = {
      cvdLookback: {},
      rrRatios: {},
      timeWindows: {},
      filters: { ema: 0, adx: 0, sma: 0, vwap: 0 },
      tradeDirection: { both: 0, long: 0, short: 0 },
    };

    topChromosomes.forEach((chr) => {
      // CVD distribution
      dist.cvdLookback[chr.cvdLookback] =
        (dist.cvdLookback[chr.cvdLookback] || 0) + 1;

      // R:R ratios
      const rr = `1:${(chr.takeProfit / chr.stopLoss).toFixed(1)}`;
      dist.rrRatios[rr] = (dist.rrRatios[rr] || 0) + 1;

      // Time windows
      dist.timeWindows[chr.timeWindow.name] =
        (dist.timeWindows[chr.timeWindow.name] || 0) + 1;

      // Filters
      if (chr.emaFilter > 0) dist.filters.ema++;
      if (chr.adxThreshold > 0) dist.filters.adx++;
      if (chr.smaFilter > 0) dist.filters.sma++;
      if (chr.useVWAP) dist.filters.vwap++;

      // Direction
      dist.tradeDirection[chr.tradeDirection]++;
    });

    return dist;
  }

  private saveResultsAsCSV(chromosomes: Chromosome[], filename: string): void {
    const headers = [
      'Rank',
      'Fitness',
      'CVD_Lookback',
      'Stop_Loss',
      'Take_Profit',
      'RR_Ratio',
      'EMA_Filter',
      'ADX_Threshold',
      'SMA_Filter',
      'Use_VWAP',
      'Time_Window',
      'Direction',
      'Trailing_Stop',
      'Total_Trades',
      'Win_Rate',
      'Profit_Factor',
      'Sharpe_Ratio',
      'Total_PnL',
      'Max_Drawdown',
      'Avg_Win',
      'Avg_Loss',
      'Long_Win_Rate',
      'Short_Win_Rate',
      'Trades_Per_Day',
    ];

    const rows = chromosomes.map((c, idx) => [
      idx + 1,
      c.fitness?.toFixed(2) || 0,
      c.cvdLookback,
      c.stopLoss,
      c.takeProfit,
      (c.takeProfit / c.stopLoss).toFixed(2),
      c.emaFilter || 'None',
      c.adxThreshold || 'None',
      c.smaFilter || 'None',
      c.useVWAP ? 'Yes' : 'No',
      c.timeWindow.name,
      c.tradeDirection,
      c.useTrailingStop ? 'Yes' : 'No',
      c.results?.totalTrades || 0,
      c.results?.winRate.toFixed(1) || 0,
      c.results?.profitFactor.toFixed(2) || 0,
      c.results?.sharpeRatio.toFixed(2) || 0,
      c.results?.totalPnL.toFixed(2) || 0,
      c.results?.maxDrawdown.toFixed(1) || 0,
      c.results?.avgWin.toFixed(2) || 0,
      c.results?.avgLoss.toFixed(2) || 0,
      c.results?.longWinRate?.toFixed(1) || 'N/A',
      c.results?.shortWinRate?.toFixed(1) || 'N/A',
      c.results?.avgTradesPerDay.toFixed(1) || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    fs.writeFileSync(filename, csv);
  }

  private plotEvolution(): void {
    console.log('\n📈 FITNESS EVOLUTION:\n');

    const width = 70;
    const height = 20;

    const maxFitness = Math.max(...this.history.map((h) => h.bestFitness));
    const minFitness = Math.min(...this.history.map((h) => h.avgFitness));
    const range = maxFitness - minFitness || 1;

    // Create plot
    for (let y = height; y >= 0; y--) {
      let line = '';
      const value = minFitness + (y / height) * range;

      for (let x = 0; x < Math.min(width, this.history.length); x++) {
        const idx = Math.floor((x * this.history.length) / width);
        const h = this.history[idx];

        if (Math.abs(h.bestFitness - value) < range / height / 2) {
          line += '█';
        } else if (Math.abs(h.top10Avg - value) < range / height / 2) {
          line += '▓';
        } else if (Math.abs(h.avgFitness - value) < range / height / 2) {
          line += '░';
        } else {
          line += ' ';
        }
      }

      if (y === height || y === Math.floor(height / 2) || y === 0) {
        console.log(`${value.toFixed(0).padStart(3)} |${line}`);
      } else {
        console.log(`    |${line}`);
      }
    }

    console.log('    ' + '└' + '─'.repeat(width));
    console.log(
      '     ' +
        '1'.padEnd(width / 2 - 1) +
        `${CONFIG.GENERATIONS}`.padStart(width / 2)
    );
    console.log('\n     █ Best  ▓ Top10  ░ Average');
  }

  // Utility methods
  private cloneChromosome(chromosome: Chromosome): Chromosome {
    return { ...chromosome };
  }

  private randomInRange(min: number, max: number, step: number): number {
    const steps = Math.floor((max - min) / step);
    return min + Math.floor(Math.random() * (steps + 1)) * step;
  }

  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }
}

// ==================== MAIN EXECUTION ====================
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║      CVD STRATEGY GENETIC ALGORITHM OPTIMIZER v2.0        ║
╚═══════════════════════════════════════════════════════════╝
  `);

  console.log('📋 Configuration:');
  console.log(`   - Population Size: ${CONFIG.POPULATION_SIZE}`);
  console.log(`   - Generations: ${CONFIG.GENERATIONS}`);
  console.log(`   - Test Period: ${CONFIG.START_DATE} to ${CONFIG.END_DATE}`);
  console.log(`   - Parallel Workers: ${CONFIG.MAX_WORKERS}`);
  console.log(`   - Output Directory: ${CONFIG.OUTPUT_DIR}`);

  console.log('\n📊 Parameter Space:');
  console.log(
    `   - CVD Lookback: ${CONFIG.PARAMS.cvdLookback.min}-${CONFIG.PARAMS.cvdLookback.max}`
  );
  console.log(
    `   - Stop Loss: ${CONFIG.PARAMS.stopLoss.min}-${CONFIG.PARAMS.stopLoss.max} points`
  );
  console.log(
    `   - Take Profit: ${CONFIG.PARAMS.takeProfit.min}-${CONFIG.PARAMS.takeProfit.max} points`
  );
  console.log(`   - Time Windows: ${CONFIG.PARAMS.timeWindows.length} options`);
  console.log(`   - Indicators: EMA, ADX, SMA, VWAP`);

  const totalPossible = CONFIG.POPULATION_SIZE * CONFIG.GENERATIONS;
  console.log(
    `\n   Estimated Backtests: ${totalPossible} (with caching: ~${Math.floor(
      totalPossible * 0.6
    )})`
  );

  const estimatedTime = (totalPossible * 2) / CONFIG.MAX_WORKERS / 60; // 2 seconds per backtest
  console.log(`⏱️  Estimated Time: ${estimatedTime.toFixed(1)} minutes\n`);

  console.log('🚀 Starting in 5 seconds... (Ctrl+C to cancel)\n');
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Run optimization
  const optimizer = new GeneticOptimizer();
  const startTime = Date.now();

  try {
    await optimizer.evolve();

    const duration = (Date.now() - startTime) / 1000;
    console.log(
      `\n✅ Optimization completed in ${(duration / 60).toFixed(1)} minutes`
    );
    console.log(`   (${(duration / 3600).toFixed(2)} hours)`);
  } catch (error) {
    console.error('\n❌ Optimization failed:', error);
    process.exit(1);
  }
}

// Run if called directly
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1] === import.meta.filename;

if (isMainModule) {
  main().catch(console.error);
}

// Export for use as module
export { GeneticOptimizer, CONFIG };
