import { Injectable, Logger } from '@nestjs/common';
import type { RateProvider } from './rate-provider.interface';
import { ExchangeRateHostAdapter } from './exchangerate-host.adapter';

@Injectable()
export class FreecurrencyapiAdapter implements RateProvider {
  private readonly logger = new Logger(FreecurrencyapiAdapter.name);
  private readonly baseUrl = 'https://api.freecurrencyapi.com/v1/latest';
  private readonly fallbackProvider = new ExchangeRateHostAdapter();

  async fetchRates(base: string, symbols: string[]): Promise<Record<string, number>> {
    const apiKey = process.env.CURRENCY_API_KEY;

    if (!apiKey) {
      this.logger.warn('CURRENCY_API_KEY environment variable is not defined. Falling back to public ExchangeRate-API.');
      return this.fallbackProvider.fetchRates(base, symbols);
    }

    try {
      // 1. Fetch USD rates from Freecurrencyapi
      const url = `${this.baseUrl}?apikey=${apiKey}&base_currency=USD`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Freecurrencyapi: ${response.statusText}`);
      }
      const data = await response.json();
      if (!data.data) {
        throw new Error('Invalid response structure: data field missing');
      }

      const usdRates = data.data;
      usdRates['USD'] = 1.0; // add self rate

      // 2. Identify missing required currencies for the application
      const REQUIRED_CURRENCIES = ['AED', 'USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD'];
      const missingCurrencies = REQUIRED_CURRENCIES.filter(
        (cur) => usdRates[cur] === undefined
      );

      // 3. Backfill missing currencies from fallback provider relative to USD
      if (missingCurrencies.length > 0) {
        try {
          const fallbackRates = await this.fallbackProvider.fetchRates('USD', missingCurrencies);
          for (const cur of missingCurrencies) {
            if (fallbackRates[cur] !== undefined) {
              usdRates[cur] = fallbackRates[cur];
            }
          }
        } catch (fallbackError) {
          this.logger.error('Failed to backfill missing currencies from fallback provider', fallbackError);
        }
      }

      // 4. Translate base rates in-memory from USD to requested base
      // If requested base is USD, filter and return
      if (base === 'USD') {
        if (symbols && symbols.length > 0) {
          const filteredRates: Record<string, number> = {};
          for (const sym of symbols) {
            if (usdRates[sym] === undefined) {
              throw new Error(`Symbol ${sym} is not supported by either provider`);
            }
            filteredRates[sym] = usdRates[sym];
          }
          return filteredRates;
        }
        return usdRates;
      }

      // Convert rates in-memory from USD base to requested base
      const baseRateInUSD = usdRates[base];
      if (baseRateInUSD === undefined) {
        throw new Error(`Base currency ${base} rate not found in USD rates`);
      }

      const translatedRates: Record<string, number> = {};
      for (const [currency, rateInUSD] of Object.entries(usdRates) as [string, number][]) {
        translatedRates[currency] = rateInUSD / baseRateInUSD;
      }

      if (symbols && symbols.length > 0) {
        const filteredRates: Record<string, number> = {};
        for (const sym of symbols) {
          if (translatedRates[sym] === undefined) {
            throw new Error(`Symbol ${sym} is not supported by either provider`);
          }
          filteredRates[sym] = translatedRates[sym];
        }
        return filteredRates;
      }

      return translatedRates;
    } catch (error) {
      this.logger.error('Error fetching rates from Freecurrencyapi, falling back to public provider completely', error);
      return this.fallbackProvider.fetchRates(base, symbols);
    }
  }
}
