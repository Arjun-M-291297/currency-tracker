import { Module, Logger } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisInsStore } from 'cache-manager-redis-yet';
import { createClient } from 'redis';
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
        let redisConfig: any = {};
        const isTls = process.env.REDIS_TLS === 'true' || 
                      process.env.REDIS_URL?.startsWith('rediss:') || 
                      process.env.REDIS_HOST?.includes('upstash.io');

        if (process.env.REDIS_URL) {
          try {
            const parsed = new URL(process.env.REDIS_URL);
            redisConfig = {
              ...redisConfig,
              socket: {
                host: parsed.hostname,
                port: parseInt(parsed.port || '6379', 10),
                tls: isTls ? { rejectUnauthorized: false } : undefined,
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
              tls: isTls ? { rejectUnauthorized: false } : undefined,
            },
            password: process.env.REDIS_PASSWORD || undefined,
          };
        }

        const client = createClient(redisConfig);

        // Attach error listener IMMEDIATELY before client connection is established
        client.on('error', (err) => {
          Logger.error(`Cache Redis Client Error: ${err.message}`, 'CacheModule');
        });

        // Connect in the background without blocking NestJS bootstrap / port binding
        client.connect().catch((err) => {
          Logger.error(`Initial Cache Redis Connection Failed: ${err.message}`, 'CacheModule');
        });

        const store = redisInsStore(client as any, { ttl: 300000 });

        return {
          store,
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
