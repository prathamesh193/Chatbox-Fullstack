import { firebaseConfig } from '../constants/firebaseConfig';

// Initialize Firebase
const initializeFirebase = async (): Promise<boolean> => {
  try {
    // For React Native Firebase, initialization happens automatically
    // when you install the package and add google-services.json
    console.log('Firebase should be auto-initialized with google-services.json');
    return true;
  } catch (error) {
    console.error('Error initializing Firebase:', error);
    return false;
  }
};

export { initializeFirebase };