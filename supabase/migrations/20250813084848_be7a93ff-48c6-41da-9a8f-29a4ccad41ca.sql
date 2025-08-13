-- Fix security vulnerability in social_media_posts table
-- Replace public access policies with user-specific access controls

-- Drop existing public policies
DROP POLICY IF EXISTS "Public read posts" ON public.social_media_posts;
DROP POLICY IF EXISTS "Public insert posts" ON public.social_media_posts;
DROP POLICY IF EXISTS "Public update posts" ON public.social_media_posts;
DROP POLICY IF EXISTS "Public delete posts" ON public.social_media_posts;

-- Create secure RLS policies that restrict access to data owners only
CREATE POLICY "Users can view their own social media posts" 
ON public.social_media_posts 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own social media posts" 
ON public.social_media_posts 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own social media posts" 
ON public.social_media_posts 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own social media posts" 
ON public.social_media_posts 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Add trigger to automatically set user_id on insert if not provided
CREATE TRIGGER set_social_media_posts_user_id
BEFORE INSERT ON public.social_media_posts
FOR EACH ROW
EXECUTE FUNCTION public.set_auth_user_id();