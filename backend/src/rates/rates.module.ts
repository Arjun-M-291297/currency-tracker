import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { RatesController } from './rates.controller';
import { RatesService } from './rates.service';
import { ExchangeRateHostAdapter } from './providers/exchangerate-host.adapter';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
          },
          ttl: 300000,
        }),
      }),
    }),
  ],
  controllers: [RatesController],
  providers: [
    RatesService,
    {
      provide: 'RateProvider',
      useClass: ExchangeRateHostAdapter,
    },
  ],
  exports: [RatesService],
})
export class RatesModule {}
