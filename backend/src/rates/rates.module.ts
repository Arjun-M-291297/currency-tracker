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
      useFactory: async () => {
        let redisConfig: any = {
          ttl: 300000,
        };

        if (process.env.REDIS_URL) {
          try {
            const parsed = new URL(process.env.REDIS_URL);
            redisConfig = {
              ...redisConfig,
              socket: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                tls: parsed.protocol === 'rediss:' ? {} : undefined,
              },
              username: parsed.username || undefined,
              password: decodeURIComponent(parsed.password || ''),
            };
          } catch (err) {
            // fallback
          }
        } else {
          redisConfig = {
            ...redisConfig,
            socket: {
              host: process.env.REDIS_HOST || '127.0.0.1',
              port: parseInt(process.env.REDIS_PORT || '6379', 10),
            },
            password: process.env.REDIS_PASSWORD || undefined,
          };
        }

        return {
          store: await redisStore(redisConfig),
        };
      },
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
