-- Add web_ident_url column to tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS web_ident_url text;