import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Work Hours Tracker</CardTitle>
          <CardDescription className="text-center">
            Authentication is not configured. Data is stored locally.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            To enable cloud sync, configure Convex by setting the VITE_CONVEX_URL environment variable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
