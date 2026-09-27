-- Migration 925: Web Push Subscriptions for AFINIX Dental Lab
CREATE TABLE IF NOT EXISTS nl_push_subscriptions (
    id SERIAL PRIMARY KEY,
    usuario_id INT NOT NULL REFERENCES nl_usuarios(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nl_push_subscriptions_usuario_id ON nl_push_subscriptions(usuario_id);
