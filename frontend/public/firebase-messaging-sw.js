// Firebase Cloud Messaging background service worker
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Set Firebase configuration values here (should match the frontend .env.local file).
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

// Check if actual credentials have been added
if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "your-api-key") {
  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    messaging.onBackgroundMessage((payload) => {
      console.log('[firebase-messaging-sw.js] Received background message ', payload);
      
      const notificationTitle = payload.notification?.title || 'Currency Rate Alert';
      const notificationOptions = {
        body: payload.notification?.body || 'An alert condition was met!',
        icon: '/favicon.ico',
      };

      self.registration.showNotification(notificationTitle, notificationOptions);
    });
    
    console.log('[firebase-messaging-sw.js] Service worker initialized messaging successfully.');
  } catch (error) {
    console.error('[firebase-messaging-sw.js] Failed to initialize messaging:', error);
  }
} else {
  console.warn('[firebase-messaging-sw.js] Service worker running in mock mode. Fill in firebaseConfig to enable real push notifications.');
}
