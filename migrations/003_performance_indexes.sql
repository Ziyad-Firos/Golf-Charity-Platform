-- Migration 003: Performance Indexes
-- Golf Charity Platform - Performance Optimization

-- Subscriber indexes for authentication and queries
CREATE INDEX idx_subscribers_email ON subscribers(email);
CREATE INDEX idx_subscribers_subscription_state ON subscribers(subscription_state);
CREATE INDEX idx_subscribers_charity_id ON subscribers(charity_id);
CREATE INDEX idx_subscribers_stripe_customer_id ON subscribers(stripe_customer_id);
CREATE INDEX idx_subscribers_created_at ON subscribers(created_at);

-- Subscription state log indexes
CREATE INDEX idx_subscription_state_log_subscriber_id ON subscription_state_log(subscriber_id);
CREATE INDEX idx_subscription_state_log_created_at ON subscription_state_log(created_at);

-- Score entries performance indexes
CREATE INDEX idx_score_entries_subscriber_id ON score_entries(subscriber_id);
CREATE INDEX idx_score_entries_played_on ON score_entries(played_on DESC);
CREATE INDEX idx_score_entries_stableford_score ON score_entries(stableford_score);

-- Draws indexes
CREATE INDEX idx_draws_draw_month ON draws(draw_month);
CREATE INDEX idx_draws_status ON draws(status);
CREATE INDEX idx_draws_created_at ON draws(created_at);

-- Draw winners indexes
CREATE INDEX idx_draw_winners_draw_id ON draw_winners(draw_id);
CREATE INDEX idx_draw_winners_subscriber_id ON draw_winners(subscriber_id);
CREATE INDEX idx_draw_winners_payment_state ON draw_winners(payment_state);
CREATE INDEX idx_draw_winners_match_tier ON draw_winners(match_tier);

-- Charity contributions indexes
CREATE INDEX idx_charity_contributions_subscriber_id ON charity_contributions(subscriber_id);
CREATE INDEX idx_charity_contributions_charity_id ON charity_contributions(charity_id);
CREATE INDEX idx_charity_contributions_created_at ON charity_contributions(created_at);
CREATE INDEX idx_charity_contributions_amount_pence ON charity_contributions(amount_pence);

-- Notification log indexes
CREATE INDEX idx_notification_log_subscriber_id ON notification_log(subscriber_id);
CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_log_created_at ON notification_log(created_at);

-- Charity events indexes
CREATE INDEX idx_charity_events_charity_id ON charity_events(charity_id);
CREATE INDEX idx_charity_events_event_date ON charity_events(event_date);
CREATE INDEX idx_charity_events_created_at ON charity_events(created_at);

-- Composite indexes for common queries
CREATE INDEX idx_score_entries_subscriber_date_score ON score_entries(subscriber_id, played_on DESC, stableford_score);
CREATE INDEX idx_subscribers_state_created ON subscribers(subscription_state, created_at);
CREATE INDEX idx_draw_winners_draw_payment ON draw_winners(draw_id, payment_state);

-- Full-text search indexes for charities
CREATE INDEX idx_charities_name_fts ON charities USING gin(to_tsvector('english', name));
CREATE INDEX idx_charities_description_fts ON charities USING gin(to_tsvector('english', description));

-- Partial indexes for better performance
CREATE INDEX idx_active_subscribers ON subscribers(id) WHERE subscription_state = 'active';
CREATE INDEX idx_published_draws ON draws(id) WHERE status = 'published';
CREATE INDEX idx_pending_winners ON draw_winners(id) WHERE payment_state = 'pending';
CREATE INDEX idx_active_charities ON charities(id) WHERE is_active = true;

-- Statistics and monitoring views
CREATE VIEW v_subscriber_stats AS
SELECT 
    COUNT(*) as total_subscribers,
    COUNT(*) FILTER (WHERE subscription_state = 'active') as active_subscribers,
    COUNT(*) FILTER (WHERE subscription_state = 'inactive') as inactive_subscribers,
    COUNT(*) FILTER (WHERE subscription_state = 'lapsed') as lapsed_subscribers,
    COUNT(*) FILTER (WHERE subscription_state = 'cancelled') as cancelled_subscribers,
    AVG(charity_contribution_pct) as avg_charity_contribution
FROM subscribers;

CREATE VIEW v_monthly_revenue AS
SELECT 
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as new_subscribers,
    SUM(CASE WHEN subscription_state = 'active' THEN 1 ELSE 0 END) as active_new_subscribers
FROM subscribers
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER set_subscribers_timestamp
    BEFORE UPDATE ON subscribers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_score_entries_timestamp
    BEFORE UPDATE ON score_entries
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_charities_timestamp
    BEFORE UPDATE ON charities
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- Comments for documentation
COMMENT ON TABLE subscribers IS 'User accounts with subscription and charity preferences';
COMMENT ON TABLE score_entries IS 'Golf scores in Stableford format submitted by subscribers';
COMMENT ON TABLE draws IS 'Monthly draw events with prize pools and winning numbers';
COMMENT ON TABLE draw_winners IS 'Winners of monthly draws with payment and verification status';
COMMENT ON TABLE charities IS 'Charitable organizations that subscribers can support';
COMMENT ON TABLE charity_contributions IS 'Ledger of all charitable contributions from subscriptions';

-- Performance monitoring function
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE(
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    rows BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        query,
        calls,
        total_time,
        mean_time,
        rows
    FROM pg_stat_statements
    WHERE mean_time > 1000 -- queries taking more than 1 second
    ORDER BY mean_time DESC
    LIMIT 10;
END;
$$ LANGUAGE plpgsql;
