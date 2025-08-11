import React from 'react';

interface TimeInterval {
  start: string;
  end: string;
  type: 'work' | 'break';
}

interface TimeSparklineProps {
  intervals: TimeInterval[];
  workStart?: string;
  workEnd?: string;
  isWorking?: boolean;
  currentTime?: Date;
}

const TimeSparkline: React.FC<TimeSparklineProps> = ({ 
  intervals, 
  workStart, 
  workEnd, 
  isWorking, 
  currentTime 
}) => {
  const dayStart = 8; // 8 AM
  const dayEnd = 18; // 6 PM
  const totalHours = dayEnd - dayStart;
  
  const timeToPosition = (timeStr?: string): number | null => {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const parts = timeStr.split(':');
    if (parts.length < 2) return null;
    const [hStr, mStr] = parts;
    const hours = Number(hStr);
    const minutes = Number(mStr);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    const totalMinutes = hours * 60 + minutes;
    const dayStartMinutes = dayStart * 60;
    const dayEndMinutes = dayEnd * 60;
    const denom = (dayEndMinutes - dayStartMinutes);
    if (denom <= 0) return null;
    const position = ((totalMinutes - dayStartMinutes) / denom) * 100;
    return Math.max(0, Math.min(100, position));
  };

  const getCurrentPosition = () => {
    if (!currentTime || !isWorking) return null;
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return timeToPosition(timeStr);
  };

  const renderIntervals = () => {
    const elements: React.ReactNode[] = [];

    // Add work intervals
    const startPos = timeToPosition(workStart);
    let endPos: number | null = null;
    if (typeof workEnd === 'string' && workEnd) {
      endPos = timeToPosition(workEnd);
    } else if (isWorking) {
      endPos = getCurrentPosition();
    }

    if (startPos !== null && endPos !== null && endPos > startPos) {
      elements.push(
        <div
          key="work"
          className="absolute h-full bg-success"
          style={{ left: `${startPos}%`, width: `${endPos - startPos}%` }}
        />
      );
    }

    // Add break intervals
    (intervals || []).forEach((interval, index) => {
      if (interval?.type === 'break') {
        const bStart = timeToPosition(interval.start);
        const bEnd = timeToPosition(interval.end);
        if (bStart !== null && bEnd !== null && bEnd > bStart) {
          elements.push(
            <div
              key={`break-${index}`}
              className="absolute h-full bg-destructive"
              style={{ left: `${bStart}%`, width: `${Math.max(1, bEnd - bStart)}%` }}
            />
          );
        }
      }
    });

    return elements;
  };

  return (
    <div className="relative w-full h-3 bg-muted rounded-sm overflow-hidden">
      {renderIntervals()}
      {isWorking && getCurrentPosition() && (
        <div
          className="absolute top-0 w-0.5 h-full bg-foreground z-10"
          style={{ left: `${getCurrentPosition()}%` }}
        />
      )}
    </div>
  );
};

export default TimeSparkline;