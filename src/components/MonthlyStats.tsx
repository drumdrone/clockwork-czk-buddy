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

  const getMonthlyStats = () => {
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return last6Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      const monthRecords = Object.values(records).filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= monthStart && recordDate <= monthEnd;
      });

      const totalHours = monthRecords.reduce((sum, record) => sum + record.workedHours, 0);
      const totalEarnings = monthRecords.reduce((sum, record) => sum + record.earnings, 0);
      const workingDays = monthRecords.filter(record => record.workedHours > 0).length;

      return {
        month: format(month, 'MMMM yyyy'),
        totalHours,
        totalEarnings,
        workingDays,
        avgHoursPerDay: workingDays > 0 ? totalHours / workingDays : 0
      };
    }).reverse();
  };

  const exportToGoogleSheets = () => {
    const stats = getMonthlyStats();
    const csvContent = [
      ['Month', 'Total Hours', 'Total Earnings (CZK)', 'Working Days', 'Avg Hours/Day'],
      ...stats.map(stat => [
        stat.month,
        stat.totalHours.toFixed(2),
        stat.totalEarnings.toFixed(0),
        stat.workingDays,
        stat.avgHoursPerDay.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `work-hours-stats-${format(new Date(), 'yyyy-MM')}.csv`;
    link.click();
  };

  const monthlyStats = getMonthlyStats();
  const currentMonth = monthlyStats[0];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <TrendingUp className="h-6 w-6 text-primary" />
              Monthly Statistics
            </CardTitle>
            <Button onClick={exportToGoogleSheets} className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Current Month Summary */}
          {currentMonth && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card className="border-primary/10">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm text-muted-foreground">Current Month</p>
                      <p className="text-lg font-semibold">{currentMonth.month}</p>
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
                      <p className="text-lg font-semibold text-success">{formatHours(currentMonth.totalHours)}</p>
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
                      <p className="text-lg font-semibold text-primary">{formatCurrency(currentMonth.totalEarnings)}</p>
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
                      <p className="text-lg font-semibold">{currentMonth.workingDays}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Monthly History Table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Month</TableHead>
                  <TableHead>Total Hours</TableHead>
                  <TableHead>Total Earnings</TableHead>
                  <TableHead>Working Days</TableHead>
                  <TableHead>Avg Hours/Day</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyStats.map((stat, index) => (
                  <TableRow key={stat.month} className={index === 0 ? 'bg-accent/30' : ''}>
                    <TableCell className="font-medium">{stat.month}</TableCell>
                    <TableCell className="font-mono">{formatHours(stat.totalHours)}</TableCell>
                    <TableCell className="font-semibold text-primary">{formatCurrency(stat.totalEarnings)}</TableCell>
                    <TableCell>{stat.workingDays}</TableCell>
                    <TableCell className="font-mono">{formatHours(stat.avgHoursPerDay)}</TableCell>
                    <TableCell>
                      {index === 0 ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                          Current
                        </Badge>
                      ) : stat.totalHours > 0 ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          Complete
                        </Badge>
                      ) : (
                        <Badge variant="outline">
                          No Data
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyStats;