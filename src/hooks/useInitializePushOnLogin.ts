// src/hooks/useInitializePushOnLogin.ts
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushService } from '../services/pushNotificationService';

export const useInitializePushOnLogin = () => {
  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        // Check if user is authenticated
        const token = await AsyncStorage.getItem('token');
        const userId = await AsyncStorage.getItem('userId');

        if (!token || !userId) {
          console.log('⚠️ User not authenticated - skipping push notification initialization');
          return;
        }

        console.log('🔐 User is authenticated, initializing push notifications...');

        if (pushService.getInitializationStatus()) {
          console.log('✅ Push notifications already initialized');
          return;
        }

        const initialized = await pushService.initialize();

        if (initialized) {
          console.log('✅ Push notifications initialized successfully');
          const fcmToken = pushService.getCurrentToken();
          console.log('📱 FCM Token:', fcmToken?.substring(0, 20) + '...');
        } else {
          console.log('⚠️ Push notification initialization failed');
        }
      } catch (error) {
        console.error('❌ Error initializing push notifications:', error);
      }
    };

    initializePushNotifications();
  }, []);
};