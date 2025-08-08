import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addDays, subDays, isToday, isSameMonth } from 'date-fns';

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
  records: { [key: string]: DayRecord };
}

const MonthlyCalendar: React.FC<MonthlyCalendarProps> = ({ selectedMonth, records }) => {
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  
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

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
        <CardTitle className="flex items-center gap-2 text-2xl">
          <Calendar className="h-6 w-6 text-primary" />
          Calendar View - {format(selectedMonth, 'MMMM yyyy')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
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
                    {dayData.earnings > 0 && (
                      <div className="text-xs bg-success/10 text-success px-2 py-1 rounded font-medium">
                        {formatCurrency(dayData.earnings)}
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
                      <div className="text-xs bg-warning/10 text-warning px-2 py-1 rounded">
                        {dayData.interrupts.length} break{dayData.interrupts.length > 1 ? 's' : ''}
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
  );
};

export default MonthlyCalendar;