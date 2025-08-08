import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Clock, Calendar, CreditCard, Pause, Target, Edit2 } from 'lucide-react';
import { format, getDaysInMonth, startOfMonth, addDays, endOfMonth, eachDayOfInterval, isWeekend, isFuture, isToday } from 'date-fns';

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

const WorkHoursTable: React.FC = () => {
  const [hourlyRate, setHourlyRate] = useState<number>(300);
  const [records, setRecords] = useState<{ [key: string]: DayRecord }>({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [dailyHoursGoal, setDailyHoursGoal] = useState<number>(() => {
    const saved = localStorage.getItem('dailyHoursGoal');
    return saved ? parseFloat(saved) : 8;
  });
  const [isEditingDailyGoal, setIsEditingDailyGoal] = useState(false);

  const currentMonth = new Date();
  const daysInMonth = getDaysInMonth(currentMonth);
  const monthStart = startOfMonth(currentMonth);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('workHoursData', JSON.stringify(records));
    localStorage.setItem('hourlyRate', hourlyRate.toString());
    localStorage.setItem('dailyHoursGoal', dailyHoursGoal.toString());
  }, [records, hourlyRate, dailyHoursGoal]);

  // Initialize days for current month
  useEffect(() => {
    const newRecords = { ...records };
    
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
        };
      }
    }
    
    setRecords(newRecords);
  }, [daysInMonth, monthStart]);

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
    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        startTime: now,
        endTime: null,
        isWorking: true,
        isPaused: false,
        pausedTime: 0,
      }
    }));
  };

  const pauseWork = (date: string) => {
    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        isPaused: true,
      }
    }));
  };

  const resumeWork = (date: string) => {
    const record = records[date];
    if (!record || !record.startTime) return;

    const now = new Date();
    const pauseStart = new Date(`${currentMonth.toDateString()} ${record.startTime}`);
    const pausedDuration = now.getTime() - pauseStart.getTime() - (record.workedHours * 60 * 60 * 1000);
    
    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        isPaused: false,
        pausedTime: (prev[date].pausedTime || 0) + Math.max(0, pausedDuration),
      }
    }));
  };

  const stopWork = (date: string, useEstimated = false) => {
    const record = records[date];
    if (!record || !record.startTime) return;

    const endTime = useEstimated ? record.estimatedEndTime : format(currentTime, 'HH:mm');
    const workedHours = calculateWorkedHours(record.startTime, endTime, record.pausedTime || 0);
    const earnings = workedHours * hourlyRate;

    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        endTime,
        isWorking: false,
        isPaused: false,
        workedHours,
        earnings,
      }
    }));
  };

  const updateStartTime = (date: string, time: string) => {
    const record = records[date];
    if (record.isWorking) return; // Don't allow editing while timer is running

    const workedHours = time && record.endTime ? calculateWorkedHours(time, record.endTime, record.pausedTime || 0) : 0;
    const earnings = workedHours * hourlyRate;

    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        startTime: time || null,
        workedHours,
        earnings,
      }
    }));
  };

  const updateEndTime = (date: string, time: string) => {
    const record = records[date];
    if (record.isWorking) return; // Don't allow editing while timer is running

    const workedHours = record.startTime && time ? calculateWorkedHours(record.startTime, time, record.pausedTime || 0) : 0;
    const earnings = workedHours * hourlyRate;

    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        endTime: time || null,
        workedHours,
        earnings,
      }
    }));
  };

  const updateEstimatedEndTime = (date: string, time: string) => {
    setRecords(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        estimatedEndTime: time,
      }
    }));
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

  const totalEarnings = Object.values(records).reduce((sum, record) => sum + record.earnings, 0);
  const totalHours = Object.values(records).reduce((sum, record) => sum + record.workedHours, 0);

  // Today's hours for daily goal calculation
  const today = format(new Date(), 'yyyy-MM-dd');
  const todayRecord = records[today];
  const todayHours = todayRecord ? todayRecord.workedHours : 0;
  const remainingHoursToday = Math.max(0, dailyHoursGoal - todayHours);

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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Calendar className="h-6 w-6 text-primary" />
            Work Hours Tracker - {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
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
                  <Clock className="h-5 w-5 text-success" />
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

          {/* Daily Goal Summary */}
          <Card className="border-orange-500/20 bg-orange-500/5 mb-6">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-500" />
                    <span className="font-medium">Hours left today:</span>
                    <span className="text-lg font-semibold text-orange-500">
                      {remainingHoursToday > 0 ? formatHours(remainingHoursToday) : 'Goal reached! 🎉'}
                    </span>
                  </div>
                  
                  {isEditingDailyGoal ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        value={dailyHoursGoal}
                        onChange={(e) => setDailyHoursGoal(Number(e.target.value))}
                        onBlur={() => setIsEditingDailyGoal(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingDailyGoal(false)}
                        className="w-20 h-8"
                        autoFocus
                      />
                      <span className="text-sm">h/day</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Goal: {formatHours(dailyHoursGoal)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsEditingDailyGoal(true)}
                        className="h-6 w-6 p-0"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                  <TableHead className="w-28">Start Time</TableHead>
                  <TableHead className="w-28">End Time</TableHead>
                  <TableHead className="w-32">Est. End Time</TableHead>
                  <TableHead className="w-24">Hours</TableHead>
                  <TableHead className="w-28">Earnings</TableHead>
                  <TableHead className="w-24">Needed/Day</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const date = format(addDays(monthStart, i), 'yyyy-MM-dd');
                  const record = records[date];
                  const isToday = format(new Date(), 'yyyy-MM-dd') === date;
                  
                  if (!record) return null;

                  return (
                    <TableRow key={date} className={isToday ? 'bg-accent/30' : ''}>
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
                            <Button
                              size="sm"
                              onClick={() => startWork(date)}
                              disabled={!!record.endTime}
                              className="h-8 w-8 p-0"
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          ) : (
                            <>
                              {!record.isPaused ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => pauseWork(date)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Pause className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => resumeWork(date)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Play className="h-3 w-3" />
                                </Button>
                              )}
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
                            </>
                          )}
                        </div>
                      </TableCell>
                      
                      <TableCell className="font-mono text-sm">
                        {record.isWorking ? (
                          record.startTime || '-'
                        ) : (
                          <Input
                            type="time"
                            value={record.startTime || ''}
                            onChange={(e) => updateStartTime(date, e.target.value)}
                            className="w-full h-8 text-sm font-mono"
                            placeholder="--:--"
                          />
                        )}
                      </TableCell>
                      
                      <TableCell className="font-mono text-sm">
                        {record.isWorking ? (
                          format(currentTime, 'HH:mm')
                        ) : (
                          <Input
                            type="time"
                            value={record.endTime || ''}
                            onChange={(e) => updateEndTime(date, e.target.value)}
                            className="w-full h-8 text-sm font-mono"
                            placeholder="--:--"
                          />
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Input
                          type="time"
                          value={record.estimatedEndTime}
                          onChange={(e) => updateEstimatedEndTime(date, e.target.value)}
                          className="w-full h-8 text-sm"
                        />
                      </TableCell>
                      
                      <TableCell className="font-medium">
                        {record.workedHours > 0 ? formatHours(record.workedHours) : '-'}
                      </TableCell>
                      
                      <TableCell className="font-medium text-primary">
                        {record.earnings > 0 ? formatCurrency(record.earnings) : '-'}
                      </TableCell>
                       
                        <TableCell className="font-medium">
                          {(() => {
                            const dateObj = addDays(monthStart, i);
                            const isFutureDate = isFuture(dateObj) || format(dateObj, 'yyyy-MM-dd') === today;
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