import { Controller, Get, Query } from '@nestjs/common';
import { RatesService } from './rates.service';

@Controller('rates')
export class RatesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  async getRates(
    @Query('base') base: string = 'USD',
    @Query('symbols') symbols: string,
  ) {
    const symbolArray = symbols ? symbols.split(',') : [];
    const rates = await this.ratesService.getRates(base, symbolArray);
    return {
      base,
      rates,
    };
  }

  @Get('history')
  async getHistory(
    @Query('base') base: string = 'USD',
    @Query('target') target: string = 'INR',
    @Query('range') range: string = '1M',
  ) {
    return this.ratesService.getHistoricalRates(base, target, range);
  }

  @Get('refresh')
  async refreshRates(
    @Query('base') base: string = 'USD',
    @Query('symbols') symbols: string,
  ) {
    const symbolArray = symbols ? symbols.split(',') : [];
    const rates = await this.ratesService.refreshRates(base, symbolArray);
    return {
      base,
      rates,
      refreshedAt: new Date().toISOString(),
    };
  }

  @Get('convert')
  async convert(
    @Query('amount') amount: number,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    if (!amount || !from || !to) {
      return { error: 'amount, from, and to are required query parameters' };
    }
    const result = await this.ratesService.convert(Number(amount), from, to);
    return {
      amount: Number(amount),
      from,
      to,
      result,
    };
  }
}
