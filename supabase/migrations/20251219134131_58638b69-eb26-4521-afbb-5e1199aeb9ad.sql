-- Function to notify all admins about employee activity (login, check_in, check_out)
CREATE OR REPLACE FUNCTION public.notify_admins_activity(_activity_type text, _employee_name text, _employee_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_id UUID;
  title_text TEXT;
  message_text TEXT;
BEGIN
  -- Set title and message based on activity type
  CASE _activity_type
    WHEN 'login' THEN
      title_text := 'Mitarbeiter angemeldet';
      message_text := _employee_name || ' hat sich angemeldet.';
    WHEN 'check_in' THEN
      title_text := 'Mitarbeiter eingestempelt';
      message_text := _employee_name || ' hat sich eingestempelt.';
    WHEN 'check_out' THEN
      title_text := 'Mitarbeiter ausgestempelt';
      message_text := _employee_name || ' hat sich ausgestempelt.';
    ELSE
      title_text := 'Mitarbeiter-Aktivität';
      message_text := _employee_name || ' - ' || _activity_type;
  END CASE;

  -- Loop through all admins and create notifications
  FOR admin_id IN 
    SELECT user_id FROM public.user_roles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, related_user_id)
    VALUES (
      admin_id,
      title_text,
      message_text,
      'activity',
      _employee_id
    );
  END LOOP;
END;
$function$;