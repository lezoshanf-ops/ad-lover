-- Add policy for admins to update documents (for KYC approval/rejection)
CREATE POLICY "Admins can update all documents" 
ON public.documents 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));