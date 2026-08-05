import { getToken, onMessage } from "firebase/messaging";
import { messaging } from "../firebase";
import { databaseService } from "../services/databaseService";

export async function requestPushPermission(userId: string) {
  if (!messaging || !('Notification' in window)) {
    console.log("This browser does not support notifications or messaging is not available.");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY' // The user would need to provide this in production
      });
      
      if (token) {
        await databaseService.saveNotificationToken(userId, token);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error("An error occurred while retrieving token:", error);
    return false;
  }
}

export function onPushMessage(callback: (payload: any) => void) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}
