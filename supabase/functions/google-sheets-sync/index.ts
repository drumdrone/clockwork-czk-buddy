import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    
    const { action, data } = await req.json();
    console.log('Request data:', { action });

    if (action === 'backup') {
      // Convert data to CSV format
      const csvData = convertToCSV(data);
      console.log('CSV data prepared, rows:', csvData.length);
      
      // Convert to CSV string
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      
      // Return the CSV data for download
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'CSV data generated successfully.',
        csvData: csvContent
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'restore') {
      // For restore, we'll need the user to provide CSV data
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Please use the JSON backup/restore feature instead.' 
      }), {
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