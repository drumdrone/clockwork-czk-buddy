import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Calendar, CreditCard, Target } from 'lucide-react';
import InterruptDialog from './InterruptDialog';
import TimeSparkline from './TimeSparkline';
import TimeInput from './TimeInput';
import { format, getDaysInMonth, startOfMonth, addDays, endOfMonth, eachDayOfInterval, isWeekend, isFuture, isToday } from 'date-fns';

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
    const savedRate = localStorage.getItem('hourlyRate');
    
    if (savedData) {
      setRecords(JSON.parse(savedData));
    }
    if (savedRate) {
      setHourlyRate(Number(savedRate));
    }
  }, []); // Only run once on mount

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('workHoursData', JSON.stringify(records));
    localStorage.setItem('hourlyRate', hourlyRate.toString());
    localStorage.setItem('dailyHoursGoal', dailyHoursGoal.toString());
  }, [records, hourlyRate, dailyHoursGoal]);

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
        };
        hasNewDays = true;
      }
    }
    
    if (hasNewDays) {
      setRecords(newRecords);
    }
  }, [daysInMonth, monthStart, setRecords]);

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
  
  const hoursPerWorkingDay = remainingWorkingDays.length > 0 ? remainingHours / remainingWorkingDays.length : 0;

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
            
            {/* Compact Hours Left Display */}
            <div className="flex items-center gap-2 text-sm bg-orange-500/10 px-3 py-1 rounded-full border border-orange-500/20">
              <Target className="h-3 w-3 text-orange-500" />
              <span className="text-orange-500 font-medium">
                {remainingHours > 0 ? `${formatHours(remainingHours)} left` : '✓ Goal reached'}
              </span>
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