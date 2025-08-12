import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import WorkHoursTable from '@/components/WorkHoursTable';
import MonthlyStats from '@/components/MonthlyStats';
import MonthlyCalendar from '@/components/MonthlyCalendar';
import DataManager from '@/components/DataManager';
import { LogOut } from 'lucide-react';
import { cleanupAuthState } from '@/utils/auth';

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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<{ [key: string]: DayRecord }>({});
  const [hourlyRate, setHourlyRate] = useState<number>(300);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  
  
  // Check authentication and redirect if not logged in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (!session?.user) {
          window.location.href = '/auth';
        }
        setLoading(false);
      }
    );

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        window.location.href = '/auth';
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data from localStorage (for backward compatibility)
  useEffect(() => {
    if (!user) return;

    const savedData = localStorage.getItem('workHoursData');
    const savedRate = localStorage.getItem('hourlyRate');
    
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed && typeof parsed === 'object') {
          setRecords(parsed);
        } else {
          localStorage.removeItem('workHoursData');
        }
      } catch (e) {
        console.error('Failed to parse workHoursData from localStorage', e);
        localStorage.removeItem('workHoursData');
      }
    }
    if (savedRate && !isNaN(Number(savedRate))) {
      setHourlyRate(Number(savedRate));
    }
  }, [user]);

  // Save hourlyRate to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('hourlyRate', hourlyRate.toString());
  }, [hourlyRate]);

  const handleSignOut = async () => {
    try {
      cleanupAuthState();
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/auth';
    } catch (error) {
      console.error('Error signing out:', error);
      window.location.href = '/auth';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth
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
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="h-8"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </Button>
              </div>
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
