import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Input } from '@/components/ui/input';

interface TimeInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  onNextFocus?: () => void; // Callback to focus next time input
  autoFocus?: boolean;
}

export interface TimeInputRef {
  focus: () => void;
}

const TimeInput = forwardRef<TimeInputRef, TimeInputProps>(({
  value,
  onChange,
  className = '',
  placeholder = '--:--',
  disabled = false,
  onNextFocus,
  autoFocus = false
}, ref) => {
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (hoursRef.current) {
        hoursRef.current.focus();
      }
    }
  }));

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

  // Auto focus hours input if autoFocus is true
  useEffect(() => {
    if (autoFocus && hoursRef.current) {
      hoursRef.current.focus();
    }
  }, [autoFocus]);

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
    
    // Auto-jump to next time input when minutes are filled
    if (val.length === 2 && onNextFocus) {
      setTimeout(() => onNextFocus(), 0); // Use timeout to ensure state updates first
    }
  };

  const updateTimeValue = (h: string, m: string) => {
    if (h && m) {
      const formattedHours = Math.min(23, parseInt(h) || 0).toString().padStart(2, '0');
      const formattedMinutes = Math.min(59, parseInt(m) || 0).toString().padStart(2, '0');
      onChange(`${formattedHours}:${formattedMinutes}`);
    } else if (h || m) {
      // Allow partial input - this helps with controlled component behavior
      const formattedHours = h ? Math.min(23, parseInt(h) || 0).toString().padStart(2, '0') : '00';
      const formattedMinutes = m ? Math.min(59, parseInt(m) || 0).toString().padStart(2, '0') : '00';
      onChange(`${formattedHours}:${formattedMinutes}`);
    } else {
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

  const handleHoursFocus = () => {
    // Clear hours field when focused for fresh input
    setHours('');
    if (hoursRef.current) {
      hoursRef.current.select();
    }
  };

  const handleMinutesFocus = () => {
    // Clear minutes field when focused for fresh input
    setMinutes('');
    if (minutesRef.current) {
      minutesRef.current.select();
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
        onFocus={handleHoursFocus}
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
        onFocus={handleMinutesFocus}
        onBlur={handleMinutesBlur}
        className="w-8 h-8 text-center text-sm font-mono p-1"
        placeholder="MM"
        maxLength={2}
      />
    </div>
  );
});

TimeInput.displayName = "TimeInput";

export default TimeInput;