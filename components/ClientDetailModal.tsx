import { useState, useEffect } from 'react'
import { 
  X, Building, MapPin, Phone, Mail, Globe, Calendar, 
  Star, Package, Clock, Camera, Navigation, FileText,
  Users, Shield, AlertCircle, CheckCircle, Edit
} from 'lucide-react'
import { notify, clientNotifications } from '../services/notifications'
import * as dataService from '../services/dataServiceWithSync'

interface ClientDetailModalProps {
  isOpen: boolean
  onClose: () => void
  client: dataService.Client | null
  onClientUpdated?: () => void
  initialEditing?: boolean
}

export default function ClientDetailModal({ isOpen, onClose, client, onClientUpdated, initialEditing = false }: ClientDetailModalProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(initialEditing)
  const [editedClient, setEditedClient] = useState<Partial<dataService.Client> | null>(null)

  // Reset editing state when client changes
  useEffect(() => {
    setIsEditing(initialEditing)
    setEditedClient(null)
  }, [client, initialEditing])

  const handleNavigate = () => {
    if (!client) return
    notify.info(
      `Navigating to ${client.name}\n\n` +
      `Address: ${client.address}\n` +
      `Business: ${client.businessName || 'N/A'}\n\n` +
      'In production, this would open Google Maps with navigation to the client location.',
      { duration: 5000 }
    )
  }

  const handleCallContact = () => {
    if (!client) return
    const contactName = client.contactPerson?.name || 'contact person'
    notify.info(
      `Calling ${contactName} at ${client.name}\n\n` +
      `Phone: ${client.contactPerson?.phone || client.phone || 'N/A'}\n\n` +
      'In production, this would dial the contact number and log the call.',
      { duration: 5000 }
    )
  }

  const handleAddLocationPhoto = () => {
    if (!client) return
    notify.info(
      `Add Location Photo for ${client.name}\n\n` +
      'In production, this would:\n' +
      '• Open camera or file picker\n' +
      '• Capture GPS coordinates\n' +
      '• Upload to cloud storage\n' +
      '• Add to client photo gallery',
      { duration: 5000 }
    )
  }

  const handleAddLocationPin = () => {
    if (!client) return
    notify.info(
      `Add Location Pin for ${client.name}\n\n` +
      'In production, this would:\n' +
      '• Open interactive map\n' +
      '• Allow precise pin placement\n' +
      '• Save GPS coordinates\n' +
      '• Add notes for drivers',
      { duration: 5000 }
    )
  }

  const handleSaveEdit = () => {
    if (!client || !editedClient) return
    
    try {
      const updated = dataService.updateClient(client.id, editedClient)
      if (updated) {
        clientNotifications.updated(updated.name)
        setIsEditing(false)
        setEditedClient(null)
        onClientUpdated?.()
      }
    } catch (error) {
      clientNotifications.error('update', error instanceof Error ? error.message : undefined)
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedClient(null)
  }

  const handleEditField = (field: keyof dataService.Client, value: any) => {
    if (!client) return
    setEditedClient(prev => ({
      ...prev,
      [field]: value
    }))
  }

  if (!isOpen || !client) return null

  const currentClient = isEditing && editedClient ? { ...client, ...editedClient } : client

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'location', label: 'Location' },
    { id: 'delivery', label: 'Delivery Info' },
    { id: 'history', label: 'History' },
  ]

  const getClientTypeColor = (type: dataService.Client['type']) => {
    switch (type) {
      case 'restaurant': return 'bg-blue-100 text-blue-800'
      case 'hotel': return 'bg-purple-100 text-purple-800'
      case 'office': return 'bg-green-100 text-green-800'
      case 'retail': return 'bg-yellow-100 text-yellow-800'
      case 'warehouse': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getFrequencyColor = (frequency?: string) => {
    switch (frequency) {
      case 'daily': return 'bg-green-100 text-green-800'
      case 'weekly': return 'bg-blue-100 text-blue-800'
      case 'bi-weekly': return 'bg-purple-100 text-purple-800'
      case 'monthly': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose} />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Building className="h-6 w-6 text-primary-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {currentClient.name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {currentClient.businessName || 'Client Details'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-3 py-1 text-sm font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition flex items-center space-x-1"
                  >
                    <Edit className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleCancelEdit}
                      className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1 text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 rounded-lg transition"
                    >
                      Save
                    </button>
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4">
              <div className="flex space-x-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-600 border border-primary-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-4">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Client Information</h3>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Building className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Business Name</p>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedClient?.businessName ?? client.businessName ?? ''}
                              onChange={(e) => handleEditField('businessName', e.target.value)}
                              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                              placeholder="Business name"
                            />
                          ) : (
                            <p className="font-medium">{currentClient.businessName || 'Not specified'}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="h-5 w-5 flex items-center justify-center">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getClientTypeColor(currentClient.type)}`}>
                            {currentClient.type}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Client Type</p>
                          {isEditing ? (
                            <select
                              value={editedClient?.type ?? client.type}
                              onChange={(e) => handleEditField('type', e.target.value)}
                              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                            >
                              <option value="restaurant">Restaurant</option>
                              <option value="hotel">Hotel</option>
                              <option value="office">Office</option>
                              <option value="retail">Retail</option>
                              <option value="warehouse">Warehouse</option>
                              <option value="other">Other</option>
                            </select>
                          ) : (
                            <p className="font-medium">{currentClient.type}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Address</p>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedClient?.address ?? client.address}
                              onChange={(e) => handleEditField('address', e.target.value)}
                              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                              placeholder="Address"
                            />
                          ) : (
                            <p className="font-medium">{currentClient.address}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Users className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Contact Person</p>
                          {isEditing ? (
                            <input
                              type="text"
                              value={editedClient?.contactPerson?.name ?? client.contactPerson?.name ?? ''}
                              onChange={(e) => handleEditField('contactPerson', { ...client.contactPerson, name: e.target.value })}
                              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                              placeholder="Contact name"
                            />
                          ) : (
                            <p className="font-medium">{currentClient.contactPerson?.name || 'Not specified'}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Phone className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Phone</p>
                          {isEditing ? (
                            <input
                              type="tel"
                              value={editedClient?.phone ?? client.phone ?? ''}
                              onChange={(e) => handleEditField('phone', e.target.value)}
                              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                              placeholder="Phone number"
                            />
                          ) : (
                            <p className="font-medium">{currentClient.phone || 'Not specified'}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Mail className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Email</p>
                          {isEditing ? (
                            <input
                              type="email"
                              value={editedClient?.email ?? client.email ?? ''}
                              onChange={(e) => handleEditField('email', e.target.value)}
                              className="mt-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                              placeholder="Email address"
                            />
                          ) : (
                            <p className="font-medium">{currentClient.email || 'Not specified'}</p>
                          )}
                        </div>
                      </div>
                      {currentClient.website && (
                        <div className="flex items-center space-x-3">
                          <Globe className="h-5 w-5 text-gray-400" />
                          <div>
                            <p className="text-sm text-gray-600">Website</p>
                            <p className="font-medium">{currentClient.website}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Preferences */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Preferences</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div className="flex items-center space-x-3">
                        <Calendar className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Delivery Frequency</p>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getFrequencyColor(currentClient.deliveryFrequency)}`}>
                            {currentClient.deliveryFrequency || 'as-needed'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Clock className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Last Delivery</p>
                          <p className="font-medium">
                            {currentClient.lastDeliveryDate 
                              ? new Date(currentClient.lastDeliveryDate).toLocaleDateString()
                              : 'Never'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center space-x-3 mb-4">
                        <Star className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="text-sm text-gray-600">Client Rating</p>
                          <div className="flex items-center mt-1">
                            {[1,2,3,4,5].map((star) => (
                              <Star 
                                key={star} 
                                className={`h-5 w-5 ${star <= (currentClient.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
                              />
                            ))}
                            <span className="ml-2 text-sm text-gray-600">
                              ({currentClient.rating || 0}/5)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Special Requirements */}
                {currentClient.specialRequirements && currentClient.specialRequirements.length > 0 && (
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Special Requirements</h3>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <ul className="space-y-2">
                        {currentClient.specialRequirements.map((req, index) => (
                          <li key={index} className="flex items-start space-x-2">
                            <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5" />
                            <span className="text-sm text-yellow-800">{req}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Location Tab */}
            {activeTab === 'location' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Location Details */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Location Details</h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Parking Instructions</p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-900">{currentClient.parkingInstructions || 'No specific parking instructions'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Drop-off Instructions</p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-900">{currentClient.dropoffInstructions || 'No specific drop-off instructions'}</p>
                        </div>
                      </div>
                      {currentClient.accessCodes && currentClient.accessCodes.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Access Codes</p>
                          <div className="flex flex-wrap gap-2">
                            {currentClient.accessCodes.map((code, index) => (
                              <span key={index} className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm">
                                {code}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Location Actions */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Location Tools</h3>
                    <div className="space-y-4">
                      <button
                        onClick={handleNavigate}
                        className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center justify-center space-x-2"
                      >
                        <Navigation className="h-5 w-5" />
                        <span>Navigate to Location</span>
                      </button>
                      <button
                        onClick={handleAddLocationPhoto}
                        className="w-full px-4 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition flex items-center justify-center space-x-2"
                      >
                        <Camera className="h-5 w-5" />
                        <span>Add Location Photo</span>
                      </button>
                      <button
                        onClick={handleAddLocationPin}
                        className="w-full px-4 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition flex items-center justify-center space-x-2"
                      >
                        <MapPin className="h-5 w-5" />
                        <span>Add Location Pin</span>
                      </button>
                    </div>

                    {/* Location Notes */}
                    <div className="mt-6">
                      <h4 className="font-medium text-gray-900 mb-2">Location Notes</h4>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <p className="text-sm text-blue-800">
                          Location photos and pins help drivers find exact delivery spots. 
                          Photos show visual references, while pins provide precise GPS coordinates.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Delivery Info Tab */}
            {activeTab === 'delivery' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Delivery Instructions */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Instructions</h3>
                    <div className="space-y-4">
                      {currentClient.preferredDeliveryTimes && currentClient.preferredDeliveryTimes.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-600 mb-2">Preferred Delivery Times</p>
                          <div className="space-y-2">
                            {currentClient.preferredDeliveryTimes.map((time, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-gray-900">{time}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Business Hours</p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-900">{currentClient.businessHours || 'Not specified'}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600 mb-2">Security Notes</p>
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-900">{currentClient.securityNotes || 'No security notes'}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Client Notes</h3>
                    <div className="bg-gray-50 p-4 rounded-lg h-full">
                      {isEditing ? (
                        <textarea
                          value={editedClient?.notes ?? client.notes ?? ''}
                          onChange={(e) => handleEditField('notes', e.target.value)}
                          className="w-full h-40 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                          placeholder="Add notes about this client..."
                        />
                      ) : (
                        <p className="text-gray-900">{currentClient.notes || 'No notes available'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={handleCallContact}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center space-x-2"
                    >
                      <Phone className="h-4 w-4" />
                      <span>Call Contact</span>
                    </button>
                    <button
                      onClick={() => notify.info('Scheduling delivery...')}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center space-x-2"
                    >
                      <Calendar className="h-4 w-4" />
                      <span>Schedule Delivery</span>
                    </button>
                    <button
                      onClick={() => notify.info('Generating delivery report...')}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center space-x-2"
                    >
                      <FileText className="h-4 w-4" />
                      <span>Delivery Report</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="space-y-6">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="text-center">
                    <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Delivery History</h3>
                    <p className="text-gray-600 mb-4">
                      Delivery history integration coming soon. This will show all past deliveries to this client.
                    </p>
                    <button
                      onClick={() => notify.info('Opening delivery history...')}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition"
                    >
                      View Full History
                    </button>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white border rounded-lg p-4">
                    <p className="text-sm text-gray-600">Total Deliveries</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">24</p>
                  </div>
                  <div className="bg-white border rounded-lg p-4">
                    <p className="text-sm text-gray-600">On-time Rate</p>
                    <p className="text-2xl font-bold text-green-600 mt-1">92%</p>
                  </div>
                  <div className="bg-white border rounded-lg p-4">
                    <p className="text-sm text-gray-600">Avg. Items</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">18</p>
                  </div>
                  <div className="bg-white border rounded-lg p-4">
                    <p className="text-sm text-gray-600">Last 30 Days</p>
                    <p className="text-2xl font-bold text-purple-600 mt-1">12</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 border-t">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <p>Client ID: {client.id} • Created: {new Date(client.created).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}