-- 1. Add user_id to document_chunks if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'document_chunks' AND column_name = 'user_id') THEN
        ALTER TABLE public.document_chunks ADD COLUMN user_id uuid references auth.users(id);
    END IF;
END $$;

-- 2. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collab_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- 3. Document Chunks Policies
CREATE POLICY "Users can insert their own document chunks"
ON public.document_chunks FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own document chunks"
ON public.document_chunks FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document chunks"
ON public.document_chunks FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 4. Collab Rooms Policies
CREATE POLICY "Anyone authenticated can view rooms"
ON public.collab_rooms FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can create rooms"
ON public.collab_rooms FOR INSERT TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their rooms"
ON public.collab_rooms FOR DELETE TO authenticated
USING (auth.uid() = owner_id);

-- 5. Collab Members Policies
CREATE POLICY "Anyone authenticated can view members"
ON public.collab_members FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Users can join rooms"
ON public.collab_members FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave rooms"
ON public.collab_members FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 6. Chat History Policies
CREATE POLICY "Users can view their own chat history"
ON public.chat_history FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat history"
ON public.chat_history FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chat history"
ON public.chat_history FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chat history"
ON public.chat_history FOR DELETE TO authenticated
USING (auth.uid() = user_id);
