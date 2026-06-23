import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { RatesService } from '../rates/rates.service';
import { AlertsService } from './alerts.service';

@Processor('alerts')
export class AlertsProcessor extends WorkerHost {
  private readonly logger = new Logger(AlertsProcessor.name);

  constructor(
    private readonly ratesService: RatesService,
    private readonly alertsService: AlertsService,
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
              this.logger.log(`Alert triggered! ${alert.base} to ${alert.target} is ${currentRate} (threshold: ${alert.threshold} ${alert.condition})`);
              // TODO: enqueue notification job or send directly via Telegram Bot
            }
          }
        } catch (error) {
          this.logger.error(`Error processing alerts for base ${base}`, error);
        }
      }
    }
  }
}
