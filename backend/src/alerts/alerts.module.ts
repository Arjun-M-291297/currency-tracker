import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Alert } from './entities/alert.entity';
import { AlertsService } from './alerts.service';
import { AlertsProcessor } from './alerts.processor';
import { AlertsController } from './alerts.controller';
import { RatesModule } from '../rates/rates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert]),
    BullModule.registerQueue({
      name: 'alerts',
    }),
    RatesModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsProcessor],
  exports: [AlertsService],
})
export class AlertsModule implements OnModuleInit {
  constructor(@InjectQueue('alerts') private alertsQueue: Queue) {}

  async onModuleInit() {
    // Add repeatable job every 5 minutes
    await this.alertsQueue.add('check-alerts', {}, {
      repeat: {
        pattern: '*/5 * * * *',
      },
    });
  }
}

