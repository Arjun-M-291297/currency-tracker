import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { AlertsService } from './alerts.service';

class CreateAlertDto {
  base: string;
  target: string;
  threshold: number;
  condition: 'above' | 'below';
  chatId?: string;
  fcmToken?: string;
}

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  getAlerts() {
    return this.alertsService.getActiveAlerts();
  }

  @Get('all')
  getAllAlerts() {
    return this.alertsService.getAllAlerts();
  }

  @Post()
  createAlert(@Body() dto: CreateAlertDto) {
    return this.alertsService.createAlert({
      base: dto.base,
      target: dto.target,
      threshold: dto.threshold,
      condition: dto.condition,
      chatId: dto.chatId || 'web',
      fcmToken: dto.fcmToken,
      isActive: true,
    });
  }

  @Patch(':id/toggle')
  async toggleAlert(@Param('id') id: string) {
    const alert = await this.alertsService.toggleAlert(id);
    if (!alert) throw new NotFoundException(`Alert ${id} not found`);
    return alert;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAlert(@Param('id') id: string) {
    await this.alertsService.deleteAlert(id);
  }
}
