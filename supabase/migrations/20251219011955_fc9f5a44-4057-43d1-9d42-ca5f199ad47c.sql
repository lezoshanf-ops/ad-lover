-- Allow employees to complete assigned tasks securely (without granting broad UPDATE rights)
CREATE OR REPLACE FUNCTION public.complete_task(
  _task_id uuid,
  _progress_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task_title text;
  v_employee_name text;
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

  SELECT t.title
  INTO v_task_title
  FROM public.tasks t
  WHERE t.id = _task_id;

  IF v_task_title IS NULL THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  SELECT COALESCE(NULLIF(trim(p.first_name || ' ' || p.last_name), ''), 'Ein Mitarbeiter')
  INTO v_employee_name
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF v_employee_name IS NULL THEN
    v_employee_name := 'Ein Mitarbeiter';
  END IF;

  -- Mark assignment completed and save notes
  UPDATE public.task_assignments
  SET status = 'completed',
      progress_notes = COALESCE(_progress_notes, progress_notes)
  WHERE task_id = _task_id
    AND user_id = auth.uid();

  -- Mark task completed
  UPDATE public.tasks
  SET status = 'completed',
      updated_at = now()
  WHERE id = _task_id;

  -- Notify admins
  PERFORM public.notify_admins_task_completed(_task_id, v_task_title, v_employee_name);
END;
$$;