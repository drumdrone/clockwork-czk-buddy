import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pause } from 'lucide-react';

interface InterruptDialogProps {
  onAddInterrupt: (startTime: string, durationMinutes: number) => void;
  disabled?: boolean;
}

const InterruptDialog: React.FC<InterruptDialogProps> = ({ onAddInterrupt, disabled }) => {
  const [open, setOpen] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);

  const handleSubmit = () => {
    if (startTime && durationMinutes > 0) {
      onAddInterrupt(startTime, durationMinutes);
      setOpen(false);
      setStartTime('');
      setDurationMinutes(30);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className="h-8 w-8 p-0"
          title="Add Interrupt"
        >
          <Pause className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Interrupt</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="start-time">Start Time</Label>
            <Input
              id="start-time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="duration">Duration (minutes)</Label>
            <Input
              id="duration"
              type="number"
              min="1"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!startTime || durationMinutes <= 0}>
              Add Interrupt
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default InterruptDialog;