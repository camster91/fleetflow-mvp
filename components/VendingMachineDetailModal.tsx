import { useState } from 'react'
import {
  X, AlertTriangle, CheckCircle, Clock, Wrench,
  MessageSquare, MapPin, Phone, User, Shield,
  ChevronDown, Plus, Check
} from 'lucide-react'
import * as dataService from '../services/dataServiceWithSync'
import { vendingMachineNotifications } from '../services/notifications'

interface Props {
  isOpen: boolean
  onClose: () => void
  machine: dataService.VendingMachine | null
  onMachineUpdated: (updated: dataService.VendingMachine) => void
}

const STATUS_CONFIG: Record<dataService.VendingMachine['status'], { label: string; color: string }> = {
  operational: { label: 'Operational', color: 'bg-green-100 text-green-800' },
  'needs-restock': { label: 'Needs Restock', color: 'bg-yellow-100 text-yellow-800' },
  'needs-maintenance': { label: 'Needs Maintenance', color: 'bg-red-100 text-red-800' },
  offline: { label: 'Offline', color: 'bg-gray-100 text-gray-800' },
}

const NOTE_CATEGORY_CONFIG: Record<dataService.VendingMachineNote['category'], { label: string; color: string; icon: typeof AlertTriangle }> = {
  restock: { label: 'Restock', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: AlertTriangle },
  maintenance: { label: 'Maintenance', color: 'bg-red-100 text-red-800 border-red-200', icon: Wrench },
  access: { label: 'Access', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Shield },
  general: { label: 'General', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: MessageSquare },
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function VendingMachineDetailModal({ isOpen, onClose, machine, onMachineUpdated }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'notes' | 'history'>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editedMachine, setEditedMachine] = useState<Partial<dataService.VendingMachine> | null>(null)

  // New note form state
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteCategory, setNoteCategory] = useState<dataService.VendingMachineNote['category']>('general')
  const [noteAuthor, setNoteAuthor] = useState('')
  const [showResolved, setShowResolved] = useState(false)

  if (!isOpen || !machine) return null

  const startEdit = () => {
    setEditedMachine({ ...machine })
    setIsEditing(true)
  }

  const cancelEdit = () => {
    setEditedMachine(null)
    setIsEditing(false)
  }

  const saveEdit = () => {
    if (!editedMachine) return
    const updated = dataService.updateVendingMachine(machine.id, editedMachine)
    if (updated) {
      vendingMachineNotifications.updated(updated.name)
      onMachineUpdated(updated)
    }
    setIsEditing(false)
    setEditedMachine(null)
  }

  const setField = <K extends keyof dataService.VendingMachine>(key: K, value: dataService.VendingMachine[K]) => {
    setEditedMachine(prev => prev ? { ...prev, [key]: value } : null)
  }

  const current = isEditing && editedMachine ? { ...machine, ...editedMachine } : machine

  const handleAddNote = () => {
    if (!noteText.trim() || !noteAuthor.trim()) return
    const updated = dataService.addVendingMachineNote(machine.id, {
      authorName: noteAuthor.trim(),
      text: noteText.trim(),
      category: noteCategory,
    })
    if (updated) {
      vendingMachineNotifications.noteAdded(machine.name)
      onMachineUpdated(updated)
      setNoteText('')
      setNoteCategory('general')
      setIsAddingNote(false)
    }
  }

  const handleResolveNote = (noteId: number) => {
    const updated = dataService.resolveVendingMachineNote(machine.id, noteId)
    if (updated) {
      vendingMachineNotifications.noteResolved()
      onMachineUpdated(updated)
    }
  }

  const handleDeleteNote = (noteId: number) => {
    const updated = dataService.deleteVendingMachineNote(machine.id, noteId)
    if (updated) {
      vendingMachineNotifications.noteDeleted()
      onMachineUpdated(updated)
    }
  }

  const visibleNotes = machine.notes.filter(n => showResolved || !n.resolved)
  const openNoteCount = machine.notes.filter(n => !n.resolved).length

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-40" onClick={onClose} />
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl">

          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-semibold text-gray-900">{current.name}</h2>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[current.status].color}`}>
                  {STATUS_CONFIG[current.status].label}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Machine ID: {current.machineId}</p>
            </div>
            <div className="flex items-center space-x-2">
              {!isEditing ? (
                <button
                  onClick={startEdit}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Edit
                </button>
              ) : (
                <>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition"
                  >
                    Save
                  </button>
                </>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6">
            {(['overview', 'notes', 'history'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition -mb-px ${
                  activeTab === tab
                    ? 'border-primary-600 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab === 'notes' ? (
                  <span className="flex items-center space-x-1.5">
                    <span>Handoff Log</span>
                    {openNoteCount > 0 && (
                      <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded-full">
                        {openNoteCount}
                      </span>
                    )}
                  </span>
                ) : (
                  tab.charAt(0).toUpperCase() + tab.slice(1)
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Machine Name</label>
                    {isEditing ? (
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={current.name}
                        onChange={e => setField('name', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm text-gray-900">{current.name}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Machine ID / Serial</label>
                    {isEditing ? (
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={current.machineId}
                        onChange={e => setField('machineId', e.target.value)}
                      />
                    ) : (
                      <p className="text-sm font-mono text-gray-900">{current.machineId}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    {isEditing ? (
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={current.type}
                        onChange={e => setField('type', e.target.value as dataService.VendingMachine['type'])}
                      >
                        {(['snacks','beverages','combo','coffee','fresh-food','other'] as const).map(t => (
                          <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-gray-900 capitalize">{current.type}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                    {isEditing ? (
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={current.status}
                        onChange={e => setField('status', e.target.value as dataService.VendingMachine['status'])}
                      >
                        {(Object.keys(STATUS_CONFIG) as dataService.VendingMachine['status'][]).map(s => (
                          <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[current.status].color}`}>
                        {STATUS_CONFIG[current.status].label}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    <MapPin className="inline h-3.5 w-3.5 mr-1" />Location
                  </label>
                  {isEditing ? (
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      value={current.location}
                      onChange={e => setField('location', e.target.value)}
                    />
                  ) : (
                    <p className="text-sm text-gray-900">{current.location}</p>
                  )}
                </div>

                {(current.locationDetail || isEditing) && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Location Detail</label>
                    {isEditing ? (
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        value={current.locationDetail || ''}
                        placeholder="e.g. Near main entrance, 2nd floor"
                        onChange={e => setField('locationDetail', e.target.value || undefined)}
                      />
                    ) : (
                      <p className="text-sm text-gray-600">{current.locationDetail}</p>
                    )}
                  </div>
                )}

                {(current.accessInstructions || current.accessCodes?.length || isEditing) && (
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-medium text-blue-900 flex items-center">
                      <Shield className="h-4 w-4 mr-1.5" />Access Information
                    </h4>
                    {(current.accessCodes?.length || isEditing) && (
                      <div>
                        <p className="text-xs text-blue-700 font-medium">Access Code(s)</p>
                        {isEditing ? (
                          <input
                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            value={current.accessCodes?.join(', ') || ''}
                            placeholder="code1, code2"
                            onChange={e => setField('accessCodes', e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined)}
                          />
                        ) : (
                          <p className="text-sm font-mono text-blue-900 mt-0.5">{current.accessCodes?.join(', ')}</p>
                        )}
                      </div>
                    )}
                    {(current.accessInstructions || isEditing) && (
                      <div>
                        <p className="text-xs text-blue-700 font-medium">Instructions</p>
                        {isEditing ? (
                          <textarea
                            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm mt-1 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            rows={2}
                            value={current.accessInstructions || ''}
                            onChange={e => setField('accessInstructions', e.target.value || undefined)}
                          />
                        ) : (
                          <p className="text-sm text-blue-900 mt-0.5">{current.accessInstructions}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {current.contactPerson && (
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      <User className="inline h-3.5 w-3.5 mr-1" />Site Contact
                    </label>
                    <div className="flex items-center space-x-3">
                      <p className="text-sm text-gray-900">{current.contactPerson.name}</p>
                      {current.contactPerson.phone && (
                        <a
                          href={`tel:${current.contactPerson.phone}`}
                          className="flex items-center text-sm text-primary-600 hover:text-primary-700"
                        >
                          <Phone className="h-3.5 w-3.5 mr-1" />
                          {current.contactPerson.phone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Handoff Notes Tab */}
            {activeTab === 'notes' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      Notes left by drivers and technicians for the next person servicing this machine.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsAddingNote(true)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Note</span>
                  </button>
                </div>

                {/* Add note form */}
                {isAddingNote && (
                  <div className="border-2 border-primary-200 rounded-xl p-4 bg-primary-50 space-y-3">
                    <h4 className="text-sm font-semibold text-primary-900">New Handoff Note</h4>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Your Name</label>
                      <input
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="Enter your name"
                        value={noteAuthor}
                        onChange={e => setNoteAuthor(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(NOTE_CATEGORY_CONFIG) as dataService.VendingMachineNote['category'][]).map(cat => {
                          const cfg = NOTE_CATEGORY_CONFIG[cat]
                          return (
                            <button
                              key={cat}
                              onClick={() => setNoteCategory(cat)}
                              className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                                noteCategory === cat ? cfg.color + ' border-current' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {cfg.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                      <textarea
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={3}
                        placeholder="Describe what the next person should know or do..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => { setIsAddingNote(false); setNoteText(''); setNoteAuthor('') }}
                        className="px-3 py-1.5 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddNote}
                        disabled={!noteText.trim() || !noteAuthor.trim()}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter toggle */}
                {machine.notes.some(n => n.resolved) && (
                  <button
                    onClick={() => setShowResolved(v => !v)}
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1"
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition ${showResolved ? 'rotate-180' : ''}`} />
                    <span>{showResolved ? 'Hide resolved' : 'Show resolved'}</span>
                  </button>
                )}

                {/* Notes list */}
                {visibleNotes.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No open notes. Add one to let the next person know what's needed.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visibleNotes.map(note => {
                      const cfg = NOTE_CATEGORY_CONFIG[note.category]
                      const Icon = cfg.icon
                      return (
                        <div
                          key={note.id}
                          className={`rounded-xl border p-4 transition ${note.resolved ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1 min-w-0">
                              <span className={`mt-0.5 flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                                <Icon className="inline h-3 w-3 mr-0.5" />
                                {cfg.label}
                              </span>
                              <div className="min-w-0">
                                <p className={`text-sm ${note.resolved ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                                  {note.text}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {note.authorName} · {formatRelativeTime(note.timestamp)}
                                  {note.resolved && ' · resolved'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 ml-3 flex-shrink-0">
                              {!note.resolved && (
                                <button
                                  onClick={() => handleResolveNote(note.id)}
                                  title="Mark as resolved"
                                  className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition"
                                >
                                  <Check className="h-4 w-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteNote(note.id)}
                                title="Delete note"
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 rounded-lg p-4 text-center">
                    <CheckCircle className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-xs text-green-700">Last Restocked</p>
                    <p className="text-sm font-semibold text-green-900 mt-0.5">
                      {current.lastRestockedDate
                        ? new Date(current.lastRestockedDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <Wrench className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-xs text-blue-700">Last Serviced</p>
                    <p className="text-sm font-semibold text-blue-900 mt-0.5">
                      {current.lastServiceDate
                        ? new Date(current.lastServiceDate).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                    <p className="text-xs text-orange-700">Next Service</p>
                    <p className="text-sm font-semibold text-orange-900 mt-0.5">
                      {current.nextServiceDue
                        ? new Date(current.nextServiceDue).toLocaleDateString()
                        : '—'}
                    </p>
                  </div>
                </div>

                <div className="border rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Resolved Notes</h4>
                  {machine.notes.filter(n => n.resolved).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No resolved notes yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {machine.notes.filter(n => n.resolved).map(note => {
                        const cfg = NOTE_CATEGORY_CONFIG[note.category]
                        return (
                          <div key={note.id} className="flex items-start space-x-2 text-sm text-gray-500">
                            <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="line-through">{note.text}</p>
                              <p className="text-xs text-gray-400">
                                {note.authorName} · {new Date(note.timestamp).toLocaleDateString()} · {cfg.label}
                              </p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="border rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Service Dates</h4>
                  {isEditing ? (
                    <div className="grid grid-cols-1 gap-3">
                      {(['lastRestockedDate', 'lastServiceDate', 'nextServiceDue'] as const).map(field => (
                        <div key={field}>
                          <label className="block text-xs text-gray-500 mb-1">
                            {field === 'lastRestockedDate' ? 'Last Restocked'
                              : field === 'lastServiceDate' ? 'Last Serviced'
                              : 'Next Service Due'}
                          </label>
                          <input
                            type="date"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            value={current[field] ? current[field]!.slice(0, 10) : ''}
                            onChange={e => setField(field, e.target.value ? new Date(e.target.value).toISOString() : undefined)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">Switch to edit mode to update service dates.</p>
                  )}
                </div>

                <p className="text-xs text-gray-400">
                  Machine added {new Date(machine.created).toLocaleDateString()} ·
                  Last updated {new Date(machine.updated).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
