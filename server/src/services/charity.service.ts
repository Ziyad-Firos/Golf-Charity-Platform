import { query } from '../db/client';
import { stripe } from './subscription.service';

export interface Charity {
  id: string;
  name: string;
  description: string | null;
  image_urls: string[] | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CharityEvent {
  id: string;
  charity_id: string;
  title: string;
  event_date: string;
  description: string | null;
  created_at: string;
}

export interface CharityWithEvents extends Charity {
  events: CharityEvent[];
}

// ─── Public ──────────────────────────────────────────────────────────────────

export async function getActiveCharities(search?: string, filter?: string): Promise<Charity[]> {
  if (search) {
    return query<Charity>(
      `SELECT id, name, description, image_urls, is_featured, is_active, created_at, updated_at
       FROM charities
       WHERE is_active = true
         AND (name ILIKE $1 OR description ILIKE $1)
       ORDER BY name ASC`,
      [`%${search}%`]
    );
  }

  if (filter) {
    return query<Charity>(
      `SELECT id, name, description, image_urls, is_featured, is_active, created_at, updated_at
       FROM charities
       WHERE is_active = true
         AND name ILIKE $1
       ORDER BY name ASC`,
      [`%${filter}%`]
    );
  }

  return query<Charity>(
    `SELECT id, name, description, image_urls, is_featured, is_active, created_at, updated_at
     FROM charities
     WHERE is_active = true
     ORDER BY name ASC`
  );
}

export async function getFeaturedCharity(): Promise<Charity | null> {
  const rows = await query<Charity>(
    `SELECT id, name, description, image_urls, is_featured, is_active, created_at, updated_at
     FROM charities
     WHERE is_featured = true AND is_active = true
     LIMIT 1`
  );
  return rows[0] ?? null;
}

export async function getCharityById(id: string): Promise<CharityWithEvents | null> {
  const charities = await query<Charity>(
    `SELECT id, name, description, image_urls, is_featured, is_active, created_at, updated_at
     FROM charities
     WHERE id = $1`,
    [id]
  );

  if (charities.length === 0) return null;

  const events = await query<CharityEvent>(
    `SELECT id, charity_id, title, event_date, description, created_at
     FROM charity_events
     WHERE charity_id = $1
     ORDER BY event_date ASC`,
    [id]
  );

  return { ...charities[0], events };
}

// ─── Subscriber ───────────────────────────────────────────────────────────────

export interface SubscriberCharityInfo {
  charity_id: string | null;
  charity_contribution_pct: string;
  charity: Charity | null;
}

export async function getSubscriberCharity(subscriberId: string): Promise<SubscriberCharityInfo> {
  const rows = await query<{ charity_id: string | null; charity_contribution_pct: string }>(
    `SELECT charity_id, charity_contribution_pct FROM subscribers WHERE id = $1`,
    [subscriberId]
  );

  const row = rows[0];
  if (!row) throw new Error('Subscriber not found');

  let charity: Charity | null = null;
  if (row.charity_id) {
    const charities = await query<Charity>(
      `SELECT id, name, description, image_urls, is_featured, is_active, created_at, updated_at
       FROM charities WHERE id = $1`,
      [row.charity_id]
    );
    charity = charities[0] ?? null;
  }

  return { charity_id: row.charity_id, charity_contribution_pct: row.charity_contribution_pct, charity };
}

export async function updateSubscriberCharity(
  subscriberId: string,
  charityId: string
): Promise<void> {
  const charities = await query<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM charities WHERE id = $1`,
    [charityId]
  );

  if (charities.length === 0) {
    throw Object.assign(new Error('Charity not found'), { code: 'NOT_FOUND' });
  }
  if (!charities[0].is_active) {
    throw Object.assign(new Error('Charity is not active'), { code: 'NOT_FOUND' });
  }

  await query(
    `UPDATE subscribers SET charity_id = $1, updated_at = NOW() WHERE id = $2`,
    [charityId, subscriberId]
  );
}

export async function updateContributionPercentage(
  subscriberId: string,
  percentage: number
): Promise<void> {
  if (percentage < 10 || percentage > 100) {
    throw Object.assign(
      new Error('Contribution percentage must be between 10 and 100'),
      { code: 'VALIDATION_ERROR' }
    );
  }

  await query(
    `UPDATE subscribers SET charity_contribution_pct = $1, updated_at = NOW() WHERE id = $2`,
    [percentage, subscriberId]
  );
}

export async function createDonationPaymentIntent(
  subscriberId: string,
  charityId: string,
  amountPence: number
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!amountPence || amountPence <= 0) {
    throw Object.assign(new Error('amountPence must be greater than 0'), { code: 'VALIDATION_ERROR' });
  }

  const charities = await query<{ id: string; name: string; is_active: boolean }>(
    `SELECT id, name, is_active FROM charities WHERE id = $1`,
    [charityId]
  );

  if (charities.length === 0 || !charities[0].is_active) {
    throw Object.assign(new Error('Charity not found'), { code: 'NOT_FOUND' });
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountPence,
    currency: 'gbp',
    metadata: { subscriberId, charityId, type: 'donation' },
  });

  await query(
    `INSERT INTO charity_contributions (subscriber_id, charity_id, amount_pence, contribution_type, stripe_payment_intent_id)
     VALUES ($1, $2, $3, 'donation', $4)`,
    [subscriberId, charityId, amountPence, paymentIntent.id]
  );

  return { clientSecret: paymentIntent.client_secret!, paymentIntentId: paymentIntent.id };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export interface CreateCharityInput {
  name: string;
  description?: string;
  imageUrls?: string[];
  events?: Array<{ title: string; event_date: string; description?: string }>;
}

export async function createCharity(input: CreateCharityInput): Promise<Charity> {
  const rows = await query<Charity>(
    `INSERT INTO charities (name, description, image_urls)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, image_urls, is_featured, is_active, created_at, updated_at`,
    [input.name, input.description ?? null, input.imageUrls ?? null]
  );

  const charity = rows[0];

  if (input.events && input.events.length > 0) {
    for (const event of input.events) {
      await query(
        `INSERT INTO charity_events (charity_id, title, event_date, description)
         VALUES ($1, $2, $3, $4)`,
        [charity.id, event.title, event.event_date, event.description ?? null]
      );
    }
  }

  return charity;
}

export interface UpdateCharityInput {
  name?: string;
  description?: string;
  imageUrls?: string[];
  isActive?: boolean;
}

export async function updateCharity(id: string, input: UpdateCharityInput): Promise<Charity | null> {
  const rows = await query<Charity>(
    `UPDATE charities
     SET name = COALESCE($1, name),
         description = COALESCE($2, description),
         image_urls = COALESCE($3, image_urls),
         is_active = COALESCE($4, is_active),
         updated_at = NOW()
     WHERE id = $5
     RETURNING id, name, description, image_urls, is_featured, is_active, created_at, updated_at`,
    [
      input.name ?? null,
      input.description ?? null,
      input.imageUrls ?? null,
      input.isActive ?? null,
      id,
    ]
  );
  return rows[0] ?? null;
}

export async function deleteCharity(id: string): Promise<{ affectedCount: number } | null> {
  // Check charity exists
  const existing = await query<{ id: string }>(
    `SELECT id FROM charities WHERE id = $1`,
    [id]
  );
  if (existing.length === 0) return null;

  // Count active subscribers with this charity
  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM subscribers
     WHERE charity_id = $1 AND subscription_state = 'active'`,
    [id]
  );
  const affectedCount = parseInt(countRows[0].count, 10);

  if (affectedCount > 0) {
    throw Object.assign(
      new Error('Cannot delete charity with active subscribers'),
      { code: 'CHARITY_HAS_SUBSCRIBERS', affectedCount }
    );
  }

  await query(`DELETE FROM charities WHERE id = $1`, [id]);
  return { affectedCount: 0 };
}

export async function featureCharity(id: string): Promise<Charity | null> {
  // Verify charity exists
  const existing = await query<{ id: string }>(
    `SELECT id FROM charities WHERE id = $1`,
    [id]
  );
  if (existing.length === 0) return null;

  // Clear all featured flags, then set the target
  await query(`UPDATE charities SET is_featured = false, updated_at = NOW()`);
  const rows = await query<Charity>(
    `UPDATE charities
     SET is_featured = true, updated_at = NOW()
     WHERE id = $1
     RETURNING id, name, description, image_urls, is_featured, is_active, created_at, updated_at`,
    [id]
  );
  return rows[0] ?? null;
}
