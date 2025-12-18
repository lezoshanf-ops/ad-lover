-- Add test credentials fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN test_email text,
ADD COLUMN test_password text;