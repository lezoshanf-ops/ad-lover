-- Create table for structured task evaluations
CREATE TABLE public.task_evaluations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  design_rating smallint NOT NULL CHECK (design_rating >= 1 AND design_rating <= 5),
  usability_rating smallint NOT NULL CHECK (usability_rating >= 1 AND usability_rating <= 5),
  overall_rating smallint NOT NULL CHECK (overall_rating >= 1 AND overall_rating <= 5),
  comment text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Enable RLS
ALTER TABLE public.task_evaluations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own evaluations"
ON public.task_evaluations
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create own evaluations"
ON public.task_evaluations
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own evaluations"
ON public.task_evaluations
FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all evaluations"
ON public.task_evaluations
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_task_evaluations_updated_at
BEFORE UPDATE ON public.task_evaluations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_evaluations;