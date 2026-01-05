const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

function isHttpsUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isAllowedHost(urlStr: string, allowed: string[]) {
  try {
    const u = new URL(urlStr);
    return allowed.some((host) => u.hostname === host || u.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

async function fetchWithTimeout(input: Request | string, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  try {
    const requestBody = await req.json();
    const { action, data, csvUrl, webAppUrl } = requestBody || {};

    if (action === 'backup') {
      // If no webhook URL, return CSV content only
      if (!webAppUrl) {
        const csvData = convertToCSV(data);
        const csvContent = csvData.map((row) => row.join(',')).join('\n');
        return new Response(JSON.stringify({ success: true, message: 'CSV data generated successfully.', csvData: csvContent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Validate Apps Script URL
      if (!isHttpsUrl(webAppUrl) || !isAllowedHost(webAppUrl, ['script.google.com', 'script.googleusercontent.com'])) {
        return new Response(JSON.stringify({ error: 'Invalid webAppUrl host. Only Google Apps Script URLs are allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const url = new URL(webAppUrl);
      console.log('Sending to Apps Script host:', url.hostname);

      const response = await fetchWithTimeout(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'updateSheet', data })
      }, 10000);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Apps Script update failed:', response.status, errorText.slice(0, 200));
        return new Response(JSON.stringify({ error: `Failed to update Google Sheet: ${response.status}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, message: 'Data updated in Google Sheet successfully.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'restore') {
      if (!csvUrl) {
        return new Response(JSON.stringify({ error: 'CSV URL is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (!isHttpsUrl(csvUrl) || !isAllowedHost(csvUrl, ['docs.google.com', 'drive.google.com'])) {
        return new Response(JSON.stringify({ error: 'Invalid csvUrl host. Only Google Docs/Drive published CSV URLs are allowed.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const url = new URL(csvUrl);
      console.log('Fetching CSV from host:', url.hostname);

      const response = await fetchWithTimeout(csvUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Supabase Edge Function)' } }, 10000);
      if (!response.ok) {
        console.error('Fetch failed:', response.status, response.statusText);
        return new Response(JSON.stringify({ error: `Failed to fetch CSV data: ${response.status} ${response.statusText}` }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const lenHeader = response.headers.get('content-length');
      if (lenHeader && Number(lenHeader) > 2_000_000) {
        return new Response(JSON.stringify({ error: 'CSV too large' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const csvText = await response.text();
      const restoredData = parseCSVData(csvText);

      return new Response(JSON.stringify({ success: true, message: 'Data imported from Google Sheet successfully.', data: restoredData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    console.error('Error in google-sheets-sync function:', error?.message || error);
    return new Response(JSON.stringify({ error: error?.message || 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

function convertToCSV(data: any) {
  const headers = ['Date', 'Day', 'Start Time', 'End Time', 'Estimated End', 'Hours Worked', 'Earnings', 'Is Day Off', 'Interrupts'];
  const rows = [headers];

  rows.push(['Hourly Rate', data.hourlyRate?.toString() || '', '', '', '', '', '', '', '']);
  rows.push(['Daily Hours Goal', data.dailyHoursGoal?.toString() || '', '', '', '', '', '', '', '']);
  rows.push(['Monthly Goal', data.monthlyGoal?.toString() || '', '', '', '', '', '', '', '']);
  rows.push(['']);

  Object.entries(data.workHoursData || {}).forEach(([date, record]: [string, any]) => {
    const dateObj = new Date(date + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
    const interruptsStr = record.interrupts?.map((i: any) => `${i.start}-${i.end}`).join(';') || '';
    rows.push([
      date,
      dayName,
      record.startTime || '',
      record.endTime || '',
      record.estimatedEndTime || '',
      String(record.workedHours ?? ''),
      String(record.earnings ?? ''),
      record.isDayOff ? 'true' : 'false',
      interruptsStr,
    ]);
  });

  return rows;
}

function parseCSVData(csvText: string) {
  const lines = csvText.trim().split('\n');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const rows = lines.map((line) => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });

  if (rows.length < 5) {
    return { workHoursData: {}, hourlyRate: 300, dailyHoursGoal: 8, monthlyGoal: 50000 };
  }

  let hourlyRate = 300;
  let dailyHoursGoal = 8;
  let monthlyGoal = 50000;

  for (let i = 1; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    if (row[0]?.toLowerCase().includes('hourly')) hourlyRate = parseFloat(row[1]) || 300;
    else if (row[0]?.toLowerCase().includes('daily')) dailyHoursGoal = parseFloat(row[1]) || 8;
    else if (row[0]?.toLowerCase().includes('monthly')) monthlyGoal = parseFloat(row[1]) || 50000;
  }

  const workHoursData: any = {};
  for (let i = 5; i < rows.length; i++) {
    const row = rows[i];
    if (row.length < 7 || !row[0] || row[0] === '') continue;

    const date = row[0];
    if (!date.match(/\d{4}-\d{2}-\d{2}/)) continue;

    const interrupts = row[8]
      ? row[8].split(';').map((interrupt: string) => {
          const [start, end] = interrupt.split('-');
          return { start, end, type: 'break' };
        })
      : [];

    workHoursData[date] = {
      date,
      startTime: row[2] || null,
      endTime: row[3] || null,
      estimatedEndTime: row[4] || '17:00',
      isWorking: false,
      workedHours: parseFloat(row[5]) || 0,
      earnings: parseFloat(row[6]) || 0,
      isPaused: false,
      pausedTime: 0,
      interrupts,
      isDayOff: row[7] === 'true',
    };
  }

  return { workHoursData, hourlyRate, dailyHoursGoal, monthlyGoal };
}
