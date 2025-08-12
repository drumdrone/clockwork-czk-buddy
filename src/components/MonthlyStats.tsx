import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Calendar, Clock, CreditCard, TrendingUp, Target, Edit2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';

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
  isDayOff?: boolean;
}

interface MonthlyStatsProps {
  records: { [key: string]: DayRecord };
  hourlyRate: number;
  selectedMonth: Date;
}

const MonthlyStats: React.FC<MonthlyStatsProps> = ({ records, hourlyRate, selectedMonth }) => {
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const saved = localStorage.getItem('monthlyGoal');
    return saved ? parseFloat(saved) : 50000;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // Parse YYYY-MM-DD as local Date to avoid timezone shifts
  const parseDateLocal = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  useEffect(() => {
    localStorage.setItem('monthlyGoal', monthlyGoal.toString());
  }, [monthlyGoal]);

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

  const getDailyStats = () => {
    const currentMonthRecords = Object.values(records).filter(record => {
      const recordDate = parseDateLocal(record.date);
      return recordDate.getMonth() === selectedMonth.getMonth() && 
             recordDate.getFullYear() === selectedMonth.getFullYear();
    });

    return currentMonthRecords
      .filter(record => record.workedHours > 0)
      .sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime());
  };

  const exportToGoogleSheets = () => {
    const dailyStats = getDailyStats();
    const csvContent = [
      ['Date', 'Day', 'Hours', 'Earnings (CZK)', 'Start Time', 'End Time'],
      ...dailyStats.map(record => [
        record.date,
        format(parseDateLocal(record.date), 'EEEE'),
        record.workedHours.toFixed(2),
        (record.workedHours * hourlyRate).toFixed(0),
        record.startTime || '',
        record.endTime || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `daily-work-hours-${format(new Date(), 'yyyy-MM')}.csv`;
    link.click();
  };

  const dailyStats = getDailyStats();
  const totalHours = dailyStats.reduce((sum, record) => sum + record.workedHours, 0);
  // Recalculate earnings based on current hourly rate instead of using stored earnings
  const totalEarnings = dailyStats.reduce((sum, record) => sum + (record.workedHours * hourlyRate), 0);

  // Goal calculations
  const remainingEarnings = Math.max(0, monthlyGoal - totalEarnings);
  const remainingHours = remainingEarnings / hourlyRate;
  
// Calculate working days from today to end of month (Monday-Friday only)
const today = new Date();
const endOfCurrentMonth = endOfMonth(today);
const remainingDays = eachDayOfInterval({
  start: today,
  end: endOfCurrentMonth
}).filter(day => !isWeekend(day))
  .filter(day => {
    const key = format(day, 'yyyy-MM-dd');
    return !(records[key]?.isDayOff);
  });
  
  const hoursPerWorkingDay = remainingDays.length > 0 ? remainingHours / remainingDays.length : 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-6 w-6 text-primary" />
              Daily Work Summary - {format(selectedMonth, 'MMMM yyyy')}
            </CardTitle>
            <Button onClick={exportToGoogleSheets} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Month Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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

            <Card className="border-accent/20 bg-accent/5">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-accent-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Working Days</p>
                    <p className="text-lg font-semibold">{dailyStats.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Goal */}
          <Card className="border-orange-500/20 bg-orange-500/5 mb-6">
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-500" />
                    <h3 className="text-lg font-semibold">Monthly Goal</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingGoal(!isEditingGoal)}
                    className="text-orange-500 hover:text-orange-600"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Goal</Label>
                    {isEditingGoal ? (
                      <Input
                        type="number"
                        value={monthlyGoal}
                        onChange={(e) => setMonthlyGoal(Number(e.target.value))}
                        onBlur={() => setIsEditingGoal(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditingGoal(false)}
                        className="mt-1"
                        autoFocus
                      />
                    ) : (
                      <p className="text-lg font-semibold text-orange-500 mt-1">
                        {formatCurrency(monthlyGoal)}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Remaining</Label>
                    <p className="text-lg font-semibold mt-1">
                      {formatCurrency(remainingEarnings)}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Hours Needed</Label>
                    <p className="text-lg font-semibold mt-1">
                      {formatHours(remainingHours)}
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Hours/Day ({remainingDays.length} working days left)
                    </Label>
                    <p className="text-lg font-semibold mt-1">
                      {formatHours(hoursPerWorkingDay)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{((totalEarnings / monthlyGoal) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (totalEarnings / monthlyGoal) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Daily Breakdown</h3>
            {dailyStats.length === 0 ? (
              <Card className="border-muted">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No work hours recorded for this month yet.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dailyStats.map((record) => (
                  <Card key={record.date} className="border-primary/10 hover:border-primary/20 transition-colors">
                    <CardContent className="pt-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">
                              {format(parseDateLocal(record.date), 'dd')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(parseDateLocal(record.date), 'EEEE')}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {format(parseDateLocal(record.date), 'MMM')}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-success" />
                            <span className="text-sm font-medium text-success">
                              {formatHours(record.workedHours)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium text-primary">
                              {formatCurrency(record.workedHours * hourlyRate)}
                            </span>
                          </div>

                          {record.startTime && record.endTime && (
                            <div className="text-xs text-muted-foreground font-mono">
                              {record.startTime} - {record.endTime}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyStats;