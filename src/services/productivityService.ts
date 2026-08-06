import { collection, onSnapshot, query } from './resilientFirestoreClient';
import { db } from '../firebase';

export interface WhatsAppResponseMetric {
  id: string;
  attendantId: string;
  attendantName: string;
  responseTimeMinutes: number;
  status: 'answered';
  sessionId: string;
  conversationId: string;
  createdAt?: unknown;
}

export interface EmployeeSatisfactionMetric {
  id: string;
  attendantId?: string;
  attendantName?: string;
  atendenteId?: string;
  atendente?: string;
  rating?: number;
  nota?: number;
}

class ProductivityService {
  subscribeWhatsAppMetrics(callback: (items: WhatsAppResponseMetric[]) => void) {
    return onSnapshot(query(collection(db, 'whatsapp_response_metrics')), snapshot => {
      callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as WhatsAppResponseMetric)));
    }, error => console.error('[PRODUCTIVITY] WhatsApp metrics subscription failed', error));
  }

  subscribeSatisfaction(callback: (items: EmployeeSatisfactionMetric[]) => void) {
    return onSnapshot(query(collection(db, 'satisfactionReviews')), snapshot => {
      callback(snapshot.docs.map(item => ({ id: item.id, ...item.data() } as EmployeeSatisfactionMetric)));
    }, error => console.error('[PRODUCTIVITY] Satisfaction subscription failed', error));
  }
}

export const productivityService = new ProductivityService();
