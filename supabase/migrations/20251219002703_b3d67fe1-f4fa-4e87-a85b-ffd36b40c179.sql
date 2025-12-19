-- Functions to safely change task status and delete tasks with proper authorization

CREATE OR REPLACE FUNCTION public.accept_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Must be assigned to the current user
  IF NOT EXISTS (
    SELECT 1
    FROM public.task_assignments ta
    WHERE ta.task_id = _task_id
      AND ta.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not assigned';
  END IF;

  -- Mark assignment accepted/in progress
  UPDATE public.task_assignments
  SET accepted_at = COALESCE(accepted_at, now()),
      status = 'in_progress'
  WHERE task_id = _task_id
    AND user_id = auth.uid();

  -- Mark task in progress (admins can see status)
  UPDATE public.tasks
  SET status = 'in_progress',
      updated_at = now()
  WHERE id = _task_id
    AND status = 'assigned';

  -- If task already in progress, keep it as-is
  IF NOT FOUND THEN
    UPDATE public.tasks
    SET status = 'in_progress',
        updated_at = now()
    WHERE id = _task_id
      AND status = 'in_progress';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Task not found or not assignable';
    END IF;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION public.delete_task(_task_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Delete dependent records first
  DELETE FROM public.sms_code_requests WHERE task_id = _task_id;
  DELETE FROM public.documents WHERE task_id = _task_id;
  DELETE FROM public.task_assignments WHERE task_id = _task_id;

  -- Then delete task
  DELETE FROM public.tasks WHERE id = _task_id;
END;
$$;