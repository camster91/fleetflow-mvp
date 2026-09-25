import { useState, useEffect, useCallback } from 'react'
import { BookOpen, Plus, Search, Edit, Trash2, FileText } from 'lucide-react'
import { DashboardLayout } from '../../components/layouts/DashboardLayout'
import { PageHeader } from '../../components/PageHeader'
import { Card, StatCard } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import { SkeletonTable } from '../../components/ui/Skeleton'
import { useConfirmDialog } from '../../components/ui/ConfirmDialog'
import SOPCategoryFormModal from '../../components/SOPCategoryFormModal'
import * as api from '../../services/apiService'
import type { SOPCategory } from '../../services/apiService'
import { notify } from '../../services/notifications'
import toast from 'react-hot-toast'
import { useWorkspaceRole } from '../../hooks/useWorkspaceRole'
import { canManageSOP } from '../../lib/permissions'

export default function SOPPage() {
  const [categories, setCategories] = useState<SOPCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<SOPCategory | null>(null)
  const { openConfirm } = useConfirmDialog()
  const { role } = useWorkspaceRole()
  const canManage = role !== null && canManageSOP(role)

  const loadData = useCallback(async () => {
    try {
      const data = await api.getSOPCategories()
      setCategories(data)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load SOPs')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filtered = categories.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDelete = (cat: SOPCategory) => {
    void openConfirm({
      title: 'Delete Category',
      variant: 'danger',
      message: `Delete "${cat.name}"? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.deleteSOPCategory(cat.id)
          notify.success(`Category "${cat.name}" deleted`)
          await loadData()
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : 'Failed to delete category')
          throw err
        }
      },
    })
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'SOPs & Procedures' }]}>
      <PageHeader
        title="SOPs & Procedures"
        subtitle="Manage standard operating procedures and document categories"
        actions={
          canManage ? (
            <Button
              variant="primary"
              size="sm"
              iconLeft={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingCategory(null)
                setIsFormOpen(true)
              }}
            >
              New Category
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Categories"
          value={categories.length}
          icon={<BookOpen className="h-6 w-6 text-blue-600" />}
          iconBgColor="bg-blue-50"
        />
        <StatCard
          title="Total Documents"
          value={categories.reduce((s, c) => s + c.count, 0)}
          icon={<FileText className="h-6 w-6 text-purple-600" />}
          iconBgColor="bg-purple-50"
        />
      </div>

      <Card className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-900"
          />
        </div>
      </Card>

      {isLoading ? (
        <SkeletonTable rows={4} columns={3} />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            type={searchQuery ? 'search' : 'data'}
            title={searchQuery ? 'No results' : 'No SOP categories yet'}
            description={
              searchQuery
                ? 'Try adjusting your search'
                : 'Create your first SOP category to start organizing procedures'
            }
            actionLabel={!searchQuery && canManage ? 'Create Category' : undefined}
            onAction={!searchQuery && canManage ? () => setIsFormOpen(true) : undefined}
          />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cat) => (
            <Card key={cat.id} hover className="flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2.5 bg-blue-50 rounded-xl">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingCategory(cat)
                        setIsFormOpen(true)
                      }}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      aria-label={`Edit ${cat.name}`}
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      aria-label={`Delete ${cat.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <h3 className="font-semibold text-slate-900 mb-1">{cat.name}</h3>
              {cat.description && <p className="text-sm text-slate-500 mb-3 flex-1">{cat.description}</p>}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100">
                <span className="text-sm text-slate-500 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {cat.count} documents
                </span>
                {cat.lastUpdated && (
                  <span className="text-xs text-slate-400">{new Date(cat.lastUpdated).toLocaleDateString()}</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {canManage && (
        <button
          onClick={() => {
            setEditingCategory(null)
            setIsFormOpen(true)
          }}
          className="fixed bottom-20 right-4 z-30 lg:hidden flex items-center justify-center w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
          aria-label="New category"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      <SOPCategoryFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingCategory(null)
        }}
        category={editingCategory ?? undefined}
        onSubmit={async (cat) => {
          notify.success(editingCategory ? `"${cat.name}" updated` : `"${cat.name}" created`)
          await loadData()
        }}
      />
    </DashboardLayout>
  )
}
