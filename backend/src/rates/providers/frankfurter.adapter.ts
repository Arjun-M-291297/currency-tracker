import { Injectable, Logger } from '@nestjs/common';
import { RateProvider } from './rate-provider.interface';

@Injectable()
export class FrankfurterAdapter implements RateProvider {
  private readonly logger = new Logger(FrankfurterAdapter.name);
  private readonly baseUrl = 'https://api.frankfurter.app';

  async fetchRates(base: string, symbols: string[]): Promise<Record<string, number>> {
    try {
      const symbolsParam = symbols.length > 0 ? `&symbols=${symbols.join(',')}` : '';
      const url = `${this.baseUrl}/latest?base=${base}${symbolsParam}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Frankfurter: ${response.statusText}`);
      }
      const data = await response.json();
      return data.rates;
    } catch (error) {
      this.logger.error('Error fetching rates from Frankfurter', error);
      throw error;
    }
  }

  async fetchHistory(
    base: string,
    symbols: string[],
    startDate: string,
    endDate: string,
  ): Promise<Record<string, Record<string, number>>> {
    try {
      const symbolsParam = symbols.length > 0 ? `&symbols=${symbols.join(',')}` : '';
      const url = `${this.baseUrl}/${startDate}..${endDate}?base=${base}${symbolsParam}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch history from Frankfurter: ${response.statusText}`);
      }
      const data = await response.json();
      return data.rates || {};
    } catch (error) {
      this.logger.error('Error fetching history from Frankfurter', error);
      throw error;
    }
  }
}
