import { useState } from 'react'
import { X, Send, AlertCircle, Users } from 'lucide-react'
import * as api from '../services/apiService'

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string, priority: string, recipients: string) => void
}

export default function AnnouncementModal({ isOpen, onClose, onSend }: AnnouncementModalProps) {
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [recipients, setRecipients] = useState('all')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    setIsSending(true)
    setError('')
    try {
      await api.addAnnouncement({ message: message.trim(), priority, type: 'general' })
      onSend(message, priority, recipients)
      setMessage('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send announcement')
    } finally {
      setIsSending(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-slate-900">Send Announcement</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
            <div className="flex gap-2 flex-wrap">
              {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    priority === p
                      ? p === 'urgent' ? 'bg-red-600 text-white border-red-600'
                        : p === 'high' ? 'bg-orange-500 text-white border-orange-500'
                        : p === 'normal' ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-600 text-white border-slate-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                  }`}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Recipients</label>
            <select value={recipients} onChange={(e) => setRecipients(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
              <option value="all">All Team Members</option>
              <option value="drivers">Drivers Only</option>
              <option value="managers">Managers Only</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your announcement..." rows={4} required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-900 focus:border-transparent" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={isSending || !message.trim()}
              className="flex-1 px-4 py-2 bg-blue-900 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 flex items-center justify-center gap-2">
              {isSending ? 'Sending...' : <><Send className="h-4 w-4" /> Send</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
