import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Target, CreditCard } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, subDays, isToday, isSameMonth, isWeekend, isFuture } from 'date-fns';

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
  interrupts: any[];
}

interface MonthlyCalendarProps {
  selectedMonth: Date;
  setSelectedMonth: (month: Date) => void;
  records: { [key: string]: DayRecord };
  setRecords: (records: { [key: string]: DayRecord }) => void;
  hourlyRate: number;
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ selectedMonth, setSelectedMonth, records, setRecords, hourlyRate }) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  
  // Generate month tabs (last 6 months + current + next 2)
  const monthTabs = Array.from({ length: 9 }, (_, i) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - 6 + i);
    return monthDate;
  });
  
  // Get first day of the calendar (might be from previous month)
  const firstDayOfWeek = getDay(monthStart);
  const calendarStart = subDays(monthStart, firstDayOfWeek);
  
  // Get last day of the calendar (might be from next month)
  const calendarEnd = addDays(monthEnd, 6 - getDay(monthEnd));
  
  // Get all days for the calendar
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

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

  const getDayData = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return records[dateStr];
  };

  // Calculate monthly totals
  const monthlyRecords = Object.values(records).filter(record => {
    const recordDate = new Date(record.date);
    return recordDate >= monthStart && recordDate <= monthEnd;
  });

  const totalHours = monthlyRecords.reduce((sum, record) => sum + record.workedHours, 0);
  // Recalculate earnings based on current hourly rate instead of using stored earnings
  const totalEarnings = monthlyRecords.reduce((sum, record) => sum + (record.workedHours * hourlyRate), 0);
  
  // Monthly goal calculations
  const monthlyGoal = parseFloat(localStorage.getItem('monthlyGoal') || '50000');
  const remainingEarnings = Math.max(0, monthlyGoal - totalEarnings);
  const remainingHours = remainingEarnings / hourlyRate;
  
  // Calculate working days from today to end of month (Monday-Friday only)
  const remainingWorkingDays = eachDayOfInterval({
    start: new Date(),
    end: monthEnd
  }).filter(day => !isWeekend(day) && (isFuture(day) || isToday(day)));
  
  const hoursPerWorkingDay = remainingWorkingDays.length > 0 ? remainingHours / remainingWorkingDays.length : 0;

  const removeInterrupt = (date: string, interruptIndex: number) => {
    const dayData = getDayData(new Date(date));
    if (!dayData || !dayData.interrupts) return;

    const updatedInterrupts = dayData.interrupts.filter((_, index) => index !== interruptIndex);
    const updatedRecords = {
      ...records,
      [date]: {
        ...dayData,
        interrupts: updatedInterrupts,
      }
    };
    setRecords(updatedRecords);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-6 w-6 text-primary" />
              Calendar View - {format(selectedMonth, 'MMMM yyyy')}
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
                variant={format(monthDate, 'yyyy-MM') === format(selectedMonth, 'yyyy-MM') ? 'default' : 'outline'}
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
          {/* Monthly Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
            
            <Card className="border-orange-500/20 bg-orange-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Hours Remaining</p>
                    <p className="text-lg font-semibold text-orange-500">
                      {remainingHours > 0 ? formatHours(remainingHours) : '0h 0m'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Daily Target</p>
                    <p className="text-lg font-semibold text-blue-500">
                      {hoursPerWorkingDay > 0 ? formatHours(hoursPerWorkingDay) : '0h 0m'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-7 gap-2">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div key={day} className="p-2 text-center font-semibold text-muted-foreground border-b">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {calendarDays.map(day => {
            const dayData = getDayData(day);
            const isCurrentMonth = isSameMonth(day, selectedMonth);
            const isTodayDate = isToday(day);
            
            return (
              <div
                key={format(day, 'yyyy-MM-dd')}
                className={`
                  min-h-[120px] p-2 border border-border/50 rounded-lg
                  ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : 'bg-background'}
                  ${isTodayDate ? 'ring-2 ring-primary/50 bg-accent/30' : ''}
                  transition-all duration-200 hover:shadow-md
                `}
              >
                {/* Day number */}
                <div className="flex justify-between items-start mb-2">
                  <span className={`
                    text-sm font-semibold
                    ${isTodayDate ? 'text-primary' : ''}
                    ${!isCurrentMonth ? 'text-muted-foreground' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                  {dayData?.isWorking && (
                    <Badge variant="secondary" className="bg-success/10 text-success border-success/20 text-xs">
                      Live
                    </Badge>
                  )}
                </div>
                
                {/* Day data */}
                {dayData && isCurrentMonth && (
                  <div className="space-y-1">
                    {/* Work hours */}
                    {dayData.workedHours > 0 && (
                      <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                        {formatHours(dayData.workedHours)}
                      </div>
                    )}
                    
                    {/* Earnings */}
                    {dayData.workedHours > 0 && (
                      <div className="text-xs bg-success/10 text-success px-2 py-1 rounded font-medium">
                        {formatCurrency(dayData.workedHours * hourlyRate)}
                      </div>
                    )}
                    
                    {/* Work status */}
                    {dayData.startTime && (
                      <div className="text-xs text-muted-foreground">
                        {dayData.startTime} - {dayData.endTime || 'ongoing'}
                      </div>
                    )}
                    
                    {/* Interrupts indicator */}
                    {dayData.interrupts && dayData.interrupts.length > 0 && (
                      <div className="space-y-1">
                        {dayData.interrupts.map((interrupt, index) => (
                          <div 
                            key={index}
                            className="text-xs bg-warning/10 text-warning px-2 py-1 rounded cursor-pointer hover:bg-warning/20 transition-colors"
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (window.confirm(`Remove break from ${interrupt.start} to ${interrupt.end}?`)) {
                                removeInterrupt(format(day, 'yyyy-MM-dd'), index);
                              }
                            }}
                            title="Right-click to remove break"
                          >
                            Break: {interrupt.start}-{interrupt.end}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-primary/10 rounded"></div>
            <span>Hours worked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-success/10 rounded"></div>
            <span>Earnings</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-warning/10 rounded"></div>
            <span>Breaks taken</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-accent/30 rounded border-2 border-primary/50"></div>
            <span>Today</span>
          </div>
        </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyCalendar;