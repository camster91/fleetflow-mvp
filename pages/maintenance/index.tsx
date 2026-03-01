import { useState, useEffect } from 'react';
import {
  Wrench,
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Truck,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card, StatCard } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SkeletonTable } from '../../components/ui/Skeleton';
import * as dataService from '../../services/dataService';
import { notify } from '../../services/notifications';
import MaintenanceTaskFormModal from '../../components/MaintenanceTaskFormModal';
import ConfirmModal from '../../components/ConfirmModal';

export default function MaintenancePage() {
  const [tasks, setTasks] = useState<dataService.MaintenanceTask[]>([]);
  const [vehicles, setVehicles] = useState<dataService.Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'overdue' | 'completed'>('all');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger' as const,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setTasks(dataService.getMaintenanceTasks());
    setVehicles(dataService.getVehicles());
    setIsLoading(false);
  };

  const today = new Date();
  const filteredTasks = tasks.filter(task => {
    const dueDate = new Date(task.dueDate);
    const isOverdue = dueDate < today && !task.completed;
    const isUpcoming = dueDate >= today && !task.completed && dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    switch (filter) {
      case 'overdue':
        return isOverdue;
      case 'upcoming':
        return isUpcoming;
      case 'completed':
        return task.completed;
      default:
        return true;
    }
  });

  const stats = [
    {
      title: 'Total Tasks',
      value: tasks.length,
      icon: <Wrench className="h-6 w-6 text-blue-600" />,
      iconBgColor: 'bg-blue-50',
    },
    {
      title: 'Overdue',
      value: tasks.filter(t => new Date(t.dueDate) < today && !t.completed).length,
      icon: <AlertTriangle className="h-6 w-6 text-red-600" />,
      iconBgColor: 'bg-red-50',
    },
    {
      title: 'Due This Week',
      value: tasks.filter(t => {
        const dueDate = new Date(t.dueDate);
        return dueDate >= today && 
               dueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) &&
               !t.completed;
      }).length,
      icon: <Clock className="h-6 w-6 text-amber-600" />,
      iconBgColor: 'bg-amber-50',
    },
    {
      title: 'Completed',
      value: tasks.filter(t => t.completed).length,
      icon: <CheckCircle className="h-6 w-6 text-emerald-600" />,
      iconBgColor: 'bg-emerald-50',
    },
  ];

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="danger">High</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      case 'low':
        return <Badge variant="default">Low</Badge>;
      default:
        return <Badge>{priority}</Badge>;
    }
  };

  const handleMarkComplete = (task: dataService.MaintenanceTask) => {
    setConfirmModal({
      isOpen: true,
      title: 'Mark as Complete',
      message: `Mark "${task.type}" for ${task.vehicle} as completed?`,
      variant: 'info',
      onConfirm: () => {
        dataService.updateMaintenanceTask(task.id, { 
          completed: true, 
          completedDate: new Date().toISOString() 
        });
        loadData();
        notify.success('Maintenance task marked as completed');
      },
    });
  };

  // Calendar generation
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  const getTasksForDay = (day: number) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.dueDate === dateStr && !t.completed);
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Maintenance' },
      ]}
    >
      <PageHeader
        title="Maintenance Calendar"
        subtitle="Schedule and track vehicle maintenance tasks"
        actions={
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              iconLeft={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-4 w-4" />}
              onClick={() => setIsFormOpen(true)}
            >
              Schedule Task
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'upcoming', 'overdue', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${filter === f
                ? 'bg-blue-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }
            `}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900">
              {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
            </h3>
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
                {day}
              </div>
            ))}
            {blanks.map((_, i) => (
              <div key={`blank-${i}`} className="aspect-square" />
            ))}
            {days.map(day => {
              const dayTasks = getTasksForDay(day);
              const isToday = day === today.getDate() && 
                             currentMonth.getMonth() === today.getMonth() &&
                             currentMonth.getFullYear() === today.getFullYear();
              
              return (
                <div
                  key={day}
                  className={`
                    aspect-square p-2 border border-slate-100 rounded-lg
                    ${isToday ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}
                  `}
                >
                  <span className={`text-sm font-medium ${isToday ? 'text-blue-900' : 'text-slate-700'}`}>
                    {day}
                  </span>
                  {dayTasks.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {dayTasks.slice(0, 2).map((task, i) => (
                        <div
                          key={i}
                          className={`
                            text-xs px-1.5 py-0.5 rounded truncate
                            ${task.priority === 'high' ? 'bg-red-100 text-red-800' :
                              task.priority === 'medium' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'}
                          `}
                        >
                          {task.vehicle}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-xs text-slate-500">+{dayTasks.length - 2} more</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Upcoming Tasks List */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Upcoming Tasks</h3>
            <Badge variant="primary">{filteredTasks.filter(t => !t.completed).length}</Badge>
          </div>

          {isLoading ? (
            <SkeletonTable rows={4} columns={1} />
          ) : filteredTasks.filter(t => !t.completed).length === 0 ? (
            <EmptyState
              type="data"
              title="No upcoming tasks"
              description="All caught up! Schedule new maintenance tasks as needed."
              actionLabel="Schedule Task"
              onAction={() => setIsFormOpen(true)}
            />
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {filteredTasks
                .filter(t => !t.completed)
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .map((task) => {
                  const isOverdue = new Date(task.dueDate) < today;
                  return (
                    <div
                      key={task.id}
                      className={`
                        p-4 rounded-lg border transition-all
                        ${isOverdue 
                          ? 'border-red-200 bg-red-50' 
                          : 'border-slate-200 hover:border-amber-300'}
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className={`
                            p-2 rounded-lg
                            ${task.priority === 'high' ? 'bg-red-100 text-red-600' :
                              task.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-blue-100 text-blue-600'}
                          `}>
                            <Wrench className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-medium text-slate-900">{task.vehicle}</h4>
                            <p className="text-sm text-slate-500">{task.type}</p>
                            <div className="flex items-center space-x-2 mt-2">
                              {getPriorityBadge(task.priority)}
                              {isOverdue && (
                                <Badge variant="danger">Overdue</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-900">
                            {new Date(task.dueDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric' 
                            })}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="mt-2 text-emerald-600 hover:text-emerald-700"
                            onClick={() => handleMarkComplete(task)}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Complete
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>
      </div>

      {/* Maintenance Form Modal */}
      <MaintenanceTaskFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={(task) => {
          dataService.addMaintenanceTask(task);
          loadData();
          notify.success('Maintenance task scheduled successfully');
        }}
        vehicles={vehicles}
      />

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
      />
    </DashboardLayout>
  );
}
