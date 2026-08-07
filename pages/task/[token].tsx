import { toast } from "react-hot-toast";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { Wrench, Car, Calendar, DollarSign, FileText, CheckCircle, AlertTriangle, Clock, Loader2, ExternalLink } from 'lucide-react';

function fmtDate(dateStr: string) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
  } catch { return dateStr; }
}

function priorityColor(p: string) {
  if (p === 'high') return 'bg-red-100 text-red-700 border-red-200';
  if (p === 'medium') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

interface SharedTask {
  id: string;
  vehicle: string;
  type: string;
  dueDate: string;
  priority: 'high' | 'medium' | 'low';
  notes?: string | null;
  estimatedDuration?: string | null;
  serviceProvider?: string | null;
  completed: boolean;
  completedDate?: string | null;
  actualCost?: number | null;
  costEstimate?: number | null;
}

export default function MechanicTaskPage() {
  const router = useRouter();
  const { token } = router.query;

  const [task, setTask] = useState<SharedTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ actualCost: '', completionNotes: '', markComplete: false });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/task/${token}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else { setTask(d.task); if (d.task.completed) setSubmitted(true); } })
      .catch(() => setError('Unable to load task. Please check the link.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (!form.actualCost && !form.completionNotes && !form.markComplete) {
      toast.error('Please fill in at least the cost or notes before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/task/${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualCost: form.actualCost || undefined,
          completionNotes: form.completionNotes || undefined,
          markComplete: form.markComplete,
        }),
      });
      if (r.ok) setSubmitted(true);
      else setError('Submission failed. Please try again.');
    } catch { setError('Submission failed. Please try again.'); }
    finally { setSubmitting(false); }
  };

  const inputCls = 'w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-900 focus:border-transparent outline-none transition';

  return (
    <>
      <Head>
        <title>Maintenance Task — FleetFlow</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-slate-100 px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 bg-blue-900 rounded-lg flex items-center justify-center">
            <Wrench className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">FleetFlow</p>
            <p className="text-xs text-slate-500">Maintenance Task</p>
          </div>
        </div>

        <div className="flex-1 flex items-start justify-center px-4 py-8">
          <div className="w-full max-w-md">

            {loading && (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="h-8 w-8 text-blue-900 animate-spin" />
                <p className="text-slate-500 text-sm">Loading task...</p>
              </div>
            )}

            {error && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 text-center">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="h-6 w-6 text-red-500" />
                </div>
                <h2 className="font-semibold text-slate-900 mb-2">Task Not Found</h2>
                <p className="text-slate-500 text-sm">{error}</p>
              </div>
            )}

            {!loading && !error && task && (
              <div className="space-y-4">

                {/* Task card */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className={`px-5 py-4 border-b ${
                    task.completed ? 'bg-emerald-50 border-emerald-100'
                    : new Date(task.dueDate) < new Date() ? 'bg-red-50 border-red-100'
                    : 'bg-blue-50 border-blue-100'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Car className="h-4 w-4 text-slate-500" />
                          <p className="font-semibold text-slate-900">{task.vehicle}</p>
                        </div>
                        <p className="text-lg font-bold text-slate-900">{task.type}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ priorityColor(task.priority) }`}>
                        {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                      </span>
                    </div>
                  </div>

                  <div className="px-5 py-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                      <span className="text-slate-600">Due:</span>
                      <span className={`font-medium ${ new Date(task.dueDate) < new Date() && !task.completed ? 'text-red-600' : 'text-slate-900' }`}>
                        {fmtDate(task.dueDate)}
                        {new Date(task.dueDate) < new Date() && !task.completed && (
                          <span className="ml-2 text-red-500 text-xs">(Overdue)</span>
                        )}
                      </span>
                    </div>

                    {task.estimatedDuration && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-600">Est. time:</span>
                        <span className="font-medium text-slate-900">{task.estimatedDuration}</span>
                      </div>
                    )}

                    {task.costEstimate != null && (
                      <div className="flex items-center gap-2 text-sm">
                        <DollarSign className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-slate-600">Cost estimate:</span>
                        <span className="font-medium text-slate-900">${Number(task.costEstimate).toFixed(2)}</span>
                      </div>
                    )}

                    {task.notes && (
                      <div className="pt-2 border-t border-slate-50">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Notes
                        </p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{task.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Submission area */}
                {submitted ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-emerald-100 p-6 text-center">
                    <div className="h-14 w-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-7 w-7 text-emerald-600" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-1">
                      {task.completed ? 'Task Completed' : 'Submitted!'}
                    </h3>
                    <p className="text-slate-500 text-sm">
                      {task.completed
                        ? 'This task has already been marked as complete.'
                        : 'Your report has been saved. The fleet manager will be notified.'}
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
                    <h3 className="font-semibold text-slate-900">Submit Work Report</h3>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Actual Cost ($)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">$</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={form.actualCost}
                          onChange={e => setForm(f => ({ ...f, actualCost: e.target.value }))}
                          className={inputCls + ' pl-8'}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Work Performed / Notes
                      </label>
                      <textarea
                        value={form.completionNotes}
                        onChange={e => setForm(f => ({ ...f, completionNotes: e.target.value }))}
                        className={inputCls + ' resize-none'}
                        rows={4}
                        placeholder="Describe what was done, parts replaced, any issues found..."
                      />
                    </div>

                    <label className="flex items-center gap-3 p-3.5 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                      <input
                        type="checkbox"
                        checked={form.markComplete}
                        onChange={e => setForm(f => ({ ...f, markComplete: e.target.checked }))}
                        className="h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-900">Mark task as complete</p>
                        <p className="text-xs text-slate-500">Check this when all work is finished</p>
                      </div>
                    </label>

                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-900 text-white rounded-xl font-semibold text-sm hover:bg-blue-800 disabled:opacity-60 transition"
                    >
                      {submitting
                        ? <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                        : 'Submit Report'}
                    </button>
                  </div>
                )}

                <p className="text-center text-xs text-slate-400">
                  Powered by FleetFlow &middot; This link is specific to this task
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
