// App.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar, Platform, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import messaging from '@react-native-firebase/messaging';
import notifee, { EventType } from '@notifee/react-native';
import AppNavigator from './src/navigation/Appnavigator';
import { SocketProvider } from './src/context/SocketContext';
import { pushService } from './src/services/pushNotificationService';

const App = () => {
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setupForegroundHandlers();
    setupNotificationHandlers();
  }, []);

  // Initialize Push Notification Service
  const initializePushNotifications = async () => {
    try {
      console.log('🚀 Initializing push notifications...');

      const initialized = await pushService.initialize();

      if (initialized) {
        console.log('✅ Push notifications initialized successfully');

        const token = pushService.getCurrentToken();
        console.log('📱 Current FCM Token:', token);
      } else {
        console.log('⚠️ Push notifications not enabled (user may have denied permission)');
      }

      setInitializing(false);
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
      setInitializing(false);
    }
  };

  // Setup Foreground Notification Handlers
  const setupForegroundHandlers = () => {
    const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
      console.log('📨 Foreground notification received:', remoteMessage);

      try {
        if (Platform.OS === 'android') {
          await notifee.createChannel({
            id: 'chat-messages',
            name: 'Chat Messages',
            importance: 4,
          });
        }

        await notifee.displayNotification({
          title: remoteMessage.notification?.title || 'New Message',
          body: remoteMessage.notification?.body || 'You have a new message',
          data: remoteMessage.data,
          android: {
            channelId: 'chat-messages',
            pressAction: {
              id: 'default',
            },
            smallIcon: 'ic_launcher',
          },
          ios: {
            categoryId: 'chat-messages',
          },
        });

        console.log('✅ Foreground notification displayed');
      } catch (error) {
        console.error('❌ Error displaying foreground notification:', error);
      }
    });

    return unsubscribeForeground;
  };

  // Setup Notification Interaction Handlers
  const setupNotificationHandlers = () => {
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('📱 Notification opened from background:', remoteMessage);
      handleNotificationNavigation(remoteMessage.data);
    });

    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('📱 Notification opened from quit state:', remoteMessage);
          handleNotificationNavigation(remoteMessage.data);
        }
      });

    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.PRESS) {
        console.log('👆 Notifee notification pressed:', detail.notification);
        handleNotificationNavigation(detail.notification?.data);
      }
    });

    return unsubscribeNotifee;
  };

  // Handle Navigation from Notifications
  const handleNotificationNavigation = (data: any) => {
    console.log('🧭 Handling notification navigation with data:', data);

    if (data?.chatId) {
      console.log('💬 Should navigate to chat:', data.chatId);
    }
  };

  return (
    <SafeAreaProvider>
      <SocketProvider>
        <NavigationContainer>
          <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
          <AppNavigator />
        </NavigationContainer>
      </SocketProvider>
    </SafeAreaProvider>
  );
};

export default App;
