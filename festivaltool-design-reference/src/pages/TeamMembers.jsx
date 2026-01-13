import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Mail, User, Trash2, Save } from "lucide-react";
import { toast } from "sonner";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

export default function TeamMembersPage() {
  const { t } = useLocalization();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null, error: null });
  const [teamMembers, setTeamMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: '',
    receive_offer_notifications: true,
    receive_project_notifications: true,
    is_active: true
  });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { isAuthorized, user, error } = await checkUserAuthorization();
        
        if (error === 'not_authenticated') {
          window.location.href = '/login';
          return;
        }
        
        if (error === 'network_error' || error === 'check_failed') {
          setAuthState({ checking: false, authorized: false, user: null, error });
          return;
        }
        
        setAuthState({ checking: false, authorized: isAuthorized, user, error });
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({ checking: false, authorized: false, user: null, error: 'check_failed' });
      }
    };
    checkAuth();
  }, []);

  const loadTeamMembers = async () => {
    setIsLoading(true);
    try {
      const members = await base44.entities.TeamMember.list('-created_date');
      setTeamMembers(members || []);
    } catch (error) {
      console.error('Failed to load team members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authState.authorized) {
      loadTeamMembers();
    }
  }, [authState.authorized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingMember) {
        await base44.entities.TeamMember.update(editingMember.id, formData);
        toast.success('Team member updated successfully');
      } else {
        await base44.entities.TeamMember.create(formData);
        toast.success('Team member added successfully');
      }
      
      setShowForm(false);
      setEditingMember(null);
      setFormData({
        full_name: '',
        email: '',
        role: '',
        receive_offer_notifications: true,
        receive_project_notifications: true,
        is_active: true
      });
      loadTeamMembers();
    } catch (error) {
      console.error('Failed to save team member:', error);
      toast.error('Failed to save team member');
    }
  };

  const handleEdit = (member) => {
    setEditingMember(member);
    setFormData({
      full_name: member.full_name,
      email: member.email,
      role: member.role || '',
      receive_offer_notifications: member.receive_offer_notifications ?? true,
      receive_project_notifications: member.receive_project_notifications ?? true,
      is_active: member.is_active ?? true
    });
    setShowForm(true);
  };

  const handleDelete = async (memberId) => {
    if (!confirm('Are you sure you want to delete this team member?')) return;
    
    try {
      await base44.entities.TeamMember.delete(memberId);
      toast.success('Team member deleted');
      loadTeamMembers();
    } catch (error) {
      console.error('Failed to delete team member:', error);
      toast.error('Failed to delete team member');
    }
  };

  const handleToggleNotification = async (memberId, field, currentValue) => {
    try {
      await base44.entities.TeamMember.update(memberId, {
        [field]: !currentValue
      });
      loadTeamMembers();
    } catch (error) {
      console.error('Failed to update notification setting:', error);
      toast.error('Failed to update setting');
    }
  };

  if (authState.checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-600">
        {t('Loading...')}
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} error={authState.error} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <User className="w-8 h-8 text-blue-600" />
              Team Members
            </h1>
            <p className="text-gray-600 mt-2">Manage team members who receive email notifications</p>
          </div>
          <Button onClick={() => {
            setShowForm(true);
            setEditingMember(null);
            setFormData({
              full_name: '',
              email: '',
              role: '',
              receive_offer_notifications: true,
              receive_project_notifications: true,
              is_active: true
            });
          }} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Team Member
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle>{editingMember ? 'Edit Team Member' : 'Add New Team Member'}</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name *</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Role/Position</Label>
                  <Input
                    id="role"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    placeholder="e.g. Account Manager, Operations Manager"
                  />
                </div>

                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="receive_offer">Receive Offer Notifications</Label>
                      <p className="text-sm text-gray-500">Get notified when offers are signed</p>
                    </div>
                    <Switch
                      id="receive_offer"
                      checked={formData.receive_offer_notifications}
                      onCheckedChange={(checked) => setFormData({...formData, receive_offer_notifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="receive_project">Receive Project Notifications</Label>
                      <p className="text-sm text-gray-500">Get notified about project updates</p>
                    </div>
                    <Switch
                      id="receive_project"
                      checked={formData.receive_project_notifications}
                      onCheckedChange={(checked) => setFormData({...formData, receive_project_notifications: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="is_active">Active</Label>
                      <p className="text-sm text-gray-500">Whether this team member is active</p>
                    </div>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setShowForm(false);
                    setEditingMember(null);
                  }}>
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                    <Save className="w-4 h-4 mr-2" />
                    {editingMember ? 'Update' : 'Add'} Team Member
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-6">
            {isLoading ? (
              <div>Loading...</div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-12">
                <User className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Team Members Yet</h3>
                <p className="text-gray-600 mb-4">Add team members to start receiving email notifications</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-center">Offer Notifications</TableHead>
                    <TableHead className="text-center">Project Notifications</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamMembers.map(member => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.full_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-gray-400" />
                          {member.email}
                        </div>
                      </TableCell>
                      <TableCell>{member.role || '-'}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={member.receive_offer_notifications ?? true}
                          onCheckedChange={() => handleToggleNotification(member.id, 'receive_offer_notifications', member.receive_offer_notifications)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={member.receive_project_notifications ?? true}
                          onCheckedChange={() => handleToggleNotification(member.id, 'receive_project_notifications', member.receive_project_notifications)}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={member.is_active ? "default" : "secondary"}>
                          {member.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(member)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(member.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}