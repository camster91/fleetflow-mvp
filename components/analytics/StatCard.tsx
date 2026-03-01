import React from 'react';
import { Card } from '../ui/Card';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  prefix?: string;
  suffix?: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  iconColor?: string;
  loading?: boolean;
  className?: string;
  footer?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  prefix = '',
  suffix = '',
  icon,
  iconBgColor = 'bg-blue-50',
  iconColor = 'text-blue-600',
  loading = false,
  className = '',
  footer,
}) => {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;
  const isNeutral = change === 0 || change === undefined;

  const formatChange = (val: number) => {
    const absValue = Math.abs(val);
    return `${absValue.toFixed(1)}%`;
  };

  return (
    <Card className={className}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className="mt-2 flex items-baseline gap-1">
            {loading ? (
              <div className="h-8 w-24 bg-slate-200 rounded animate-pulse" />
            ) : (
              <>
                {prefix && (
                  <span className="text-2xl font-semibold text-slate-400">{prefix}</span>
                )}
                <span className="text-3xl font-bold text-slate-900">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </span>
                {suffix && (
                  <span className="text-lg font-medium text-slate-500">{suffix}</span>
                )}
              </>
            )}
          </div>
          
          {change !== undefined && !loading && (
            <div className="mt-2 flex items-center gap-1.5">
              <span
                className={`inline-flex items-center gap-0.5 text-sm font-medium ${
                  isPositive
                    ? 'text-emerald-600'
                    : isNegative
                    ? 'text-red-600'
                    : 'text-slate-500'
                }`}
              >
                {isPositive && <TrendingUp className="h-4 w-4" />}
                {isNegative && <TrendingDown className="h-4 w-4" />}
                {isNeutral && <Minus className="h-4 w-4" />}
                {formatChange(change)}
              </span>
              <span className="text-sm text-slate-500">{changeLabel}</span>
            </div>
          )}
        </div>

        {icon && (
          <div className={`p-3 rounded-xl ${iconBgColor}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        )}
      </div>

      {footer && (
        <div className="mt-4 pt-4 border-t border-slate-100">{footer}</div>
      )}
    </Card>
  );
};

export default StatCard;
