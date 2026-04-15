import { logger } from '../utils/logger';
import { query } from '../db/client';
import crypto from 'crypto';

export interface WebhookEvent {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'delivered' | 'failed';
  deliveredAt?: number;
  errorMessage?: string;
}

export interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
  headers?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface WebhookDelivery {
  webhookId: string;
  eventId: string;
  url: string;
  payload: string;
  headers: Record<string, string>;
  signature?: string;
  statusCode?: number;
  response?: string;
  duration?: number;
  timestamp: number;
}

class WebhookManager {
  private static instance: WebhookManager;
  private subscriptions = new Map<string, WebhookSubscription>();
  private eventQueue: WebhookEvent[] = [];
  private processing = false;
  private retryDelay = 5000; // 5 seconds
  private maxRetries = 3;

  private constructor() {
    this.loadSubscriptions();
    this.startProcessing();
  }

  static getInstance(): WebhookManager {
    if (!WebhookManager.instance) {
      WebhookManager.instance = new WebhookManager();
    }
    return WebhookManager.instance;
  }

  private async loadSubscriptions(): Promise<void> {
    try {
      const results = await query<WebhookSubscription>(
        'SELECT id, url, events, secret, active, headers, created_at, updated_at FROM webhooks WHERE active = true'
      );

      for (const row of results) {
        this.subscriptions.set(row.id, {
          id: row.id,
          url: row.url,
          events: row.events,
          secret: row.secret,
          active: row.active,
          headers: row.headers ? JSON.parse(row.headers) : undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      }

      logger.info(`Loaded ${this.subscriptions.size} webhook subscriptions`);
    } catch (error) {
      logger.error('Failed to load webhook subscriptions', { error: (error as Error).message });
    }
  }

  async createSubscription(webhook: Omit<WebhookSubscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<WebhookSubscription> {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    const newSubscription: WebhookSubscription = {
      id,
      ...webhook,
      createdAt: now,
      updatedAt: now
    };

    try {
      await query(
        'INSERT INTO webhooks (id, url, events, secret, active, headers, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [id, webhook.url, JSON.stringify(webhook.events), webhook.secret, webhook.active, webhook.headers ? JSON.stringify(webhook.headers) : null, now, now]
      );

      this.subscriptions.set(id, newSubscription);
      logger.info('Webhook subscription created', { id, url: webhook.url, events: webhook.events });
      
      return newSubscription;
    } catch (error) {
      logger.error('Failed to create webhook subscription', { error: (error as Error).message });
      throw error;
    }
  }

  async updateSubscription(id: string, updates: Partial<WebhookSubscription>): Promise<WebhookSubscription> {
    const existing = this.subscriptions.get(id);
    if (!existing) {
      throw new Error('Webhook subscription not found');
    }

    const updated: WebhookSubscription = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };

    try {
      await query(
        'UPDATE webhooks SET url = $1, events = $2, secret = $3, active = $4, headers = $5, updated_at = $6 WHERE id = $7',
        [updated.url, JSON.stringify(updated.events), updated.secret, updated.active, updated.headers ? JSON.stringify(updated.headers) : null, updated.updatedAt, id]
      );

      this.subscriptions.set(id, updated);
      logger.info('Webhook subscription updated', { id });
      
      return updated;
    } catch (error) {
      logger.error('Failed to update webhook subscription', { error: (error as Error).message });
      throw error;
    }
  }

  async deleteSubscription(id: string): Promise<void> {
    try {
      await query('DELETE FROM webhooks WHERE id = $1', [id]);
      this.subscriptions.delete(id);
      logger.info('Webhook subscription deleted', { id });
    } catch (error) {
      logger.error('Failed to delete webhook subscription', { error: (error as Error).message });
      throw error;
    }
  }

  async triggerEvent(type: string, data: Record<string, any>): Promise<void> {
    const event: WebhookEvent = {
      id: crypto.randomUUID(),
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: this.maxRetries,
      status: 'pending'
    };

    // Store event in database
    await query(
      'INSERT INTO webhook_events (id, type, data, timestamp, retries, max_retries, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [event.id, type, JSON.stringify(data), event.timestamp, event.retries, event.maxRetries, event.status]
    );

    // Add to queue
    this.eventQueue.push(event);
    logger.debug('Webhook event triggered', { type, eventId: event.id });
  }

  private startProcessing(): void {
    setInterval(() => {
      this.processEvents();
    }, 1000); // Process every second
  }

  private async processEvents(): Promise<void> {
    if (this.processing || this.eventQueue.length === 0) {
      return;
    }

    this.processing = true;

    try {
      const events = [...this.eventQueue];
      this.eventQueue = [];

      for (const event of events) {
        await this.processEvent(event);
      }
    } catch (error) {
      logger.error('Error processing webhook events', { error: (error as Error).message });
    } finally {
      this.processing = false;
    }
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    const relevantSubscriptions = Array.from(this.subscriptions.values()).filter(
      sub => sub.active && sub.events.includes(event.type)
    );

    if (relevantSubscriptions.length === 0) {
      await this.markEventDelivered(event.id);
      return;
    }

    const promises = relevantSubscriptions.map(subscription => 
      this.deliverWebhook(subscription, event)
    );

    await Promise.allSettled(promises);
  }

  private async deliverWebhook(subscription: WebhookSubscription, event: WebhookEvent): Promise<void> {
    const delivery: WebhookDelivery = {
      webhookId: subscription.id,
      eventId: event.id,
      url: subscription.url,
      payload: JSON.stringify(event.data),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'GolfCharity-Webhook/1.0',
        'X-Webhook-Event': event.type,
        'X-Webhook-ID': event.id,
        ...subscription.headers
      },
      timestamp: Date.now()
    };

    // Add signature if secret is provided
    if (subscription.secret) {
      const signature = this.generateSignature(delivery.payload, subscription.secret);
      delivery.signature = signature;
      delivery.headers['X-Webhook-Signature'] = `sha256=${signature}`;
    }

    try {
      const startTime = Date.now();
      const response = await fetch(subscription.url, {
        method: 'POST',
        headers: delivery.headers,
        body: delivery.payload,
        timeout: 30000 // 30 seconds timeout
      });

      delivery.duration = Date.now() - startTime;
      delivery.statusCode = response.status;
      delivery.response = await response.text();

      // Store delivery record
      await this.storeDelivery(delivery);

      if (response.ok) {
        logger.info('Webhook delivered successfully', {
          webhookId: subscription.id,
          eventId: event.id,
          statusCode: response.status,
          duration: delivery.duration
        });
      } else {
        logger.warn('Webhook delivery failed', {
          webhookId: subscription.id,
          eventId: event.id,
          statusCode: response.status,
          response: delivery.response
        });
      }
    } catch (error) {
      delivery.duration = Date.now() - delivery.timestamp;
      delivery.errorMessage = (error as Error).message;

      await this.storeDelivery(delivery);

      logger.error('Webhook delivery error', {
        webhookId: subscription.id,
        eventId: event.id,
        error: delivery.errorMessage
      });
    }
  }

  private generateSignature(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private async storeDelivery(delivery: WebhookDelivery): Promise<void> {
    try {
      await query(
        'INSERT INTO webhook_deliveries (webhook_id, event_id, url, payload, headers, signature, status_code, response, duration, timestamp, error_message) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
        [
          delivery.webhookId,
          delivery.eventId,
          delivery.url,
          delivery.payload,
          JSON.stringify(delivery.headers),
          delivery.signature,
          delivery.statusCode,
          delivery.response,
          delivery.duration,
          delivery.timestamp,
          delivery.errorMessage
        ]
      );
    } catch (error) {
      logger.error('Failed to store webhook delivery', { error: (error as Error).message });
    }
  }

  private async markEventDelivered(eventId: string): Promise<void> {
    try {
      await query('UPDATE webhook_events SET status = $1, delivered_at = $2 WHERE id = $3', 
        ['delivered', Date.now(), eventId]);
    } catch (error) {
      logger.error('Failed to mark webhook event as delivered', { error: (error as Error).message });
    }
  }

  // Event types
  static readonly EVENT_TYPES = {
    USER_CREATED: 'user.created',
    USER_UPDATED: 'user.updated',
    USER_DELETED: 'user.deleted',
    SUBSCRIPTION_CREATED: 'subscription.created',
    SUBSCRIPTION_UPDATED: 'subscription.updated',
    SUBSCRIPTION_CANCELLED: 'subscription.cancelled',
    PAYMENT_SUCCEEDED: 'payment.succeeded',
    PAYMENT_FAILED: 'payment.failed',
    SCORE_SUBMITTED: 'score.submitted',
    DRAW_PUBLISHED: 'draw.published',
    CHARITY_CONTRIBUTION: 'charity.contribution'
  };

  // Public methods for triggering events
  async userCreated(userId: string, userData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.USER_CREATED, {
      userId,
      user: userData
    });
  }

  async userUpdated(userId: string, userData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.USER_UPDATED, {
      userId,
      user: userData
    });
  }

