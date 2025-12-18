-- Fix chat_messages RLS policy to require authentication for group messages
-- Currently group messages are readable by anyone (including unauthenticated users)

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can view own messages" ON public.chat_messages;

-- Create fixed policy that requires authentication for ALL access including group messages
CREATE POLICY "Users can view own messages" 
ON public.chat_messages 
FOR SELECT 
TO authenticated
USING (
  (sender_id = auth.uid()) OR 
  (recipient_id = auth.uid()) OR 
  ((is_group_message = true) AND (auth.uid() IS NOT NULL))
);

-- Also add UPDATE policy so users can mark their messages as read
CREATE POLICY "Users can update read status on received messages" 
ON public.chat_messages 
FOR UPDATE 
TO authenticated
USING (recipient_id = auth.uid() OR (is_group_message = true AND auth.uid() IS NOT NULL))
WITH CHECK (recipient_id = auth.uid() OR (is_group_message = true AND auth.uid() IS NOT NULL));

-- Add DELETE policy so users can delete their own sent messages
CREATE POLICY "Users can delete own sent messages" 
ON public.chat_messages 
FOR DELETE 
TO authenticated
USING (sender_id = auth.uid());