import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { ExchangeRateHostAdapter } from './providers/exchangerate-host.adapter';
import { FrankfurterAdapter } from './providers/frankfurter.adapter';
import { FreecurrencyapiAdapter } from './providers/freecurrencyapi.adapter';
import { ExchangeRateFunAdapter } from './providers/exchangerate-fun.adapter';
import { YahooFinanceAdapter } from './providers/yahoofinance.adapter';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore(
          process.env.REDIS_URL
            ? {
                url: process.env.REDIS_URL,
                ttl: 300000,
              }
            : {
                socket: {
                  host: process.env.REDIS_HOST || '127.0.0.1',
                  port: parseInt(process.env.REDIS_PORT || '6379', 10),
                },
                password: process.env.REDIS_PASSWORD || undefined,
                ttl: 300000,
              },
        ),
      }),
    }),
  ],
  controllers: [RatesController],
  providers: [
    RatesService,
    FrankfurterAdapter,
    FreecurrencyapiAdapter,
    ExchangeRateHostAdapter,
    ExchangeRateFunAdapter,
    YahooFinanceAdapter,
    {
      provide: 'RateProvider',
      useFactory: (
        freecurrencyapi: FreecurrencyapiAdapter,
        exchangerateHost: ExchangeRateHostAdapter,
        exchangerateFun: ExchangeRateFunAdapter,
        yahooFinance: YahooFinanceAdapter,
      ) => {
        const provider = process.env.RATE_PROVIDER || 'yahoofinance';
        switch (provider.toLowerCase()) {
          case 'freecurrencyapi':
            return freecurrencyapi;
          case 'exchangeratehost':
            return exchangerateHost;
          case 'exchangeratefun':
            return exchangerateFun;
          case 'yahoofinance':
          default:
            return yahooFinance;
          }
      },
      inject: [
        FreecurrencyapiAdapter,
        ExchangeRateHostAdapter,
        ExchangeRateFunAdapter,
        YahooFinanceAdapter,
      ],
    },
  ],
  exports: [RatesService],
})
export class RatesModule {}
