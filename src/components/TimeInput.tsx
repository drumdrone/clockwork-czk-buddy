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
  const [isEditing, setIsEditing] = useState(false);
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

  // Parse value into hours and minutes when it changes (but not while user is editing)
  useEffect(() => {
    if (!isEditing && value && value.includes(':')) {
      const [h, m] = value.split(':');
      setHours(h.padStart(2, '0'));
      setMinutes(m.padStart(2, '0'));
    } else if (!isEditing && !value) {
      setHours('');
      setMinutes('');
    }
  }, [value, isEditing]);

  // Auto focus hours input if autoFocus is true
  useEffect(() => {
    if (autoFocus && hoursRef.current) {
      hoursRef.current.focus();
    }
  }, [autoFocus]);

  const handleHoursChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setIsEditing(true); // Set editing mode when user types
    setHours(val);
    
    // Auto-tab to minutes when 2 digits entered
    if (val.length === 2) {
      if (minutesRef.current) {
        minutesRef.current.focus();
      }
    }
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinutes(val);
    
    // Auto-jump to next time input when minutes are filled
    if (val.length === 2) {
      // Update time when complete
      updateTimeValue(hours, val);
      if (onNextFocus) {
        setTimeout(() => onNextFocus(), 0);
      }
    }
  };

  const updateTimeValue = (h: string, m: string) => {
    if (h && m) {
      const formattedHours = Math.min(23, parseInt(h) || 0).toString().padStart(2, '0');
      const formattedMinutes = Math.min(59, parseInt(m) || 0).toString().padStart(2, '0');
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
    // Set editing mode first before clearing - this prevents external value interference
    setIsEditing(true);
    setTimeout(() => {
      setHours('');
    }, 0);
  };

  const handleMinutesFocus = () => {
    // Clear minutes field when focused for fresh input and set editing mode
    setIsEditing(true);
    setMinutes('');
  };

  const handleHoursBlur = () => {
    setIsEditing(false);
    if (hours && hours.length === 1) {
      const paddedHours = hours.padStart(2, '0');
      setHours(paddedHours);
      updateTimeValue(paddedHours, minutes);
    } else if (hours) {
      // Update even with existing hours
      updateTimeValue(hours, minutes);
    }
  };

  const handleMinutesBlur = () => {
    setIsEditing(false);
    if (minutes && minutes.length === 1) {
      const paddedMinutes = minutes.padStart(2, '0');
      setMinutes(paddedMinutes);
      updateTimeValue(hours, paddedMinutes);
    } else if (minutes) {
      // Update even with existing minutes
      updateTimeValue(hours, minutes);
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