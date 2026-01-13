import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, formatDistanceToNow } from "date-fns";
import { Edit, Eye, Trash2, CheckCircle, Copy, RotateCcw, Tags, X, Check } from "lucide-react";
import { toast } from "sonner";
import { Offer, Project } from "@/api/entities";
import { useLocalization } from "../Localization";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { defaultTasks } from "../projects/ProjectForm";

const statusColors = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  sent: "bg-blue-100 text-blue-800 border-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-gray-200 text-gray-600 border-gray-400",
  archived: "bg-gray-100 text-gray-500 border-gray-200"
};

const salesLaneLabels = {
  draft: { label: 'Draft', color: 'text-slate-500' },
  sent: { label: 'Sent', color: 'text-blue-500' },
  reminder: { label: 'Reminder', color: 'text-amber-500' },
  conversation: { label: 'In gesprek', color: 'text-orange-500' },
  deal: { label: 'Confirmed', color: 'text-emerald-600' },
  lost: { label: 'Lost', color: 'text-red-500' },
};

const getTagColor = (tag) => {
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-orange-100 text-orange-800",
    "bg-green-100 text-green-800",
    "bg-teal-100 text-teal-800",
    "bg-indigo-100 text-indigo-800",
    "bg-rose-100 text-rose-800",
    "bg-cyan-100 text-cyan-800",
    "bg-amber-100 text-amber-800"
  ];
  
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export default function DraggableOfferRow({
  offer,
  clients,
  products,
  categorySettings,
  projectOfferMap,
  onDataChange,
  onUpdateOffer,
  onRemoveOffer,
  showArchived,
  allTags,
  isInFolder = false,
  onDragStart,
  onDragEnd
}) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');

  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.company_name || t("Unknown Client");
  };

  const isSigned = !!offer.signed_date;
  const effectiveStatus = isSigned ? 'confirmed' : offer.status;
  const hasProject = projectOfferMap.has(offer.id);
  const offerTags = offer.tags || [];
  const lastClientView = offer.last_client_view;

  const handleStatusChange = async (newStatus) => {
    try {
      if (onUpdateOffer) {
        onUpdateOffer(offer.id, { status: newStatus, updated_date: new Date().toISOString() });
      }

      await Offer.update(offer.id, { status: newStatus });
      toast.success(t("Offer status updated."));

      if (newStatus === 'confirmed' && !hasProject) {
        await handleCreateProject();
      }
    } catch (error) {
      toast.error(t("Failed to update status."));
      console.error(error);
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const handleCreateProject = async () => {
    setIsCreating(true);
    try {
      const newProject = await Project.create({
        offer_id: offer.id,
        client_id: offer.client_id,
        project_name: offer.project_name,
        project_location: offer.project_location,
        start_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[0] : offer.project_start_date,
        end_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[offer.showdates.length - 1] : offer.project_end_date,
        showdates: offer.showdates || [],
        expected_attendance: offer.expected_attendance,
        confirmed_revenue: offer.subtotal_excl_btw,
        services: ['Cashless'],
        status: 'planning',
        tasks: defaultTasks,
      });
      toast.success(t(`Project "${newProject.project_name}" created!`));
      onDataChange();
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error(t("Failed to create project."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleArchive = async () => {
    try {
      if (onRemoveOffer) {
        onRemoveOffer(offer.id);
      }

      await Offer.update(offer.id, { status: 'archived', folder_id: null });
      toast.success(t("Offer archived."));
    } catch (error) {
      toast.error(t("Failed to archive offer."));
      console.error(error);
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    try {
      await Offer.update(offer.id, { status: 'draft' });
      toast.success(t("Offer restored to draft."));
      onDataChange();
    } catch (error) {
      toast.error(t("Failed to restore offer."));
      console.error(error);
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const duplicateData = {
        ...offer,
        project_name: `${offer.project_name} (copy)`,
        offer_number: `DRAFT-${Math.floor(Date.now() / 1000)}`,
        version: 1,
        status: 'draft',
        folder_id: offer.folder_id, // Keep in same folder
        signed_by_name: undefined,
        signed_date: undefined,
        signature_data_url: undefined,
      };
      
      delete duplicateData.id;
      delete duplicateData.created_date;
      delete duplicateData.updated_date;
      delete duplicateData.created_by;
      delete duplicateData.last_client_view;

      const newOffer = await Offer.create(duplicateData);
      toast.success(t("Offer duplicated successfully!"));
      navigate(createPageUrl(`OfferEditor?id=${newOffer.id}`));
    } catch (error) {
      console.error("Failed to duplicate offer:", error);
      toast.error(t("Failed to duplicate offer."));
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleAddTag = async (newTag) => {
    if (!newTag || !newTag.trim()) return;
    
    const trimmedTag = newTag.trim();
    if (offerTags.includes(trimmedTag)) {
      toast.error("Tag already exists");
      return;
    }
    
    const updatedTags = [...offerTags, trimmedTag];
    
    try {
      if (onUpdateOffer) {
        onUpdateOffer(offer.id, { tags: updatedTags });
      }
      
      await Offer.update(offer.id, { tags: updatedTags });
      setTagInputValue('');
      setTagPopoverOpen(false);
    } catch (error) {
      toast.error("Failed to add tag");
      console.error(error);
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    const updatedTags = offerTags.filter(tag => tag !== tagToRemove);
    
    try {
      if (onUpdateOffer) {
        onUpdateOffer(offer.id, { tags: updatedTags });
      }
      
      await Offer.update(offer.id, { tags: updatedTags });
    } catch (error) {
      toast.error("Failed to remove tag");
      console.error(error);
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  return (
    <TableRow 
      className="hover:bg-gray-50"
    >
      <TableCell className="text-xs text-gray-600">
        {offer.showdates && offer.showdates.length > 0 ? (
          <div>
            <div className="font-medium">{format(new Date(offer.showdates[0]), 'dd MMM yyyy')}</div>
            {offer.showdates.length > 1 && (
              <div className="text-xs text-gray-500">+{offer.showdates.length - 1} meer</div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 italic">-</div>
        )}
      </TableCell>
      <TableCell className="text-xs text-gray-600">
        <div className="font-medium">{format(new Date(offer.updated_date), 'dd MMM yyyy')}</div>
        <div className="text-xs text-gray-400">{format(new Date(offer.updated_date), 'HH:mm')}</div>
      </TableCell>
      <TableCell>
        <Link to={createPageUrl(`OfferEditor?id=${offer.id}`)} className="font-semibold text-gray-900 hover:text-blue-700">
          {offer.project_name}
        </Link>
        {offer.project_location && (
          <div className="text-xs text-gray-500">{offer.project_location}</div>
        )}
      </TableCell>
      <TableCell className="text-sm text-gray-700">
        {getClientName(offer.client_id)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1 items-center">
          {offerTags.map(tag => (
            <Badge 
              key={tag} 
              className={`${getTagColor(tag)} text-xs gap-1 pr-1 border border-transparent`}
              variant="outline"
            >
              {tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="hover:bg-black/10 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0 hover:bg-blue-50"
              >
                <Tags className="w-3 h-3 text-gray-400" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3" align="start">
              <div className="space-y-2">
                <div className="text-sm font-semibold mb-2">{t('Add Tag')}</div>
                <div className="flex gap-2">
                  <Input
                    placeholder={t('Enter tag name...')}
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddTag(tagInputValue);
                    }}
                    className="h-8 text-sm"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => handleAddTag(tagInputValue)}
                    className="h-8 px-2"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                </div>
                
                {allTags.length > 0 && (
                  <>
                    <div className="text-xs text-gray-500 mt-3 mb-1">{t('Existing tags')}:</div>
                    <div className="flex flex-wrap gap-1">
                      {allTags
                        .filter(tag => !offerTags.includes(tag))
                        .map(tag => (
                          <Badge
                            key={tag}
                            className={`${getTagColor(tag)} text-xs cursor-pointer hover:opacity-80 border border-transparent`}
                            variant="outline"
                            onClick={() => handleAddTag(tag)}
                          >
                            {tag}
                          </Badge>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </TableCell>
      <TableCell>
        {isSigned ? (
          <div className="flex items-center gap-2">
            <Badge className={`h-auto px-2 py-0.5 text-xs rounded-md border ${statusColors[effectiveStatus]}`}>
              {t(effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1))}
            </Badge>
            <CheckCircle className="w-3 h-3 text-green-600" />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 p-0 text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Reset Signed Offer?')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('This will remove the signature and reset the offer to draft status.')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={async () => {
                      try {
                        await Offer.update(offer.id, {
                          status: 'draft',
                          signed_by_name: null,
                          signed_date: null,
                          signature_data_url: null
                        });
                        toast.success(t('Offer reset to draft'));
                        onDataChange();
                      } catch (error) {
                        toast.error(t('Failed to reset offer'));
                      }
                    }}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    {t('Reset to Draft')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <div className="space-y-0.5">
            <Select value={effectiveStatus} onValueChange={handleStatusChange}>
              <SelectTrigger className={`h-8 w-32 border ${statusColors[effectiveStatus]}`}>
                <SelectValue>
                  <Badge className={`h-auto px-2 py-0.5 text-xs rounded-md ${statusColors[effectiveStatus]} border-transparent`}>
                    {t(effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1))}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">{t('Draft')}</SelectItem>
                <SelectItem value="sent">{t('Offered')}</SelectItem>
                <SelectItem value="under_review">{t('Under Review')}</SelectItem>
                <SelectItem value="confirmed">{t('Confirmed')}</SelectItem>
                <SelectItem value="rejected">{t('Lost')}</SelectItem>
              </SelectContent>
            </Select>
            {offer.sales_lane && salesLaneLabels[offer.sales_lane] && (
              <div className={`text-[10px] ${salesLaneLabels[offer.sales_lane].color} pl-1`}>
                {salesLaneLabels[offer.sales_lane].label}
              </div>
            )}
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="font-semibold text-gray-900">
          €{(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-gray-500">{t('incl. BTW')}</div>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          {showArchived ? (
            <>
              <Link to={createPageUrl(`OfferReview?id=${offer.id}`)} target="_blank">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <Eye className="w-3 h-3"/>
                </Button>
              </Link>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                onClick={handleRestore}
                disabled={isRestoring}
              >
                <RotateCcw className="w-3 h-3"/>
              </Button>
            </>
          ) : (
            <>
              <Link to={createPageUrl(`OfferEditor?id=${offer.id}`)}>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <Edit className="w-3 h-3"/>
                </Button>
              </Link>
              <Link to={createPageUrl(`OfferReview?id=${offer.id}`)} target="_blank">
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <Eye className="w-3 h-3"/>
                </Button>
              </Link>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                onClick={handleDuplicate}
                disabled={isDuplicating}
              >
                <Copy className="w-3 h-3"/>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="w-3 h-3"/>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t('This will archive the offer and remove it from the main list.')}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleArchive} className="bg-red-600 hover:bg-red-700">
                      {t('Archive')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}