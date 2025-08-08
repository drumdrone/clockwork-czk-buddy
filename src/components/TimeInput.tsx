import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  className = '',
  placeholder = '--:--',
  disabled = false
}) => {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  // Parse value into hours and minutes when it changes
  useEffect(() => {
    if (value && value.includes(':')) {
      const [h, m] = value.split(':');
      setHours(h.padStart(2, '0'));
      setMinutes(m.padStart(2, '0'));
    } else {
      setHours('');
      setMinutes('');
    }
  }, [value]);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHours(val);
    
    // Auto-tab to minutes when 2 digits entered
    if (val.length === 2 && minutesRef.current) {
      minutesRef.current.focus();
    }
    
    updateTimeValue(val, minutes);
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinutes(val);
    updateTimeValue(hours, val);
  };

  const updateTimeValue = (h: string, m: string) => {
    if (h && m) {
      const formattedHours = Math.min(23, parseInt(h) || 0).toString().padStart(2, '0');
      const formattedMinutes = Math.min(59, parseInt(m) || 0).toString().padStart(2, '0');
      onChange(`${formattedHours}:${formattedMinutes}`);
    } else if (!h && !m) {
      onChange('');
    }
  };

  const handleHoursKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey && minutesRef.current) {
      e.preventDefault();
      minutesRef.current.focus();
    }
  };

  const handleMinutesKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && e.shiftKey && hoursRef.current) {
      e.preventDefault();
      hoursRef.current.focus();
    }
  };

  const handleHoursBlur = () => {
    if (hours && hours.length === 1) {
      setHours(hours.padStart(2, '0'));
      updateTimeValue(hours.padStart(2, '0'), minutes);
    }
  };

  const handleMinutesBlur = () => {
    if (minutes && minutes.length === 1) {
      setMinutes(minutes.padStart(2, '0'));
      updateTimeValue(hours, minutes.padStart(2, '0'));
    }
  };

  if (disabled) {
    return (
      <div className={`flex items-center justify-center h-8 text-sm font-mono ${className}`}>
        {value || placeholder}
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <Input
        ref={hoursRef}
        type="text"
        value={hours}
        onChange={handleHoursChange}
        onKeyDown={handleHoursKeyDown}
        onBlur={handleHoursBlur}
        className="w-8 h-8 text-center text-sm font-mono p-1"
        placeholder="HH"
        maxLength={2}
      />
      <span className="text-sm font-mono">:</span>
      <Input
        ref={minutesRef}
        type="text"
        value={minutes}
        onChange={handleMinutesChange}
        onKeyDown={handleMinutesKeyDown}
        onBlur={handleMinutesBlur}
        className="w-8 h-8 text-center text-sm font-mono p-1"
        placeholder="MM"
        maxLength={2}
      />
    </div>
  );
};

export default TimeInput;