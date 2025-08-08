import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Calendar, Clock, CreditCard, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

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

interface MonthlyStatsProps {
  records: { [key: string]: DayRecord };
  hourlyRate: number;
}

const MonthlyStats: React.FC<MonthlyStatsProps> = ({ records, hourlyRate }) => {
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
    const currentMonth = new Date();
    const currentMonthRecords = Object.values(records).filter(record => {
      const recordDate = new Date(record.date);
      return recordDate.getMonth() === currentMonth.getMonth() && 
             recordDate.getFullYear() === currentMonth.getFullYear();
    });

    return currentMonthRecords
      .filter(record => record.workedHours > 0)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const exportToGoogleSheets = () => {
    const dailyStats = getDailyStats();
    const csvContent = [
      ['Date', 'Day', 'Hours', 'Earnings (CZK)', 'Start Time', 'End Time'],
      ...dailyStats.map(record => [
        record.date,
        format(new Date(record.date), 'EEEE'),
        record.workedHours.toFixed(2),
        record.earnings.toFixed(0),
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
  const totalEarnings = dailyStats.reduce((sum, record) => sum + record.earnings, 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Calendar className="h-6 w-6 text-primary" />
              Daily Work Summary - {format(new Date(), 'MMMM yyyy')}
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
                              {format(new Date(record.date), 'dd')}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(record.date), 'EEEE')}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {format(new Date(record.date), 'MMM')}
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
                              {formatCurrency(record.earnings)}
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