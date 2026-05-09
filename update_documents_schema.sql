-- 1. Add mode, session_id, and room_id to document_chunks
ALTER TABLE public.document_chunks 
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS session_id text,
  ADD COLUMN IF NOT EXISTS room_id text;

-- (Optional) If you have a user_id column that wasn't correctly set before
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'user_id') THEN
        ALTER TABLE public.document_chunks ADD COLUMN user_id uuid references auth.users(id);
    END IF;
END $$;

-- Enable Row Level Security (RLS) on document_chunks
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Drop old policies to replace them
DROP POLICY IF EXISTS "Users can insert their own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can view their own document chunks" ON public.document_chunks;
DROP POLICY IF EXISTS "Users can delete their own document chunks" ON public.document_chunks;

-- 2. New RLS Policies for Document Chunks
-- Users can insert chunks for themselves or into rooms they belong to
CREATE POLICY "Users can insert chunks"
ON public.document_chunks FOR INSERT TO authenticated
WITH CHECK (
  (mode = 'private' AND auth.uid() = user_id) OR
  (mode = 'collab' AND auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM public.collab_members WHERE room_id = document_chunks.room_id AND user_id = auth.uid()
  ))
);

-- Users can view private chunks they own, or collab chunks in their rooms
CREATE POLICY "Users can view chunks"
ON public.document_chunks FOR SELECT TO authenticated
USING (
  (mode = 'private' AND auth.uid() = user_id) OR
  (mode = 'collab' AND EXISTS (
    SELECT 1 FROM public.collab_members WHERE room_id = document_chunks.room_id AND user_id = auth.uid()
  ))
);

-- Users can only delete their own chunks (both private and collab)
CREATE POLICY "Users can delete chunks"
ON public.document_chunks FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 3. Recreate match_documents function to support mode and isolation
DROP FUNCTION IF EXISTS public.match_documents(vector, double precision, integer);
DROP FUNCTION IF EXISTS public.match_documents(vector, float, int);
DROP FUNCTION IF EXISTS public.match_documents(vector, double precision, integer, text, uuid, text);
DROP FUNCTION IF EXISTS public.match_documents(vector, float, int, text, uuid, text);

CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  p_mode text DEFAULT 'private',
  p_user_id uuid DEFAULT NULL,
  p_room_id text DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  filename text,
  content text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    document_chunks.id,
    document_chunks.filename,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
    AND (
      (p_mode = 'private' AND document_chunks.mode = 'private' AND document_chunks.user_id = p_user_id)
      OR
      (p_mode = 'collab' AND document_chunks.mode = 'collab' AND document_chunks.room_id = p_room_id)
    )
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;
