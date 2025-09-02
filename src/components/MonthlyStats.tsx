import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Download, Calendar, Clock, CreditCard, TrendingUp, Target, Edit2, Upload, CalendarIcon } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, startOfYear } from 'date-fns';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

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
  const [currentViewMonth, setCurrentViewMonth] = useState(selectedMonth);
  const [exportUrl, setExportUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Parse YYYY-MM-DD as local Date to avoid timezone shifts
  const parseDateLocal = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  useEffect(() => {
    localStorage.setItem('monthlyGoal', monthlyGoal.toString());
  }, [monthlyGoal]);

  // Load user settings for export functionality
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: settings } = await supabase
          .from('user_settings')
          .select('export_url')
          .single();

        if (settings?.export_url) {
          setExportUrl(settings.export_url);
        }
      } catch (error) {
        console.error('Failed to load export URL:', error);
      }
    };

    loadSettings();
  }, []);

  // Update currentViewMonth when selectedMonth prop changes
  useEffect(() => {
    setCurrentViewMonth(selectedMonth);
  }, [selectedMonth]);

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
      return recordDate.getMonth() === currentViewMonth.getMonth() && 
             recordDate.getFullYear() === currentViewMonth.getFullYear();
    });

    return currentMonthRecords
      .filter(record => record.workedHours > 0)
      .sort((a, b) => parseDateLocal(b.date).getTime() - parseDateLocal(a.date).getTime());
  };

  const exportToCSV = () => {
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
    link.download = `daily-work-hours-${format(currentViewMonth, 'yyyy-MM')}.csv`;
    link.click();
  };

  const exportToGoogleSheets = async () => {
    if (!exportUrl) {
      toast({
        title: "Export URL Required",
        description: "Please configure your Google Apps Script URL in Data Manager settings first.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      // Convert current month's records to the format expected by the edge function
      const dailyStats = getDailyStats();
      const workHoursData: { [key: string]: any } = {};
      
      dailyStats.forEach(record => {
        workHoursData[record.date] = {
          startTime: record.startTime,
          endTime: record.endTime,
          estimatedEndTime: record.estimatedEndTime,
          workedHours: record.workedHours,
          earnings: record.earnings,
          isDayOff: record.isDayOff,
          pausedTime: record.pausedTime,
          interrupts: []
        };
      });

      const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
        body: {
          action: 'backup',
          exportUrl: exportUrl,
          data: {
            hourlyRate: hourlyRate,
            dailyGoal: 8,
            monthlyGoal: monthlyGoal,
            workHoursData: workHoursData
          }
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Export Successful",
          description: `Exported ${dailyStats.length} records to Google Sheets`,
        });
      } else {
        throw new Error(data?.error || 'Export failed');
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: "Export Failed",
        description: error.message || "Failed to export data to Google Sheets",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const dailyStats = getDailyStats();
  // Build daily earnings data and append weekly total bars (1-7, 8-14, 15-21, 22-31)
  const start = startOfMonth(currentViewMonth);
  const end = endOfMonth(currentViewMonth);
  const days = eachDayOfInterval({ start, end });

  const dayEntries = days.map((d) => {
    const key = format(d, 'yyyy-MM-dd');
    const worked = Number(records[key]?.workedHours || 0);
    const earnings = Math.round(worked * hourlyRate);
    return {
      date: key,
      label: format(d, 'd'),
      earnings,
      isWeekTotal: false,
      weekIndex: Math.min(3, Math.floor((d.getDate() - 1) / 7)),
    };
  });

  const weeklySums = [0, 0, 0, 0];
  dayEntries.forEach((e) => {
    weeklySums[e.weekIndex] += e.earnings;
  });

  const chartData = [] as Array<{ label: string; earnings: number; isWeekTotal?: boolean }>;
  dayEntries.forEach((e, i) => {
    chartData.push({ label: e.label, earnings: e.earnings });
    const dayNum = parseInt(e.label, 10);
    const isBoundary = [7, 14, 21].includes(dayNum) || i === dayEntries.length - 1;
    if (isBoundary) {
      const wIdx = Math.min(3, Math.floor((dayNum - 1) / 7));
      chartData.push({ label: `W${wIdx + 1}`, earnings: weeklySums[wIdx], isWeekTotal: true });
    }
  });

  const chartConfig = {
    earnings: {
      label: 'Earnings',
      color: 'hsl(var(--accent))',
    },
  } as const;
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
            <div className="flex items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Calendar className="h-6 w-6 text-primary" />
                Daily Work Summary
              </CardTitle>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[240px] justify-start text-left font-normal",
                      "hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(currentViewMonth, "MMMM yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={currentViewMonth}
                    onSelect={(date) => date && setCurrentViewMonth(startOfMonth(date))}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={exportToCSV} variant="outline" className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
              <Button 
                onClick={exportToGoogleSheets} 
                disabled={exporting || !exportUrl}
                className="flex items-center gap-2"
              >
                <Upload className="h-4 w-4" />
                {exporting ? 'Exporting...' : 'Export to Sheets'}
              </Button>
            </div>
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

          {/* Daily Earnings with weekly total bars */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Daily Earnings</h3>
            {dailyStats.length === 0 ? (
              <Card className="border-muted">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No work hours recorded for this month yet.
                </CardContent>
              </Card>
            ) : (
              <Card className="border-primary/10">
                <CardContent className="pt-6">
                  <ChartContainer config={chartConfig} className="h-72 w-full">
                    <BarChart data={chartData} margin={{ left: 12, right: 12 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="earnings" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isWeekTotal ? 'hsl(var(--primary))' : 'var(--color-earnings)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MonthlyStats;