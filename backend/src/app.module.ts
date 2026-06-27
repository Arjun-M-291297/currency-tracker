import { Module, NestModule, MiddlewareConsumer, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RatesModule } from './rates/rates.module';
import { AlertsModule } from './alerts/alerts.module';
import { BotModule } from './bot/bot.module';
import { Alert } from './alerts/entities/alert.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: 'postgres',
            url: process.env.DATABASE_URL,
            entities: [Alert],
            synchronize: true,
            ssl: { rejectUnauthorized: false },
          }
        : {
            type: 'postgres',
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '5433', 10),
            username: process.env.DB_USER || 'myuser',
            password: process.env.DB_PASSWORD || 'mypassword',
            database: process.env.DB_NAME || 'currencyapp',
            entities: [Alert],
            synchronize: true,
          },
    ),
    BullModule.forRoot({
      connection: (() => {
        if (process.env.REDIS_URL) {
          try {
            const parsed = new URL(process.env.REDIS_URL);
            return {
              host: parsed.hostname,
              port: parseInt(parsed.port || '6379', 10),
              username: parsed.username || undefined,
              password: decodeURIComponent(parsed.password || ''),
              tls: parsed.protocol === 'rediss:' ? {} : undefined,
            };
          } catch (err) {
            // fallback
          }
        }
        return {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD || undefined,
        };
      })(),
    }),
    RatesModule,
    AlertsModule,
    BotModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: any, res: any, next: () => void) => {
        const logger = new Logger('HTTP');
        const { method, originalUrl } = req;
        const userAgent = req.get('user-agent') || '';
        
        res.on('finish', () => {
          const { statusCode } = res;
          logger.log(`${method} ${originalUrl} ${statusCode} - ${userAgent}`);
        });
        
        next();
      })
      .forRoutes('*');
  }
}
