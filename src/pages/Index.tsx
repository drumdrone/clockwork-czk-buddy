import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkHoursTable from '@/components/WorkHoursTable';
import MonthlyStats from '@/components/MonthlyStats';
import MonthlyCalendar from '@/components/MonthlyCalendar';

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
}

const Index = () => {
  const [records, setRecords] = useState<{ [key: string]: DayRecord }>({});
  const [hourlyRate, setHourlyRate] = useState<number>(300);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Load data from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('workHoursData');
    const savedRate = localStorage.getItem('hourlyRate');
    
    if (savedData) {
      setRecords(JSON.parse(savedData));
    }
    if (savedRate) {
      setHourlyRate(Number(savedRate));
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Tabs defaultValue="tracker" className="w-full">
        <div className="border-b bg-card">
          <div className="container mx-auto px-6">
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
            </TabsList>
          </div>
        </div>
        
        <TabsContent value="tracker" className="mt-0">
          <WorkHoursTable 
            selectedMonth={selectedMonth} 
            setSelectedMonth={setSelectedMonth}
            records={records}
            setRecords={setRecords}
          />
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-0">
          <MonthlyCalendar 
            selectedMonth={selectedMonth}
            records={records}
          />
        </TabsContent>
        
        <TabsContent value="stats" className="mt-0">
          <MonthlyStats records={records} hourlyRate={hourlyRate} selectedMonth={selectedMonth} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
