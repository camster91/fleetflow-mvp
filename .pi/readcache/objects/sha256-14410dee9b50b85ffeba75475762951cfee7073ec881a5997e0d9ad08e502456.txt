import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { 
  Users, Shield, UserCheck, UserX, Edit2, Trash2, 
  Eye, EyeOff, Search, AlertTriangle, CheckCircle, X,
  Crown, User, Truck, Wrench, FileText, DollarSign, EyeIcon
} from 'lucide-react'
import FormModal from './FormModal'
import ConfirmModal from './ConfirmModal'

interface User {
  id: string
  name: string | null
  email: string
  role: string
  company: string | null
  createdAt: string
  emailVerified: string | null
}

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrator', icon: Crown, color: 'text-purple-600 bg-purple-50' },
  { value: 'fleet_manager', label: 'Fleet Manager', icon: Shield, color: 'text-blue-600 bg-blue-50' },
  { value: 'dispatch', label: 'Dispatcher', icon: Truck, color: 'text-green-600 bg-green-50' },
  { value: 'driver', label: 'Driver', icon: User, color: 'text-orange-600 bg-orange-50' },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench, color: 'text-red-600 bg-red-50' },
  { value: 'safety_officer', label: 'Safety Officer', icon: Shield, color: 'text-yellow-600 bg-yellow-50' },
  { value: 'finance', label: 'Finance', icon: DollarSign, color: 'text-emerald-600 bg-emerald-50' },
  { value: 'viewer', label: 'Viewer', icon: EyeIcon, color: 'text-gray-600 bg-gray-50' }
]

export default function AdminUserManagement() {
  const { data: session, update: updateSession } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonatedUser, setImpersonatedUser] = useState<string | null>(null)
  
  // Check if currently impersonating on mount
  useEffect(() => {
    if (session?.impersonation?.isImpersonating) {
      setIsImpersonating(true)
      setImpersonatedUser(session.impersonation.impersonatedUserName || 'User')
    }
  }, [session])

  // Fetch users
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) throw new Error('Failed to fetch users')
      const data = await response.json()
      setUsers(data.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update role')
      }
      
      await fetchUsers()
      setIsRoleModalOpen(false)
      setSelectedUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleDeleteUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete user')
      }
      
      await fetchUsers()
      setIsDeleteModalOpen(false)
      setSelectedUser(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  const handleImpersonate = async (user: User) => {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to impersonate user')
      }
      
      const data = await response.json()
      
      // Update session with impersonation data
      await updateSession({ impersonation: data.impersonation })
      
      setIsImpersonating(true)
      setImpersonatedUser(user.name || user.email)
      
      // Reload page to apply new role/permissions
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to impersonate user')
    }
  }

  const handleStopImpersonating = async () => {
    try {
      await fetch('/api/admin/impersonate', { method: 'DELETE' })
      
      // Clear impersonation from session
      await updateSession({ impersonation: null })
      
      setIsImpersonating(false)
      setImpersonatedUser(null)
      
      // Reload page to restore original permissions
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop impersonating')
    }
  }

  const filteredUsers = users.filter(user =>
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getRoleOption = (role: string) => ROLE_OPTIONS.find(r => r.value === role) || ROLE_OPTIONS[7]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Impersonation Banner */}
      {isImpersonating && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-orange-600" />
            <div>
              <p className="font-medium text-orange-900">
                Impersonating: {impersonatedUser}
              </p>
              <p className="text-sm text-orange-700">
                You are viewing the system as this user. Some admin features may be limited.
              </p>
            </div>
          </div>
          <button
            onClick={handleStopImpersonating}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
          >
            Stop Impersonating
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
          <p className="text-gray-600">Manage user roles and permissions</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Users className="h-4 w-4" />
          <span>{users.length} total users</span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600" />
          <p className="text-red-700">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name, email, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const roleOption = getRoleOption(user.role)
              const RoleIcon = roleOption.icon
              
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-medium">
                          {user.name?.charAt(0).toUpperCase() || user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name || 'No name'}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${roleOption.color}`}>
                      <RoleIcon className="h-3.5 w-3.5" />
                      {roleOption.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{user.company || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* Impersonate button */}
                      {user.id !== session?.user?.id && user.role !== 'admin' && !isImpersonating && (
                        <button
                          onClick={() => handleImpersonate(user)}
                          className="p-2 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition"
                          title="Impersonate user"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      
                      {/* Edit role button */}
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setIsRoleModalOpen(true)
                        }}
                        className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition"
                        title="Change role"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      
                      {/* Delete button */}
                      <button
                        onClick={() => {
                          setSelectedUser(user)
                          setIsDeleteModalOpen(true)
                        }}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No users found matching "{searchTerm}"</p>
          </div>
        )}
      </div>

      {/* Role Change Modal */}
      <FormModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false)
          setSelectedUser(null)
        }}
        title={`Change Role: ${selectedUser?.name || selectedUser?.email}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Select a new role for this user. This will change their permissions immediately.
          </p>
          
          <div className="grid grid-cols-1 gap-2">
            {ROLE_OPTIONS.map((role) => {
              const RoleIcon = role.icon
              const isSelected = selectedUser?.role === role.value
              
              return (
                <button
                  key={role.value}
                  onClick={() => selectedUser && handleUpdateRole(selectedUser.id, role.value)}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition text-left ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${role.color}`}>
                    <RoleIcon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{role.label}</div>
                    <div className="text-xs text-gray-500">
                      {role.value === 'admin' && 'Full system access'}
                      {role.value === 'fleet_manager' && 'Manage vehicles and drivers'}
                      {role.value === 'dispatch' && 'Assign and track deliveries'}
                      {role.value === 'driver' && 'View assigned deliveries only'}
                      {role.value === 'maintenance' && 'Manage maintenance tasks'}
                      {role.value === 'safety_officer' && 'View SOPs and safety data'}
                      {role.value === 'finance' && 'Access reports and billing'}
                      {role.value === 'viewer' && 'Read-only access'}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle className="h-5 w-5 text-primary-600" />
                  )}
                </button>
              )
            })}
          </div>
          
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => {
                setIsRoleModalOpen(false)
                setSelectedUser(null)
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </FormModal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setSelectedUser(null)
        }}
        onConfirm={() => selectedUser && handleDeleteUser(selectedUser.id)}
        title="Delete User"
        message={`Are you sure you want to delete "${selectedUser?.name || selectedUser?.email}"? This action cannot be undone and all their data will be permanently removed.`}
        variant="danger"
        confirmText="Delete User"
      />
    </div>
  )
}
