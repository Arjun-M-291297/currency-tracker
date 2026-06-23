import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { RatesModule } from '../rates/rates.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [RatesModule, AlertsModule],
  providers: [BotService],
})
export class BotModule {}
