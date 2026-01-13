import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Pencil, Archive, Check, X } from "lucide-react";
import { toast } from "sonner";
import { OfferFolder, Offer } from "@/api/entities";
import { useLocalization } from "../Localization";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800",
  under_review: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-200 text-gray-600",
  archived: "bg-gray-100 text-gray-500"
};

export default function OfferFolderRow({ 
  folder, 
  offersInFolder, 
  isExpanded, 
  onToggleExpand,
  onDataChange,
  onDragOver,
  onDrop,
  isDragTarget
}) {
  const { t } = useLocalization();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  // Calculate aggregated data
  const aggregatedData = useMemo(() => {
    const totalValue = offersInFolder.reduce((sum, offer) => sum + (offer.total_incl_btw || 0), 0);
    const offerCount = offersInFolder.length;
    
    // Status breakdown
    const statusBreakdown = {};
    offersInFolder.forEach(offer => {
      const isSigned = !!offer.signed_date;
      const effectiveStatus = isSigned ? 'confirmed' : offer.status;
      statusBreakdown[effectiveStatus] = (statusBreakdown[effectiveStatus] || 0) + 1;
    });

    return { totalValue, offerCount, statusBreakdown };
  }, [offersInFolder]);

  const handleSaveName = async () => {
    if (!editName.trim()) {
      toast.error(t("Folder name cannot be empty"));
      return;
    }
    
    try {
      await OfferFolder.update(folder.id, { name: editName.trim() });
      setIsEditing(false);
      onDataChange();
    } catch (error) {
      toast.error(t("Failed to rename folder"));
      console.error(error);
    }
  };

  const handleArchiveFolder = async () => {
    try {
      // Archive all offers in the folder
      const archivePromises = offersInFolder.map(offer => 
        Offer.update(offer.id, { status: 'archived', folder_id: null })
      );
      await Promise.all(archivePromises);
      
      // Archive the folder
      await OfferFolder.update(folder.id, { is_archived: true });
      
      toast.success(t("Folder and offers archived"));
      onDataChange();
    } catch (error) {
      toast.error(t("Failed to archive folder"));
      console.error(error);
    }
  };

  return (
    <TableRow 
      className={`bg-blue-50/50 hover:bg-blue-50 border-b-2 border-blue-100 ${isDragTarget ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <TableCell colSpan={2}>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onToggleExpand}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </Button>
          
          {isExpanded ? (
            <FolderOpen className="w-5 h-5 text-blue-600" />
          ) : (
            <Folder className="w-5 h-5 text-blue-600" />
          )}
          
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 w-48"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditName(folder.name);
                  }
                }}
              />
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveName}>
                <Check className="w-4 h-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => {
                setIsEditing(false);
                setEditName(folder.name);
              }}>
                <X className="w-4 h-4 text-red-600" />
              </Button>
            </div>
          ) : (
            <span className="font-semibold text-gray-900">{folder.name}</span>
          )}
          
          <Badge variant="outline" className="ml-2 text-xs">
            {aggregatedData.offerCount} {aggregatedData.offerCount === 1 ? t('offer') : t('offers')}
          </Badge>
        </div>
      </TableCell>
      
      <TableCell>
        {/* Client - show count of unique clients */}
        <span className="text-sm text-gray-500">
          {new Set(offersInFolder.map(o => o.client_id)).size} {t('clients')}
        </span>
      </TableCell>
      
      <TableCell>
        {/* Tags - empty for folders */}
      </TableCell>
      
      <TableCell>
        {/* Status breakdown */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(aggregatedData.statusBreakdown).map(([status, count]) => (
            <Badge 
              key={status} 
              className={`${statusColors[status]} text-xs px-1.5 py-0`}
              variant="outline"
            >
              {count} {status === 'confirmed' ? '✓' : status === 'draft' ? '○' : status === 'sent' ? '→' : status === 'rejected' ? '✗' : ''}
            </Badge>
          ))}
        </div>
      </TableCell>
      
      <TableCell className="text-right">
        <div className="font-semibold text-gray-900">
          €{aggregatedData.totalValue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-gray-500">{t('total incl. BTW')}</div>
      </TableCell>
      
      <TableCell>
        {/* Created date - empty for folders */}
      </TableCell>
      
      <TableCell>
        {/* Last viewed - empty for folders */}
      </TableCell>
      
      <TableCell>
        <div className="flex items-center justify-center gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0"
            onClick={() => setIsEditing(true)}
            title={t('Rename folder')}
          >
            <Pencil className="w-3 h-3" />
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                title={t('Archive folder')}
              >
                <Archive className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('Archive folder?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('This will archive the folder and all')} {aggregatedData.offerCount} {t('offers inside it.')}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleArchiveFolder} className="bg-red-600 hover:bg-red-700">
                  {t('Archive')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  );
}