-- Add CSV sync settings to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN csv_sync_url TEXT,
ADD COLUMN sync_interval_minutes INTEGER DEFAULT 15,
ADD COLUMN auto_sync_enabled BOOLEAN DEFAULT false,
ADD COLUMN last_sync_at TIMESTAMP WITH TIME ZONE;