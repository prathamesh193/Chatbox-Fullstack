import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import App from './App';
import { name as appName } from './app.json';

// Background/Quit State Message Handler
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('🔔 Background message received:', remoteMessage);

  try {
    await notifee.createChannel({
      id: 'chat-messages',
      name: 'Chat Messages',
      importance: 4,
    });

    // Display the notification
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

    console.log('✅ Background notification displayed');
  } catch (error) {
    console.error('❌ Error displaying background notification:', error);
  }
});

AppRegistry.registerComponent(appName, () => App);