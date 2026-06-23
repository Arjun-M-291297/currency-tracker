import { Injectable, Logger } from '@nestjs/common';
import type { RateProvider } from './rate-provider.interface';

@Injectable()
export class ExchangeRateHostAdapter implements RateProvider {
  private readonly logger = new Logger(ExchangeRateHostAdapter.name);
  // Using open.er-api.com as the free fallback which supports AED and 160+ currencies
  private readonly baseUrl = 'https://open.er-api.com/v6/latest';

  async fetchRates(base: string, symbols: string[]): Promise<Record<string, number>> {
    try {
      const url = `${this.baseUrl}/${base}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from ExchangeRateHost: ${response.statusText}`);
      }
      const data = await response.json();
      
      if (data.result !== 'success') {
        throw new Error(`API returned error: ${data['error-type']}`);
      }

      if (symbols && symbols.length > 0) {
        const filteredRates: Record<string, number> = {};
        for (const sym of symbols) {
          if (data.rates[sym]) {
            filteredRates[sym] = data.rates[sym];
          }
        }
        return filteredRates;
      }

      return data.rates;
    } catch (error) {
      this.logger.error('Error fetching rates from ExchangeRateHost', error);
      throw error;
    }
  }
}
