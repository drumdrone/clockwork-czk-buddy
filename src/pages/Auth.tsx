import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { cleanupAuthState } from '@/utils/auth';

const Auth = () => {
  const [email, setEmail] = useState('honza.hrodek@gmail.com');
  const [verificationCode, setVerificationCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Set page title
  useEffect(() => {
    document.title = 'Login | Work Hours Tracker';
  }, []);

  // Check if user is already logged in and redirect
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          window.location.href = '/';
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        window.location.href = '/';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email !== 'honza.hrodek@gmail.com') {
      toast({
        title: "Error",
        description: "Only honza.hrodek@gmail.com is allowed to login",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      console.log('Starting OTP process for email:', email);
      cleanupAuthState();

      // First try to sign up the user (in case they don't exist)
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: Math.random().toString(36), // Random password since we're using OTP
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      console.log('SignUp attempt result:', { signUpError });
      
      // If user already exists, signUp will fail but that's ok
      // Now send OTP regardless
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      console.log('OTP response:', { error });

      if (error) {
        console.error('OTP error details:', error);
        throw error;
      }

      setStep('code');
      toast({
        title: "Success",
        description: "Check your email for the verification code!",
      });
    } catch (error: any) {
      console.error('Failed to send OTP:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to send verification code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log('Verifying OTP code:', verificationCode, 'for email:', email);
      
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: verificationCode,
        type: 'email'
      });

      console.log('Verify OTP response:', { data, error });

      if (error) {
        console.error('Verify OTP error details:', error);
        throw error;
      }

      if (data.user) {
        console.log('User authenticated successfully:', data.user.id);
        toast({
          title: "Success",
          description: "Signed in successfully!",
        });
        window.location.href = '/';
      }
    } catch (error: any) {
      console.error('Failed to verify OTP:', error);
      toast({
        title: "Error",
        description: error.message || "Invalid verification code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Work Hours Tracker</CardTitle>
        </CardHeader>
        <CardContent>
          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled
                />
                <p className="text-sm text-muted-foreground">
                  Only honza.hrodek@gmail.com can access this app
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Sending Code...' : 'Send Verification Code'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Enter 6-digit code from email"
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setStep('email')}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify Code'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;