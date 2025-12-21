-- Add workflow tracking to task assignments (employee step-by-step flow)
ALTER TABLE public.task_assignments
ADD COLUMN IF NOT EXISTS workflow_step smallint NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS workflow_digital boolean NULL,
ADD COLUMN IF NOT EXISTS workflow_updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Keep updated_at fresh when step/choice changes
CREATE OR REPLACE FUNCTION public.touch_task_assignment_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.workflow_updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_task_assignments_workflow_touch ON public.task_assignments;
CREATE TRIGGER trg_task_assignments_workflow_touch
BEFORE UPDATE OF workflow_step, workflow_digital ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.touch_task_assignment_workflow_updated_at();

-- Basic validation: workflow_step between 1 and 8
CREATE OR REPLACE FUNCTION public.validate_task_assignment_workflow_step()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.workflow_step < 1 OR NEW.workflow_step > 8 THEN
    RAISE EXCEPTION 'workflow_step must be between 1 and 8';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_task_assignments_workflow_validate ON public.task_assignments;
CREATE TRIGGER trg_task_assignments_workflow_validate
BEFORE INSERT OR UPDATE OF workflow_step ON public.task_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_task_assignment_workflow_step();