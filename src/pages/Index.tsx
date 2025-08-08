import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WorkHoursTable from '@/components/WorkHoursTable';
import MonthlyStats from '@/components/MonthlyStats';

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
}

const Index = () => {
  const [records, setRecords] = useState<{ [key: string]: DayRecord }>({});
  const [hourlyRate, setHourlyRate] = useState<number>(300);

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
              <TabsTrigger value="stats" className="h-10 px-6">
                Monthly Stats
              </TabsTrigger>
            </TabsList>
          </div>
        </div>
        
        <TabsContent value="tracker" className="mt-0">
          <WorkHoursTable />
        </TabsContent>
        
        <TabsContent value="stats" className="mt-0">
          <MonthlyStats records={records} hourlyRate={hourlyRate} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Index;
