import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, Download, Save, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const GROOTBOEK_OPTIONS = [
  "unassigned",
  "4096 – Payroll: Onbelaste reiskostenvergoeding werknemer",
  "4100 – Huur kantoor",
  "4200 – 4G/Satteliet telecom inkoop",
  "4201 – Development software",
  "4202 – Office & design software",
  "4300 – Kantoorkosten",
  "4301 – Hardware voor producties",
  "4400 – Administratie & advies",
  "4402 – Contributies & abonnementen",
  "4404 – Online marketing",
  "4450 – Drukwerk & werkkleding",
  "4500 – Verzekeringen algemeen",
  "4600 – Mobiliteit",
  "4610 – Reis- & verblijfkosten",
  "4800 – Representatie & verteer",
  "4810 – Kantinekosten",
  "7000 – Inkoop algemeen",
  "7002 – Extern personeel",
  "7003 – Inhuur netwerkapparatuur",
  "7004 – Huur apparatuur en toebehoren",
  "7005 – Intern personeel",
  "7006 – Management fees",
  "8000 – Omzet algemeen",
  "8003 – Omzet refunds",
  "8004 – Omzet Testevents",
  "9300 – Bankkosten"
];

export default function InvoiceDetailModal({ invoice, users = [], projects = [], onClose, onUpdate }) {
  const [editedInvoice, setEditedInvoice] = useState({ ...invoice });
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await base44.entities.Invoice.update(invoice.id, editedInvoice);
      toast.success('Invoice updated successfully');
      onUpdate(updated);
    } catch (error) {
      toast.error('Failed to update invoice');
      console.error(error);
    }
    setIsSaving(false);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Create signed URL for the private file
      const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: invoice.file_uri,
        expires_in: 300 // 5 minutes
      });

      // Open in new tab
      window.open(signed_url, '_blank');
    } catch (error) {
      toast.error('Failed to download invoice');
      console.error(error);
    }
    setIsDownloading(false);
  };

  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-green-100 text-green-800',
    archived: 'bg-gray-100 text-gray-800'
  };

  const confidenceColors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-red-100 text-red-700'
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Invoice Details</h2>
            <p className="text-sm text-gray-600 mt-1">{invoice.subject}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
            >
              <Download className="w-4 h-4 mr-2" />
              {isDownloading ? 'Loading...' : 'View File'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* OCR Confidence & Status */}
          <div className="flex gap-3">
            {invoice.ocr_confidence && (
              <div>
                <Label className="text-xs text-gray-600 mb-1">OCR Confidence</Label>
                <Badge className={confidenceColors[invoice.ocr_confidence]}>
                  {invoice.ocr_confidence}
                </Badge>
              </div>
            )}
            <div>
              <Label className="text-xs text-gray-600 mb-1">Status</Label>
              <Badge className={statusColors[editedInvoice.status]}>
                {editedInvoice.status}
              </Badge>
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendor Name *</Label>
              <Input
                value={editedInvoice.vendor_name || ''}
                onChange={(e) => setEditedInvoice({ ...editedInvoice, vendor_name: e.target.value })}
                placeholder="Vendor name"
              />
            </div>

            <div>
              <Label>Invoice Number</Label>
              <Input
                value={editedInvoice.invoice_number || ''}
                onChange={(e) => setEditedInvoice({ ...editedInvoice, invoice_number: e.target.value })}
                placeholder="Invoice #"
              />
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={editedInvoice.amount || ''}
                onChange={(e) => setEditedInvoice({ ...editedInvoice, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Currency</Label>
              <Input
                value={editedInvoice.currency || 'EUR'}
                onChange={(e) => setEditedInvoice({ ...editedInvoice, currency: e.target.value })}
                placeholder="EUR"
              />
            </div>

            <div>
              <Label>Invoice Date</Label>
              <Input
                type="date"
                value={editedInvoice.invoice_date || ''}
                onChange={(e) => setEditedInvoice({ ...editedInvoice, invoice_date: e.target.value })}
              />
            </div>

            <div>
              <Label>Category</Label>
              <Input
                value={editedInvoice.category || ''}
                onChange={(e) => setEditedInvoice({ ...editedInvoice, category: e.target.value })}
                placeholder="e.g., Software, Marketing"
              />
            </div>
          </div>

          {/* Grootboek */}
          <div>
            <Label>Grootboek Account</Label>
            <Select
              value={editedInvoice.grootboek || 'unassigned'}
              onValueChange={(value) => setEditedInvoice({ ...editedInvoice, grootboek: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROOTBOEK_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Project */}
          <div>
            <Label>Related Project</Label>
            <Select
              value={editedInvoice.project_id || ''}
              onValueChange={(value) => setEditedInvoice({ ...editedInvoice, project_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No project linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>No project</SelectItem>
                {projects.map(project => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.project_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status & Assignment */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Status</Label>
              <Select
                value={editedInvoice.status}
                onValueChange={(value) => setEditedInvoice({ ...editedInvoice, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Assigned To</Label>
              <Select
                value={editedInvoice.assigned_to || ''}
                onValueChange={(value) => setEditedInvoice({ ...editedInvoice, assigned_to: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Unassigned</SelectItem>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.email}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label>Notes</Label>
            <Textarea
              value={editedInvoice.notes || ''}
              onChange={(e) => setEditedInvoice({ ...editedInvoice, notes: e.target.value })}
              placeholder="Add notes about this invoice..."
              rows={3}
            />
          </div>

          {/* Metadata */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">File Name:</span>
              <span className="font-medium">{invoice.file_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Received:</span>
              <span className="font-medium">
                {format(new Date(invoice.received_date), 'dd MMM yyyy, HH:mm')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Created By:</span>
              <span className="font-medium">{invoice.created_by || 'System'}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}