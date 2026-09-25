import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  X,
  Truck,
  MapPin,
  Battery,
  Calendar,
  Wrench,
  Navigation,
  Mail,
  FileText,
  Loader2,
  CheckCircle,
  Clock,
} from 'lucide-react'

interface Vehicle {
  id: string
  name: string
  status: 'active' | 'inactive' | 'delayed'
  driver: string
  location: string
  eta: string
  mileage: number
  maintenanceDue: boolean
}

interface MaintenanceTask {
  id: string
  title: string
  type: string
  dueDate: string
  priority: string
  completed: boolean
  completedDate: string | null
  costEstimate: number | null
  serviceProvider: string | null
}

interface DriverUser {
  name: string | null
  email: string
  image: string | null
}

interface VehicleDetailModalProps {
  isOpen: boolean
  onClose: () => void
  vehicle: Vehicle | null
  onEdit?: () => void
  onDelete?: () => void
}

export default function VehicleDetailModal({ isOpen, onClose, vehicle, onEdit, onDelete }: VehicleDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [maintenanceTasks, setMaintenanceTasks] = useState<MaintenanceTask[]>([])
  const [driverUser, setDriverUser] = useState<DriverUser | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)

  useEffect(() => {
    if (!isOpen || !vehicle?.id) return
    setLoadingDetails(true)
    fetch(`/api/vehicles/${vehicle.id}/details`)
      .then(async (r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setMaintenanceTasks(data.maintenanceTasks ?? [])
        setDriverUser(data.driverUser ?? null)
      })
      .catch(() => {})
      .finally(() => setLoadingDetails(false))
  }, [isOpen, vehicle?.id])

  const handleNavigate = () => {
    if (!vehicle) return
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(vehicle.location)}`
    window.open(mapsUrl, '_blank')
  }

  if (!isOpen || !vehicle) return null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'driver', label: 'Driver Info' },
    { id: 'history', label: 'History' },
  ]

  const priorityColor = (p: string) =>
    p === 'high'
      ? 'bg-red-100 text-red-800'
      : p === 'medium'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-blue-100 text-blue-800'

  const driverInitials = vehicle.driver
    ? vehicle.driver
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={onClose} />
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="absolute top-0 right-0 pt-4 pr-4">
              <button
                onClick={onClose}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Header */}
            <div className="flex items-start space-x-4">
              <div
                className={`p-3 rounded-lg ${
                  vehicle.status === 'active'
                    ? 'bg-green-100 text-green-600'
                    : vehicle.status === 'delayed'
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                <Truck className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">{vehicle.name}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {vehicle.driver} •{' '}
                  {vehicle.status === 'active' ? 'On Route' : vehicle.status === 'delayed' ? 'Delayed' : 'Inactive'}
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  vehicle.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : vehicle.status === 'delayed'
                      ? 'bg-orange-100 text-orange-800'
                      : 'bg-gray-100 text-gray-800'
                }`}
              >
                {vehicle.status}
              </span>
            </div>

            {/* Tabs */}
            <div className="mt-6 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab content */}
            <div className="mt-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Current Location</h4>
                          <p className="mt-1 text-sm text-gray-600">{vehicle.location || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">ETA to Destination</h4>
                          <p className="mt-1 text-sm text-gray-600">{vehicle.eta || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Battery className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-900">Vehicle Mileage</h4>
                        <p className="mt-1 text-sm text-blue-700">
                          {(vehicle.mileage ?? 0).toLocaleString()} mi • Next service at{' '}
                          {((Math.floor((vehicle.mileage ?? 0) / 5000) + 1) * 5000).toLocaleString()} mi
                        </p>
                        <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${(((vehicle.mileage ?? 0) % 5000) / 5000) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-1 gap-3">
                      <button
                        onClick={handleNavigate}
                        className="p-3 border border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition flex flex-col items-center justify-center"
                      >
                        <Navigation className="h-5 w-5 text-primary-600 mb-2" />
                        <span className="text-sm font-medium text-gray-900">Navigate To</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="space-y-4">
                  <div
                    className={`border rounded-lg p-4 ${
                      vehicle.maintenanceDue ? 'bg-yellow-50 border-yellow-200' : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Wrench className={`h-5 w-5 ${vehicle.maintenanceDue ? 'text-yellow-600' : 'text-green-600'}`} />
                      <div>
                        <h4
                          className={`text-sm font-medium ${vehicle.maintenanceDue ? 'text-yellow-900' : 'text-green-900'}`}
                        >
                          {vehicle.maintenanceDue ? 'Maintenance Required' : 'Maintenance Up to Date'}
                        </h4>
                        <p className={`mt-1 text-sm ${vehicle.maintenanceDue ? 'text-yellow-700' : 'text-green-700'}`}>
                          {vehicle.maintenanceDue
                            ? 'This vehicle requires immediate attention'
                            : 'All maintenance items are current'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {loadingDetails ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                    </div>
                  ) : maintenanceTasks.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Wrench className="h-10 w-10 mx-auto text-gray-300 mb-2" />
                      <p className="text-sm">No maintenance tasks for this vehicle</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-gray-900">
                        Maintenance Tasks ({maintenanceTasks.length})
                      </h4>
                      {maintenanceTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            {task.completed ? (
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                            )}
                            <div>
                              <h5
                                className={`font-medium text-gray-900 ${task.completed ? 'line-through text-gray-400' : ''}`}
                              >
                                {task.title}
                              </h5>
                              <p className="text-xs text-gray-500">
                                {task.completed
                                  ? `Completed ${task.completedDate ? new Date(task.completedDate).toLocaleDateString() : ''}`
                                  : `Due ${new Date(task.dueDate).toLocaleDateString()}`}
                                {task.serviceProvider && ` • ${task.serviceProvider}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {task.costEstimate && (
                              <span className="text-xs text-gray-500">${task.costEstimate.toFixed(0)}</span>
                            )}
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                task.completed ? 'bg-green-100 text-green-800' : priorityColor(task.priority)
                              }`}
                            >
                              {task.completed ? 'done' : task.priority}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'driver' && (
                <div className="space-y-6">
                  {loadingDetails ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                    </div>
                  ) : (
                    <>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center space-x-4">
                          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                            {driverUser?.image ? (
                              <Image
                                unoptimized
                                src={driverUser.image}
                                alt={vehicle.driver}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-primary-600 font-bold text-lg">{driverInitials}</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{driverUser?.name ?? vehicle.driver}</h4>
                            <p className="text-sm text-gray-600">
                              {driverUser ? 'Fleet Member' : 'Driver (not linked to account)'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {driverUser?.email && (
                          <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <Mail className="h-5 w-5 text-gray-400" />
                              <span className="text-sm font-medium text-gray-700">Email:</span>
                            </div>
                            <a href={`mailto:${driverUser.email}`} className="text-sm text-primary-600 hover:underline">
                              {driverUser.email}
                            </a>
                          </div>
                        )}
                        {!driverUser && (
                          <div className="text-center py-4 text-gray-500">
                            <p className="text-sm">
                              Driver <strong>{vehicle.driver}</strong> is not linked to a FleetFlow account.
                            </p>
                            <p className="text-xs mt-1">Invite them via Team Settings to see contact info here.</p>
                          </div>
                        )}
                      </div>

                      {driverUser?.email && (
                        <div className="grid grid-cols-1 gap-3">
                          <a
                            href={`mailto:${driverUser.email}`}
                            className="p-3 border border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition flex flex-col items-center justify-center"
                          >
                            <Mail className="h-5 w-5 text-primary-600 mb-2" />
                            <span className="text-sm font-medium text-gray-900">Email</span>
                          </a>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-sm">Trip history coming in a future update</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm transition"
            >
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition"
              >
                Edit Vehicle
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition"
              >
                Delete Vehicle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
