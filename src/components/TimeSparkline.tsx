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
  
  const timeToPosition = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;
    const dayStartMinutes = dayStart * 60;
    const dayEndMinutes = dayEnd * 60;
    
    const position = ((totalMinutes - dayStartMinutes) / (dayEndMinutes - dayStartMinutes)) * 100;
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
    const elements = [];
    
    // Add work intervals
    if (workStart) {
      const startPos = timeToPosition(workStart);
      const endPos = workEnd ? timeToPosition(workEnd) : (isWorking ? getCurrentPosition() || 100 : startPos);
      
      if (endPos !== null && endPos > startPos) {
        elements.push(
          <div
            key="work"
            className="absolute h-full bg-success"
            style={{
              left: `${startPos}%`,
              width: `${endPos - startPos}%`,
            }}
          />
        );
      }
    }
    
    // Add break intervals
    intervals.forEach((interval, index) => {
      if (interval.type === 'break') {
        const startPos = timeToPosition(interval.start);
        const endPos = timeToPosition(interval.end);
        
        elements.push(
          <div
            key={`break-${index}`}
            className="absolute h-full bg-destructive"
            style={{
              left: `${startPos}%`,
              width: `${Math.max(1, endPos - startPos)}%`,
            }}
          />
        );
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