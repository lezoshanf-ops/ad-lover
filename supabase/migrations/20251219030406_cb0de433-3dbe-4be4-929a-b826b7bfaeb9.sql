-- Set REPLICA IDENTITY FULL for realtime tables so RLS works correctly
ALTER TABLE public.sms_code_requests REPLICA IDENTITY FULL;
ALTER TABLE public.tasks REPLICA IDENTITY FULL;
ALTER TABLE public.task_assignments REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;