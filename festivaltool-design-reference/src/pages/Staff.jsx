import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2, Mail, UserCheck, UserX, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

export default function StaffPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    skills: [],
    hourly_rate: 0,
    notes: '',
    is_active: true
  });
  const availableRoles = ["Bar", "Kitchen", "Cashier", "Runner", "Security", "Tech Support", "Manager", "Setup Crew", "Cleanup"];

  useEffect(() => {
    const checkAuth = async () => {
      const { isAuthorized, user, error } = await checkUserAuthorization();
      
      if (error === 'not_authenticated') {
        window.location.href = '/login';
        return;
      }
      
      setAuthState({ checking: false, authorized: isAuthorized, user });
    };
    checkAuth();
  }, []);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const data = await base44.entities.Staff.list();
      setStaff(data || []);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Fout bij laden van personeel');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authState.authorized) {
      loadStaff();
    }
  }, [authState.authorized]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.email) {
      toast.error('Naam en e-mail zijn verplicht');
      return;
    }

    try {
      if (editingStaff) {
        await base44.entities.Staff.update(editingStaff.id, formData);
        toast.success('Personeelslid bijgewerkt');
        setStaff(staff.map(s => s.id === editingStaff.id ? { ...s, ...formData } : s));
      } else {
        const newStaff = await base44.entities.Staff.create(formData);
        setStaff([...staff, newStaff]);
        
        // Send welcome email via backend function
        try {
          await base44.functions.invoke('sendWelcomeEmailx', {
            staffName: formData.name,
            staffEmail: formData.email,
            appOrigin: window.location.origin
          });
          toast.success('Personeelslid toegevoegd en welkomstmail verzonden');
        } catch (emailError) {
          console.error('Error sending welcome email:', emailError);
          toast.success('Personeelslid toegevoegd (email kon niet worden verzonden)');
        }
      }
      
      setShowForm(false);
      setEditingStaff(null);
      setFormData({ name: '', email: '', phone: '', skills: [], hourly_rate: 0, notes: '', is_active: true });
    } catch (error) {
      console.error('Error saving staff:', error);
      toast.error('Fout bij opslaan');
    }
  };

  const handleEdit = (staffMember) => {
    setEditingStaff(staffMember);
    setFormData({
      name: staffMember.name || '',
      email: staffMember.email || '',
      phone: staffMember.phone || '',
      skills: staffMember.skills || [],
      hourly_rate: staffMember.hourly_rate || 0,
      notes: staffMember.notes || '',
      is_active: staffMember.is_active !== false
    });
    setShowForm(true);
  };

  const handleToggleActive = async (staffMember) => {
    try {
      await base44.entities.Staff.update(staffMember.id, {
        ...staffMember,
        is_active: !staffMember.is_active
      });
      setStaff(staff.map(s => 
        s.id === staffMember.id 
          ? { ...s, is_active: !s.is_active }
          : s
      ));
      toast.success(staffMember.is_active ? 'Personeelslid gedeactiveerd' : 'Personeelslid geactiveerd');
    } catch (error) {
      console.error('Error toggling staff status:', error);
      toast.error('Fout bij wijzigen status');
    }
  };

  const handleResendInvitation = async (staffMember) => {
    try {
      await base44.functions.invoke('sendWelcomeEmailx', {
        staffName: staffMember.name,
        staffEmail: staffMember.email,
        appOrigin: window.location.origin
      });
      toast.success('Uitnodiging opnieuw verzonden naar ' + staffMember.email);
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Fout bij verzenden uitnodiging');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Weet je zeker dat je dit personeelslid wilt verwijderen?')) return;
    
    try {
      await base44.entities.Staff.delete(id);
      setStaff(staff.filter(s => s.id !== id));
      toast.success('Personeelslid verwijderd');
    } catch (error) {
      console.error('Error deleting staff:', error);
      toast.error('Fout bij verwijderen');
    }
  };

  const handlePreviewPortal = (staffMember) => {
    // Store staff data in sessionStorage for preview
    sessionStorage.setItem('fastlane_staff', JSON.stringify(staffMember));
    sessionStorage.setItem('fastlane_admin_preview', 'true');
    // Navigate to employee portal
    navigate(createPageUrl('EmployeePortal'));
  };

  const handleAddSkill = (role) => {
    if (role && !formData.skills.includes(role)) {
      setFormData({ ...formData, skills: [...formData.skills, role] });
    }
  };

  const handleRemoveSkill = (skill) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  };

  if (authState.checking) {
    return <div className="p-6">Loading...</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Personeel</h1>
            <p className="text-gray-600 mt-1">Beheer je team en crew leden</p>
          </div>
          <Button onClick={() => {
            setEditingStaff(null);
            setFormData({ name: '', email: '', phone: '', skills: [], hourly_rate: 0, notes: '', is_active: true });
            setShowForm(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nieuw personeelslid
          </Button>
        </div>

        {/* Staff List */}
        {isLoading ? (
          <div className="text-center py-12">Laden...</div>
        ) : staff.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-gray-500 mb-4">Nog geen personeel toegevoegd</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Voeg eerste personeelslid toe
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {staff.map(member => (
              <Card key={member.id} className={`p-4 ${!member.is_active ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{member.name}</h3>
                      {member.is_active ? (
                        <Badge className="bg-green-100 text-green-800">Actief</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-100 text-gray-600">Inactief</Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        <span>{member.email}</span>
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">Tel:</span>
                          <span>{member.phone}</span>
                        </div>
                      )}
                    </div>

                    {member.skills && member.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {member.skills.map(skill => (
                          <Badge key={skill} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {member.notes && (
                      <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {member.notes}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePreviewPortal(member)}
                      title="Bekijk portal als deze medewerker"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResendInvitation(member)}
                      title="Uitnodiging opnieuw verzenden"
                    >
                      <Mail className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(member)}
                    >
                      {member.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(member)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(member.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Form Modal */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingStaff ? 'Personeelslid bewerken' : 'Nieuw personeelslid'}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Naam *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Voor- en achternaam"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">E-mail *</label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@voorbeeld.nl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Telefoon</label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+31 6 12345678"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Uurtarief (€)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
                  placeholder="25.00"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Vaardigheden / Rollen</label>
                <div className="mb-2">
                  <Select onValueChange={handleAddSkill}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecteer rol om toe te voegen" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.filter(role => !formData.skills.includes(role)).map(role => (
                        <SelectItem key={role} value={role}>{role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveSkill(skill)}>
                      {skill} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Notities</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Interne notities over dit personeelslid"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Annuleren
                </Button>
                <Button type="submit">
                  {editingStaff ? 'Bijwerken' : 'Toevoegen'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}