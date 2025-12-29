import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { authApi } from '../utils/api';

class PushNotificationService {
  private isInitialized: boolean = false;
  private currentToken: string | null = null;

  async initialize(): Promise<boolean> {
    try {
      console.log('🚀 Initializing push notifications...');

      // Register device for remote messages
      await messaging().registerDeviceForRemoteMessages();

      // Request permission (iOS)
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (!enabled) {
          console.log('User declined notification permissions');
          return false;
        }
      }

      // Get FCM token
      await this.getFCMToken();
      
      // Setup message handlers
      this.setupMessageHandlers();
      
      this.isInitialized = true;
      console.log('✅ Push notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
      return false;
    }
  }

  async getFCMToken(): Promise<string | null> {
    try {
      console.log('🔑 Getting FCM token...');
      this.currentToken = await messaging().getToken();
      console.log('✅ FCM Token received:', this.currentToken);

      if (this.currentToken) {
        await this.registerTokenWithBackend(this.currentToken);
        return this.currentToken;
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

async registerTokenWithBackend(token: string): Promise<void> {
  try {
    console.log('📡 Registering token with backend...');
    // Now the URL will be correct: http://192.168.31.56:3000/api/push/register-fcm
    await authApi.post('/api/push/register-fcm', { token });
    console.log('✅ Token registered with backend successfully');
  } catch (error: any) {
    // Handle different error cases
    if (error.response?.status === 404) {
      console.log('ℹ️  Push endpoints not available on backend');
    } else if (error.response?.status === 401) {
      console.log('🔐 Not authenticated - token not registered');
    } else if (error.code === 'NETWORK_ERROR') {
      console.log('🌐 Network error - cannot reach backend');
    } else {
      console.log('⚠️  Could not register token:', error.message);
    }
  }
}

  setupMessageHandlers(): void {
    console.log('🔧 Setting up message handlers...');

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage: any) => {
      console.log('📨 Foreground message received:', remoteMessage);
      await this.showLocalNotification(
        remoteMessage.notification?.title || 'New Message',
        remoteMessage.notification?.body || 'You have a new message',
        remoteMessage.data
      );
    });

    // Handle notification opened from background state
    messaging().onNotificationOpenedApp((remoteMessage: any) => {
      console.log('📱 Notification opened from background:', remoteMessage);
      this.handleNotificationClick(remoteMessage.data);
    });

    // Handle notification opened from quit state
    messaging().getInitialNotification().then((remoteMessage: any) => {
      if (remoteMessage) {
        console.log('📱 Notification opened from quit state:', remoteMessage);
        this.handleNotificationClick(remoteMessage.data);
      }
    });

    // Handle token refresh
    messaging().onTokenRefresh(async (token: string) => {
      console.log('🔄 FCM token refreshed:', token);
      this.currentToken = token;
      await this.registerTokenWithBackend(token);
    });
  }

  async showLocalNotification(title: string, body: string, data: any = {}): Promise<void> {
    try {
      // Create channel (required for Android)
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: 'chat-messages',
          name: 'Chat Messages',
          importance: 4, // High importance
        });
      }

      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId: 'chat-messages',
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          categoryId: 'chat-messages',
        },
      });
      
      console.log('✅ Local notification displayed:', title);
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
  }

  handleNotificationClick(data: any): void {
    console.log('👆 Notification clicked with data:', data);
    // You can add navigation logic here based on data
    if (data.chatId) {
      console.log('💬 Navigate to chat:', data.chatId);
    }
  }
async unregisterToken(): Promise<void> {
  try {
    if (this.currentToken) {
      console.log('🗑️  Unregistering token...');
      // Now the URL will be correct: http://192.168.31.56:3000/api/push/unregister-fcm
      await authApi.post('/api/push/unregister-fcm', { token: this.currentToken });
      this.currentToken = null;
      console.log('✅ Token unregistered');
    }
  } catch (error: any) {
    console.log('⚠️  Could not unregister token:', error.message);
  }
}

  async cleanup(): Promise<void> {
    await this.unregisterToken();
    this.isInitialized = false;
    console.log('✅ Push service cleaned up');
  }

  // Get current status
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }
}

export const pushService = new PushNotificationService();