import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { RatesService } from '../rates/rates.service';
import { AlertsService } from './alerts.service';
import { BotService } from '../bot/bot.service';
import { FcmService } from './fcm.service';

@Processor('alerts')
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly ratesService: RatesService,
    private readonly alertsService: AlertsService,
    @Inject(forwardRef(() => BotService))
    private readonly botService: BotService,
    private readonly fcmService: FcmService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    if (job.name === 'check-alerts') {
      const activeAlerts = await this.alertsService.getActiveAlerts();
      if (activeAlerts.length === 0) {
        this.logger.log('No active alerts to process.');
        return;
      }

      // Group alerts by base to optimize fetching rates
      const bases = [...new Set(activeAlerts.map(a => a.base))];
      
      for (const base of bases) {
        const baseAlerts = activeAlerts.filter(a => a.base === base);
        const targets = [...new Set(baseAlerts.map(a => a.target))];
        
        try {
          const rates = await this.ratesService.getRates(base, targets);
          
          for (const alert of baseAlerts) {
            const currentRate = rates[alert.target];
            if (!currentRate) continue;

            const isTriggered = 
              (alert.condition === 'above' && currentRate > alert.threshold) ||
              (alert.condition === 'below' && currentRate < alert.threshold);

            if (isTriggered) {
              const alertMsg = `Alert triggered! ${alert.base}/${alert.target} is currently ${currentRate} (Threshold: ${alert.condition} ${alert.threshold})`;
              this.logger.log(alertMsg);

              // 1. Send push notification to mobile via FCM
              if (alert.fcmToken) {
                await this.fcmService.sendPushNotification(
                  alert.fcmToken,
                  `Price Alert: ${alert.base}/${alert.target}`,
                  `The rate has gone ${alert.condition} ${alert.threshold} and is currently ${currentRate}.`
                );
              }

              // 2. Send message via Telegram Bot (if valid chatId exists and is not web default)
              if (alert.chatId && alert.chatId !== 'web') {
                await this.botService.sendMessage(alert.chatId, alertMsg);
              }

              // 3. Deactivate the alert so it only triggers once
              await this.alertsService.toggleAlert(alert.id);
            }
          }
        } catch (error) {
          this.logger.error(`Error processing alerts for base ${base}`, error);
        }
      }
    }
  }
}
