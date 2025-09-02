import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import WorkHoursTable from '@/components/WorkHoursTable';
import MonthlyStats from '@/components/MonthlyStats';
import MonthlyCalendar from '@/components/MonthlyCalendar';
import DataManager from '@/components/DataManager';
import Login from '@/components/Login';

interface TimeInterval {
  start: string;
  end: string;
  type: 'work' | 'break';
}

interface DayRecord {
  date: string;
  startTime: string | null;
  endTime: string | null;
  estimatedEndTime: string;
  isWorking: boolean;
  workedHours: number;
  earnings: number;
  isPaused?: boolean;
  pausedTime?: number;
  interrupts: TimeInterval[];
  isDayOff?: boolean;
}

const Index = () => {
  const [records, setRecords] = useState<{ [key: string]: DayRecord }>({});
  const [hourlyRate, setHourlyRate] = useState<number>(300);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  // Initialize authentication
  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);
  
  // Load data from localStorage (keeping existing functionality)
  useEffect(() => {
    const loadData = () => {
      const savedData = localStorage.getItem('workHoursData');
      const savedRate = localStorage.getItem('hourlyRate');
      
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed && typeof parsed === 'object') {
            setRecords(parsed);
          }
        } catch (e) {
          console.error('Failed to parse localStorage data:', e);
        }
      }
      if (savedRate && !isNaN(Number(savedRate))) {
        setHourlyRate(Number(savedRate));
      }
    };

    loadData();
  }, []);

  // Save hourlyRate to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('hourlyRate', hourlyRate.toString());
  }, [hourlyRate]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: 'Signed out',
        description: 'You have been signed out successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error signing out',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleLogin = () => {
    // This will be handled by the auth state change listener
  };

  // Show loading state
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Show login if not authenticated
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }




  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="tracker" className="w-full">
        <div className="border-b bg-card">
          <div className="container mx-auto px-6">
            <div className="flex items-center justify-between">
              <TabsList className="h-12 bg-transparent p-0">
                <TabsTrigger value="tracker" className="h-10 px-6">
                  Time Tracker
                </TabsTrigger>
                <TabsTrigger value="calendar" className="h-10 px-6">
                  Calendar View
                </TabsTrigger>
                <TabsTrigger value="stats" className="h-10 px-6">
                  Monthly Stats
                </TabsTrigger>
                <TabsTrigger value="data" className="h-10 px-6">
                  Data Manager
                </TabsTrigger>
              </TabsList>
              <Button
                onClick={handleSignOut}
                variant="outline"
                size="sm"
                className="ml-4"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
        
        <TabsContent value="tracker" className="mt-0">
          <WorkHoursTable 
            selectedMonth={selectedMonth} 
            setSelectedMonth={setSelectedMonth}
            records={records}
            setRecords={setRecords}
            hourlyRate={hourlyRate}
            setHourlyRate={setHourlyRate}
          />
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-0">
          <MonthlyCalendar 
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            records={records}
            setRecords={setRecords}
            hourlyRate={hourlyRate}
          />
        </TabsContent>
        
        <TabsContent value="stats" className="mt-0">
          <MonthlyStats records={records} hourlyRate={hourlyRate} selectedMonth={selectedMonth} />
        </TabsContent>
        
        <TabsContent value="data" className="mt-0">
          <DataManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
