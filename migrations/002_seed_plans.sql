-- Migration 002: Seed subscription plans
INSERT INTO subscription_plans (name, price_pence, interval, stripe_price_id, prize_pool_contribution_pct, charity_contribution_pct)
VALUES
    ('monthly', 999,  'month', 'price_monthly_placeholder', 20.00, 10.00),
    ('yearly',  9990, 'year',  'price_yearly_placeholder',  20.00, 10.00);
