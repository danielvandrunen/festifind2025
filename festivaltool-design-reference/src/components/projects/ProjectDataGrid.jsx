
import React, { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // New import
import { Edit, Save, X, FileText, GanttChartSquare, User, CheckCircle } from 'lucide-react'; // Added User, CheckCircle
import { getISOWeek, format } from 'date-fns';
import { createPageUrl } from "@/utils";
import { Link } from "react-router-dom";
import { useLocalization } from '../Localization';

const statusOptions = ["planning", "active", "closing", "complete", "archived"];
const serviceOptions = ["cashless", "ticketing", "bi", "internet"];

const statusColors = {
  planning: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  closing: "bg-orange-100 text-orange-800",
  complete: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-800"
};

const offerStatusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600"
};

// Helper function to get user initials for display
const getUserInitials = (nameOrEmail) => {
  if (!nameOrEmail) return '';
  // Try to extract from full name first, then email
  const cleanedName = nameOrEmail.split('@')[0].replace(/[^a-zA-Z\s.]/g, ''); // Remove non-alphabetic chars except dot and space before @
  const parts = cleanedName.split(/[\s.]+/).filter(Boolean); // Split by space or dot, remove empty strings
  
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const EditableCell = ({ value, onChange, type = 'text', options = [] }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value || '');

  const handleSave = () => {
    onChange(parseFloat(tempValue) || tempValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value || '');
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <span 
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded min-w-[60px] inline-block"
      >
        {type === 'currency' ? `€${parseFloat(value || 0).toLocaleString('nl-NL')}` : (value || '-')}
      </span>
    );
  }

  if (type === 'select') {
    return (
      <Select
        value={tempValue}
        onValueChange={(val) => {
          onChange(val);
          setIsEditing(false);
        }}
      >
        <SelectTrigger className="h-8 min-w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(option => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type={type === 'currency' ? 'number' : type}
        value={tempValue}
        onChange={(e) => setTempValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
          if (e.key === 'Escape') handleCancel();
        }}
        className="h-8 w-24"
        autoFocus
      />
    </div>
  );
};

