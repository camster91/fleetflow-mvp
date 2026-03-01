import React from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';
import {
  Download,
  MoreHorizontal,
  FileSpreadsheet,
  FileImage,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

type ChartType = 'line' | 'bar' | 'pie' | 'area';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  type: ChartType;
  data: any[];
  dataKey: string;
  xAxisKey?: string;
  series?: Array<{
    key: string;
    name: string;
    color: string;
  }>;
  colors?: string[];
  showLegend?: boolean;
  showGrid?: boolean;
  height?: number;
  loading?: boolean;
  dateRange?: { from: Date; to: Date; label: string };
  onDateRangeChange?: (range: { from: Date; to: Date; label: string }) => void;
  onExport?: (format: 'csv' | 'png') => void;
  className?: string;
}

const defaultColors = ['#2563eb', '#059669', '#dc2626', '#d97706', '#7c3aed', '#db2777'];

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  type,
  data,
  dataKey,
  xAxisKey = 'name',
  series,
  colors = defaultColors,
  showLegend = true,
  showGrid = true,
  height = 300,
  loading = false,
  dateRange,
  onDateRangeChange,
  onExport,
  className = '',
}) => {
  const [showExportMenu, setShowExportMenu] = React.useState(false);

  const handleExport = (format: 'csv' | 'png') => {
    onExport?.(format);
    setShowExportMenu(false);
  };

  const exportToCSV = () => {
    if (!data.length) return;
    
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).join(','));
    const csv = [headers, ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderChart = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      );
    }

    switch (type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              {showLegend && <Legend />}
              {series ? (
                series.map((s, index) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color || colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ fill: s.color || colors[index % colors.length], r: 4 }}
                  />
                ))
              ) : (
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  stroke={colors[0]}
                  strokeWidth={2}
                  dot={{ fill: colors[0], r: 4 }}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              {showLegend && <Legend />}
              {series ? (
                series.map((s, index) => (
                  <Area
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.name}
                    stroke={s.color || colors[index % colors.length]}
                    fill={s.color || colors[index % colors.length]}
                    fillOpacity={0.2}
                  />
                ))
              ) : (
                <Area
                  type="monotone"
                  dataKey={dataKey}
                  stroke={colors[0]}
                  fill={colors[0]}
                  fillOpacity={0.2}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />}
              <XAxis dataKey={xAxisKey} stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              {showLegend && <Legend />}
              {series ? (
                series.map((s, index) => (
                  <Bar
                    key={s.key}
                    dataKey={s.key}
                    name={s.name}
                    fill={s.color || colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))
              ) : (
                <Bar dataKey={dataKey} fill={colors[0]} radius={[4, 4, 0, 0]} />
              )}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={height}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey={dataKey}
                nameKey={xAxisKey}
                label
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              {showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={className}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {dateRange && onDateRangeChange && (
            <DateRangePicker
              value={dateRange}
              onChange={onDateRangeChange}
            />
          )}
          
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowExportMenu(!showExportMenu)}
              iconLeft={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            
            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                  <button
                    onClick={exportToCSV}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleExport('png')}
                    className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <FileImage className="h-4 w-4" />
                    Export PNG
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        {renderChart()}
      </div>
    </Card>
  );
};

export default ChartCard;
