# Supabase Database Setup

Due to an issue where certain Google API keys restrict `text-embedding-004`, we have switched the application to use a blazing-fast, 100% free **local Sentence Transformers model** (`Xenova/all-MiniLM-L6-v2`). This means embeddings are done perfectly right inside your app without API constraints!

Because this new local model outputs a vector dimension of `384` (instead of 768), please completely drop your old `document_chunks` table and `match_documents` function in the Supabase **SQL Editor**, and run the **NEW script below**:

## 🚀 SQL Script

```sql
-- 1. Enable pgvector
create extension if not exists vector;

-- 2. Drop the old table and function if you already created them
drop function if exists match_documents;
drop table if exists document_chunks;

-- 3. Create the table for 384-dimensional local embeddings
create table if not exists document_chunks (
  id bigserial primary key,
  filename text not null,
  content text not null,
  embedding vector(384)
);

-- IMPORTANT: Disable Row Level Security so the app can insert chunks!
ALTER TABLE document_chunks DISABLE ROW LEVEL SECURITY;

-- 4. Create the search function
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  filename text,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.filename,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;
```


