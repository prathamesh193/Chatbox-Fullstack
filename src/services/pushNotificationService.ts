import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { authApi } from '../utils/api';

class PushNotificationService {
  private isInitialized: boolean = false;
  private currentToken: string | null = null;
  private lastUserId: string | null = null;


  async initialize(userId?: string): Promise<boolean> {
    if (this.isInitialized && this.lastUserId === userId) {
      console.log("⚡ Push already initialized for this user");
      return true;
    }

    console.log("🔄 Reinitializing push for user:", userId);

    this.isInitialized = false;
    this.lastUserId = userId || null;
    this.currentToken = null;

    try {
      console.log('🚀 Initializing push notifications...');
      const isSupported = await messaging().isDeviceRegisteredForRemoteMessages;
      console.log('📱 Device registered for remote messages:', isSupported);

      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
        console.log('✅ Device registered for remote messages');
      }

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        console.log('⚠️ User declined notification permissions');
        return false;
      }

      const token = await this.getFCMToken();
      if (!token) {
        console.log('❌ Failed to get FCM token');
        return false;
      }

      this.setupMessageHandlers();

      await this.createNotificationChannels();

      this.isInitialized = true;
      console.log('✅ Push notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      console.log('🔐 Requesting notification permission...');

      const authStatus = await messaging().requestPermission();

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      console.log('📋 Permission status:', authStatus);
      console.log('✅ Permission enabled:', enabled);

      return enabled;
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
      return false;
    }
  }

  async getFCMToken(): Promise<string | null> {
    try {
      console.log('🔑 Getting FCM token...');

      this.currentToken = await messaging().getToken();

      if (!this.currentToken) {
        console.log('❌ No FCM token received');
        return null;
      }

      console.log('✅ FCM Token received:', this.currentToken.substring(0, 20) + '...');

      await this.registerTokenWithBackend(this.currentToken);

      return this.currentToken;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  async registerTokenWithBackend(token: string): Promise<void> {
    try {
      console.log('📡 Registering token with backend...');

      await authApi.post('/api/push/register-fcm', {
        token,
        platform: Platform.OS,
        deviceInfo: {
          os: Platform.OS,
          version: Platform.Version,
        }
      });

      console.log('✅ Token registered with backend successfully');
    } catch (error: any) {
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

    messaging().onTokenRefresh(async (token: string) => {
      console.log('🔄 FCM token refreshed:', token.substring(0, 20) + '...');
      this.currentToken = token;
      await this.registerTokenWithBackend(token);
    });

    console.log('✅ Message handlers set up');
  }

  async createNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      console.log('📢 Creating notification channels...');

      await notifee.createChannel({
        id: 'chat-messages',
        name: 'Chat Messages',
        importance: 4,
        sound: 'default',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'chat-mentions',
        name: 'Mentions',
        importance: 4,
        sound: 'default',
        vibration: true,
      });

      await notifee.createChannel({
        id: 'chat-alerts',
        name: 'Alerts',
        importance: 3,
        sound: 'default',
      });

      console.log('✅ Notification channels created');
    } catch (error) {
      console.error('❌ Error creating notification channels:', error);
    }
  }

  async showLocalNotification(
    title: string,
    body: string,
    data: any = {}
  ): Promise<void> {
    try {
      console.log('🔔 Showing local notification:', title);

      await notifee.displayNotification({
        title,
        body,
        data,
        android: {
          channelId: 'chat-messages',
          pressAction: {
            id: 'default',
          },
          smallIcon: 'ic_launcher',
          color: '#4F46E5',
          importance: 4,
        },
        ios: {
          categoryId: 'chat-messages',
          sound: 'default',
        },
      });

      console.log('✅ Local notification displayed');
    } catch (error) {
      console.error('❌ Error showing local notification:', error);
    }
  }

  handleNotificationClick(data: any): void {
    console.log('👆 Notification clicked with data:', data);

    if (data?.chatId) {
      console.log('💬 Chat notification clicked:', data.chatId);
    }
    if (data?.userId) {
      console.log('👤 User notification clicked:', data.userId);
    }
  }

  async unregisterToken(): Promise<void> {
    try {
      if (this.currentToken) {
        console.log('🗑️  Unregistering token...');

        await authApi.post('/api/push/unregister-fcm', {
          token: this.currentToken
        });

        await messaging().deleteToken();

        this.currentToken = null;
        console.log('✅ Token unregistered successfully');
      }
    } catch (error: any) {
      console.log('⚠️  Could not unregister token:', error.message);
    }
  }

  async cleanup(): Promise<void> {
    console.log('🧹 Cleaning up push notification service...');
    await this.unregisterToken();
    this.isInitialized = false;
    this.lastUserId = null;
    this.currentToken = null;
    console.log('✅ Push service cleaned up');
  }

  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  getCurrentToken(): string | null {
    return this.currentToken;
  }

  async checkPermission(): Promise<number> {
    const authStatus = await messaging().hasPermission();
    return authStatus;
  }

  async getBadgeCount(): Promise<number> {
    if (Platform.OS === 'ios') {
      return await notifee.getBadgeCount();
    }
    return 0;
  }

  async setBadgeCount(count: number): Promise<void> {
    if (Platform.OS === 'ios') {
      await notifee.setBadgeCount(count);
    }
  }

  async incrementBadge(): Promise<void> {
    if (Platform.OS === 'ios') {
      await notifee.incrementBadgeCount();
    }
  }

  async decrementBadge(): Promise<void> {
    if (Platform.OS === 'ios') {
      await notifee.decrementBadgeCount();
    }
  }
}

export const pushService = new PushNotificationService();