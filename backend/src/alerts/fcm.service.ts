import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmService implements OnModuleInit {
  private readonly logger = new Logger(FcmService.name);
  private isInitialized = false;

  onModuleInit() {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (projectId && clientEmail && privateKey) {
      try {
        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
        
        initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: formattedPrivateKey,
          }),
        });
        
        this.isInitialized = true;
        this.logger.log('Firebase Admin SDK initialized successfully.');
      } catch (error) {
        this.logger.error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
      }
    } else {
      this.logger.warn('Firebase environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are missing. FCM notifications will be mocked/disabled.');
    }
  }

  async sendPushNotification(token: string, title: string, body: string): Promise<void> {
    if (!token) {
      this.logger.warn('FCM token is empty, cannot send push notification.');
      return;
    }

    if (!this.isInitialized) {
      this.logger.log(`[MOCK FCM] Sending push to token "${token}" -> Title: "${title}", Body: "${body}"`);
      return;
    }

    try {
      const message = {
        notification: {
          title,
          body,
        },
        token,
      };

      const response = await getMessaging().send(message);
      this.logger.log(`FCM push notification sent successfully: ${response}`);
    } catch (error) {
      this.logger.error(`Failed to send FCM push notification: ${error.message}`);
    }
  }
}
