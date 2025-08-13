-- Fix security vulnerability in plan_sections table
-- Replace public access policies with user-specific access controls

-- Drop existing public policies
DROP POLICY IF EXISTS "Public read plan_sections" ON public.plan_sections;
DROP POLICY IF EXISTS "Public insert plan_sections" ON public.plan_sections;
DROP POLICY IF EXISTS "Public update plan_sections" ON public.plan_sections;
DROP POLICY IF EXISTS "Public delete plan_sections" ON public.plan_sections;

-- Create secure RLS policies that restrict access to data owners only
CREATE POLICY "Users can view their own plan sections" 
ON public.plan_sections 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own plan sections" 
ON public.plan_sections 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plan sections" 
ON public.plan_sections 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plan sections" 
ON public.plan_sections 
FOR DELETE 
TO authenticated
USING (auth.uid() = user_id);

-- Add trigger to automatically set user_id on insert if not provided
CREATE TRIGGER set_plan_sections_user_id
BEFORE INSERT ON public.plan_sections
FOR EACH ROW
EXECUTE FUNCTION public.set_auth_user_id();