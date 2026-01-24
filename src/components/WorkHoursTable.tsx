
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Calendar, CreditCard, Target, Cloud, CloudDownload, CloudUpload, ExternalLink } from 'lucide-react';
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
  setRecords: React.Dispatch<React.SetStateAction<{ [key: string]: DayRecord }>>;
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

  const [googleAppsScriptUrl, setGoogleAppsScriptUrl] = useState(() => {
    const saved = localStorage.getItem('googleAppsScriptUrl');
    return saved || '';
  });

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(() => {
    const saved = localStorage.getItem('autoSyncEnabled');
    return saved === 'true';
  });
  const [syncInterval, setSyncInterval] = useState(() => {
    const saved = localStorage.getItem('syncInterval');
    return saved ? parseInt(saved) : 30; // default 30 minutes
  });
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      try {
        const parsed = JSON.parse(savedData);
        if (parsed && typeof parsed === 'object') {
          setRecords(parsed);
        } else {
          console.warn('Invalid workHoursData in localStorage, resetting.');
          localStorage.removeItem('workHoursData');
        }
      } catch (e) {
        console.error('Failed to parse workHoursData. Clearing corrupted data.', e);
        localStorage.removeItem('workHoursData');
      }
    }
  }, []); // Only run once on mount

  // Save data to localStorage
  useEffect(() => {
    localStorage.setItem('workHoursData', JSON.stringify(records));
    localStorage.setItem('hourlyRate', hourlyRate.toString());
    localStorage.setItem('dailyHoursGoal', dailyHoursGoal.toString());
    localStorage.setItem('googleSheetId', googleSheetId);
    localStorage.setItem('googleAppsScriptUrl', googleAppsScriptUrl);
    localStorage.setItem('autoSyncEnabled', autoSyncEnabled.toString());
    localStorage.setItem('syncInterval', syncInterval.toString());
  }, [records, hourlyRate, dailyHoursGoal, googleSheetId, googleAppsScriptUrl, autoSyncEnabled, syncInterval]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncEnabled && googleSheetId.trim() && syncInterval > 0) {
      const intervalMs = syncInterval * 60 * 1000; // Convert minutes to milliseconds

      // Initial sync
      console.log('Auto-sync enabled, initial sync...');
      syncFromGoogleSheets();

      // Set up interval
      syncIntervalRef.current = setInterval(() => {
        console.log('Auto-syncing from Google Sheets...');
        syncFromGoogleSheets();
      }, intervalMs);

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }
  }, [autoSyncEnabled, googleSheetId, syncInterval]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, []);

  // Initialize days for current month using functional state update to avoid clobbering imported data
  useEffect(() => {
    setRecords((prev) => {
      const newRecords = { ...prev };
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

      return hasNewDays ? newRecords : prev;
    });
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

  const handleCSVImportClick = () => {
    csvInputRef.current?.click();
  };

  const handleCSVImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
      }

      // Parse CSV - detect columns dynamically from headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      console.log('CSV Headers:', headers);

      const importedData: { [key: string]: DayRecord } = {};

      // Find column indices dynamically
      const findColumn = (names: string[]) => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const dateIdx = findColumn(['date', 'datum']);
      const startIdx = findColumn(['start time', 'start', 'začátek', 'zacatek']);
      const endIdx = findColumn(['end time', 'end', 'konec']);
      const estEndIdx = findColumn(['estimated end', 'est. end', 'est end', 'odhadovaný konec']);
      const workedIdx = findColumn(['worked hours', 'hours', 'hodiny']);
      const earningsIdx = findColumn(['earnings', 'výdělek', 'vydelek']);
      const dayOffIdx = findColumn(['day off', 'volno']);
      const pausedIdx = findColumn(['paused', 'pauza']);

      console.log('Column indices:', { dateIdx, startIdx, endIdx, estEndIdx, workedIdx, earningsIdx, dayOffIdx, pausedIdx });

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue; // Skip invalid rows

        const date = dateIdx >= 0 ? values[dateIdx] : values[0];
        if (!date || date.toLowerCase().includes('hourly') || date.toLowerCase().includes('daily') || date.toLowerCase().includes('monthly')) {
          continue; // Skip config rows
        }

        const startTime = startIdx >= 0 ? values[startIdx] : null;
        const endTime = endIdx >= 0 ? values[endIdx] : null;
        const estimatedEndTime = estEndIdx >= 0 ? values[estEndIdx] : '17:00';
        const workedHours = workedIdx >= 0 ? parseFloat(values[workedIdx]) || 0 : 0;
        const earnings = earningsIdx >= 0 ? parseFloat(values[earningsIdx]) || 0 : 0;
        const isDayOff = dayOffIdx >= 0 ? values[dayOffIdx]?.toLowerCase() === 'true' : false;
        const pausedTime = pausedIdx >= 0 ? parseInt(values[pausedIdx]) || 0 : 0;

        importedData[date] = {
          date,
          startTime,
          endTime,
          estimatedEndTime,
          isWorking: false,
          workedHours,
          earnings,
          isPaused: false,
          pausedTime,
          interrupts: [],
          isDayOff,
        };
      }

      if (Object.keys(importedData).length === 0) {
        throw new Error('No valid data found in CSV');
      }

      const processedData = recomputeImportedData(importedData, hourlyRate);
      setRecords(processedData);
      localStorage.setItem('workHoursData', JSON.stringify(processedData));

      toast({
        title: 'CSV imported',
        description: `Successfully imported ${Object.keys(processedData).length} records.`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Import failed',
        description: err.message || 'Invalid CSV file.',
        variant: 'destructive' as any,
      });
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const data = json.data || json;
      if (!data.workHoursData) throw new Error('Invalid backup file');

      const rate = typeof data.hourlyRate === 'number' ? data.hourlyRate : hourlyRate;
      const processedWorkHoursData = recomputeImportedData(data.workHoursData, rate);

      setRecords(processedWorkHoursData);
      if (typeof data.hourlyRate === 'number') setHourlyRate(data.hourlyRate);
      if (typeof data.dailyHoursGoal === 'number') setDailyHoursGoal(data.dailyHoursGoal);
      if (typeof data.monthlyGoal === 'number') localStorage.setItem('monthlyGoal', String(data.monthlyGoal));

      localStorage.setItem('workHoursData', JSON.stringify(processedWorkHoursData));
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

  const syncFromGoogleSheets = async () => {
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

    setIsSyncing(true);
    try {
      console.log('Fetching CSV from URL:', googleSheetId);

      // Fetch CSV directly from URL (works without Supabase)
      const response = await fetch(googleSheetId);
      if (!response.ok) {
        throw new Error(`Failed to fetch CSV: ${response.statusText}`);
      }

      const csvText = await response.text();
      const lines = csvText.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('CSV file is empty or invalid');
      }

      // Parse CSV - detect columns dynamically from headers
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      console.log('CSV Headers:', headers);

      const importedData: { [key: string]: DayRecord } = {};

      // Find column indices dynamically
      const findColumn = (names: string[]) => {
        for (const name of names) {
          const idx = headers.findIndex(h => h.includes(name.toLowerCase()));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const dateIdx = findColumn(['date', 'datum']);
      const startIdx = findColumn(['start time', 'start', 'začátek', 'zacatek']);
      const endIdx = findColumn(['end time', 'end', 'konec']);
      const estEndIdx = findColumn(['estimated end', 'est. end', 'est end', 'odhadovaný konec']);
      const workedIdx = findColumn(['worked hours', 'hours', 'hodiny']);
      const earningsIdx = findColumn(['earnings', 'výdělek', 'vydelek']);
      const dayOffIdx = findColumn(['day off', 'volno']);
      const pausedIdx = findColumn(['paused', 'pauza']);

      console.log('Column indices:', { dateIdx, startIdx, endIdx, estEndIdx, workedIdx, earningsIdx, dayOffIdx, pausedIdx });

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue; // Skip invalid rows

        const date = dateIdx >= 0 ? values[dateIdx] : values[0];
        if (!date || date.toLowerCase().includes('hourly') || date.toLowerCase().includes('daily') || date.toLowerCase().includes('monthly')) {
          continue; // Skip config rows
        }

        const startTime = startIdx >= 0 ? values[startIdx] : null;
        const endTime = endIdx >= 0 ? values[endIdx] : null;
        const estimatedEndTime = estEndIdx >= 0 ? values[estEndIdx] : '17:00';
        const workedHours = workedIdx >= 0 ? parseFloat(values[workedIdx]) || 0 : 0;
        const earnings = earningsIdx >= 0 ? parseFloat(values[earningsIdx]) || 0 : 0;
        const isDayOff = dayOffIdx >= 0 ? values[dayOffIdx]?.toLowerCase() === 'true' : false;
        const pausedTime = pausedIdx >= 0 ? parseInt(values[pausedIdx]) || 0 : 0;

        importedData[date] = {
          date,
          startTime,
          endTime,
          estimatedEndTime,
          isWorking: false,
          workedHours,
          earnings,
          isPaused: false,
          pausedTime,
          interrupts: [],
          isDayOff,
        };
      }

      if (Object.keys(importedData).length === 0) {
        throw new Error('No valid data found in CSV');
      }

      const processedData = recomputeImportedData(importedData, hourlyRate);
      setRecords(processedData);
      localStorage.setItem('workHoursData', JSON.stringify(processedData));
      localStorage.setItem('lastSyncTime', new Date().toISOString());

      toast({
        title: 'Sync successful',
        description: `Synced ${Object.keys(processedData).length} records from Google Sheet.`
      });
    } catch (error: any) {
      console.error('Sync failed:', error);
      toast({
        title: 'Sync failed',
        description: error.message || 'Failed to sync from Google Sheet. Make sure the URL is a published CSV.',
        variant: 'destructive'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const restoreFromGoogleSheets = async () => {
    // Legacy function for Supabase - redirect to new sync function
    await syncFromGoogleSheets();
  };

  const exportDayToGoogleSheets = async (date: string) => {
    if (!googleAppsScriptUrl.trim()) {
      toast({
        title: 'Google Apps Script URL required',
        description: 'Please enter your Google Apps Script Web App URL first.',
        variant: 'destructive'
      });
      return;
    }

    const record = records[date];
    if (!record) {
      toast({
        title: 'No data',
        description: 'No data found for this date.',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(googleAppsScriptUrl, {
        method: 'POST',
        mode: 'no-cors', // Google Apps Script requires no-cors
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: record.date,
          startTime: record.startTime || '',
          endTime: record.endTime || '',
          workedHours: record.workedHours || 0,
          earnings: record.earnings || 0,
        }),
      });

      toast({
        title: 'Exported to Google Sheets',
        description: `Data for ${format(parseDateLocal(date), 'MMM d, yyyy')} has been sent to your Google Sheet.`,
      });
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export to Google Sheets.',
        variant: 'destructive'
      });
    }
  };

  const exportMonthToGoogleSheets = async () => {
    if (!googleAppsScriptUrl.trim()) {
      toast({
        title: 'Google Apps Script URL required',
        description: 'Please enter your Google Apps Script Web App URL first.',
        variant: 'destructive'
      });
      return;
    }

    try {
      // Get all days in current month - ONLY dates, no data
      // This creates empty rows for the month structure
      const monthData = [];
      for (let i = 0; i < daysInMonth; i++) {
        const date = format(addDays(monthStart, i), 'yyyy-MM-dd');

        // Send ONLY the date - Apps Script will skip existing rows
        monthData.push({
          date: date,
          startTime: '',
          endTime: '',
          workedHours: 0,
          earnings: 0,
        });
      }

      await fetch(googleAppsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(monthData),
      });

      toast({
        title: 'Month structure created',
        description: `Created date rows for ${format(currentMonth, 'MMMM yyyy')}. Existing data was not modified.`,
      });
    } catch (error: any) {
      console.error('Export failed:', error);
      toast({
        title: 'Export failed',
        description: error.message || 'Failed to export month to Google Sheets.',
        variant: 'destructive'
      });
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

  // Helper to parse YYYY-MM-DD as local date
  const parseDateLocal = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  // Parse "HH:mm" to minutes since midnight
  const parseTimeToMinutes = (t?: string | null) => {
    if (!t || typeof t !== 'string') return null;
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  // Compute worked hours for a single record using times and breaks
  const computeWorkedHoursForRecord = (rec: DayRecord): number => {
    const s = parseTimeToMinutes(rec.startTime);
    const e = parseTimeToMinutes(rec.endTime);
    if (s == null || e == null) return 0;
    let minutes = Math.max(0, e - s);

    const breaks = (rec.interrupts || []).reduce((acc: number, it: any) => {
      const sb = parseTimeToMinutes(it.start);
      const eb = parseTimeToMinutes(it.end);
      if (sb == null || eb == null) return acc;
      return acc + Math.max(0, eb - sb);
    }, 0);

    // Subtract breaks and paused time (pausedTime stored in ms)
    minutes = Math.max(0, minutes - breaks - Math.floor((rec.pausedTime || 0) / 60000));

    return minutes / 60;
  };

  // Normalize and recompute imported data
  const recomputeImportedData = (incoming: { [key: string]: DayRecord }, rate: number) => {
    const result: { [key: string]: DayRecord } = { ...incoming };
    Object.keys(result).forEach((dateKey) => {
      const r: any = result[dateKey] as any;

      // Ensure required fields exist
      r.date = r.date || dateKey;
      if (typeof r.startTime === 'string') r.startTime = r.startTime.trim();
      if (typeof r.endTime === 'string') r.endTime = r.endTime.trim();

      r.isWorking = false; // never import as running
      r.isPaused = false;
      r.pausedTime = typeof r.pausedTime === 'number' ? r.pausedTime : Number(r.pausedTime) || 0;
      r.interrupts = Array.isArray(r.interrupts) ? r.interrupts : [];
      r.isDayOff = !!r.isDayOff;
      r.estimatedEndTime = r.estimatedEndTime || '17:00';

      // Coerce workedHours to a number if it came as string (e.g. "7,5")
      let wh = r.workedHours;
      if (typeof wh !== 'number' || !isFinite(wh)) {
        const parsed = Number(String(wh ?? '').replace(',', '.'));
        wh = Number.isFinite(parsed) ? parsed : 0;
      }

      console.log(`[${dateKey}] CSV workedHours:`, wh, 'startTime:', r.startTime, 'endTime:', r.endTime);

      // Always compute from times if we have both start and end time
      const computed = (r.startTime && r.endTime) ? computeWorkedHoursForRecord(r) : (wh > 0 ? wh : 0);

      console.log(`[${dateKey}] Computed workedHours:`, computed);

      r.workedHours = computed;
      r.earnings = Math.max(0, computed * (typeof rate === 'number' && isFinite(rate) ? rate : 0));
    });
    return result;
  };
  // Monthly totals for selected month
  const monthlyRecords = Object.values(records).filter((record) => {
    const d = parseDateLocal(record.date);
    return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
  });
  const totalEarnings = monthlyRecords.reduce((sum, record) => sum + (record.workedHours * hourlyRate), 0);
  const totalHours = monthlyRecords.reduce((sum, record) => sum + record.workedHours, 0);

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
              <Button variant="outline" size="sm" onClick={handleCSVImportClick} className="h-8">
                Import CSV
              </Button>
              <input type="file" accept="application/json" ref={fileInputRef} onChange={handleImportChange} className="hidden" />
              <input type="file" accept=".csv,text/csv" ref={csvInputRef} onChange={handleCSVImportChange} className="hidden" />
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
          {/* Google Sheets Auto-Sync */}
          <Card className="border-primary/10 mb-6">
            <CardContent className="pt-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Google Sheets Auto-Sync</p>
                      <p className="text-xs text-muted-foreground">
                        {autoSyncEnabled
                          ? `Syncing every ${syncInterval} minutes`
                          : 'Paste your published CSV URL below'}
                      </p>
                    </div>
                  </div>
                  {localStorage.getItem('lastSyncTime') && (
                    <Badge variant="outline" className="text-xs">
                      Last sync: {new Date(localStorage.getItem('lastSyncTime')!).toLocaleTimeString()}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Import URL (CSV for syncing data from Sheets)</label>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/.../pub?gid=0&single=true&output=csv"
                      value={googleSheetId}
                      onChange={(e) => setGoogleSheetId(e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Export URL (Apps Script for exporting individual days)</label>
                    <Input
                      placeholder="https://script.google.com/macros/s/.../exec"
                      value={googleAppsScriptUrl}
                      onChange={(e) => setGoogleAppsScriptUrl(e.target.value)}
                      className="flex-1 font-mono text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={syncFromGoogleSheets}
                      disabled={isSyncing || !googleSheetId.trim()}
                      className="min-w-[120px]"
                    >
                      <CloudDownload className={`h-4 w-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                      {isSyncing ? 'Syncing...' : 'Sync Now'}
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportMonthToGoogleSheets}
                      disabled={!googleAppsScriptUrl.trim()}
                      className="min-w-[140px]"
                      title="Create empty date rows for the month (won't overwrite existing data)"
                    >
                      <CloudUpload className="h-4 w-4 mr-1" />
                      Init Month
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                      className="h-8"
                    >
                      <a
                        href="https://docs.google.com/spreadsheets/d/12E9XXt5p7Ax2W10wV0866lq8sc7zw2CCm9xHG4pWbaU/edit?gid=0#gid=0"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Google Sheets"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>

                    <div className="flex items-center gap-2 ml-auto">
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoSyncEnabled}
                          onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                          className="w-4 h-4"
                        />
                        Auto-sync
                      </label>

                      {autoSyncEnabled && (
                        <>
                          <span className="text-sm text-muted-foreground">every</span>
                          <Input
                            type="number"
                            min="1"
                            max="1440"
                            value={syncInterval}
                            onChange={(e) => setSyncInterval(parseInt(e.target.value) || 30)}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-sm text-muted-foreground">min</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-3 rounded">
                  <p><strong>📝 How to get CSV URL:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open your Google Sheet</li>
                    <li>Click <strong>File → Share → Publish to web</strong></li>
                    <li>Choose <strong>Entire Document</strong> or specific sheet</li>
                    <li>Select <strong>Comma-separated values (.csv)</strong></li>
                    <li>Click <strong>Publish</strong> and copy the URL</li>
                  </ol>
                </div>
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
                              <Button
                                size="sm"
                                onClick={() => exportDayToGoogleSheets(date)}
                                disabled={!googleAppsScriptUrl.trim() || (!record.startTime && !record.endTime)}
                                className="h-8 w-8 p-0 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30"
                                title="Export to Google Sheets"
                              >
                                <CloudUpload className="h-3 w-3" />
                              </Button>
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
