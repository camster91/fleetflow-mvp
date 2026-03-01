import { useState } from 'react'
import { X, Send, AlertCircle, Users, Clock } from 'lucide-react'

interface AnnouncementModalProps {
  isOpen: boolean
  onClose: () => void
  onSend: (message: string, priority: 'low' | 'normal' | 'high' | 'urgent', recipients: string) => void
}

export default function AnnouncementModal({ isOpen, onClose, onSend }: AnnouncementModalProps) {
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal')
  const [recipients, setRecipients] = useState('all')
  const [isSending, setIsSending] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    
    setIsSending(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000))
    onSend(message, priority, recipients)
    setIsSending(false)
    setMessage('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={onClose} />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              onClick={onClose}
              className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div>
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <Send className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mt-3 text-center sm:mt-5">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Send Announcement
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Broadcast a message to your drivers. This will appear immediately on their mobile devices.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="recipients" className="block text-sm font-medium text-gray-700 mb-1">
                Recipients
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'all', label: 'All Drivers', icon: Users },
                  { id: 'active', label: 'Active Only', icon: Clock },
                  { id: 'specific', label: 'Specific', icon: Users },
                  { id: 'offduty', label: 'Off Duty', icon: Clock },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setRecipients(option.id)}
                    className={`p-3 border rounded-lg flex flex-col items-center transition ${
                      recipients === option.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <option.icon className="h-5 w-5 mb-1" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Priority
              </label>
              <div className="flex space-x-2">
                {([
                  { id: 'low', label: 'Low', color: 'bg-green-100 text-green-800' },
                  { id: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-800' },
                  { id: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
                  { id: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-800' },
                ] as const).map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPriority(option.id)}
                    className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition ${
                      priority === option.id
                        ? `${option.color} border-2 border-current`
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                id="message"
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Type your announcement here... For example: 'Traffic alert: Highway 1 closed due to accident. Use alternate routes.'"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                Keep messages clear and concise. Drivers will receive this while driving.
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Best Practices</h4>
                  <div className="mt-1 text-sm text-yellow-700">
                    <ul className="list-disc list-inside space-y-1">
                      <li>Keep messages under 160 characters for quick reading</li>
                      <li>Include location details when relevant</li>
                      <li>Use high priority only for urgent safety alerts</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 sm:mt-6 sm:grid sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSending || !message.trim()}
                className="mt-3 sm:mt-0 w-full px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSending ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Send className="mr-2 h-4 w-4" />
                    Send Announcement
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}