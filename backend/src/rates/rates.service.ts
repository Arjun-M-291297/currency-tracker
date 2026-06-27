import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RateProvider } from './providers/rate-provider.interface';
import { FrankfurterAdapter } from './providers/frankfurter.adapter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    @Inject('RateProvider') private readonly rateProvider: RateProvider,
    private readonly frankfurterAdapter: FrankfurterAdapter,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getRates(base: string = 'USD', symbols: string[] = []): Promise<Record<string, number>> {
    const cacheKey = `rates_${base}`;
    let cachedRates = await this.cacheManager.get<Record<string, number>>(cacheKey);
    
    if (!cachedRates) {
      this.logger.log(`Cache miss for ${cacheKey} - fetching fresh rates for ${base}`);
      // Fetch all rates (empty symbols) to populate cache
      cachedRates = await this.rateProvider.fetchRates(base, []);
      // Cache for 5 minutes (300000 ms)
      await this.cacheManager.set(cacheKey, cachedRates, 300000);
    } else {
      this.logger.log(`Cache hit for ${cacheKey}`);
    }

    if (symbols.length > 0) {
      const filteredRates: Record<string, number> = {};
      for (const symbol of symbols) {
        if (cachedRates[symbol] !== undefined) {
          filteredRates[symbol] = cachedRates[symbol];
        }
      }
      return filteredRates;
    }

    return cachedRates;
  }

  async refreshRates(base: string = 'USD', symbols: string[] = []): Promise<Record<string, number>> {
    const cacheKey = `rates_${base}`;
    // Bust the cache so we always hit the external API
    await this.cacheManager.del(cacheKey);
    this.logger.log(`Cache busted for ${cacheKey} — fetching live rate from provider`);
    const rates = await this.rateProvider.fetchRates(base, []);
    // Re-populate cache with fresh data
    await this.cacheManager.set(cacheKey, rates, 300000);

    if (symbols.length > 0) {
      const filteredRates: Record<string, number> = {};
      for (const symbol of symbols) {
        if (rates[symbol] !== undefined) {
          filteredRates[symbol] = rates[symbol];
        }
      }
      return filteredRates;
    }
    return rates;
  }

  async convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    
    const rates = await this.getRates(from, [to]);
    if (!rates[to]) {
      throw new Error(`Rate for ${to} not found with base ${from}`);
    }
    
    return amount * rates[to];
  }

  async getHistoricalRates(
    base: string,
    target: string,
    range: string,
  ): Promise<Array<{ time: string; rate: number }>> {
    const cacheKey = `history_${base}_${target}_${range}`;
    const cachedHistory = await this.cacheManager.get<Array<{ time: string; rate: number }>>(cacheKey);
    if (cachedHistory) {
      this.logger.log(`Cache hit for history ${cacheKey}`);
      return cachedHistory;
    }

    this.logger.log(`Fetching history for ${base} -> ${target} (${range})`);
    
    // 1. Handle base === target directly
    if (base === target) {
      const result = this.generateFlatHistory(range);
      await this.cacheManager.set(cacheKey, result, 3600000); // cache history for 1 hour
      return result;
    }

    // 2. Compute date range
    const { startDate, endDate } = this.calculateDateRange(range);

    // 3. Resolve base and target with Frankfurter USD peg for AED
    let queryBase = base;
    let queryTarget = target;
    const hasAED = base === 'AED' || target === 'AED';

    if (hasAED) {
      if (base === 'AED') {
        queryBase = 'USD';
      }
      if (target === 'AED') {
        queryTarget = 'USD';
      }
    }

    if (queryBase === queryTarget) {
      const pegRate = this.applyAEDPeg(base, target, 1.0);
      const result = this.generateFlatHistory(range, pegRate);
      await this.cacheManager.set(cacheKey, result, 3600000);
      return result;
    }

    let rawRates: Record<string, Record<string, number>> = {};

    // 4. Fetch history from the active rate provider if it supports it, otherwise fallback to Frankfurter
    if (queryBase !== queryTarget) {
      if (typeof this.rateProvider.fetchHistory === 'function') {
        try {
          rawRates = await this.rateProvider.fetchHistory(queryBase, [queryTarget], startDate, endDate);
        } catch (error) {
          this.logger.warn(`Failed to fetch history from active provider, falling back to Frankfurter: ${error.message}`);
          rawRates = await this.frankfurterAdapter.fetchHistory(queryBase, [queryTarget], startDate, endDate);
        }
      } else {
        rawRates = await this.frankfurterAdapter.fetchHistory(queryBase, [queryTarget], startDate, endDate);
      }
    }


    let history: Array<{ time: string; rate: number }> = [];

    if (range === '1D') {
      // 5. For 1D, we get previous close from history or fallback, and current live rate.
      let previousClose = 1.0;
      const dates = Object.keys(rawRates).sort();
      if (dates.length > 0) {
        const lastDate = dates[dates.length - 1];
        previousClose = rawRates[lastDate]?.[queryTarget] || 1.0;
      } else {
        // Fallback: get current rate
        const currentLive = await this.getRates(queryBase, [queryTarget]);
        previousClose = currentLive[queryTarget] || 1.0;
      }

      // Convert previousClose for AED if needed
      if (hasAED) {
        previousClose = this.applyAEDPeg(base, target, previousClose);
      }

      // Fetch current live rate
      const currentLiveRates = await this.getRates(base, [target]);
      const currentRate = currentLiveRates[target] || previousClose;

      // Generate simulated hourly path
      history = this.generateIntradayPath(previousClose, currentRate);
    } else {
      // For 1W, 1M, 1Y, parse timeseries rates
      const dates = Object.keys(rawRates).sort();
      for (const date of dates) {
        let rate = rawRates[date]?.[queryTarget];
        if (rate !== undefined) {
          if (hasAED) {
            rate = this.applyAEDPeg(base, target, rate);
          }
          history.push({
            time: date,
            rate: Number(rate.toFixed(4)),
          });
        }
      }
      
      // If we don't have enough history, fallback or add latest live rate
      if (history.length === 0) {
        const currentLiveRates = await this.getRates(base, [target]);
        const currentRate = currentLiveRates[target] || 1.0;
        history.push({ time: new Date().toISOString().split('T')[0], rate: currentRate });
      }
    }

    // Cache historical rates for 1 hour (3600000 ms)
    await this.cacheManager.set(cacheKey, history, 3600000);
    return history;
  }

  private applyAEDPeg(base: string, target: string, rate: number): number {
    const PEG = 3.6725;
    if (base === 'AED' && target === 'USD') return 1 / PEG;
    if (base === 'USD' && target === 'AED') return PEG;
    if (base === 'AED') {
      return rate / PEG;
    }
    if (target === 'AED') {
      return rate * PEG;
    }
    return rate;
  }

  private calculateDateRange(range: string): { startDate: string; endDate: string } {
    const end = new Date();
    const start = new Date();

    if (range === '1W') {
      start.setDate(end.getDate() - 7);
    } else if (range === '1M') {
      start.setDate(end.getDate() - 30);
    } else if (range === '1Y') {
      start.setDate(end.getDate() - 365);
    } else if (range === '1D') {
      start.setDate(end.getDate() - 5);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  private generateFlatHistory(range: string, rate: number = 1.0): Array<{ time: string; rate: number }> {
    const result: Array<{ time: string; rate: number }> = [];
    const now = new Date();
    const count = range === '1D' ? 24 : range === '1W' ? 7 : range === '1M' ? 30 : 365;

    for (let i = 0; i <= count; i++) {
      let timeLabel = '';
      if (range === '1D') {
        const time = new Date(now.getTime() - (count - i) * 60 * 60 * 1000);
        timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else {
        const date = new Date(now.getTime() - (count - i) * 24 * 60 * 60 * 1000);
        timeLabel = date.toISOString().split('T')[0];
      }
      result.push({ time: timeLabel, rate: Number(rate.toFixed(4)) });
    }
    return result;
  }

  private generateIntradayPath(startRate: number, endRate: number): Array<{ time: string; rate: number }> {
    const points: Array<{ time: string; rate: number }> = [];
    const now = new Date();
    const count = 24;

    for (let i = 0; i <= count; i++) {
      const time = new Date(now.getTime() - (count - i) * 60 * 60 * 1000);
      const progress = i / count;
      let rate = startRate + progress * (endRate - startRate);

      if (i > 0 && i < count) {
        const variance = (endRate * 0.001) * (Math.sin(progress * Math.PI * 2) * 0.5 + (Math.random() - 0.5) * 0.5);
        rate += variance;
      }

      points.push({
        time: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        rate: Number(rate.toFixed(4)),
      });
    }

    return points;
  }
}
