import { useState } from 'react'
import { X, Truck, MapPin, Battery, Calendar, Wrench, Navigation, Phone, Mail, FileText } from 'lucide-react'
import { notify } from '../services/notifications'

interface Vehicle {
  id: number
  name: string
  status: 'active' | 'inactive' | 'delayed'
  driver: string
  location: string
  eta: string
  mileage: number
  maintenanceDue: boolean
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

  const handleNavigate = () => {
    if (!vehicle) return
    notify.info(
      `Navigating to ${vehicle.location}\n\n` +
      `Vehicle: ${vehicle.name}\n` +
      `Driver: ${vehicle.driver}\n` +
      `ETA: ${vehicle.eta}\n\n` +
      'In production, this would open Google Maps with real-time navigation to the vehicle\'s current location.',
      { duration: 5000 }
    )
  }

  const handleCallDriver = () => {
    if (!vehicle) return
    notify.info(
      `Calling ${vehicle.driver} (${vehicle.name})\n\n` +
      'Phone: +1 (555) 123-4567\n\n' +
      'In production, this would dial the driver\'s registered phone number and log the call for compliance.',
      { duration: 5000 }
    )
  }

  if (!isOpen || !vehicle) return null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'driver', label: 'Driver Info' },
    { id: 'history', label: 'History' },
  ]

  const maintenanceItems = [
    { item: 'Oil Change', due: 'Next 500 km', status: 'upcoming' },
    { item: 'Tire Rotation', due: 'Next 1,000 km', status: 'upcoming' },
    { item: 'Brake Inspection', due: 'Completed', status: 'completed' },
    { item: 'Engine Filter', due: 'Next 2,000 km', status: 'upcoming' },
  ]

  const driverInfo = {
    name: vehicle.driver,
    phone: '+1 (555) 123-4567',
    email: `${vehicle.driver.toLowerCase().replace(' ', '.')}@fleetflow.com`,
    license: 'CDL-A Valid until 2027',
    hoursThisWeek: '42/60 hours',
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity bg-black bg-opacity-50" onClick={onClose} />

        {/* Modal panel */}
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
              <div className={`p-3 rounded-lg ${vehicle.status === 'active' ? 'bg-green-100 text-green-600' : vehicle.status === 'delayed' ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                <Truck className="h-8 w-8" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  {vehicle.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {vehicle.driver} • {vehicle.status === 'active' ? 'On Route' : vehicle.status === 'delayed' ? 'Delayed' : 'Inactive'}
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                vehicle.status === 'active' ? 'bg-green-100 text-green-800' :
                vehicle.status === 'delayed' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
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

            {/* Content based on active tab */}
            <div className="mt-6">
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Location & ETA */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">Current Location</h4>
                          <p className="mt-1 text-sm text-gray-600">{vehicle.location}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                          <h4 className="text-sm font-medium text-gray-900">ETA to Destination</h4>
                          <p className="mt-1 text-sm text-gray-600">{vehicle.eta}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Mileage */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Battery className="h-5 w-5 text-blue-600" />
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-blue-900">Vehicle Mileage</h4>
                        <p className="mt-1 text-sm text-blue-700">
                          {vehicle.mileage.toLocaleString()} km • Next service at 45,000 km
                        </p>
                        <div className="mt-2 h-2 bg-blue-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${(vehicle.mileage % 45000) / 45000 * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={handleNavigate}
                        className="p-3 border border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition flex flex-col items-center justify-center"
                      >
                        <Navigation className="h-5 w-5 text-primary-600 mb-2" />
                        <span className="text-sm font-medium text-gray-900">Navigate To</span>
                      </button>
                      <button 
                        onClick={handleCallDriver}
                        className="p-3 border border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition flex flex-col items-center justify-center"
                      >
                        <Phone className="h-5 w-5 text-primary-600 mb-2" />
                        <span className="text-sm font-medium text-gray-900">Call Driver</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'maintenance' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <Wrench className="h-5 w-5 text-yellow-600" />
                      <div>
                        <h4 className="text-sm font-medium text-yellow-900">
                          {vehicle.maintenanceDue ? 'Maintenance Required' : 'Maintenance Up to Date'}
                        </h4>
                        <p className="mt-1 text-sm text-yellow-700">
                          {vehicle.maintenanceDue 
                            ? 'This vehicle requires immediate attention'
                            : 'All maintenance items are current'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-900">Upcoming Maintenance</h4>
                    {maintenanceItems.map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <h5 className="font-medium text-gray-900">{item.item}</h5>
                          <p className="text-sm text-gray-600">Due: {item.due}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>

                  <button className="w-full p-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium">
                    Schedule Maintenance
                  </button>
                </div>
              )}

              {activeTab === 'driver' && (
                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                        <span className="text-primary-600 font-bold text-lg">
                          {driverInfo.name.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{driverInfo.name}</h4>
                        <p className="text-sm text-gray-600">Commercial Driver</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {[
                      { icon: Phone, label: 'Phone', value: driverInfo.phone },
                      { icon: Mail, label: 'Email', value: driverInfo.email },
                      { icon: FileText, label: 'License', value: driverInfo.license },
                      { icon: Calendar, label: 'Hours This Week', value: driverInfo.hoursThisWeek },
                    ].map((info, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div className="flex items-center space-x-3">
                          <info.icon className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">{info.label}:</span>
                        </div>
                        <span className="text-sm text-gray-900">{info.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button className="p-3 border border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition flex flex-col items-center justify-center">
                      <Phone className="h-5 w-5 text-primary-600 mb-2" />
                      <span className="text-sm font-medium text-gray-900">Call</span>
                    </button>
                    <button className="p-3 border border-gray-300 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition flex flex-col items-center justify-center">
                      <Mail className="h-5 w-5 text-primary-600 mb-2" />
                      <span className="text-sm font-medium text-gray-900">Message</span>
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  <div className="text-center py-8 text-gray-500">
                    <Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p className="text-sm">Trip history and analytics coming soon</p>
                    <p className="text-xs mt-1">This feature is under development</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm transition"
            >
              Close
            </button>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition"
              >
                Edit Vehicle
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="mt-3 w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition"
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