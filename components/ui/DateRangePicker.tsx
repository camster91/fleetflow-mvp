import React, { useState } from 'react';
import { Button } from './Button';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from 'date-fns';

interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const presetRanges = [
  {
    label: 'Last 7 days',
    getValue: () => ({
      from: subDays(new Date(), 7),
      to: new Date(),
      label: 'Last 7 days',
    }),
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      from: subDays(new Date(), 30),
      to: new Date(),
      label: 'Last 30 days',
    }),
  },
  {
    label: 'This week',
    getValue: () => ({
      from: startOfWeek(new Date()),
      to: endOfWeek(new Date()),
      label: 'This week',
    }),
  },
  {
    label: 'This month',
    getValue: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
      label: 'This month',
    }),
  },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (range: DateRange) => {
    onChange(range);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        iconLeft={<Calendar className="h-4 w-4" />}
        iconRight={<ChevronDown className="h-4 w-4" />}
      >
        {value.label || `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d')}`}
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
            {presetRanges.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handleSelect(preset.getValue())}
                className={`
                  w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors
                  ${value.label === preset.label ? 'bg-blue-50 text-blue-700' : 'text-slate-700'}
                `}
              >
                {preset.label}
              </button>
            ))}
            <div className="border-t border-slate-200 my-1" />
            <div className="px-4 py-2">
              <p className="text-xs text-slate-500 mb-2">Custom range</p>
              <div className="space-y-2">
                <input
                  type="date"
                  value={format(value.from, 'yyyy-MM-dd')}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      from: new Date(e.target.value),
                      label: 'Custom',
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <input
                  type="date"
                  value={format(value.to, 'yyyy-MM-dd')}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      to: new Date(e.target.value),
                      label: 'Custom',
                    })
                  }
                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DateRangePicker;
