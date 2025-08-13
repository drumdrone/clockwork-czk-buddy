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

  // Load data from Supabase and migrate from localStorage if needed
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        // Load user settings from Supabase
        const { data: settings, error: settingsError } = await supabase
          .from('user_settings')
          .select('*')
          .single();

        if (settingsError && settingsError.code !== 'PGRST116') {
          throw settingsError;
        }

        if (settings) {
          setHourlyRate(settings.hourly_rate || 300);
        } else {
          // Create initial user settings
          const { error } = await supabase
            .from('user_settings')
            .insert([{
              user_id: user.id,
              hourly_rate: 300,
              daily_hours_goal: 8
            }]);
          
          if (error) console.error('Error creating user settings:', error);
        }

        // Load work records from Supabase
        const { data: workRecords, error: recordsError } = await supabase
          .from('work_records')
          .select('*')
          .order('date', { ascending: false });

        if (recordsError) throw recordsError;

        // Convert Supabase records to legacy format for compatibility
        const legacyRecords: { [key: string]: DayRecord } = {};
        (workRecords || []).forEach(record => {
          legacyRecords[record.date] = {
            date: record.date,
            startTime: record.start_time,
            endTime: record.end_time,
            estimatedEndTime: record.estimated_end_time || '',
            isWorking: record.is_working || false,
            workedHours: record.worked_hours || 0,
            earnings: record.earnings || 0,
            isPaused: record.is_paused || false,
            pausedTime: record.paused_time || 0,
            interrupts: Array.isArray(record.interrupts) ? 
              record.interrupts
                .filter((item: any) => item && typeof item === 'object' && item.start && item.end && item.type)
                .map((item: any) => ({
                  start: item.start,
                  end: item.end,
                  type: item.type
                } as TimeInterval)) : [],
            isDayOff: record.is_day_off || false,
          };
        });
        setRecords(legacyRecords);

        // Migrate localStorage data if Supabase is empty
        if (!workRecords || workRecords.length === 0) {
          const savedData = localStorage.getItem('workHoursData');
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);
              if (parsed && typeof parsed === 'object') {
                // Convert legacy records to Supabase format and insert
                const recordsToInsert = Object.values(parsed).map((record: any) => ({
                  user_id: user.id,
                  date: record.date,
                  start_time: record.startTime,
                  end_time: record.endTime,
                  estimated_end_time: record.estimatedEndTime || null,
                  is_working: record.isWorking || false,
                  worked_hours: record.workedHours || 0,
                  earnings: record.earnings || 0,
                  is_paused: record.isPaused || false,
                  paused_time: record.pausedTime || 0,
                  interrupts: record.interrupts || [],
                  is_day_off: record.isDayOff || false,
                }));

                if (recordsToInsert.length > 0) {
                  await supabase.from('work_records').insert(recordsToInsert);
                  setRecords(parsed);
                }
              }
              localStorage.removeItem('workHoursData');
            } catch (e) {
              console.error('Failed to migrate localStorage data:', e);
            }
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
        // Fallback to localStorage
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
      }
    };

    loadUserData();
  }, [user]);

  // Save hourlyRate to Supabase when it changes
  useEffect(() => {
    if (!user || !hourlyRate) return;

    const saveHourlyRate = async () => {
      try {
        await supabase
          .from('user_settings')
          .upsert({
            user_id: user.id,
            hourly_rate: hourlyRate,
            daily_hours_goal: 8
          });
      } catch (error) {
        console.error('Error saving hourly rate:', error);
        // Fallback to localStorage
        localStorage.setItem('hourlyRate', hourlyRate.toString());
      }
    };

    saveHourlyRate();
  }, [hourlyRate, user]);

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