  async subscriptionCreated(subscriptionId: string, subscriptionData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.SUBSCRIPTION_CREATED, {
      subscriptionId,
      subscription: subscriptionData
    });
  }

  async subscriptionCancelled(subscriptionId: string, subscriptionData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.SUBSCRIPTION_CANCELLED, {
      subscriptionId,
      subscription: subscriptionData
    });
  }

  async paymentSucceeded(paymentId: string, paymentData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.PAYMENT_SUCCEEDED, {
      paymentId,
      payment: paymentData
    });
  }

  async scoreSubmitted(scoreId: string, scoreData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.SCORE_SUBMITTED, {
      scoreId,
      score: scoreData
    });
  }

  async drawPublished(drawId: string, drawData: any): Promise<void> {
    await this.triggerEvent(WebhookManager.EVENT_TYPES.DRAW_PUBLISHED, {
      drawId,
      draw: drawData
    });
  }

  // Utility methods
  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  getSubscription(id: string): WebhookSubscription | undefined {
    return this.subscriptions.get(id);
  }

  async getDeliveryHistory(eventId: string): Promise<WebhookDelivery[]> {
    try {
      const results = await query<WebhookDelivery>(
        'SELECT * FROM webhook_deliveries WHERE event_id = $1 ORDER BY timestamp DESC',
        [eventId]
      );
      return results;
    } catch (error) {
      logger.error('Failed to get webhook delivery history', { error: (error as Error).message });
      return [];
    }
  }

  async getEventHistory(limit: number = 100, offset: number = 0): Promise<WebhookEvent[]> {
    try {
      const results = await query<WebhookEvent>(
        'SELECT * FROM webhook_events ORDER BY timestamp DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      return results;
    } catch (error) {
      logger.error('Failed to get webhook event history', { error: (error as Error).message });
      return [];
    }
  }

  // Webhook verification
  static verifySignature(payload: string, signature: string, secret: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return `sha256=${expectedSignature}` === signature;
  }

  // Statistics
  async getStatistics(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalEvents: number;
    pendingEvents: number;
    deliveredEvents: number;
    failedEvents: number;
    averageDeliveryTime: number;
  }> {
    try {
      const [subscriptions, events] = await Promise.all([
        query<{ count: string }>('SELECT COUNT(*) as count FROM webhooks'),
        query<{ count: string }>('SELECT COUNT(*) as count FROM webhooks WHERE active = true'),
        query<{ count: string }>('SELECT COUNT(*) as count FROM webhook_events'),
        query<{ count: string }>('SELECT COUNT(*) as count FROM webhook_events WHERE status = $1', ['pending']),
        query<{ count: string }>('SELECT COUNT(*) as count FROM webhook_events WHERE status = $1', ['delivered']),
        query<{ count: string }>('SELECT COUNT(*) as count FROM webhook_events WHERE status = $1', ['failed']),
        query<{ avg: string }>('SELECT AVG(duration) as avg FROM webhook_deliveries WHERE status_code >= 200 AND status_code < 300')
      ]);

      return {
        totalSubscriptions: parseInt(subscriptions[0].count),
        activeSubscriptions: parseInt(subscriptions[1].count),
        totalEvents: parseInt(events[0].count),
        pendingEvents: parseInt(events[1].count),
        deliveredEvents: parseInt(events[2].count),
        failedEvents: parseInt(events[3].count),
        averageDeliveryTime: parseFloat(events[4].avg || '0')
      };
    } catch (error) {
      logger.error('Failed to get webhook statistics', { error: (error as Error).message });
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        totalEvents: 0,
        pendingEvents: 0,
        deliveredEvents: 0,
        failedEvents: 0,
        averageDeliveryTime: 0
      };
    }
  }
}

export const webhookManager = WebhookManager.getInstance();

// Webhook middleware for verifying incoming webhooks
export function webhookVerification(secret: string) {
  return (req: any, res: any, next: any) => {
    const signature = req.get('X-Webhook-Signature');
    const payload = JSON.stringify(req.body);

    if (!signature) {
      return res.status(401).json({ error: 'Missing signature' });
    }

    if (!WebhookManager.verifySignature(payload, signature, secret)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    next();
  };
}
