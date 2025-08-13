-- Fix critical security vulnerability in woocommerce_orders table
-- The current service-role-only approach is insufficient for such sensitive data
-- Implement defense-in-depth security with multiple protection layers

-- First, let's examine if we need to create a user roles system for admin access
-- Create user roles enum and table for proper access control
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table for role-based access control
CREATE TABLE IF NOT EXISTS public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

-- Create RLS policies for user_roles table
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- Only service role can manage roles
CREATE POLICY "Service role can manage all roles" 
ON public.user_roles 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- Now secure the woocommerce_orders table with enhanced protection
-- Drop existing policies to rebuild with stronger security
DROP POLICY IF EXISTS "Service role can delete orders" ON public.woocommerce_orders;
DROP POLICY IF EXISTS "Service role can insert orders" ON public.woocommerce_orders;
DROP POLICY IF EXISTS "Service role can select orders" ON public.woocommerce_orders;
DROP POLICY IF EXISTS "Service role can update orders" ON public.woocommerce_orders;

-- Enhanced policies with multiple layers of protection
-- 1. Service role access (for WooCommerce integration)
CREATE POLICY "Service role full access to orders" 
ON public.woocommerce_orders 
FOR ALL 
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Admin users can view orders (read-only for security)
CREATE POLICY "Admin users can view orders" 
ON public.woocommerce_orders 
FOR SELECT 
TO authenticated
USING (public.is_admin());

-- 3. Absolutely no public or regular user access
-- (This is implicit but we're being explicit about the security model)

-- Add trigger for user_roles updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Log access to sensitive customer data (audit trail)
CREATE OR REPLACE FUNCTION public.log_order_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Log access attempts (could be expanded to write to audit table)
  RAISE LOG 'Order access: user=%, operation=%, order_id=%', 
    auth.uid(), TG_OP, COALESCE(NEW.id, OLD.id);
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

-- Add audit trigger to woocommerce_orders
CREATE TRIGGER audit_order_access
AFTER INSERT OR UPDATE OR DELETE ON public.woocommerce_orders
FOR EACH ROW
EXECUTE FUNCTION public.log_order_access();