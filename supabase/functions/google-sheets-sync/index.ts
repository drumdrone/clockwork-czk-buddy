import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log('Environment check - GOOGLE_API_KEY exists:', !!Deno.env.get('GOOGLE_API_KEY'));
const googleApiKey = Deno.env.get('GOOGLE_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Function called with method:', req.method);
    
    if (!googleApiKey) {
      console.error('GOOGLE_API_KEY environment variable not set');
      throw new Error('Google API key not configured');
    }

    const { action, data, spreadsheetId, range } = await req.json();
    console.log('Request data:', { action, spreadsheetId, range });

    if (action === 'backup') {
      // Create or update a Google Sheet with work hours data
      const csvData = convertToCSV(data);
      console.log('CSV data prepared, rows:', csvData.length);
      
      // For simplicity, we'll use Google Sheets API to update a specific range
      // User needs to create a Google Sheet and share the ID
      const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:clear?key=${googleApiKey}`;
      
      // Clear existing data
      console.log('Clearing existing data...');
      const clearResponse = await fetch(clearUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!clearResponse.ok) {
        const clearError = await clearResponse.text();
        console.error('Clear failed:', clearResponse.status, clearError);
        throw new Error(`Failed to clear sheet: ${clearResponse.status} - ${clearError}`);
      }

      // Insert new data
      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=RAW&key=${googleApiKey}`;
      
      console.log('Updating with new data...');
      const response = await fetch(updateUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: csvData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Update failed:', response.status, errorText);
        throw new Error(`Google Sheets API error: ${response.status} - ${errorText}`);
      }

      console.log('Backup successful');
      return new Response(JSON.stringify({ success: true, message: 'Data backed up to Google Sheets' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'restore') {
      // Read data from Google Sheet
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${googleApiKey}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Google Sheets API error: ${response.statusText}`);
      }

      const result = await response.json();
      const restoredData = convertFromCSV(result.values || []);

      return new Response(JSON.stringify({ success: true, data: restoredData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error('Invalid action');

  } catch (error) {
    console.error('Error in google-sheets-sync function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function convertToCSV(data: any) {
  const headers = ['Date', 'Start Time', 'End Time', 'Estimated End', 'Hours Worked', 'Earnings', 'Is Day Off', 'Interrupts'];
  const rows = [headers];

  // Add metadata row
  rows.push(['Hourly Rate', data.hourlyRate.toString(), '', '', '', '', '', '']);
  rows.push(['Daily Hours Goal', data.dailyHoursGoal.toString(), '', '', '', '', '', '']);
  rows.push(['Monthly Goal', data.monthlyGoal.toString(), '', '', '', '', '', '']);
  rows.push(['']); // Empty row separator

  // Add work hours data
  Object.entries(data.workHoursData).forEach(([date, record]: [string, any]) => {
    const interruptsStr = record.interrupts?.map((i: any) => `${i.start}-${i.end}`).join(';') || '';
    rows.push([
      date,
      record.startTime || '',
      record.endTime || '',
      record.estimatedEndTime || '',
      record.workedHours.toString(),
      record.earnings.toString(),
      record.isDayOff ? 'true' : 'false',
      interruptsStr
    ]);
  });

  return rows;
}

function convertFromCSV(values: string[][]) {
  if (values.length < 5) {
    throw new Error('Invalid CSV data structure');
  }

  // Extract metadata
  const hourlyRate = parseFloat(values[1][1]) || 0;
  const dailyHoursGoal = parseFloat(values[2][1]) || 8;
  const monthlyGoal = parseFloat(values[3][1]) || 50000;

  // Extract work hours data (skip header and metadata rows)
  const workHoursData: any = {};
  
  for (let i = 5; i < values.length; i++) {
    const row = values[i];
    if (row.length < 7 || !row[0]) continue;

    const date = row[0];
    const interrupts = row[7] ? row[7].split(';').map(interrupt => {
      const [start, end] = interrupt.split('-');
      return { start, end, type: 'break' };
    }) : [];

    workHoursData[date] = {
      date,
      startTime: row[1] || null,
      endTime: row[2] || null,
      estimatedEndTime: row[3] || '17:00',
      isWorking: false,
      workedHours: parseFloat(row[4]) || 0,
      earnings: parseFloat(row[5]) || 0,
      isPaused: false,
      pausedTime: 0,
      interrupts,
      isDayOff: row[6] === 'true'
    };
  }

  return {
    workHoursData,
    hourlyRate,
    dailyHoursGoal,
    monthlyGoal
  };
}