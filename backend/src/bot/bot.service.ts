import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { RatesService } from '../rates/rates.service';
import { AlertsService } from '../alerts/alerts.service';

@Injectable()
export class BotService implements OnModuleInit {
  private readonly logger = new Logger(BotService.name);
  private bot: Telegraf;

  constructor(
    private readonly ratesService: RatesService,
    private readonly alertsService: AlertsService,
  ) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (token) {
      this.bot = new Telegraf(token);
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN is missing. Bot will not be initialized.');
    }
  }

  onModuleInit() {
    if (!this.bot) return;

    this.bot.command('rate', async (ctx) => {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        return ctx.reply('Usage: /rate <BASE> <TARGET> (e.g. /rate AED INR)');
      }
      const base = parts[1].toUpperCase();
      const target = parts[2].toUpperCase();

      try {
        const rates = await this.ratesService.getRates(base, [target]);
        if (rates[target]) {
          ctx.reply(`Current rate: 1 ${base} = ${rates[target]} ${target}`);
        } else {
          ctx.reply(`Could not fetch rate for ${target} from ${base}`);
        }
      } catch (error) {
        ctx.reply('Error fetching rate.');
      }
    });

    this.bot.command('alert', async (ctx) => {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 5) {
        return ctx.reply('Usage: /alert <BASE> <TARGET> <CONDITION: above|below> <THRESHOLD> (e.g. /alert AED INR above 24.5)');
      }
      const base = parts[1].toUpperCase();
      const target = parts[2].toUpperCase();
      const condition = parts[3].toLowerCase() as 'above' | 'below';
      const threshold = parseFloat(parts[4]);

      if (isNaN(threshold) || !['above', 'below'].includes(condition)) {
        return ctx.reply('Invalid condition or threshold.');
      }

      try {
        await this.alertsService.createAlert({
          chatId: ctx.chat.id.toString(),
          base,
          target,
          condition,
          threshold,
          isActive: true,
        });
        ctx.reply(`Alert set! I'll notify you when ${base} to ${target} goes ${condition} ${threshold}.`);
      } catch (error) {
        ctx.reply('Failed to save alert.');
      }
    });

    this.bot.command('watchlist', async (ctx) => {
      const activeAlerts = await this.alertsService.getActiveAlerts();
      const userAlerts = activeAlerts.filter(a => a.chatId === ctx.chat.id.toString());
      
      if (userAlerts.length === 0) {
        return ctx.reply('You have no active alerts on your watchlist.');
      }
      
      const response = userAlerts.map(a => `- ${a.base} → ${a.target} ${a.condition} ${a.threshold}`).join('\n');
      ctx.reply(`Your Watchlist:\n${response}`);
    });

    this.bot.launch();
    this.logger.log('Telegram bot started.');
  }

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.telegram.sendMessage(chatId, text);
        this.logger.log(`Telegram message sent to ${chatId}`);
      } catch (error) {
        this.logger.error(`Failed to send Telegram message to ${chatId}: ${error.message}`);
      }
    } else {
      this.logger.warn(`Cannot send Telegram message to ${chatId}: Bot is not initialized.`);
    }
  }
}
