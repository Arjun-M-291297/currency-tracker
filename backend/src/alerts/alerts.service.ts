import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './entities/alert.entity';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectRepository(Alert) private alertRepository: Repository<Alert>,
    @InjectQueue('alerts') private alertsQueue: Queue,
  ) {}

  async createAlert(data: Partial<Alert>): Promise<Alert> {
    let existingCount = 0;
    if (data.fcmToken) {
      existingCount = await this.alertRepository.count({
        where: { fcmToken: data.fcmToken, isActive: true },
      });
    } else if (data.chatId && data.chatId !== 'web') {
      existingCount = await this.alertRepository.count({
        where: { chatId: data.chatId, isActive: true },
      });
    } else {
      existingCount = await this.alertRepository.count({
        where: { chatId: 'web', isActive: true },
      });
    }

    if (existingCount >= 5) {
      throw new BadRequestException('You have reached the limit of 5 active alerts.');
    }

    const alert = this.alertRepository.create(data);
    return this.alertRepository.save(alert);
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return this.alertRepository.find({ where: { isActive: true }, order: { createdAt: 'DESC' } });
  }

  async getAllAlerts(): Promise<Alert[]> {
    return this.alertRepository.find({ order: { createdAt: 'DESC' } });
  }

  async toggleAlert(id: string): Promise<Alert | null> {
    const alert = await this.alertRepository.findOne({ where: { id } });
    if (!alert) return null;
    alert.isActive = !alert.isActive;
    return this.alertRepository.save(alert);
  }

  async deleteAlert(id: string): Promise<void> {
    await this.alertRepository.delete(id);
  }

  async processAlerts() {
    this.logger.log('Adding check-alerts job to queue');
    await this.alertsQueue.add('check-alerts', {}, { removeOnComplete: true });
  }
}
