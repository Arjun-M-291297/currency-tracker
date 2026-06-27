import { Injectable, Logger } from '@nestjs/common';
import type { RateProvider } from './rate-provider.interface';

@Injectable()
export class ExchangeRateFunAdapter implements RateProvider {
  private readonly logger = new Logger(ExchangeRateFunAdapter.name);
  private readonly baseUrl = 'https://api.exchangerate.fun/latest';

  async fetchRates(base: string, symbols: string[]): Promise<Record<string, number>> {
    try {
      const url = `${this.baseUrl}?base=${base}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from ExchangeRateFun: ${response.statusText}`);
      }
      const data = await response.json();
      
      if (!data.rates) {
        throw new Error('Invalid response structure from ExchangeRateFun: rates field missing');
      }

      if (symbols && symbols.length > 0) {
        const filteredRates: Record<string, number> = {};
        for (const sym of symbols) {
          if (data.rates[sym] !== undefined) {
            filteredRates[sym] = data.rates[sym];
          }
        }
        return filteredRates;
      }

      return data.rates;
    } catch (error) {
      this.logger.error('Error fetching rates from ExchangeRateFun', error);
      throw error;
    }
  }
}
