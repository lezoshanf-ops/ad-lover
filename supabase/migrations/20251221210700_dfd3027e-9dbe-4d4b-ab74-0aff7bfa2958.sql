-- Add updated_at column to chat_messages to track edits
ALTER TABLE public.chat_messages 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE;

-- Add RLS policy to allow all authenticated users to view profiles (needed for chat)
CREATE POLICY "Authenticated users can view all profiles for chat"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);