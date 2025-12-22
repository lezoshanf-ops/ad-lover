-- Add status column to documents table for KYC approval workflow
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));

-- Add review columns for tracking
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS reviewed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS reviewed_by uuid,
ADD COLUMN IF NOT EXISTS review_notes text;

-- Create index for faster status filtering
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);

-- Enable realtime for documents table
ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;