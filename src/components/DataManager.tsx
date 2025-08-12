import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Download, Upload, Save, Undo2, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

interface WorkRecord {
  id: string;
  user_id?: string;
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
  created_at?: string;
  updated_at?: string;
}

interface UserSettings {
  hourly_rate: number;
  daily_hours_goal: number;
}

const DataManager = () => {
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettings>({ hourly_rate: 300, daily_hours_goal: 8 });
  const [loading, setLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState('');
  const { toast } = useToast();

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load work records
      const { data: workRecords, error: recordsError } = await supabase
        .from('work_records')
        .select('*')
        .order('date', { ascending: false });

      if (recordsError) throw recordsError;

      // Load user settings
      const { data: settings, error: settingsError } = await supabase
        .from('user_settings')
        .select('*')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') throw settingsError;

      setRecords((workRecords || []).map(record => ({
        ...record,
        interrupts: Array.isArray(record.interrupts) ? record.interrupts : []
      })));
      if (settings) {
        setUserSettings({
          hourly_rate: settings.hourly_rate || 300,
          daily_hours_goal: settings.daily_hours_goal || 8
        });
      }
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

  // Save record to database
  const saveRecord = async (record: WorkRecord) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('work_records')
        .upsert({
          ...record,
          user_id: user.id,
          interrupts: record.interrupts || []
        });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save record: " + error.message,
        variant: "destructive",
      });
    }
  };

  // Add new record
  const addNewRecord = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newRecord = {
        user_id: user.id,
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

      const { data, error } = await supabase
        .from('work_records')
        .insert([newRecord])
        .select()
        .single();

      if (error) throw error;

      setRecords(prev => [{
        ...data,
        interrupts: Array.isArray(data.interrupts) ? data.interrupts : []
      }, ...prev]);
      toast({
        title: "Success",
        description: "New record added",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to add record: " + error.message,
        variant: "destructive",
      });
    }
  };

  // Delete selected records
  const deleteSelectedRecords = async () => {
    if (selectedRows.size === 0) return;

    try {
      const { error } = await supabase
        .from('work_records')
        .delete()
        .in('id', Array.from(selectedRows));

      if (error) throw error;

      setRecords(prev => prev.filter(record => !selectedRows.has(record.id)));
      setSelectedRows(new Set());
      toast({
        title: "Success",
        description: `Deleted ${selectedRows.size} records`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to delete records: " + error.message,
        variant: "destructive",
      });
    }
  };

  // Handle cell edit
  const startEdit = (id: string, field: string, currentValue: any) => {
    setEditingCell({ id, field });
    setEditValue(currentValue?.toString() || '');
  };

  const saveEdit = async () => {
    if (!editingCell) return;

    const record = records.find(r => r.id === editingCell.id);
    if (!record) return;

    let newValue: any = editValue;
    
    // Type conversion based on field
    if (['worked_hours', 'earnings', 'paused_time'].includes(editingCell.field)) {
      newValue = parseFloat(editValue) || 0;
    } else if (['is_working', 'is_paused', 'is_day_off'].includes(editingCell.field)) {
      newValue = editValue.toLowerCase() === 'true';
    }

    const updatedRecord = { ...record, [editingCell.field]: newValue };
    
    // Auto-calculate earnings if hours or rate changed
    if (editingCell.field === 'worked_hours') {
      updatedRecord.earnings = newValue * userSettings.hourly_rate;
    }

    await saveRecord(updatedRecord);
    setRecords(prev => prev.map(r => r.id === editingCell.id ? updatedRecord : r));
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
    reader.onload = async (e) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',');
        const newRecords: any[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length >= headers.length && values[0]) {
            newRecords.push({
              user_id: user.id,
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
          const { data, error } = await supabase
            .from('work_records')
            .upsert(newRecords)
            .select();

          if (error) throw error;

          await loadData();
          toast({
            title: "Success",
            description: `Imported ${newRecords.length} records`,
          });
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
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
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