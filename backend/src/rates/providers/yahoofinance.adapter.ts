import { Injectable, Logger } from '@nestjs/common';
import type { RateProvider } from './rate-provider.interface';

@Injectable()
export class YahooFinanceAdapter implements RateProvider {
  private readonly logger = new Logger(YahooFinanceAdapter.name);
  private readonly baseUrl = 'https://query1.finance.yahoo.com/v8/finance/chart';

  async fetchRates(base: string, symbols: string[]): Promise<Record<string, number>> {
    const REQUIRED_CURRENCIES = ['AED', 'USD', 'EUR', 'INR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'SGD'];
    
    // Determine target symbols to fetch
    const targets = symbols && symbols.length > 0 
      ? symbols 
      : REQUIRED_CURRENCIES.filter(cur => cur !== base);

    const rates: Record<string, number> = {};

    // Fetch tickers in parallel
    await Promise.all(
      targets.map(async (target) => {
        if (base === target) {
          rates[target] = 1.0;
          return;
        }

        try {
          const ticker = `${base}${target}=X`;
          const url = `${this.baseUrl}/${ticker}`;
          
          const response = await fetch(url);
          if (!response.ok) {
            this.logger.warn(`Failed to fetch ticker ${ticker} from Yahoo Finance: ${response.statusText}`);
            return;
          }
          
          const data = await response.json();
          const price = data.chart?.result?.[0]?.meta?.regularMarketPrice;
          
          if (price !== undefined && price !== null) {
            rates[target] = price;
          }
        } catch (error) {
          this.logger.warn(`Error fetching ticker ${base}${target}=X from Yahoo Finance: ${error.message}`);
        }
      })
    );

    // Ensure we got at least some rates
    if (Object.keys(rates).length === 0) {
      throw new Error(`Failed to fetch any rates from Yahoo Finance for base ${base}`);
    }

    return rates;
  }

  async fetchHistory(
    base: string,
    symbols: string[],
    startDate: string,
    endDate: string,
  ): Promise<Record<string, Record<string, number>>> {
    const target = symbols && symbols.length > 0 ? symbols[0] : 'USD';
    
    try {
      const period1 = Math.floor(new Date(startDate).getTime() / 1000);
      // Set end date to end of day to ensure we capture all data
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      const period2 = Math.floor(end.getTime() / 1000);
      
      const ticker = `${base}${target}=X`;
      const url = `${this.baseUrl}/${ticker}?period1=${period1}&period2=${period2}&interval=1d`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch history for ticker ${ticker} from Yahoo Finance: ${response.statusText}`);
      }
      
      const data = await response.json();
      const result: Record<string, Record<string, number>> = {};
      
      const timestamps = data.chart?.result?.[0]?.timestamp || [];
      const indicators = data.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
      
      timestamps.forEach((ts: number, index: number) => {
        const dateStr = new Date(ts * 1000).toISOString().split('T')[0];
        const price = indicators[index];
        if (price !== undefined && price !== null) {
          result[dateStr] = {
            [target]: price,
          };
        }
      });
      
      return result;
    } catch (error) {
      this.logger.error(`Error fetching history from Yahoo Finance: ${error.message}`);
      throw error;
    }
  }
}

