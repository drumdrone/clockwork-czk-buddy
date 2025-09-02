-- Add export_url column to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS export_url TEXT;