-- Policy to allow Room Owners to delete document chunks in their rooms
CREATE POLICY "Room owners can delete chunks"
ON public.document_chunks FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collab_rooms WHERE id = document_chunks.room_id AND owner_id = auth.uid()
  )
);

-- Policy to allow Room Owners to delete chat history in their rooms
CREATE POLICY "Room owners can delete chat history"
ON public.chat_history FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.collab_rooms WHERE id = chat_history.session_id AND owner_id = auth.uid()
  )
);
