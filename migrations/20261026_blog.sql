CREATE TABLE IF NOT EXISTS blog_posts (
 id UUID PRIMARY KEY,
 slug VARCHAR(120) NOT NULL UNIQUE,
 title VARCHAR(200) NOT NULL,
 excerpt TEXT NOT NULL DEFAULT '',
 image TEXT NOT NULL DEFAULT '',
 body TEXT NOT NULL DEFAULT '',
 author VARCHAR(120) NOT NULL DEFAULT 'Barrera Brokers',
 status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
 featured BOOLEAN NOT NULL DEFAULT TRUE,
 published_at TIMESTAMPTZ(3),
 created_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT NOW(),
 CONSTRAINT blog_published_complete CHECK(status <> 'published' OR (length(trim(excerpt)) > 0 AND length(trim(image)) > 0 AND length(trim(body)) > 0 AND published_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS blog_posts_published_date_idx ON blog_posts(published_at DESC) WHERE status='published';
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
