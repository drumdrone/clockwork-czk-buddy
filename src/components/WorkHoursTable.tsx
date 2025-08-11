import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Calendar, CreditCard, Target, Cloud, CloudDownload } from 'lucide-react';
import InterruptDialog from './InterruptDialog';
import TimeSparkline from './TimeSparkline';
import TimeInput from './TimeInput';
import { format, getDaysInMonth, startOfMonth, addDays, endOfMonth, eachDayOfInterval, isWeekend, isFuture, isToday } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

interface WorkHoursTableProps {
  selectedMonth: Date;
  setSelectedMonth: (month: Date) => void;
  records: { [key: string]: DayRecord };
  setRecords: (records: { [key: string]: DayRecord }) => void;
  hourlyRate: number;
  setHourlyRate: (rate: number) => void;
}

const WorkHoursTable: React.FC<WorkHoursTableProps> = ({ 
  selectedMonth, 
  setSelectedMonth, 
  records, 
  setRecords,
  hourlyRate,
  setHourlyRate 
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyHoursGoal, setDailyHoursGoal] = useState<number>(() => {
    const saved = localStorage.getItem('dailyHoursGoal');
    return saved ? parseFloat(saved) : 8;
  });
  const [isEditingDailyGoal, setIsEditingDailyGoal] = useState(false);
  const [googleSheetId, setGoogleSheetId] = useState(() => {
    const saved = localStorage.getItem('googleSheetId');
    return saved || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT_JmZVro__21S9k6ZE3WbwEvr-O9MwhOMesGAS_8hVzejC-RT8hpjouIXBBqOPJr-pjFTvYG6LiWsm/pub?gid=0&single=true&output=csv';
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMonth = selectedMonth;
  const daysInMonth = getDaysInMonth(currentMonth);
  const monthStart = startOfMonth(currentMonth);

  // Generate month tabs (last 6 months + current + next 2)
  const monthTabs = Array.from({ length: 9 }, (_, i) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - 6 + i);
    return monthDate;
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load data from localStorage (only once on mount)
  useEffect(() => {
    const savedData = localStorage.getItem('workHoursData');
    
    if (savedData) {
      setRecords(JSON.parse(savedData));
    }
  }, []); // Only run once on mount

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('workHoursData', JSON.stringify(records));
    localStorage.setItem('hourlyRate', hourlyRate.toString());
    localStorage.setItem('dailyHoursGoal', dailyHoursGoal.toString());
    localStorage.setItem('googleSheetId', googleSheetId);
  }, [records, hourlyRate, dailyHoursGoal, googleSheetId]);

  // Initialize days for current month
  useEffect(() => {
    const newRecords = { ...records };
    let hasNewDays = false;
    
    for (let i = 0; i < daysInMonth; i++) {
      const date = format(addDays(monthStart, i), 'yyyy-MM-dd');
      if (!newRecords[date]) {
        newRecords[date] = {
          date,
          startTime: null,
          endTime: null,
          estimatedEndTime: '17:00',
          isWorking: false,
          workedHours: 0,
          earnings: 0,
          isPaused: false,
          pausedTime: 0,
          interrupts: [],
          isDayOff: false,
        };
        hasNewDays = true;
      }
    }
    
    if (hasNewDays) {
      setRecords(newRecords);
    }
  }, [daysInMonth, monthStart]); // Removed records dependency to prevent infinite loop

  const calculateWorkedHours = useCallback((startTime: string, endTime?: string, pausedTime: number = 0): number => {
    if (!startTime) return 0;
    
    const start = new Date(`${currentMonth.toDateString()} ${startTime}`);
    const end = endTime 
      ? new Date(`${currentMonth.toDateString()} ${endTime}`)
      : currentTime;
    
    const diffMs = end.getTime() - start.getTime();
    const totalHours = Math.max(0, diffMs / (1000 * 60 * 60));
    return Math.max(0, totalHours - (pausedTime / (1000 * 60 * 60)));
  }, [currentTime, currentMonth]);

  // Update worked hours and earnings in real-time
  useEffect(() => {
    const updatedRecords = { ...records };
    let hasChanges = false;

    Object.keys(updatedRecords).forEach(date => {
      const record = updatedRecords[date];
      if (record.isWorking && record.startTime && !record.isPaused) {
        const newWorkedHours = calculateWorkedHours(record.startTime, undefined, record.pausedTime || 0);
        const newEarnings = newWorkedHours * hourlyRate;
        
        if (record.workedHours !== newWorkedHours || record.earnings !== newEarnings) {
          record.workedHours = newWorkedHours;
          record.earnings = newEarnings;
          hasChanges = true;
        }
      }
    });

    if (hasChanges) {
      setRecords(updatedRecords);
    }
  }, [currentTime, records, hourlyRate, calculateWorkedHours]);

  const startWork = (date: string) => {
    const now = format(currentTime, 'HH:mm');
    const updatedRecords = {
      ...records,
      [date]: {
        ...records[date],
        startTime: now,
        endTime: null,
        isWorking: true,
        isPaused: false,
        pausedTime: 0,
      }
    };
    setRecords(updatedRecords);
  };

  const addInterrupt = (date: string, startTime: string, durationMinutes: number) => {
    const endTime = new Date(`${date} ${startTime}`);
    endTime.setMinutes(endTime.getMinutes() + durationMinutes);
    
    const interrupt: TimeInterval = {
      start: startTime,
      end: endTime.toTimeString().slice(0, 5),
      type: 'break'
    };

    const updatedRecords = {
      ...records,
      [date]: {
        ...records[date],
        interrupts: [...(records[date].interrupts || []), interrupt],
      }
    };
    setRecords(updatedRecords);
  };

  const stopWork = (date: string, useEstimated = false) => {
    const record = records[date];
    if (!record || !record.startTime) return;

    const endTime = useEstimated ? record.estimatedEndTime : format(currentTime, 'HH:mm');
    const workedHours = calculateWorkedHours(record.startTime, endTime, record.pausedTime || 0);
    const earnings = workedHours * hourlyRate;

    const updatedRecords = {
      ...records,
      [date]: {
        ...records[date],
        endTime,
        isWorking: false,
        isPaused: false,
        workedHours,
        earnings,
      }
    };
    setRecords(updatedRecords);
  };

  const updateStartTime = (date: string, time: string) => {
    const record = records[date];
    if (record.isWorking) return; // Don't allow editing while timer is running

    const workedHours = time && record.endTime ? calculateWorkedHours(time, record.endTime, record.pausedTime || 0) : 0;
    const earnings = workedHours * hourlyRate;

    const updatedRecords = {
      ...records,
      [date]: {
        ...records[date],
        startTime: time || null,
        workedHours,
        earnings,
      }
    };
    setRecords(updatedRecords);
  };

  const updateEndTime = (date: string, time: string) => {
    const record = records[date];
    if (record.isWorking) return; // Don't allow editing while timer is running

    const workedHours = record.startTime && time ? calculateWorkedHours(record.startTime, time, record.pausedTime || 0) : 0;
    const earnings = workedHours * hourlyRate;

    const updatedRecords = {
      ...records,
      [date]: {
        ...records[date],
        endTime: time || null,
        workedHours,
        earnings,
      }
    };
    setRecords(updatedRecords);
  };

  const updateEstimatedEndTime = (date: string, time: string) => {
    const updatedRecords = {
      ...records,
      [date]: {
        ...records[date],
        estimatedEndTime: time,
      }
    };
    setRecords(updatedRecords);
  };

  const toggleDayOff = (date: string) => {
    const prev = records[date];
    const updatedRecords = {
      ...records,
      [date]: { ...prev, isDayOff: !prev?.isDayOff }
    };
    setRecords(updatedRecords);
  };

  const exportBackup = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      data: {
        workHoursData: records,
        hourlyRate,
        dailyHoursGoal,
        monthlyGoal: parseFloat(localStorage.getItem('monthlyGoal') || '50000'),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `work-hours-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast({ title: 'Backup exported', description: 'JSON downloaded.' });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const data = json.data || json;
      if (!data.workHoursData) throw new Error('Invalid backup file');

      // Apply state
      setRecords(data.workHoursData);
      if (typeof data.hourlyRate === 'number') setHourlyRate(data.hourlyRate);
      if (typeof data.dailyHoursGoal === 'number') setDailyHoursGoal(data.dailyHoursGoal);
      if (typeof data.monthlyGoal === 'number') localStorage.setItem('monthlyGoal', String(data.monthlyGoal));

      // Persist to localStorage
      localStorage.setItem('workHoursData', JSON.stringify(data.workHoursData));
      if (typeof data.hourlyRate === 'number') localStorage.setItem('hourlyRate', String(data.hourlyRate));
      if (typeof data.dailyHoursGoal === 'number') localStorage.setItem('dailyHoursGoal', String(data.dailyHoursGoal));

      toast({ title: 'Backup imported', description: 'Data restored successfully.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Import failed', description: 'Invalid backup file.', variant: 'destructive' as any });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const backupToGoogleSheets = async () => {
    setIsBackingUp(true);
    try {
      const payload = {
        workHoursData: records,
        hourlyRate,
        dailyHoursGoal,
        monthlyGoal: parseFloat(localStorage.getItem('monthlyGoal') || '50000'),
      };

      const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
        body: {
          action: 'backup',
          data: payload
        }
      });

      if (error) throw error;

      if (data?.csvData) {
        // Create and download CSV file
        const blob = new Blob([data.csvData], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `work-hours-backup-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        toast({ 
          title: 'CSV exported', 
          description: 'CSV file downloaded. Import this file into your Google Sheet.' 
        });
      }
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({ 
        title: 'Export failed', 
        description: error.message || 'Failed to generate CSV export.',
        variant: 'destructive' 
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const restoreFromGoogleSheets = async () => {
    if (!googleSheetId.trim()) {
      toast({ 
        title: 'Google Sheet CSV URL required', 
        description: 'Please enter your published Google Sheet CSV URL first.',
        variant: 'destructive' 
      });
      return;
    }

    // Validate that it's a proper URL
    if (!googleSheetId.startsWith('http')) {
      toast({ 
        title: 'Invalid URL', 
        description: 'Please enter a valid Google Sheet published CSV URL starting with https://',
        variant: 'destructive' 
      });
      return;
    }

    setIsRestoring(true);
    try {
      console.log('Sending restore request with URL:', googleSheetId);
      const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
        body: {
          action: 'restore',
          csvUrl: googleSheetId
        }
      });

      if (error) throw error;

      if (data?.data) {
        const restoredData = data.data;
        
        // Update all the state with restored data
        setRecords(restoredData.workHoursData);
        setHourlyRate(restoredData.hourlyRate);
        setDailyHoursGoal(restoredData.dailyHoursGoal);
        localStorage.setItem('monthlyGoal', String(restoredData.monthlyGoal));

        // Persist to localStorage
        localStorage.setItem('workHoursData', JSON.stringify(restoredData.workHoursData));
        localStorage.setItem('hourlyRate', String(restoredData.hourlyRate));
        localStorage.setItem('dailyHoursGoal', String(restoredData.dailyHoursGoal));

        toast({ 
          title: 'Import successful', 
          description: 'Data imported from Google Sheet successfully.' 
        });
      }
    } catch (error: any) {
      console.error('Import failed:', error);
      toast({ 
        title: 'Import failed', 
        description: error.message || 'Failed to import from Google Sheet.',
        variant: 'destructive' 
      });
    } finally {
      setIsRestoring(false);
    }
  };


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency: 'CZK',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatHours = (hours: number) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  // Recalculate earnings based on current hourly rate instead of using stored earnings
  const totalEarnings = Object.values(records).reduce((sum, record) => sum + (record.workedHours * hourlyRate), 0);
  const totalHours = Object.values(records).reduce((sum, record) => sum + record.workedHours, 0);

  // Monthly goal calculations
  const monthlyGoal = parseFloat(localStorage.getItem('monthlyGoal') || '50000');
  const remainingEarnings = Math.max(0, monthlyGoal - totalEarnings);
  const remainingHours = remainingEarnings / hourlyRate;
  
  // Calculate working days from today to end of month (Monday-Friday only)
  const endOfCurrentMonth = endOfMonth(currentMonth);
  const remainingWorkingDays = eachDayOfInterval({
    start: new Date(),
    end: endOfCurrentMonth
  }).filter(day => !isWeekend(day));
  // Exclude days marked as off
  const remainingAvailableDays = remainingWorkingDays.filter(day => {
    const key = format(day, 'yyyy-MM-dd');
    return !(records[key]?.isDayOff);
  });
  
  const hoursPerWorkingDay = remainingAvailableDays.length > 0 ? remainingHours / remainingAvailableDays.length : 0;

  // Generate weekly calendar with daily hours needed
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  const dailyHoursDisplay = weekDays.map(day => ({
    day,
    hours: hoursPerWorkingDay
  }));

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-6 w-6 text-primary" />
              Work Hours Tracker - {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            
            {/* Compact Hours Left + Backup */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
                <Target className="h-3 w-3 text-orange-500" />
                <span className="text-orange-500 font-medium">
                  {remainingHours > 0 ? `${formatHours(remainingHours)} left` : '✓ Goal reached'}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={exportBackup} className="h-8">
                Backup JSON
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportClick} className="h-8">
                Restore JSON
              </Button>
              <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImportChange} className="hidden" />
            </div>
          </div>
          
          {/* Month Filter Tabs */}
          <div className="flex gap-1 mt-4 overflow-x-auto">
            {monthTabs.map((monthDate, index) => (
              <Button
                key={index}
                variant={format(monthDate, 'yyyy-MM') === format(currentMonth, 'yyyy-MM') ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedMonth(monthDate)}
                className="min-w-fit text-xs h-7"
              >
                {format(monthDate, 'MMM yyyy')}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Google Sheets Integration */}
          <Card className="border-primary/10 mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Cloud className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Google Sheets Integration</p>
                    <p className="text-xs text-muted-foreground">Real-time sync with your published Google Sheet</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Input
                    placeholder="Paste your published Google Sheet CSV URL here"
                    value={googleSheetId}
                    onChange={(e) => setGoogleSheetId(e.target.value)}
                    className="flex-1"
                  />
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={backupToGoogleSheets}
                      disabled={isBackingUp}
                      className="min-w-[120px]"
                    >
                      <Cloud className="h-4 w-4 mr-1" />
                      {isBackingUp ? 'Exporting...' : 'Export CSV'}
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={restoreFromGoogleSheets}
                      disabled={isRestoring || !googleSheetId.trim()}
                      className="min-w-[120px]"
                    >
                      <CloudDownload className="h-4 w-4 mr-1" />
                      {isRestoring ? 'Importing...' : 'Import from Sheet'}
                    </Button>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Paste your Google Sheet published CSV URL above. Export creates a CSV file to import to your sheet. Import reads data directly from your published sheet.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="border-primary/10">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Hourly Rate</p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={hourlyRate}
                        onChange={(e) => setHourlyRate(Number(e.target.value))}
                        className="w-24 h-8"
                      />
                      <span className="text-sm text-muted-foreground">CZK/h</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-success/20 bg-success/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-lg font-semibold text-success">{formatHours(totalHours)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Total Earnings</p>
                    <p className="text-lg font-semibold text-primary">{formatCurrency(totalEarnings)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>


          <div className="relative max-h-[600px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background shadow-sm">
                <TableRow className="bg-muted/80 backdrop-blur-sm">
                  <TableHead className="w-24 bg-muted/80 backdrop-blur-sm border-b">Date</TableHead>
                  <TableHead className="w-32 bg-muted/80 backdrop-blur-sm border-b">Actions</TableHead>
                  <TableHead className="w-28 bg-muted/80 backdrop-blur-sm border-b">Start</TableHead>
                  <TableHead className="w-28 bg-muted/80 backdrop-blur-sm border-b">End</TableHead>
                  <TableHead className="w-32 bg-muted/80 backdrop-blur-sm border-b">Est. End</TableHead>
                  <TableHead className="w-20 bg-muted/80 backdrop-blur-sm border-b">Hours</TableHead>
                  <TableHead className="w-24 bg-muted/80 backdrop-blur-sm border-b">Earnings</TableHead>
                  <TableHead className="w-20 bg-muted/80 backdrop-blur-sm border-b">Need/Day</TableHead>
                  <TableHead className="w-32 bg-muted/80 backdrop-blur-sm border-b">Timeline</TableHead>
                  <TableHead className="w-16 bg-muted/80 backdrop-blur-sm border-b">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = format(addDays(monthStart, i), 'yyyy-MM-dd');
                  const record = records[date];
                  const isTodayRow = format(new Date(), 'yyyy-MM-dd') === date;
                  
                  if (!record) return null;

                  return (
                    <TableRow key={date} className={isTodayRow ? 'bg-accent/30' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{format(addDays(monthStart, i), 'dd')}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(addDays(monthStart, i), 'EEE')}
                          </span>
                        </div>
                      </TableCell>
                      
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant={record.isDayOff ? "secondary" : "outline"}
                            onClick={() => toggleDayOff(date)}
                            className={`h-8 w-8 p-0 ${record.isDayOff ? 'bg-orange-500/10 text-orange-600 border-orange-500/20' : ''}`}
                            title="Day off"
                          >
                            D
                          </Button>
                          {!record.isWorking ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => startWork(date)}
                                disabled={!!record.endTime}
                                className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                              <InterruptDialog
                                onAddInterrupt={(startTime, minutes) => addInterrupt(date, startTime, minutes)}
                                disabled={!record.startTime}
                              />
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => stopWork(date)}
                                className="h-8 w-8 p-0"
                              >
                                <Square className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => stopWork(date, true)}
                                className="h-8 text-xs px-2"
                              >
                                Est
                              </Button>
                              <InterruptDialog
                                onAddInterrupt={(startTime, minutes) => addInterrupt(date, startTime, minutes)}
                              />
                            </>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="font-mono text-sm">
                        {record.isWorking ? (
                          record.startTime || '-'
                        ) : (
                          <TimeInput
                            value={record.startTime || ''}
                            onChange={(value) => updateStartTime(date, value)}
                            className="w-full"
                            placeholder="--:--"
                          />
                        )}
                      </TableCell>
                      
                      <TableCell className="font-mono text-sm">
                        {record.isWorking ? (
                          format(currentTime, 'HH:mm')
                        ) : (
                          <TimeInput
                            value={record.endTime || ''}
                            onChange={(value) => updateEndTime(date, value)}
                            className="w-full"
                            placeholder="--:--"
                          />
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <TimeInput
                          value={record.estimatedEndTime}
                          onChange={(value) => updateEstimatedEndTime(date, value)}
                          className="w-full"
                        />
                      </TableCell>
                      
                      <TableCell className="font-medium">
                        {record.workedHours > 0 ? formatHours(record.workedHours) : '-'}
                      </TableCell>
                      
                      <TableCell className="font-medium text-primary">
                        {record.workedHours > 0 ? formatCurrency(record.workedHours * hourlyRate) : '-'}
                      </TableCell>
                       
                        <TableCell className="font-medium text-xs">
                          {(() => {
                            const dateObj = addDays(monthStart, i);
                            const isFutureDate = isFuture(dateObj) || format(dateObj, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
                            const isWorkingDay = !isWeekend(dateObj);
                            
                            if (isFutureDate && isWorkingDay && hoursPerWorkingDay > 0) {
                              return (
                                <span className="text-orange-500 font-semibold">
                                  {formatHours(hoursPerWorkingDay)}
                                </span>
                              );
                            }
                            return '-';
                          })()}
                        </TableCell>
                       
                       <TableCell>
                         <TimeSparkline
                           intervals={record.interrupts || []}
                           workStart={record.startTime || undefined}
                           workEnd={record.endTime || undefined}
                           isWorking={record.isWorking}
                           currentTime={currentTime}
                         />
                       </TableCell>
                       
                       <TableCell>
                        {record.isWorking ? (
                          record.isPaused ? (
                            <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">
                              Paused
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-success/10 text-success border-success/20">
                              Working
                            </Badge>
                          )
                        ) : record.endTime ? (
                          <Badge className="bg-muted text-muted-foreground">
                            Done
                          </Badge>
                        ) : record.isDayOff ? (
                          <Badge variant="outline" className="text-orange-600 border-orange-500/30">
                            Off
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            -
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkHoursTable;