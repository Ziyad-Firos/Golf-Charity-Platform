-- Migration 001: Initial Schema
-- Golf Charity Platform

-- Charities (referenced by subscribers, so must come first)
CREATE TABLE charities (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    image_urls      TEXT[],
    is_featured     BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscribers (users)
CREATE TABLE subscribers (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                    VARCHAR(255) UNIQUE NOT NULL,
    password_hash            VARCHAR(255) NOT NULL,
    first_name               VARCHAR(100) NOT NULL,
    last_name                VARCHAR(100) NOT NULL,
    role                     VARCHAR(20) NOT NULL DEFAULT 'subscriber',
    subscription_state       VARCHAR(20) NOT NULL DEFAULT 'inactive',
    stripe_customer_id       VARCHAR(100),
    stripe_subscription_id   VARCHAR(100),
    charity_id               UUID REFERENCES charities(id),
    charity_contribution_pct NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    currency                 VARCHAR(3) NOT NULL DEFAULT 'GBP',
    locale                   VARCHAR(10) NOT NULL DEFAULT 'en-GB',
    group_id                 UUID,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_role CHECK (role IN ('subscriber', 'admin')),
    CONSTRAINT chk_subscription_state CHECK (subscription_state IN ('active', 'inactive', 'lapsed', 'cancelled')),
    CONSTRAINT chk_charity_contribution_pct CHECK (charity_contribution_pct >= 10.00 AND charity_contribution_pct <= 100.00)
);

-- Subscription audit log
CREATE TABLE subscription_state_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES subscribers(id),
    old_state     VARCHAR(20),
    new_state     VARCHAR(20) NOT NULL,
    changed_by    UUID,
    reason        TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_new_state CHECK (new_state IN ('active', 'inactive', 'lapsed', 'cancelled'))
);

-- Subscription plans
CREATE TABLE subscription_plans (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        VARCHAR(50) NOT NULL,
    price_pence                 INTEGER NOT NULL,
    interval                    VARCHAR(10) NOT NULL,
    stripe_price_id             VARCHAR(100) NOT NULL,
    prize_pool_contribution_pct NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    charity_contribution_pct    NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    active                      BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_interval CHECK (interval IN ('month', 'year')),
    CONSTRAINT chk_price_pence CHECK (price_pence > 0)
);

-- Charity events
CREATE TABLE charity_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    charity_id  UUID NOT NULL REFERENCES charities(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    event_date  DATE NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Score entries
CREATE TABLE score_entries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id    UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    stableford_score INTEGER NOT NULL CHECK (stableford_score BETWEEN 1 AND 45),
    played_on        DATE NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_score_entries_subscriber_date ON score_entries(subscriber_id, played_on DESC);

-- Draws
CREATE TABLE draws (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draw_month              DATE NOT NULL,
    draw_mode               VARCHAR(20) NOT NULL,
    draw_numbers            INTEGER[] NOT NULL,
    prize_pool_total        NUMERIC(10,2) NOT NULL DEFAULT 0,
    jackpot_carryforward    NUMERIC(10,2) NOT NULL DEFAULT 0,
    tier_5_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
    tier_4_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
    tier_3_amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
    active_subscriber_count INTEGER NOT NULL DEFAULT 0,
    status                  VARCHAR(20) NOT NULL DEFAULT 'draft',
    published_at            TIMESTAMPTZ,
    published_by            UUID REFERENCES subscribers(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (draw_month),
    CONSTRAINT chk_draw_mode CHECK (draw_mode IN ('random', 'algorithmic')),
    CONSTRAINT chk_draw_status CHECK (status IN ('draft', 'simulated', 'published'))
);

-- Draw winners
CREATE TABLE draw_winners (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draw_id                     UUID NOT NULL REFERENCES draws(id),
    subscriber_id               UUID NOT NULL REFERENCES subscribers(id),
    match_tier                  INTEGER NOT NULL CHECK (match_tier IN (3, 4, 5)),
    matched_numbers             INTEGER[] NOT NULL,
    prize_amount                NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_state               VARCHAR(20) NOT NULL DEFAULT 'pending',
    verification_screenshot_url TEXT,
    verification_submitted_at   TIMESTAMPTZ,
    reviewed_by                 UUID REFERENCES subscribers(id),
    reviewed_at                 TIMESTAMPTZ,
    rejection_reason            TEXT,
    payment_proof_url           TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_payment_state CHECK (payment_state IN ('pending', 'verified', 'paid', 'rejected'))
);

-- Charity contributions ledger
CREATE TABLE charity_contributions (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id            UUID NOT NULL REFERENCES subscribers(id),
    charity_id               UUID NOT NULL REFERENCES charities(id),
    amount_pence             INTEGER NOT NULL,
    contribution_type        VARCHAR(20) NOT NULL,
    stripe_payment_intent_id VARCHAR(100),
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_contribution_type CHECK (contribution_type IN ('subscription', 'donation')),
    CONSTRAINT chk_amount_pence CHECK (amount_pence > 0)
);

-- Notification log
CREATE TABLE notification_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id       UUID REFERENCES subscribers(id),
    notification_type   VARCHAR(50) NOT NULL,
    status              VARCHAR(20) NOT NULL,
    provider_message_id VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_notification_status CHECK (status IN ('sent', 'failed'))
);
