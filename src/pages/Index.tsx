import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import WorkHoursTable from '@/components/WorkHoursTable';
import MonthlyStats from '@/components/MonthlyStats';
import MonthlyCalendar from '@/components/MonthlyCalendar';
import DataManager from '@/components/DataManager';

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
  const { toast } = useToast();

  // Load data from localStorage
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
