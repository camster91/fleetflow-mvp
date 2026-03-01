import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { DashboardLayout } from '../../components/layouts/DashboardLayout';
import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { getAllRoles, getRoleDescription } from '../../lib/permissions';
import {
  Mail,
  Plus,
  X,
  Send,
  Users,
  ChevronDown,
  Check,
} from 'lucide-react';
import { notify } from '../../services/notifications';
import { TeamRole } from '../../types';

interface InviteForm {
  email: string;
  role: TeamRole;
}

export default function InvitePage() {
  const router = useRouter();
  const [invites, setInvites] = useState<InviteForm[]>([{ email: '', role: 'MEMBER' as TeamRole }]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState<number | null>(null);

  const roles = getAllRoles().filter(r => r.value !== 'OWNER');

  const addInvite = () => {
    setInvites([...invites, { email: '', role: 'MEMBER' as TeamRole }]);
  };

  const removeInvite = (index: number) => {
    setInvites(invites.filter((_, i) => i !== index));
  };

  const updateInvite = (index: number, updates: Partial<InviteForm>) => {
    setInvites(invites.map((invite, i) =>
      i === index ? { ...invite, ...updates } : invite
    ));
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async () => {
    const validInvites = invites.filter(i => validateEmail(i.email));
    
    if (validInvites.length === 0) {
      notify.error('Please enter at least one valid email address');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: 'default-team', // Would come from context
          emails: validInvites.map(i => i.email),
          role: validInvites[0].role, // For simplicity, using first role
          message,
        }),
      });

      if (response.ok) {
        notify.success(`Invitations sent to ${validInvites.length} member(s)`);
        router.push('/team');
      } else {
        const error = await response.json();
        notify.error(error.error || 'Failed to send invitations');
      }
    } catch (error) {
      notify.error('Failed to send invitations');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/' },
        { label: 'Team', href: '/team' },
        { label: 'Invite Members' },
      ]}
    >
      <PageHeader
        title="Invite Team Members"
        subtitle="Add new members to your team and assign their roles"
      />

      <div className="max-w-2xl">
        <Card>
          <div className="space-y-6">
            {/* Email Inputs */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-3">
                Email Addresses
              </label>
              <div className="space-y-3">
                {invites.map((invite, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-1 relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        type="email"
                        placeholder="colleague@company.com"
                        value={invite.email}
                        onChange={(e) => updateInvite(index, { email: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowRoleDropdown(showRoleDropdown === index ? null : index)}
                        className="h-full px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                      >
                        {roles.find(r => r.value === invite.role)?.label}
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      
                      {showRoleDropdown === index && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setShowRoleDropdown(null)}
                          />
                          <div className="absolute right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-slate-200 z-50 py-1">
                            {roles.map((role) => (
                              <button
                                key={role.value}
                                onClick={() => {
                                  updateInvite(index, { role: role.value });
                                  setShowRoleDropdown(null);
                                }}
                                className={`
                                  w-full px-4 py-2 text-left hover:bg-slate-50
                                  ${invite.role === role.value ? 'bg-blue-50' : ''}
                                `}
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${role.color.split(' ')[0].replace('bg-', 'bg-opacity-100 bg-')}`} />
                                  <span className="font-medium text-slate-900">{role.label}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 ml-4">
                                  {role.description}
                                </p>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>

                    {invites.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeInvite(index)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={addInvite}
                className="mt-3"
                iconLeft={<Plus className="h-4 w-4" />}
              >
                Add another
              </Button>
            </div>

            {/* Custom Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Personal Message (Optional)
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Hey! I'd like you to join our team on FleetFlow to help manage our fleet..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
            </div>

            {/* Role Summary */}
            <div className="bg-slate-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-slate-900 mb-3">Role Permissions</h4>
              <div className="space-y-2">
                {Array.from(new Set(invites.map(i => i.role))).map((role) => {
                  const roleInfo = roles.find(r => r.value === role);
                  return (
                    <div key={role} className="flex items-start gap-2 text-sm">
                      <Badge variant="default" size="sm">{roleInfo?.label}</Badge>
                      <span className="text-slate-600">{roleInfo?.description}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <Button
                variant="ghost"
                onClick={() => router.push('/team')}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSubmit}
                loading={isLoading}
                iconLeft={<Send className="h-4 w-4" />}
              >
                Send Invitations ({invites.filter(i => validateEmail(i.email)).length})
              </Button>
            </div>
          </div>
        </Card>

        {/* Tips */}
        <div className="mt-6 flex items-start gap-3 text-sm text-slate-500">
          <Users className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-slate-700">Tip:</p>
            <p>
              Team members will receive an email invitation. They can accept it to 
              join your team and start collaborating on fleet management.
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
