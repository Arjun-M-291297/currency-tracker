import { Inject, Injectable, Logger } from '@nestjs/common';
import type { RateProvider } from './providers/rate-provider.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  constructor(
    @Inject('RateProvider') private readonly rateProvider: RateProvider,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getRates(base: string = 'USD', symbols: string[] = []): Promise<Record<string, number>> {
    const cacheKey = `rates_${base}_${symbols.join(',')}`;
    const cachedRates = await this.cacheManager.get<Record<string, number>>(cacheKey);
    
    if (cachedRates) {
      this.logger.log(`Cache hit for ${cacheKey}`);
      return cachedRates;
    }

    this.logger.log(`Fetching fresh rates for ${base}`);
    const rates = await this.rateProvider.fetchRates(base, symbols);
    
    // Cache for 5 minutes (300000 ms)
    await this.cacheManager.set(cacheKey, rates, 300000);
    
    return rates;
  }

  async refreshRates(base: string = 'USD', symbols: string[] = []): Promise<Record<string, number>> {
    const cacheKey = `rates_${base}_${symbols.join(',')}`;
    // Bust the cache so we always hit the external API
    await this.cacheManager.del(cacheKey);
    this.logger.log(`Cache busted for ${cacheKey} — fetching live rate from provider`);
    const rates = await this.rateProvider.fetchRates(base, symbols);
    // Re-populate cache with fresh data
    await this.cacheManager.set(cacheKey, rates, 300000);
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
}
