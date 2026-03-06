import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Download, Upload, RefreshCw, Settings, Clock } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format, parseISO, formatDistanceToNow } from 'date-fns';

interface WorkRecord {
  id: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  estimated_end_time: string | null;
  is_working: boolean;
  worked_hours: number;
  earnings: number;
  is_paused: boolean;
  paused_time: number;
  interrupts: any[];
  is_day_off: boolean;
}

interface UserSettings {
  hourly_rate: number;
  daily_hours_goal: number;
  csv_sync_url?: string;
  sync_interval_minutes?: number;
  auto_sync_enabled?: boolean;
  last_sync_at?: string;
  export_url?: string;
}

const DataManager = () => {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>({ hourly_rate: 300, daily_hours_goal: 8 });
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [syncUrl, setSyncUrl] = useState('');
  const [syncInterval, setSyncInterval] = useState(15);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [exportUrl, setExportUrl] = useState('');
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load data from localStorage
  const loadData = useCallback(() => {
    try {
      const savedData = localStorage.getItem('workHoursData');
      const savedRate = localStorage.getItem('hourlyRate');
      const savedGoal = localStorage.getItem('dailyHoursGoal');
      const savedSyncUrl = localStorage.getItem('dm_syncUrl');
      const savedSyncInterval = localStorage.getItem('dm_syncInterval');
      const savedAutoSync = localStorage.getItem('dm_autoSyncEnabled');
      const savedExportUrl = localStorage.getItem('dm_exportUrl');
      const savedLastSync = localStorage.getItem('dm_lastSyncAt');

      if (savedData) {
        const parsed = JSON.parse(savedData);
        const recordList: WorkRecord[] = Object.entries(parsed).map(([date, record]: [string, any]) => ({
          id: date,
          date,
          start_time: record.startTime || null,
          end_time: record.endTime || null,
          estimated_end_time: record.estimatedEndTime || null,
          is_working: record.isWorking || false,
          worked_hours: record.workedHours || 0,
          earnings: record.earnings || 0,
          is_paused: record.isPaused || false,
          paused_time: record.pausedTime || 0,
          interrupts: record.interrupts || [],
          is_day_off: record.isDayOff || false,
        }));
        setRecords(recordList.sort((a, b) => b.date.localeCompare(a.date)));
      }

      setUserSettings({
        hourly_rate: savedRate ? parseFloat(savedRate) : 300,
        daily_hours_goal: savedGoal ? parseFloat(savedGoal) : 8,
        csv_sync_url: savedSyncUrl || '',
        sync_interval_minutes: savedSyncInterval ? parseInt(savedSyncInterval) : 15,
        auto_sync_enabled: savedAutoSync === 'true',
        last_sync_at: savedLastSync || undefined,
        export_url: savedExportUrl || '',
      });
      setSyncUrl(savedSyncUrl || '');
      setSyncInterval(savedSyncInterval ? parseInt(savedSyncInterval) : 15);
      setAutoSyncEnabled(savedAutoSync === 'true');
      setExportUrl(savedExportUrl || '');
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load data: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-sync effect
  useEffect(() => {
    if (autoSyncEnabled && syncUrl && syncInterval > 0) {
      const intervalMs = syncInterval * 60 * 1000;
      syncIntervalRef.current = setInterval(() => {
        syncFromCSV();
      }, intervalMs);
      return () => {
        if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      };
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    }
  }, [autoSyncEnabled, syncUrl, syncInterval]);

  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, []);

  // Save records to localStorage
  const saveRecordToStorage = (updatedRecords: WorkRecord[]) => {
    const dataObj: any = {};
    updatedRecords.forEach(record => {
      dataObj[record.date] = {
        date: record.date,
        startTime: record.start_time,
        endTime: record.end_time,
        estimatedEndTime: record.estimated_end_time,
        isWorking: record.is_working,
        workedHours: record.worked_hours,
        earnings: record.earnings,
        isPaused: record.is_paused,
        pausedTime: record.paused_time,
        interrupts: record.interrupts,
        isDayOff: record.is_day_off,
      };
    });
    localStorage.setItem('workHoursData', JSON.stringify(dataObj));
  };

  // Add new record
  const addNewRecord = () => {
    const newRecord: WorkRecord = {
      id: format(new Date(), 'yyyy-MM-dd'),
      date: format(new Date(), 'yyyy-MM-dd'),
      start_time: null,
      end_time: null,
      estimated_end_time: null,
      is_working: false,
      worked_hours: 0,
      earnings: 0,
      is_paused: false,
      paused_time: 0,
      interrupts: [],
      is_day_off: false,
    };

    const updated = [newRecord, ...records];
    setRecords(updated);
    saveRecordToStorage(updated);
    toast({ title: "Success", description: "New record added" });
  };

  // Delete selected records
  const deleteSelectedRecords = () => {
    if (selectedRows.size === 0) return;
    const updated = records.filter(record => !selectedRows.has(record.id));
    setRecords(updated);
    saveRecordToStorage(updated);
    setSelectedRows(new Set());
    toast({ title: "Success", description: `Deleted ${selectedRows.size} records` });
  };

  // Handle cell edit
  const startEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(currentValue?.toString() || '');
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const record = records.find(r => r.id === editingCell.id);
    if (!record) return;

    let newValue: any = editValue;
    if (['worked_hours', 'earnings', 'paused_time'].includes(editingCell.field)) {
      newValue = parseFloat(editValue) || 0;
    } else if (['is_working', 'is_paused', 'is_day_off'].includes(editingCell.field)) {
      newValue = editValue.toLowerCase() === 'true';
    }

    const updatedRecord = { ...record, [editingCell.field]: newValue };
    if (editingCell.field === 'worked_hours') {
      updatedRecord.earnings = newValue * userSettings.hourly_rate;
    }

    const updated = records.map(r => r.id === editingCell.id ? updatedRecord : r);
    setRecords(updated);
    saveRecordToStorage(updated);
    setEditingCell(null);
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Date', 'Start Time', 'End Time', 'Estimated End', 'Worked Hours', 'Earnings', 'Day Off', 'Paused Time'];
    const csvContent = [
      headers.join(','),
      ...records.map(record => [
        record.date,
        record.start_time || '',
        record.end_time || '',
        record.estimated_end_time || '',
        record.worked_hours,
        record.earnings,
        record.is_day_off,
        record.paused_time
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-hours-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from CSV
  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        const newRecords: WorkRecord[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length >= 2 && values[0]) {
            newRecords.push({
              id: values[0],
              date: values[0],
              start_time: values[1] || null,
              end_time: values[2] || null,
              estimated_end_time: values[3] || null,
              worked_hours: parseFloat(values[4]) || 0,
              earnings: parseFloat(values[5]) || 0,
              is_day_off: values[6] === 'true',
              paused_time: parseInt(values[7]) || 0,
              is_working: false,
              is_paused: false,
              interrupts: [],
            });
          }
        }

        if (newRecords.length > 0) {
          const recordMap = new Map(records.map(r => [r.date, r]));
          newRecords.forEach(r => recordMap.set(r.date, r));
          const merged = Array.from(recordMap.values()).sort((a, b) => b.date.localeCompare(a.date));
          setRecords(merged);
          saveRecordToStorage(merged);
          toast({ title: "Success", description: `Imported ${newRecords.length} records` });
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description: "Failed to import CSV: " + error.message,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  // Sync from URL
  const syncFromCSV = async () => {
    const urlToUse = syncUrl || exportUrl;
    if (!urlToUse) {
      toast({
        title: "Error",
        description: "No sync URL configured.",
        variant: "destructive",
      });
      return;
    }

    setSyncing(true);
    try {
      const response = await fetch(urlToUse);
      if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

      const csv = await response.text();
      const lines = csv.split('\n').filter(l => l.trim());
      if (lines.length < 2) throw new Error('CSV is empty');

      const newRecords: WorkRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 2 && values[0]) {
          newRecords.push({
            id: values[0],
            date: values[0],
            start_time: values[1] || null,
            end_time: values[2] || null,
            estimated_end_time: values[3] || null,
            worked_hours: parseFloat(values[4]) || 0,
            earnings: parseFloat(values[5]) || 0,
            is_day_off: values[6] === 'true',
            paused_time: parseInt(values[7]) || 0,
            is_working: false,
            is_paused: false,
            interrupts: [],
          });
        }
      }

      if (newRecords.length > 0) {
        const recordMap = new Map(records.map(r => [r.date, r]));
        newRecords.forEach(r => recordMap.set(r.date, r));
        const merged = Array.from(recordMap.values()).sort((a, b) => b.date.localeCompare(a.date));
        setRecords(merged);
        saveRecordToStorage(merged);

        localStorage.setItem('dm_lastSyncAt', new Date().toISOString());
        setUserSettings(prev => ({ ...prev, last_sync_at: new Date().toISOString() }));

        toast({ title: "Success", description: `Imported ${newRecords.length} records from Google Sheets` });
      }
    } catch (error: any) {
      toast({
        title: "Import Error",
        description: error.message || "Failed to import data",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // Save sync settings
  const saveSyncSettings = () => {
    localStorage.setItem('dm_syncUrl', syncUrl);
    localStorage.setItem('dm_syncInterval', syncInterval.toString());
    localStorage.setItem('dm_autoSyncEnabled', autoSyncEnabled.toString());
    localStorage.setItem('dm_exportUrl', exportUrl);

    setUserSettings(prev => ({
      ...prev,
      csv_sync_url: syncUrl,
      sync_interval_minutes: syncInterval,
      auto_sync_enabled: autoSyncEnabled,
      export_url: exportUrl,
    }));
    setShowSyncSettings(false);
    toast({ title: "Success", description: "Sync settings saved" });
  };

  // Export to Google Sheets
  const exportToSheets = async () => {
    if (!exportUrl) {
      toast({
        title: "Error",
        description: "No export URL configured.",
        variant: "destructive",
      });
      return;
    }

    setExporting(true);
    try {
      const workHoursData: any = {};
      records.forEach(record => {
        workHoursData[record.date] = {
          startTime: record.start_time,
          endTime: record.end_time,
          estimatedEndTime: record.estimated_end_time,
          workedHours: record.worked_hours,
          earnings: record.earnings,
          isDayOff: record.is_day_off,
          interrupts: record.interrupts || []
        };
      });

      await fetch(exportUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'backup',
          data: {
            workHoursData,
            hourlyRate: userSettings.hourly_rate,
            dailyHoursGoal: userSettings.daily_hours_goal,
            monthlyGoal: userSettings.daily_hours_goal * 22 * userSettings.hourly_rate
          }
        }),
      });

      toast({ title: "Success", description: "Data exported to Google Sheets successfully!" });
    } catch (error: any) {
      toast({
        title: "Export Error",
        description: error.message || "Failed to export",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Data Manager
            <div className="flex gap-2">
              <Button onClick={addNewRecord} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Row
              </Button>
              <Button
                onClick={deleteSelectedRecords}
                variant="destructive"
                size="sm"
                disabled={selectedRows.size === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedRows.size})
              </Button>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <label>
                <Button variant="outline" size="sm" asChild>
                  <span>
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </span>
                </Button>
                <input
                  type="file"
                  accept=".csv"
                  onChange={importFromCSV}
                  className="hidden"
                />
              </label>
              <Button
                onClick={syncFromCSV}
                variant="outline"
                size="sm"
                disabled={syncing || (!syncUrl && !exportUrl)}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Importing...' : 'Import from Sheets'}
              </Button>
              <Button
                onClick={exportToSheets}
                variant="outline"
                size="sm"
                disabled={exporting || !exportUrl}
              >
                <Upload className={`w-4 h-4 mr-2 ${exporting ? 'animate-spin' : ''}`} />
                {exporting ? 'Exporting...' : 'Export to Sheets'}
              </Button>
              <Button
                onClick={() => setShowSyncSettings(true)}
                variant="outline"
                size="sm"
              >
                <Settings className="w-4 h-4 mr-2" />
                Sync Settings
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Sync Status */}
          {(autoSyncEnabled || userSettings.last_sync_at) && (
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={autoSyncEnabled ? "default" : "outline"}>
                    {autoSyncEnabled ? 'Auto-import ON' : 'Auto-import OFF'}
                  </Badge>
                  {autoSyncEnabled && (
                    <span className="text-muted-foreground">
                      Importing every {syncInterval} minutes
                    </span>
                  )}
                </div>
                {userSettings.last_sync_at && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Last import: {formatDistanceToNow(new Date(userSettings.last_sync_at), { addSuffix: true })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sync Settings Modal */}
          {showSyncSettings && (
            <div className="mb-4 p-4 border rounded-lg bg-card">
              <h3 className="text-lg font-semibold mb-3">Google Sheets Sync Settings</h3>
              <div className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-200">Recommended: Use Apps Script URL</p>
                  <p className="text-blue-600 dark:text-blue-300 mt-1">
                    Set up a Google Apps Script to enable bidirectional sync. See GOOGLE_APPS_SCRIPT_BIDIRECTIONAL.md for instructions.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium">Apps Script URL (for export & import)</label>
                  <Input
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={exportUrl}
                    onChange={(e) => setExportUrl(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="border-t pt-4">
                  <p className="text-xs text-muted-foreground mb-2">Alternative: Published CSV URL (read-only import)</p>
                  <Input
                    placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                    value={syncUrl}
                    onChange={(e) => setSyncUrl(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                  />
                  <label htmlFor="autoSync" className="text-sm font-medium">
                    Enable auto-import
                  </label>
                </div>
                {autoSyncEnabled && (
                  <div>
                    <label className="text-sm font-medium">Import interval (minutes)</label>
                    <Input
                      type="number"
                      min="1"
                      max="1440"
                      value={syncInterval}
                      onChange={(e) => setSyncInterval(parseInt(e.target.value) || 15)}
                      className="mt-1 w-32"
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button onClick={saveSyncSettings} size="sm">
                    Save Settings
                  </Button>
                  <Button onClick={() => setShowSyncSettings(false)} variant="outline" size="sm">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedRows.size === records.length && records.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(new Set(records.map(r => r.id)));
                        } else {
                          setSelectedRows(new Set());
                        }
                      }}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Estimated End</TableHead>
                  <TableHead>Worked Hours</TableHead>
                  <TableHead>Earnings</TableHead>
                  <TableHead>Day Off</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(record.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedRows);
                          if (e.target.checked) {
                            newSelected.add(record.id);
                          } else {
                            newSelected.delete(record.id);
                          }
                          setSelectedRows(newSelected);
                        }}
                      />
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => startEdit(record.id, 'date', record.date)}
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'date' ? (
                        <Input
                          type="date"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        format(parseISO(record.date), 'MMM dd, yyyy')
                      )}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => startEdit(record.id, 'start_time', record.start_time)}
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'start_time' ? (
                        <Input
                          type="time"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        record.start_time || '-'
                      )}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => startEdit(record.id, 'end_time', record.end_time)}
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'end_time' ? (
                        <Input
                          type="time"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        record.end_time || '-'
                      )}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => startEdit(record.id, 'estimated_end_time', record.estimated_end_time)}
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'estimated_end_time' ? (
                        <Input
                          type="time"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        record.estimated_end_time || '-'
                      )}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => startEdit(record.id, 'worked_hours', record.worked_hours)}
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'worked_hours' ? (
                        <Input
                          type="number"
                          step="0.1"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        record.worked_hours.toFixed(1)
                      )}
                    </TableCell>
                    <TableCell
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => startEdit(record.id, 'earnings', record.earnings)}
                    >
                      {editingCell?.id === record.id && editingCell?.field === 'earnings' ? (
                        <Input
                          type="number"
                          step="0.01"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit();
                            if (e.key === 'Escape') cancelEdit();
                          }}
                          autoFocus
                        />
                      ) : (
                        `$${record.earnings.toFixed(2)}`
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.is_day_off ? "secondary" : "outline"}>
                        {record.is_day_off ? 'Day Off' : 'Work Day'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.is_working ? "default" : "outline"}>
                        {record.is_working ? 'Working' : 'Stopped'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {records.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No records found. Add your first record to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DataManager;
