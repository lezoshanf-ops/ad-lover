-- Add 'pending_review' to task_status enum
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending_review' AFTER 'sms_requested';

-- Add approval fields to tasks table
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS review_notes text;

-- Update complete_task function to set status to 'pending_review' instead of 'completed'
CREATE OR REPLACE FUNCTION public.complete_task(_task_id uuid, _progress_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Mark task as pending_review (instead of completed)
  UPDATE public.tasks
  SET status = 'pending_review',
      updated_at = now()
  WHERE id = _task_id;

  -- Notify admins about task pending review
  PERFORM public.notify_admins_task_completed(_task_id, v_task_title, v_employee_name);
END;
$function$;

-- Create function to approve a task
CREATE OR REPLACE FUNCTION public.approve_task(_task_id uuid, _review_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task_title text;
  v_employee_id uuid;
  v_employee_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Must be admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get task info
  SELECT t.title INTO v_task_title
  FROM public.tasks t
  WHERE t.id = _task_id AND t.status = 'pending_review';

  IF v_task_title IS NULL THEN
    RAISE EXCEPTION 'Task not found or not pending review';
  END IF;

  -- Get assigned employee
  SELECT ta.user_id INTO v_employee_id
  FROM public.task_assignments ta
  WHERE ta.task_id = _task_id
  LIMIT 1;

  -- Get employee name for notification
  SELECT COALESCE(NULLIF(trim(p.first_name || ' ' || p.last_name), ''), 'Mitarbeiter')
  INTO v_employee_name
  FROM public.profiles p
  WHERE p.user_id = v_employee_id;

  -- Mark task as completed (approved)
  UPDATE public.tasks
  SET status = 'completed',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = _review_notes,
      updated_at = now()
  WHERE id = _task_id;

  -- Notify employee about approval
  INSERT INTO public.notifications (user_id, title, message, type, related_task_id)
  VALUES (
    v_employee_id,
    'Auftrag genehmigt',
    'Dein Auftrag "' || v_task_title || '" wurde genehmigt. Die Sondervergütung wird verrechnet.',
    'task_approved',
    _task_id
  );
END;
$function$;

-- Create function to reject a task
CREATE OR REPLACE FUNCTION public.reject_task(_task_id uuid, _review_notes text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_task_title text;
  v_employee_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Must be admin
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Get task info
  SELECT t.title INTO v_task_title
  FROM public.tasks t
  WHERE t.id = _task_id AND t.status = 'pending_review';

  IF v_task_title IS NULL THEN
    RAISE EXCEPTION 'Task not found or not pending review';
  END IF;

  -- Get assigned employee
  SELECT ta.user_id INTO v_employee_id
  FROM public.task_assignments ta
  WHERE ta.task_id = _task_id
  LIMIT 1;

  -- Mark task as back to in_progress (rejected)
  UPDATE public.tasks
  SET status = 'in_progress',
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_notes = _review_notes,
      updated_at = now()
  WHERE id = _task_id;

  -- Reset assignment status
  UPDATE public.task_assignments
  SET status = 'in_progress'
  WHERE task_id = _task_id;

  -- Notify employee about rejection
  INSERT INTO public.notifications (user_id, title, message, type, related_task_id)
  VALUES (
    v_employee_id,
    'Auftrag abgelehnt',
    'Dein Auftrag "' || v_task_title || '" wurde abgelehnt. Grund: ' || COALESCE(_review_notes, 'Keine Angabe'),
    'task_rejected',
    _task_id
  );
END;
$function$;