import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase only if keys are present and we are in the browser
const isClient = typeof window !== 'undefined';
const hasConfig = process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'your-api-key';

let app: FirebaseApp | undefined;
if (isClient && hasConfig) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
}

export const getFcmToken = async (): Promise<string | null> => {
  if (!isClient) return null;

  if (!hasConfig) {
    console.warn('Firebase configuration is missing or using placeholders. FCM notifications are in mock mode.');
    return null;
  }

  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('Firebase Cloud Messaging is not supported on this browser.');
      return null;
    }

    // Register service worker if not already registered (NextJS specific)
    if ('serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }

    const messaging = app ? getMessaging(app) : getMessaging();

    // Request notification permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('Notification permission denied or dismissed.');
      return null;
    }

    // Retrieve FCM registration token
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });
    
    return token;
  } catch (error) {
    console.error('An error occurred while retrieving FCM token:', error);
    return null;
  }
};
