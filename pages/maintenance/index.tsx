import { useState, useCallback, useMemo } from 'react';
import {
  Wrench, Plus, AlertTriangle, CheckCircle, Clock, Download,
  ChevronLeft, ChevronRight, List, Grid, Search,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import { InlineAlert } from '../../components/ui/Alert';
import { Pagination, SortSelect, type SortOption } from '../../components/ui/Pagination';
import * as api from '../../services/apiService';
import type { MaintenanceTask, Vehicle } from '../../services/apiService';
import { notify } from '../../services/notifications';
import MaintenanceTaskFormModal from '../../components/MaintenanceTaskFormModal';
import { useConfirmDialog } from '../../components/ui/ConfirmDialog';
import MaintenanceTaskDetailModal from '../../components/MaintenanceTaskDetailModal';
import toast from 'react-hot-toast';
import { downloadCSV } from '../../lib/csvExport';
import { localDateOnly } from '../../lib/dateOnly';
import { useRecordQuery } from '../../hooks/useRecordQuery';
import { useDataFetch } from '../../hooks/useDataFetch';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole';
import { canManageMaintenance } from '../../lib/permissions';

const SORT_OPTIONS: SortOption[] = [
  { value: '', label: 'Due date (soonest)' },
  { value: 'dueDate', label: 'Due date (latest)', order: 'desc' },
  { value: 'vehicle', label: 'Vehicle (A–Z)', order: 'asc' },
  { value: 'title', label: 'Task (A–Z)', order: 'asc' },
  { value: 'createdAt', label: 'Recently added', order: 'desc' },
];
const FILTERS = ['all', 'overdue', 'upcoming', 'completed'] as const;
const pad = (value: number) => String(value).padStart(2, '0');

export default function MaintenancePage() {
  const parseDateOnly = (value: string) => new Date(`${value.split('T')[0]}T12:00:00`);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { openConfirm } = useConfirmDialog();
  const { role, loading: roleLoading } = useWorkspaceRole();
  const canManage = role !== null && canManageMaintenance(role);

  // Overdue/upcoming and the stat cards are relative to the viewer's calendar day.
  const todayKey = localDateOnly();
  const list = usePaginatedList<MaintenanceTask, api.MaintenanceSummary>({
    fetchPage: (params, signal) => api.getMaintenancePage({ ...params, summary: 1 }, signal),
    filterKeys: ['state'],
    sortKeys: ['dueDate', 'vehicle', 'title', 'createdAt'],
    extraParams: { today: todayKey },
  });
  const { rows: filteredTasks, summary, filters, setFilter, isFiltered } = list;
  const filter = (filters.state || 'all') as typeof FILTERS[number];

  // The calendar shows every task due in the visible month (unfiltered, as before).
  const monthStart = `${currentMonth.getFullYear()}-${pad(currentMonth.getMonth() + 1)}-01`;
  const monthEnd = `${currentMonth.getFullYear()}-${pad(currentMonth.getMonth() + 1)}-${pad(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate())}`;
  const calendar = useDataFetch<MaintenanceTask[]>(
    () => viewMode === 'calendar' ? api.getMaintenanceTasksDue(monthStart, monthEnd) : Promise.resolve([]),
    [],
    [viewMode, monthStart, monthEnd]
  );
  const tasks = calendar.data;
  const isLoading = list.loading || (viewMode === 'calendar' && calendar.loading);
  const fetchError = list.error ?? (viewMode === 'calendar' ? calendar.error : null);

  // Vehicles only feed the form picker; technicians may not list vehicles but must still see their work.
  const { data: vehicles, refetch: loadVehicles } = useDataFetch<Vehicle[]>(
    () => canManage ? api.getVehicles().catch(() => [] as Vehicle[]) : Promise.resolve([]),
    [],
    [canManage]
  );

  const { refetch: loadList } = list;
  const { refetch: loadCalendar } = calendar;
  const loadData = useCallback(async () => {
    await Promise.all([loadList(), loadCalendar(), loadVehicles()]);
  }, [loadList, loadCalendar, loadVehicles]);

  const today = new Date();

  const stats = [
    { title: 'Total Tasks', value: summary?.total ?? 0, icon: <Wrench className="h-6 w-6 text-blue-600" />, iconBgColor: 'bg-blue-50' },
    { title: 'Overdue', value: summary?.overdue ?? 0, icon: <AlertTriangle className="h-6 w-6 text-red-600" />, iconBgColor: 'bg-red-50' },
    { title: 'Due This Week', value: summary?.dueThisWeek ?? 0, icon: <Clock className="h-6 w-6 text-amber-600" />, iconBgColor: 'bg-amber-50' },
    { title: 'Completed', value: summary?.completed ?? 0, icon: <CheckCircle className="h-6 w-6 text-emerald-600" />, iconBgColor: 'bg-emerald-50' },
  ];

  const getPriorityBadge = (priority: string) => {
    if (priority === 'high') return <Badge variant="danger">High</Badge>;
    if (priority === 'medium') return <Badge variant="warning">Medium</Badge>;
    return <Badge variant="default">Low</Badge>;
  };

  const handleMarkComplete = (task: MaintenanceTask) => {
    void openConfirm({
      title: 'Mark as Complete',
      message: `Mark "${task.type}" for ${task.vehicle} as completed?`,
      variant: 'info',
      onConfirm: async () => {
        try {
          await api.updateMaintenanceTask(task.id, { completed: true, completedDate: localDateOnly() });
          notify.success('Maintenance task completed');
          await loadData();
        } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Failed to complete task'); throw err; }
      },
    });
  };

  const loadedTasks = useMemo(() => [...filteredTasks, ...tasks], [filteredTasks, tasks]);
  useRecordQuery({
    records: loadedTasks,
    // Wait for the workspace role too: edit links open the editor only for managers.
    loading: isLoading || roleLoading,
    resource: 'maintenance',
    onMatch: (task) => { setSelectedTask(task); setIsDetailOpen(true); },
    onUnavailable: () => toast.error('This record is unavailable or you no longer have access.'),
  });

  
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const getTasksForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return tasks.filter((t) => t.dueDate === dateStr);
  };

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Maintenance' }]}>
      <PageHeader
        title="Maintenance Calendar"
        subtitle="Schedule and track vehicle maintenance tasks"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex border border-slate-200 rounded-lg overflow-hidden">
              <button onClick={() => setViewMode('calendar')} className={`px-3 py-1.5 text-sm flex items-center gap-1.5 ${ viewMode === 'calendar' ? 'bg-blue-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50' }`}><Grid className="h-4 w-4" />Calendar</button>
              <button onClick={() => setViewMode('list')} className={`px-3 py-1.5 text-sm flex items-center gap-1.5 border-l border-slate-200 ${ viewMode === 'list' ? 'bg-blue-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50' }`}><List className="h-4 w-4" />List</button>
            </div>
            <Button variant="outline" size="sm" iconLeft={<Download className="h-4 w-4" />} onClick={() => {
              api.getAllMatching<MaintenanceTask>('/api/maintenance', { ...list.queryParams, today: todayKey }).then((rows) => downloadCSV('maintenance-tasks', rows.map(t => ({
                Vehicle: t.vehicle,
                Type: t.type,
                'Due Date': t.dueDate,
                Priority: t.priority,
                Completed: t.completed ? 'Yes' : 'No',
                'Cost Estimate': t.costEstimate || '',
                Notes: t.notes || '',
              })))).catch((err: unknown) => toast.error(err instanceof Error ? err.message : 'Failed to export maintenance tasks'));
            }}>Export CSV</Button>
            {canManage && <Button variant="primary" size="sm" iconLeft={<Plus className="h-4 w-4" />} onClick={() => setIsFormOpen(true)}>Add Task</Button>}
          </div>
        }
      />

      {/* Stats */}
      <div className="mb-6">
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x sm:hidden">
          {stats.map((stat) => (
            <div key={stat.title} className="min-w-[160px] snap-start">
              <StatCard {...stat} />
            </div>
          ))}
        </div>
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => <StatCard key={stat.title} {...stat} />)}
        </div>
      </div>

      {fetchError && (
        <InlineAlert
          type="error"
          title="Couldn’t load maintenance tasks"
          className="mb-4"
          actionLabel="Try again"
          onAction={() => void loadData()}
        >
          {fetchError}
        </InlineAlert>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-2 -mx-4 px-4">
        {FILTERS.map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter('state', f)}
            className={`min-h-11 px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f ? 'bg-blue-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>
            {f === 'all' ? 'All Tasks' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* View Mode Toggle */}
      {viewMode === 'list' ? (
        // LIST VIEW
        <Card>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="search" aria-label="Search maintenance tasks" placeholder="Search by task or vehicle..." value={list.searchInput} onChange={(e) => list.setSearchInput(e.target.value)}
                className="w-full min-h-11 pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900" />
            </div>
            <SortSelect id="maintenance-sort" options={SORT_OPTIONS} sort={list.sort} order={list.order} onChange={list.setSort} />
          </div>
          {list.loading && filteredTasks.length === 0 ? <SkeletonTable rows={5} columns={5} /> : filteredTasks.length === 0 ? (
            <EmptyState type={isFiltered ? 'search' : 'data'} title="No tasks" description={isFiltered ? 'No maintenance tasks match your search or filter' : 'No maintenance tasks yet'} />
          ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-slate-100">
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Vehicle</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Task</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Due Date</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Priority</th>
                  <th className="text-left py-3 px-4 text-slate-500 font-medium">Status</th>
                  <th className="py-3 px-4"></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTasks.map(task => {
                    const isOverdueTask = parseDateOnly(task.dueDate) < today && !task.completed;
                    return (
                      <tr key={task.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}>
                        <td className="py-3 px-4 font-medium text-slate-900">{task.vehicle}</td>
                        <td className="py-3 px-4 text-slate-700">{task.type}</td>
                        <td className={`py-3 px-4 ${ isOverdueTask ? 'text-red-600 font-medium' : 'text-slate-600' }`}>
                          {parseDateOnly(task.dueDate).toLocaleDateString()}
                          {isOverdueTask && <span className="ml-1 text-xs">(Overdue)</span>}
                        </td>
                        <td className="py-3 px-4">{getPriorityBadge(task.priority)}</td>
                        <td className="py-3 px-4">
                          {task.completed
                            ? <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">Done</span>
                            : <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">Pending</span>}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1 justify-end">
                            <button onClick={(e) => { e.stopPropagation(); setSelectedTask(task); setIsDetailOpen(true); }} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg">{canManage ? 'Edit' : 'View'}</button>
                            {canManage && !task.completed && (
                              <button onClick={(e) => { e.stopPropagation(); handleMarkComplete(task); }} className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg">Complete</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="pt-4 mt-2 border-t border-slate-100">
              <Pagination
                label="tasks"
                page={list.page}
                pageSize={list.pageSize}
                total={list.total}
                onPageChange={list.setPage}
                onPageSizeChange={list.setPageSize}
                disabled={list.loading}
              />
            </div>
            </>
          )}
        </Card>
      ) : (
        // CALENDAR VIEW
        <Card>
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-semibold text-slate-900">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</h3>
            <div className="flex gap-2">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronLeft className="h-5 w-5 text-slate-600" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Today</button>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronRight className="h-5 w-5 text-slate-600" />
              </button>
            </div>
          </div>

          {calendar.loading ? <SkeletonTable rows={5} columns={7} /> : (
            <div className="max-w-full overflow-x-auto">
            <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden min-w-[640px]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="bg-slate-50 p-2 text-center text-xs font-semibold text-slate-500 uppercase">{day}</div>
              ))}
              {blanks.map((b) => <div key={`blank-${b}`} className="bg-white min-h-[100px]" />)}
              {days.map((day) => {
                const dayTasks = getTasksForDay(day);
                const isToday = day === today.getDate() && currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();
                return (
                  <div key={day} className={`bg-white p-2 min-h-[100px] ${isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}`}>
                    <div className={`text-sm font-medium mb-2 ${isToday ? 'text-blue-600' : 'text-slate-900'}`}>{day}</div>
                    <div className="space-y-1">
                      {dayTasks.slice(0, 3).map((task) => {
                        const isOverdue = parseDateOnly(task.dueDate) < today;
                        return (
                          <div key={task.id} onClick={() => { setSelectedTask(task); setIsDetailOpen(true); }}
                            className={`text-xs p-1.5 rounded cursor-pointer transition-colors ${
                              task.completed ? 'bg-emerald-50 text-emerald-700 line-through opacity-60' : isOverdue ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                            }`}>
                            <div className="font-medium truncate">{task.vehicle}</div>
                            <div className="truncate opacity-80">{task.type}</div>
                          </div>
                        );
                      })}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-slate-500 text-center py-1">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          )}
        </Card>
      )}

      <MaintenanceTaskDetailModal
        isOpen={isDetailOpen}
        task={selectedTask}
        onClose={() => { setIsDetailOpen(false); setSelectedTask(null); }}
        onUpdated={async () => { await loadData(); setIsDetailOpen(false); setSelectedTask(null); }}
        onComplete={async (task) => { await handleMarkComplete(task); setIsDetailOpen(false); setSelectedTask(null); }}
        canManage={canManage}
      />

      {canManage && isFormOpen && (
        <MaintenanceTaskFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={async () => { await loadData(); setIsFormOpen(false); }}
          vehicles={vehicles}
        />
      )}
    </DashboardLayout>
  );
}
