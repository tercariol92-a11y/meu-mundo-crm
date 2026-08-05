import { collection, query, where, orderBy, onSnapshot, updateDoc, doc, getDocs } from '../../services/resilientFirestoreClient';
import { db } from '../api/firebase';
import { Notification } from '../types';

export type { Notification };

export const notificationsService = {
  getNotifications(userId: string, callback: (notifications: Notification[]) => void) {
    const q = query(
      collection(db, 'notificacoes'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snap) => {
      const notifications = snap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
      callback(notifications);
    });
  },

  async markAsRead(notificationId: string) {
    await updateDoc(doc(db, 'notificacoes', notificationId), {
      read: true
    });
  }
};
