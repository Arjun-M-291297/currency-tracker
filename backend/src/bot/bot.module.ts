import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { RatesModule } from '../rates/rates.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [RatesModule, forwardRef(() => AlertsModule)],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