const ProjectRow = ({ project, client, offer, onUpdateProject, clients, t, allUsers }) => {
  const [editingProject, setEditingProject] = useState(null);

  // State for inline cell editing for project_name
  const [editingCell, setEditingCell] = useState(null); // { projectId, field }
  const [editingValue, setEditingValue] = useState('');

  const handleStartEdit = (projectId, field, value) => {
    setEditingCell({ projectId, field });
    setEditingValue(value);
  };

  const handleSaveInline = async () => {
    if (editingCell) {
      const { projectId, field } = editingCell;
      await onUpdateProject(projectId, { [field]: editingValue });
      setEditingCell(null);
      setEditingValue('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  const handleEdit = () => { // This is for starting row-level editing
    setEditingProject(project);
  };

  const handleSaveRow = async () => { // Renamed from handleSave for clarity
    if (editingProject) {
      await onUpdateProject(editingProject.id, editingProject);
      setEditingProject(null);
    }
  };

  const handleCancelRow = () => { // Renamed from handleCancel for clarity
    setEditingProject(null);
  };

  const handleFieldChange = (field, value) => {
    setEditingProject(prev => ({ ...prev, [field]: value }));
  };

  const handleAccountManagerChange = async (projectId, email) => {
    await onUpdateProject(projectId, { account_manager: email });
  };

  const isEditing = editingProject?.id === project.id;
  const currentProject = isEditing ? editingProject : project;

  const startWeek = currentProject.start_date ? getISOWeek(new Date(currentProject.start_date)) : '-';
  const endWeek = currentProject.end_date ? getISOWeek(new Date(currentProject.end_date)) : '-';
  const weekDisplay = startWeek !== '-' && endWeek !== '-' && startWeek !== endWeek 
    ? `${startWeek}-${endWeek}` 
    : (startWeek !== '-' ? startWeek : endWeek);

  const showDates = currentProject.start_date && currentProject.end_date
    ? `${format(new Date(currentProject.start_date), 'dd/MM')} - ${format(new Date(currentProject.end_date), 'dd/MM')}`
    : '-';

  // Calculate totals
  const totalCosts = (currentProject.cost_personnel_zzp || 0) + 
                    (currentProject.cost_personnel_internal || 0) + 
                    (currentProject.cost_mobility || 0) + 
                    (currentProject.cost_accommodation || 0) + 
                    (currentProject.cost_internet || 0) + 
                    (currentProject.cost_payment_processor || 0) + 
                    (currentProject.cost_other || 0);

  const totalRevenue = (currentProject.confirmed_revenue || 0) + (currentProject.transaction_revenue || 0);
  const actualMargin = totalRevenue - totalCosts;
  const marginPercentage = totalRevenue > 0 ? ((actualMargin / totalRevenue) * 100) : 0;

  return (
    <TableRow key={currentProject.id} className="hover:bg-gray-50">
      <TableCell className="sticky left-0 bg-white z-10 min-w-[200px]">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {editingCell?.projectId === project.id && editingCell?.field === 'project_name' ? (
              <Input
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onBlur={handleSaveInline}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveInline();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                autoFocus
                className="h-7 text-sm"
              />
            ) : (
              <button
                onClick={() => handleStartEdit(project.id, 'project_name', project.project_name)}
                className="text-left hover:text-blue-600 transition-colors w-full truncate"
                title={project.project_name}
              >
                {currentProject.project_name}
              </button>
            )}
          </div>
          
          {/* Account Manager Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold hover:shadow-lg transition-all">
                {currentProject.account_manager ? getUserInitials(currentProject.account_manager) : <User className="w-4 h-4" />}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2">
              <div className="space-y-1">
                <div className="px-2 py-1 text-xs font-semibold text-gray-500">
                  {t('Account Manager')}
                </div>
                {allUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleAccountManagerChange(project.id, user.email)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 transition-colors ${
                      currentProject.account_manager === user.email ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {getUserInitials(user.full_name || user.email)}
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {user.full_name || user.email}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {user.email}
                      </div>
                    </div>
                    {currentProject.account_manager === user.email && (
                      <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                ))}
                {currentProject.account_manager && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      onClick={() => handleAccountManagerChange(project.id, null)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 transition-colors text-gray-600"
                    >
                      <X className="w-4 h-4" />
                      <span className="text-sm">{t('Clear Assignment')}</span>
                    </button>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
      <TableCell>
        <Link to={createPageUrl(`ProjectDetail?id=${currentProject.id}`)}>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <GanttChartSquare className="w-4 h-4" />
          </Button>
        </Link>
      </TableCell>
      <TableCell className="text-center">{weekDisplay}</TableCell>
      <TableCell className="text-center">{showDates}</TableCell>
      <TableCell>{client?.company_name || t('N/A')}</TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.project_location}
            onChange={(val) => handleFieldChange('project_location', val)}
          />
        ) : (
          currentProject.project_location || '-'
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.status}
            onChange={(val) => handleFieldChange('status', val)}
            type="select"
            options={statusOptions}
          />
        ) : (
          <Badge className={statusColors[currentProject.status]}>
            {currentProject.status}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <EditableCell
          value={offer?.total_incl_btw || 0}
          onChange={() => {}} 
          type="currency"
        />
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.confirmed_revenue}
            onChange={(val) => handleFieldChange('confirmed_revenue', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.confirmed_revenue || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {offer?.status && (
          <Badge className={offerStatusColors[offer.status]}>
            {offer.status.replace('_', ' ')}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-center font-medium">
        {marginPercentage.toFixed(1)}%
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_personnel_zzp}
            onChange={(val) => handleFieldChange('cost_personnel_zzp', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_personnel_zzp || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_personnel_internal}
            onChange={(val) => handleFieldChange('cost_personnel_internal', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_personnel_internal || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_mobility}
            onChange={(val) => handleFieldChange('cost_mobility', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_mobility || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_accommodation}
            onChange={(val) => handleFieldChange('cost_accommodation', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_accommodation || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_internet}
            onChange={(val) => handleFieldChange('cost_internet', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_internet || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_payment_processor}
            onChange={(val) => handleFieldChange('cost_payment_processor', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_payment_processor || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.cost_other}
            onChange={(val) => handleFieldChange('cost_other', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.cost_other || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell>
        {isEditing ? (
          <EditableCell
            value={currentProject.transaction_revenue}
            onChange={(val) => handleFieldChange('transaction_revenue', val)}
            type="currency"
          />
        ) : (
          `€${(currentProject.transaction_revenue || 0).toLocaleString('nl-NL')}`
        )}
      </TableCell>
      <TableCell className="font-medium">
        €{totalRevenue.toLocaleString('nl-NL')}
      </TableCell>
      <TableCell className={`font-medium ${actualMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        €{actualMargin.toLocaleString('nl-NL')}
      </TableCell>
      {/* The CSM (Account Manager) column is removed from here */}
      <TableCell>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button onClick={handleSaveRow} size="sm" variant="default">
                <Save className="w-4 h-4" />
              </Button>
              <Button onClick={handleCancelRow} size="sm" variant="outline">
                <X className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button onClick={handleEdit} size="sm" variant="ghost">
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
};

export default function ProjectDataGrid({ projects, clients, offers, isLoading, onUpdateProject, allUsers }) { // Added allUsers prop
    const { t } = useLocalization();

    const tableHeaders = [
        t("Project Name"), t("Tasks"), t("Week"), t("Showdates"), t("Client"), t("Location"), t("Status"),
        t("€ Offered"), t("€ Confirmed"), t("Offer Status"), t("Margin %"),
        t("Cost ZZP"), t("Cost Internal"), t("Cost Mobility"), t("Cost Acco."), t("Cost Internet"), t("Cost PP"), t("Cost Other"),
        t("Revenue Trans."), t("Revenue Total"), t("Actual Margin €"),
        // t("CSM"), // Removed this header
        t("Actions")
    ];

    if (isLoading) {
        return (
            <div className="space-y-2">
                {Array(10).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
        );
    }
    
    return (
        <div className="w-full overflow-x-auto border rounded-lg bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        {tableHeaders.map((header, index) => (
                             <TableHead key={header} className={`whitespace-nowrap ${index === 0 ? "sticky left-0 bg-gray-50 z-20" : ""}`}>{header}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {projects.map(project => {
                        const client = clients.find(c => c.id === project.client_id);
                        const offer = offers.find(o => o.id === project.offer_id);
                        return <ProjectRow key={project.id} project={project} client={client} offer={offer} onUpdateProject={onUpdateProject} clients={clients} t={t} allUsers={allUsers || []} />;
                    })}
                </TableBody>
            </Table>
        </div>
    );
}
