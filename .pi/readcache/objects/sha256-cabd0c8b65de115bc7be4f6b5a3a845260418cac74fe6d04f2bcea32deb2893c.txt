import { useState, useEffect } from 'react';
import { X, Wrench, Calendar, AlertTriangle, CheckCircle, DollarSign, FileText, Save, Edit2, Clock, Share2, Copy, Link } from 'lucide-react';
import * as api from '../services/apiService';
import type { MaintenanceTask } from '../services/apiService';
import { notify } from '../services/notifications';

interface Props {
  isOpen: boolean;
  task: MaintenanceTask | null;
  onClose: () => void;
  onUpdated: (task: MaintenanceTask) => void;
  onComplete: (task: MaintenanceTask) => void;
}

export default function MaintenanceTaskDetailModal({ isOpen, task, onClose, onUpdated, onComplete }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    type: '',
    dueDate: '',
    priority: 'medium',
    notes: '',
    costEstimate: '',
    estimatedDuration: '',
    serviceProvider: '',
  });

  useEffect(() => {
    if (task) {
      setForm({
        type: task.type || '',
        dueDate: task.dueDate || '',
        priority: task.priority || 'medium',
        notes: task.notes || '',
        costEstimate: task.costEstimate != null ? String(task.costEstimate) : '',
        estimatedDuration: task.estimatedDuration || '',
        serviceProvider: task.serviceProvider || '',
      });
      setIsEditing(false);
      setShareUrl(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  const isOverdue = !task.completed && new Date(task.dueDate) < new Date();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.updateMaintenanceTask(task.id, {
        type: form.type,
        dueDate: form.dueDate,
        priority: form.priority as any,
        notes: form.notes || undefined,
        costEstimate: form.costEstimate ? parseFloat(form.costEstimate) : undefined,
        estimatedDuration: form.estimatedDuration || undefined,
        serviceProvider: form.serviceProvider || undefined,
      });
      notify.success('Task updated');
      setIsEditing(false);
      if (updated) onUpdated(updated);
    } catch { notify.error('Failed to update task'); }
    finally { setSaving(false); }
  };

  const handleShare = async () => {
    if (!task) return;
    setSharing(true);
    try {
      const r = await fetch(`/api/maintenance/${task.id}/share`, { method: 'POST' });
      if (r.ok) {
        const { url } = await r.json();
        setShareUrl(url);
      } else { notify.error('Failed to generate share link'); }
    } catch { notify.error('Failed to generate share link'); }
    finally { setSharing(false); }
  };

  const handleCopy = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const priorityBadge = (p: string) => {
    if (p === 'high') return <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">High Priority</span>;
    if (p === 'medium') return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">Medium Priority</span>;
    return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-semibold">Low Priority</span>;
  };

  const inputCls = 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl">
          {/* Header */}
          <div className={`flex items-center justify-between px-6 py-4 border-b ${
            task.completed ? 'border-emerald-100 bg-emerald-50/40' : isOverdue ? 'border-red-100 bg-red-50/40' : 'border-slate-100'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                task.completed ? 'bg-emerald-100' : isOverdue ? 'bg-red-100' : 'bg-blue-100'
              }`}>
                {task.completed
                  ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                  : isOverdue
                  ? <AlertTriangle className="h-5 w-5 text-red-600" />
                  : <Wrench className="h-5 w-5 text-blue-600" />}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{task.vehicle}</h3>
                <p className="text-sm text-slate-500">{task.completed ? 'Completed' : isOverdue ? 'Overdue' : 'Scheduled'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!task.completed && !isEditing && (
                <>
                  <button onClick={handleShare} disabled={sharing}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
                    <Share2 className="h-3.5 w-3.5" /> {sharing ? 'Generating...' : 'Share'}
                  </button>
                  <button onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition">
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                </>
              )}
              <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Task type */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Task Type</label>
              {isEditing ? (
                <input value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))} className={inputCls + ' mt-1'} />
              ) : (
                <p className="mt-1 text-slate-900 font-medium">{task.type}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Due date */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due Date
                </label>
                {isEditing ? (
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({...f, dueDate: e.target.value}))} className={inputCls + ' mt-1'} />
                ) : (
                  <p className={`mt-1 font-medium ${ isOverdue ? 'text-red-600' : 'text-slate-900' }`}>
                    {new Date(task.dueDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    {isOverdue && <span className="ml-2 text-xs text-red-500">(Overdue)</span>}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Priority</label>
                {isEditing ? (
                  <select value={form.priority} onChange={e => setForm(f => ({...f, priority: e.target.value}))} className={inputCls + ' mt-1'}>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                ) : (
                  <div className="mt-1">{priorityBadge(task.priority)}</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Cost estimate */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <DollarSign className="h-3 w-3" /> Cost Estimate
                </label>
                {isEditing ? (
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input type="number" step="0.01" value={form.costEstimate}
                      onChange={e => setForm(f => ({...f, costEstimate: e.target.value}))}
                      className={inputCls + ' pl-7'} placeholder="0.00" />
                  </div>
                ) : (
                  <p className="mt-1 text-slate-900 font-medium">
                    {task.costEstimate != null ? `$${Number(task.costEstimate).toFixed(2)}` : <span className="text-slate-400 text-sm">Not set</span>}
                  </p>
                )}
              </div>

              {/* Duration */}
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Est. Duration
                </label>
                {isEditing ? (
                  <input value={form.estimatedDuration} onChange={e => setForm(f => ({...f, estimatedDuration: e.target.value}))} className={inputCls + ' mt-1'} placeholder="e.g. 2 hours" />
                ) : (
                  <p className="mt-1 text-slate-900">
                    {task.estimatedDuration || <span className="text-slate-400 text-sm">Not set</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Service provider */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Service Provider / Mechanic</label>
              {isEditing ? (
                <input value={form.serviceProvider} onChange={e => setForm(f => ({...f, serviceProvider: e.target.value}))} className={inputCls + ' mt-1'} placeholder="Shop name or technician" />
              ) : (
                <p className="mt-1 text-slate-900">
                  {task.serviceProvider || <span className="text-slate-400 text-sm">Not assigned</span>}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <FileText className="h-3 w-3" /> Notes
              </label>
              {isEditing ? (
                <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
                  className={inputCls + ' mt-1 resize-none'} rows={3} placeholder="Add notes..." />
              ) : (
                <p className="mt-1 text-slate-700 text-sm whitespace-pre-wrap">
                  {task.notes || <span className="text-slate-400">No notes</span>}
                </p>
              )}
            </div>

            {task.completed && task.completedDate && (
              <div className="bg-emerald-50 rounded-xl p-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                <p className="text-sm text-emerald-700">Completed on {new Date(task.completedDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
              </div>
            )}

            {shareUrl && (
              <div className="bg-blue-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1">
                  <Link className="h-3 w-3" /> Mechanic Link — share this URL
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-blue-600 flex-1 truncate font-mono bg-white px-2 py-1.5 rounded-lg border border-blue-100">{shareUrl}</p>
                  <button type="button" onClick={handleCopy}
                    className="shrink-0 px-3 py-1.5 bg-blue-900 text-white text-xs rounded-lg hover:bg-blue-800 transition font-medium">
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition">
              Close
            </button>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-medium transition">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 transition">
                    <Save className="h-4 w-4" />{saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : !task.completed ? (
                <button onClick={() => onComplete(task)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition">
                  <CheckCircle className="h-4 w-4" /> Mark Complete
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
