import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { RoleBadge } from '../../components/team/RoleBadge';
import { TeamRole, InvitationStatus } from '../../types';
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  UserCheck,
  UserX,
  RefreshCw,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { notify } from '../../services/notifications';
import { canManageTeam } from '../../lib/permissions';

interface TeamMember {
  id: string;
  role: TeamRole;
  status: InvitationStatus;
  invitedAt: string;
  joinedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
  invitedByUser: {
    name: string | null;
    email: string;
  } | null;
}

export default function TeamPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<InvitationStatus | 'all'>('all');

  // Mock current user's role - in real app, get from session or context
  const currentUserRole: TeamRole = 'OWNER';
  const canManage = canManageTeam(currentUserRole);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      // Mock data for now
      const mockMembers: TeamMember[] = [
        {
          id: '1',
          role: 'OWNER',
          status: 'ACCEPTED',
          invitedAt: new Date().toISOString(),
          joinedAt: new Date().toISOString(),
          user: {
            id: 'u1',
            name: session?.user?.name || 'You',
            email: session?.user?.email || 'you@example.com',
            image: null,
          },
          invitedByUser: null,
        },
        {
          id: '2',
          role: 'ADMIN',
          status: 'ACCEPTED',
          invitedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          joinedAt: new Date(Date.now() - 86400000 * 29).toISOString(),
          user: {
            id: 'u2',
            name: 'Sarah Johnson',
            email: 'sarah@example.com',
            image: null,
          },
          invitedByUser: { name: 'You', email: 'you@example.com' },
        },
        {
          id: '3',
          role: 'MANAGER',
          status: 'ACCEPTED',
          invitedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
          joinedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
          user: {
            id: 'u3',
            name: 'Mike Davis',
            email: 'mike@example.com',
            image: null,
          },
          invitedByUser: { name: 'Sarah', email: 'sarah@example.com' },
        },
        {
          id: '4',
          role: 'MEMBER',
          status: 'PENDING',
          invitedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          joinedAt: null,
          user: {
            id: 'u4',
            name: null,
            email: 'pending@example.com',
            image: null,
          },
          invitedByUser: { name: 'You', email: 'you@example.com' },
        },
      ];

      setMembers(mockMembers);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      notify.error('Failed to load team members');
      setIsLoading(false);
    }
  };

  const handleChangeRole = async (memberId: string, newRole: TeamRole) => {
    try {
      // API call would go here
      setMembers(prev =>
        prev.map(m =>
          m.id === memberId ? { ...m, role: newRole } : m
        )
      );
      notify.success('Role updated successfully');
    } catch (error) {
      notify.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      // API call would go here
      setMembers(prev => prev.filter(m => m.id !== memberId));
      notify.success('Member removed successfully');
    } catch (error) {
      notify.error('Failed to remove member');
    }
  };

  const handleResendInvite = async (memberId: string) => {
    try {
      // API call would go here
      notify.success('Invitation resent');
    } catch (error) {
      notify.error('Failed to resend invitation');
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch =
      !searchQuery ||
      member.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.user?.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || member.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: members.length,
    ACCEPTED: members.filter(m => m.status === 'ACCEPTED').length,
    PENDING: members.filter(m => m.status === 'PENDING').length,
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Team' },
      ]}
    >
      <PageHeader
        title="Team Management"
        subtitle={`Manage your team members and their permissions`}
        actions={
          canManage && (
            <Button
              variant="primary"
              onClick={() => router.push('/team/invite')}
              iconLeft={<Plus className="h-4 w-4" />}
            >
              Invite Member
            </Button>
          )
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{members.length}</p>
              <p className="text-sm text-slate-500">Total Members</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 rounded-lg">
              <UserCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{statusCounts.ACCEPTED}</p>
              <p className="text-sm text-slate-500">Active</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 rounded-lg">
              <Mail className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{statusCounts.PENDING}</p>
              <p className="text-sm text-slate-500">Pending Invites</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search members..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'ACCEPTED', 'PENDING'] as const).map((status) => (
              <Button
                key={status}
                variant={filterStatus === status ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setFilterStatus(status)}
              >
                {status === 'all' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
                <span className="ml-1.5 text-xs opacity-70">({statusCounts[status]})</span>
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {/* Members List */}
      <Card>
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No members found</h3>
            <p className="text-slate-500">
              {searchQuery ? 'Try adjusting your search' : 'Invite your first team member'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                    {member.user?.name?.charAt(0) || member.user?.email.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">
                        {member.user?.name || member.user?.email}
                      </h4>
                      {member.user?.id === session?.user?.id && (
                        <Badge variant="primary" size="sm">You</Badge>
                      )}
                      {member.status === 'PENDING' && (
                        <Badge variant="warning" size="sm">Pending</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-500">
                      <span>{member.user?.email}</span>
                      {member.invitedByUser && (
                        <>
                          <span>•</span>
                          <span>Invited by {member.invitedByUser.name || member.invitedByUser.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {canManage && member.user?.id !== session?.user?.id && (
                    <div className="relative group">
                      <select
                        value={member.role}
                        onChange={(e) => handleChangeRole(member.id, e.target.value as TeamRole)}
                        disabled={member.role === 'OWNER'}
                        className="appearance-none bg-transparent pr-8 py-1 text-sm font-medium text-slate-700 cursor-pointer disabled:cursor-not-allowed"
                      >
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="MEMBER">Member</option>
                        <option value="VIEWER">Viewer</option>
                        {member.role === 'OWNER' && <option value="OWNER">Owner</option>}
                      </select>
                      <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    </div>
                  )}

                  {!canManage && <RoleBadge role={member.role} size="sm" />}

                  {canManage && member.user?.id !== session?.user?.id && (
                    <div className="flex items-center gap-1">
                      {member.status === 'PENDING' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleResendInvite(member.id)}
                          title="Resend invitation"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-red-600 hover:text-red-800"
                        title="Remove member"
                      >
                        <UserX className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardLayout>
  );
}
