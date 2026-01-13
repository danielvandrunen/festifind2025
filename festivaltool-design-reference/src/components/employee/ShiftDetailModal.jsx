import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Upload,
  Loader2,
  CheckCircle,
  Image as ImageIcon,
  Package
} from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import MediaPreviewModal from "./MediaPreviewModal";

export default function ShiftDetailModal({ shift, project, isOpen, onClose, onUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [uploadingInvoice, setUploadingInvoice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffMember, setStaffMember] = useState(null);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [hasPakbon, setHasPakbon] = useState(false);
  const [shiftData, setShiftData] = useState({
    actual_start_time: shift.actual_start_time || '',
    actual_end_time: shift.actual_end_time || '',
    completion_notes: shift.completion_notes || '',
    completion_photos: shift.completion_photos || [],
    invoice_pdf_url: shift.invoice_pdf_url || ''
  });

  const saveTimeoutRef = React.useRef(null);

  // Update local state when shift prop changes
  React.useEffect(() => {
    setShiftData({
      actual_start_time: shift.actual_start_time || '',
      actual_end_time: shift.actual_end_time || '',
      completion_notes: shift.completion_notes || '',
      completion_photos: shift.completion_photos || [],
      invoice_pdf_url: shift.invoice_pdf_url || ''
    });
  }, [shift]);

  // Fetch staff member data
  React.useEffect(() => {
    const loadStaffMember = async () => {
      if (!shift.staff_id) return;
      try {
        const allStaff = await base44.entities.Staff.list();
        const staff = allStaff.find(s => s.id === shift.staff_id);
        setStaffMember(staff);
      } catch (error) {
        console.error('Error loading staff:', error);
      }
    };
    loadStaffMember();
  }, [shift.staff_id]);

  // Check if pakbon is available
  React.useEffect(() => {
    if (project?.packing_slip_items && project.packing_slip_items.length > 0) {
      setHasPakbon(true);
    }
  }, [project]);

  const openPakbon = () => {
    const url = `/pakbon?project=${shift.project_id}`;
    window.open(url, '_blank');
  };

  // Calculate hours and cost
  const calculateHours = () => {
    if (!shiftData.actual_start_time || !shiftData.actual_end_time) return 0;
    const start = new Date(shiftData.actual_start_time);
    const end = new Date(shiftData.actual_end_time);
    const hours = (end - start) / (1000 * 60 * 60);
    return Math.max(0, hours);
  };

  const hours = calculateHours();
  const rate = staffMember?.hourly_rate || 0;
  const totalCost = hours * rate;

  // Auto-save with debounce
  const debouncedSave = (data) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await base44.entities.Shift.update(shift.id, data);
      } catch (error) {
        console.error('Error saving shift:', error);
        toast.error('Fout bij opslaan');
      } finally {
        setSaving(false);
      }
    }, 1000);
  };

  const handleTimeChange = (field, value) => {
    if (!value) return;
    
    const time = value;
    const date = new Date(shift.shift_date);
    const [hours, minutes] = time.split(':');
    date.setHours(parseInt(hours), parseInt(minutes));
    const isoString = date.toISOString();
    
    // Update local state immediately
    setShiftData(prev => ({ ...prev, [field]: isoString }));
    
    // Debounced save to backend
    debouncedSave({ [field]: isoString });
  };

  const handleNotesChange = (value) => {
    // Update local state immediately
    setShiftData(prev => ({ ...prev, completion_notes: value }));
    
    // Debounced save to backend
    debouncedSave({ completion_notes: value });
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(file => 
        base44.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const newPhotos = results.map(r => r.file_url);
      
      const updatedPhotos = [...shiftData.completion_photos, ...newPhotos];
      
      // Update local state first for immediate UI update
      setShiftData(prev => ({ ...prev, completion_photos: updatedPhotos }));
      
      // Then save to backend
      await base44.entities.Shift.update(shift.id, { completion_photos: updatedPhotos });
      toast.success(`${files.length} foto${files.length > 1 ? "'s" : ''} geüpload`);
    } catch (error) {
      console.error('Error uploading photos:', error);
      toast.error('Fout bij uploaden foto');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async (photoUrl) => {
    const updatedPhotos = shiftData.completion_photos.filter(p => p !== photoUrl);
    
    // Update local state first for immediate UI update
    setShiftData(prev => ({ ...prev, completion_photos: updatedPhotos }));
    
    try {
      await base44.entities.Shift.update(shift.id, { completion_photos: updatedPhotos });
      toast.success('Foto verwijderd');
    } catch (error) {
      console.error('Error removing photo:', error);
      toast.error('Fout bij verwijderen foto');
    }
  };

  const handleInvoiceUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast.error('Alleen PDF bestanden zijn toegestaan');
      return;
    }

    setUploadingInvoice(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Update local state first for immediate UI update
      setShiftData(prev => ({ ...prev, invoice_pdf_url: file_url }));
      
      // Then save to backend
      await base44.entities.Shift.update(shift.id, { invoice_pdf_url: file_url });
      toast.success('Factuur geüpload');
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast.error('Fout bij uploaden factuur');
    } finally {
      setUploadingInvoice(false);
    }
  };

  const handleRemoveInvoice = async () => {
    // Update local state first for immediate UI update
    setShiftData(prev => ({ ...prev, invoice_pdf_url: '' }));
    
    try {
      await base44.entities.Shift.update(shift.id, { invoice_pdf_url: '' });
      toast.success('Factuur verwijderd');
    } catch (error) {
      console.error('Error removing invoice:', error);
      toast.error('Fout bij verwijderen factuur');
    }
  };

  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl font-bold">
            {project?.project_name || 'Shift Details'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {saving && (
            <div className="text-xs text-blue-600 text-right animate-pulse">
              Opslaan...
            </div>
          )}

          {/* Pakbon Link */}
          {hasPakbon && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">Pakbon Beschikbaar</p>
                    <p className="text-sm text-green-700">Bekijk welke materialen meegenomen moeten worden</p>
                  </div>
                </div>
                <Button onClick={openPakbon} variant="outline" size="sm" className="gap-2">
                  <Package className="w-4 h-4" />
                  Open Pakbon
                </Button>
              </div>
            </div>
          )}

          {/* Shift Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50">
                {shift.role}
              </Badge>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Calendar className="w-4 h-4" />
              <span>{format(new Date(shift.shift_date), 'EEEE d MMMM yyyy', { locale: nl })}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-700">
              <Clock className="w-4 h-4" />
              <span>Gepland: {shift.start_time} - {shift.end_time}</span>
            </div>

            {shift.location && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <MapPin className="w-4 h-4" />
                <span>{shift.location}</span>
              </div>
            )}

            {shift.contact_person && (
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <User className="w-4 h-4" />
                <span>{shift.contact_person}</span>
                {shift.contact_phone && (
                  <a href={`tel:${shift.contact_phone}`} className="text-blue-600 hover:underline">
                    ({shift.contact_phone})
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Briefing */}
          {shift.briefing && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Briefing</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{shift.briefing}</p>
            </div>
          )}

          {/* Shift Logging */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Shift Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Begintijd</label>
                <Input
                  type="time"
                  value={shiftData.actual_start_time ? 
                    new Date(shiftData.actual_start_time).toTimeString().slice(0, 5) : ''}
                  onChange={(e) => handleTimeChange('actual_start_time', e.target.value)}
                  className="h-12 text-base"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Eindtijd</label>
                <Input
                  type="time"
                  value={shiftData.actual_end_time ? 
                    new Date(shiftData.actual_end_time).toTimeString().slice(0, 5) : ''}
                  onChange={(e) => handleTimeChange('actual_end_time', e.target.value)}
                  className="h-12 text-base"
                />
              </div>
            </div>

            {hours > 0 && rate > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-900 font-medium">Shift kosten</p>
                    <p className="text-xs text-blue-700 mt-1">
                      {hours.toFixed(1)} uur × €{rate.toFixed(2)}/uur
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-900">€{totalCost.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Foto's</label>
              <div className="space-y-3">
                <label className="flex items-center justify-center w-full px-4 py-4 sm:py-3 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-100 active:bg-gray-200">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    capture="environment"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                  {uploading ? (
                    <Loader2 className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-gray-600" />
                  ) : (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Upload className="w-6 h-6 sm:w-5 sm:h-5" />
                      <span className="text-base sm:text-sm">Maak of upload foto's</span>
                    </div>
                  )}
                </label>
                
                {shiftData.completion_photos && shiftData.completion_photos.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {shiftData.completion_photos.map((photoUrl, idx) => (
                      <div key={idx} className="relative group">
                        <button
                          onClick={() => setPreviewMedia({ url: photoUrl, type: 'image' })}
                          className="block w-full"
                        >
                          <img 
                            src={photoUrl} 
                            alt={`Photo ${idx + 1}`}
                            className="w-full h-40 sm:h-32 object-cover rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
                          />
                        </button>
                        <div className="absolute top-2 right-2 flex gap-1">
                          <a
                            href={photoUrl}
                            download
                            className="h-8 w-8 sm:h-7 sm:w-7 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Upload className="w-4 h-4 rotate-180" />
                          </a>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 w-8 sm:h-7 sm:w-7 p-0 text-lg"
                            onClick={() => handleRemovePhoto(photoUrl)}
                          >
                            ×
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Factuur (PDF)</label>
              <div className="space-y-2">
                {!shiftData.invoice_pdf_url ? (
                  <label className="flex items-center justify-center w-full px-4 py-4 sm:py-3 bg-blue-50 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-100 active:bg-blue-200">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={handleInvoiceUpload}
                      className="hidden"
                      disabled={uploadingInvoice}
                    />
                    {uploadingInvoice ? (
                      <Loader2 className="w-6 h-6 sm:w-5 sm:h-5 animate-spin text-blue-600" />
                    ) : (
                      <div className="flex items-center gap-2 text-blue-600">
                        <Upload className="w-6 h-6 sm:w-5 sm:h-5" />
                        <span className="text-base sm:text-sm">Upload factuur PDF</span>
                      </div>
                    )}
                  </label>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium text-green-900">Factuur geüpload</span>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          onClick={() => setPreviewMedia({ url: shiftData.invoice_pdf_url, type: 'pdf' })}
                          className="flex-1 sm:flex-none text-center px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                        >
                          Bekijk
                        </button>
                        <a
                          href={shiftData.invoice_pdf_url}
                          download
                          className="flex-none text-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center"
                        >
                          <Upload className="w-4 h-4 rotate-180" />
                        </a>
                        <button
                          onClick={handleRemoveInvoice}
                          className="flex-1 sm:flex-none text-center px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                        >
                          Verwijder
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Logboek / Notities</label>
              <Textarea
                value={shiftData.completion_notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Hoe is de shift verlopen? Eventuele bijzonderheden..."
                rows={6}
                className="text-base resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">Automatisch opgeslagen</p>
            </div>
          </div>
        </div>
      </DialogContent>

      {previewMedia && (
        <MediaPreviewModal
          isOpen={!!previewMedia}
          onClose={() => setPreviewMedia(null)}
          mediaUrl={previewMedia.url}
          mediaType={previewMedia.type}
        />
      )}
    </Dialog>
  );
}