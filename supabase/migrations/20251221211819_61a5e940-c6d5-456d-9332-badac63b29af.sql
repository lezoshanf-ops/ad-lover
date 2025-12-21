-- Add is_pinned column to chat_messages for pinning messages
ALTER TABLE public.chat_messages ADD COLUMN is_pinned boolean NOT NULL DEFAULT false;

-- Add index for faster pinned message queries
CREATE INDEX idx_chat_messages_pinned ON public.chat_messages(is_pinned) WHERE is_pinned = true;

-- Update RLS policy to allow users to update their own sent messages (for pinning)
DROP POLICY IF EXISTS "Users can update read status on received messages" ON public.chat_messages;

CREATE POLICY "Users can update messages they sent or received"
ON public.chat_messages
FOR UPDATE
USING (
  sender_id = auth.uid() OR 
  recipient_id = auth.uid() OR 
  (is_group_message = true AND auth.uid() IS NOT NULL)
)
WITH CHECK (
  sender_id = auth.uid() OR 
  recipient_id = auth.uid() OR 
  (is_group_message = true AND auth.uid() IS NOT NULL)
);