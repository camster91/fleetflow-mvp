import React, { useState } from 'react';
import { Palette } from 'lucide-react';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  className?: string;
}

const presetColors = [
  '#2563eb', // blue
  '#059669', // emerald
  '#dc2626', // red
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#0891b2', // cyan
  '#4338ca', // indigo
  '#000000', // black
  '#64748b', // slate
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg hover:border-slate-400 transition-colors bg-white"
        >
          <div
            className="w-6 h-6 rounded border border-slate-200"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm text-slate-700 uppercase">{value}</span>
          <Palette className="h-4 w-4 text-slate-400 ml-2" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 mt-2 p-3 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
              <div className="grid grid-cols-5 gap-2">
                {presetColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      onChange(color);
                      setIsOpen(false);
                    }}
                    className={`
                      w-8 h-8 rounded-lg border-2 transition-all
                      ${value === color ? 'border-slate-900 scale-110' : 'border-transparent hover:scale-105'}
                    `}
                    style={{ backgroundColor: color }}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-200">
                <label className="flex items-center gap-2">
                  <span className="text-sm text-slate-600">Custom:</span>
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#000000"
                  />
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ColorPicker;
