create extension if not exists vector;

CREATE TABLE memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  company TEXT,
  url TEXT UNIQUE NOT NULL,
  tags TEXT[],
  seen BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  priority INTEGER DEFAULT 1 CHECK (priority IN (0, 1, 2)),
  content TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE memory ADD COLUMN embedding vector(768);
ALTER TABLE memory DROP COLUMN embedding;
ALTER TABLE memory ADD COLUMN embedding vector(3072);
ALTER TABLE memory DROP COLUMN key;


CREATE OR REPLACE FUNCTION match_memories(
    query_embedding vector(3072),
    match_count int
)
RETURNS TABLE (
    category text,
    value text,
    similarity float
)
LANGUAGE SQL
AS $$
    SELECT
        category,
        value,
        1 - (embedding <=> query_embedding) AS similarity
    FROM memory
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> query_embedding
    LIMIT match_count;
$$;

CREATE INDEX ON memory 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);