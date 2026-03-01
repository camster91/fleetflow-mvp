import React from 'react';

interface ToggleOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface ToggleGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
  type?: 'single' | 'multiple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ToggleGroup: React.FC<ToggleGroupProps> = ({
  options,
  value,
  onChange,
  type = 'single',
  size = 'md',
  className = '',
}) => {
  const sizeStyles = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const handleClick = (optionValue: string) => {
    if (type === 'single') {
      onChange(optionValue);
    } else {
      // For multiple selection, we'd need array value - simplified for now
      onChange(optionValue);
    }
  };

  return (
    <div className={`inline-flex bg-slate-100 rounded-lg p-1 ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value;
        return (
          <button
            key={option.value}
            onClick={() => handleClick(option.value)}
            className={`
              flex items-center gap-1.5 font-medium rounded-md transition-all
              ${sizeStyles[size]}
              ${isActive 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-600 hover:text-slate-900'
              }
            `}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
};

export default ToggleGroup;
