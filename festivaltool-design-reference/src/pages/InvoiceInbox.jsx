import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  FileText, 
  Calendar, 
  Euro,
  Filter,
  Download,
  Edit2,
  Check,
  X,
  Eye,
  Mail,
  Archive,
  Upload
} from "lucide-react";
import { format } from "date-fns";
import { useLocalization } from "../components/Localization";
import InvoiceDetailModal from "../components/invoices/InvoiceDetailModal";
import { GrootboekSelect, StatusSelect, AssignedToSelect, ProjectSelect } from "../components/invoices/InlineSelect";

export default function InvoiceInbox() {
  const { t } = useLocalization();
  const [invoices, setInvoices] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [previewInvoice, setPreviewInvoice] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedQuarter, setSelectedQuarter] = useState(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setIsLoading(true);
    try {
      const [invoicesData, usersData, projectsData] = await Promise.all([
        base44.entities.Invoice.list('-received_date'),
        base44.entities.User.list(),
        base44.entities.Project.list()
      ]);
      setInvoices(invoicesData || []);
      setUsers(usersData || []);
      setProjects(projectsData || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
    }
    setIsLoading(false);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = !searchTerm || 
        invoice.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.subject?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' 
        ? invoice.status !== 'archived' 
        : invoice.status === statusFilter;
      
      // Date filtering
      let matchesDate = true;
      if (dateFilter !== 'all' && invoice.invoice_date) {
        const invoiceDate = new Date(invoice.invoice_date);
        const now = new Date();
        const currentMonth = now.getMonth();

        if (dateFilter === 'year_quarter') {
          matchesDate = invoiceDate.getFullYear() === selectedYear;
          if (selectedQuarter !== null) {
            const invoiceQuarter = Math.floor(invoiceDate.getMonth() / 3);
            matchesDate = matchesDate && invoiceQuarter === selectedQuarter;
          }
        } else if (dateFilter === 'current_month') {
          matchesDate = invoiceDate.getFullYear() === now.getFullYear() && invoiceDate.getMonth() === currentMonth;
        } else if (dateFilter === 'last_month') {
          const lastMonth = new Date(now.getFullYear(), currentMonth - 1, 1);
          matchesDate = invoiceDate.getFullYear() === lastMonth.getFullYear() && invoiceDate.getMonth() === lastMonth.getMonth();
        } else if (dateFilter === 'custom') {
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            const end = new Date(customEndDate);
            matchesDate = invoiceDate >= start && invoiceDate <= end;
          }
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate;
    });
  }, [invoices, searchTerm, statusFilter, dateFilter, selectedYear, selectedQuarter, customStartDate, customEndDate]);

  const handleViewInvoice = (invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailModal(true);
  };

  const handleInvoiceUpdated = (updatedInvoice) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === updatedInvoice.id ? updatedInvoice : inv
    ));
    setSelectedInvoice(updatedInvoice);
  };

  const handleSelectInvoice = (invoiceId) => {
    setSelectedInvoices(prev => 
      prev.includes(invoiceId) 
        ? prev.filter(id => id !== invoiceId)
        : [...prev, invoiceId]
    );
  };

  const handleSelectAll = () => {
    if (selectedInvoices.length === filteredInvoices.length) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(inv => inv.id));
    }
  };

  const handleDownloadSelected = async () => {
    for (const invoiceId of selectedInvoices) {
      const invoice = invoices.find(inv => inv.id === invoiceId);
      if (invoice?.file_uri) {
        try {
          const signedUrlResponse = await base44.integrations.Core.CreateFileSignedUrl({
            file_uri: invoice.file_uri,
            expires_in: 300
          });
          const link = document.createElement('a');
          link.href = signedUrlResponse.signed_url;
          link.download = invoice.file_name || 'invoice.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } catch (error) {
          console.error('Failed to download invoice:', error);
        }
      }
    }
  };

  const handlePreview = async (invoice) => {
    setPreviewInvoice(invoice);
    setShowPreviewModal(true);
  };

  const handleQuickUpdate = async (invoiceId, field, value) => {
    try {
      const updated = await base44.entities.Invoice.update(invoiceId, { [field]: value });
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updated : inv));
    } catch (error) {
      console.error('Failed to update invoice:', error);
    }
  };

  const handleArchiveInvoice = async (invoiceId) => {
    try {
      const updated = await base44.entities.Invoice.update(invoiceId, { status: 'archived' });
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updated : inv));
    } catch (error) {
      console.error('Failed to archive invoice:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of files) {
        // Upload to private storage
        const uploadResponse = await base44.integrations.Core.UploadPrivateFile({ file });
        const fileUri = uploadResponse.file_uri;

        // Extract invoice data using LLM
        const ocrResponse = await base44.integrations.Core.InvokeLLM({
          prompt: `Extract invoice data from this document. Return a JSON object with:
- vendor_name: The company/vendor name issuing the invoice
- invoice_number: The invoice number
- amount: The total amount (just the number, no currency symbol)
- currency: The currency code (EUR, USD, etc.)
- invoice_date: The invoice date in YYYY-MM-DD format
- category: Best guess for category (e.g., "Software", "Hardware", "Services", "Marketing", etc.)

If any field cannot be determined with confidence, return null for that field.
Be precise with numbers - extract the final total amount.`,
          file_urls: [fileUri],
          response_json_schema: {
            type: "object",
            properties: {
              vendor_name: { type: ["string", "null"] },
              invoice_number: { type: ["string", "null"] },
              amount: { type: ["number", "null"] },
              currency: { type: ["string", "null"] },
              invoice_date: { type: ["string", "null"] },
              category: { type: ["string", "null"] }
            }
          }
        });

        // Determine confidence
        const extractedFields = Object.values(ocrResponse).filter(v => v !== null).length;
        let confidence = 'low';
        if (extractedFields >= 5) confidence = 'high';
        else if (extractedFields >= 3) confidence = 'medium';

        // Create invoice
        const invoiceData = {
          subject: `Manual upload: ${file.name}`,
          vendor_name: ocrResponse.vendor_name || 'Unknown Vendor',
          invoice_number: ocrResponse.invoice_number,
          amount: ocrResponse.amount,
          currency: ocrResponse.currency || 'EUR',
          invoice_date: ocrResponse.invoice_date,
          received_date: new Date().toISOString(),
          status: 'pending',
          grootboek: 'unassigned',
          category: ocrResponse.category,
          file_uri: fileUri,
          file_name: file.name,
          ocr_confidence: confidence,
          ocr_raw_data: ocrResponse
        };

        const newInvoice = await base44.entities.Invoice.create(invoiceData);
        setInvoices(prev => [newInvoice, ...prev]);
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to upload invoice:', error);
      alert('Failed to upload invoice. Please try again.');
    } finally {
      setIsUploading(false);
    }
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

  const totalPending = invoices.filter(i => i.status === 'pending').reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Invoice Inbox</h1>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="w-4 h-4 mr-2" />
                {isUploading ? 'Uploading...' : 'Upload Invoice'}
              </Button>
            </div>
          </div>
          <p className="text-gray-600">Manage incoming invoices from email or upload manually</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Invoices</p>
                  <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Amount</p>
                  <p className="text-2xl font-bold text-yellow-600">€{totalPending.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
                </div>
                <Euro className="w-8 h-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Paid Amount</p>
                  <p className="text-2xl font-bold text-green-600">€{totalPaid.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</p>
                </div>
                <Check className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Actions */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-[300px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="Search by vendor, invoice number, or subject..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('all')}
                    size="sm"
                  >
                    All
                  </Button>
                  <Button
                    variant={statusFilter === 'pending' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('pending')}
                    size="sm"
                  >
                    Pending
                  </Button>
                  <Button
                    variant={statusFilter === 'paid' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('paid')}
                    size="sm"
                  >
                    Paid
                  </Button>
                  <Button
                    variant={statusFilter === 'archived' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('archived')}
                    size="sm"
                  >
                    Archived
                  </Button>
                </div>
              </div>

              {/* Date Filters */}
              <div className="flex gap-3 flex-wrap items-center">
                <Button
                  variant={dateFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => {
                    setDateFilter('all');
                    setSelectedQuarter(null);
                  }}
                  size="sm"
                >
                  All Time
                </Button>
                
                <div className="flex gap-2 items-center">
                  <Select 
                    value={selectedYear.toString()} 
                    onValueChange={(value) => {
                      setSelectedYear(parseInt(value));
                      setDateFilter('year_quarter');
                    }}
                  >
                    <SelectTrigger className="w-28 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2025, 2024, 2023, 2022, 2021, 2020].map(year => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant={dateFilter === 'year_quarter' && selectedQuarter === null ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('year_quarter');
                      setSelectedQuarter(null);
                    }}
                    size="sm"
                  >
                    Full Year
                  </Button>
                  <Button
                    variant={dateFilter === 'year_quarter' && selectedQuarter === 0 ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('year_quarter');
                      setSelectedQuarter(0);
                    }}
                    size="sm"
                  >
                    Q1
                  </Button>
                  <Button
                    variant={dateFilter === 'year_quarter' && selectedQuarter === 1 ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('year_quarter');
                      setSelectedQuarter(1);
                    }}
                    size="sm"
                  >
                    Q2
                  </Button>
                  <Button
                    variant={dateFilter === 'year_quarter' && selectedQuarter === 2 ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('year_quarter');
                      setSelectedQuarter(2);
                    }}
                    size="sm"
                  >
                    Q3
                  </Button>
                  <Button
                    variant={dateFilter === 'year_quarter' && selectedQuarter === 3 ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('year_quarter');
                      setSelectedQuarter(3);
                    }}
                    size="sm"
                  >
                    Q4
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant={dateFilter === 'current_month' ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('current_month');
                      setSelectedQuarter(null);
                    }}
                    size="sm"
                  >
                    This Month
                  </Button>
                  <Button
                    variant={dateFilter === 'last_month' ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('last_month');
                      setSelectedQuarter(null);
                    }}
                    size="sm"
                  >
                    Last Month
                  </Button>
                </div>

                <div className="flex gap-2 items-center">
                  <Button
                    variant={dateFilter === 'custom' ? 'default' : 'outline'}
                    onClick={() => {
                      setDateFilter('custom');
                      setSelectedQuarter(null);
                    }}
                    size="sm"
                  >
                    Custom Range
                  </Button>
                  {dateFilter === 'custom' && (
                    <>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-40 h-9"
                        placeholder="Start date"
                      />
                      <span className="text-sm text-gray-500">to</span>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-40 h-9"
                        placeholder="End date"
                      />
                    </>
                  )}
                </div>
              </div>
              
              {selectedInvoices.length > 0 && (
                <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">
                    {selectedInvoices.length} selected
                  </span>
                  <Button
                    size="sm"
                    onClick={handleDownloadSelected}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedInvoices([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice List */}
        <Card>
          <CardHeader>
            <CardTitle>Invoices ({filteredInvoices.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading invoices...</div>
            ) : filteredInvoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No invoices found</p>
                <p className="text-sm text-gray-400 mt-2">Invoices sent to your CloudMailin address will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-center py-3 px-2 w-12">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                          onChange={handleSelectAll}
                          className="w-4 h-4"
                        />
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-40">Vendor</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-56">Grootboek</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-32">Invoice #</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-28">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-28">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-32">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-40">Project</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700 w-44">Assigned</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700 w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredInvoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="text-center py-3 px-2">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={() => handleSelectInvoice(invoice.id)}
                            className="w-4 h-4"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900 truncate block max-w-[160px]" title={invoice.vendor_name || 'Unknown'}>
                            {invoice.vendor_name || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <GrootboekSelect
                            value={invoice.grootboek}
                            onChange={(value) => handleQuickUpdate(invoice.id, 'grootboek', value)}
                          />
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {invoice.invoice_number || '-'}
                        </td>
                        <td className="py-3 px-4">
                          {invoice.amount ? (
                            <span className="font-semibold text-gray-900">
                              €{invoice.amount.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {invoice.invoice_date ? format(new Date(invoice.invoice_date), 'dd-MM-yyyy') : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <StatusSelect
                            value={invoice.status}
                            onChange={(value) => handleQuickUpdate(invoice.id, 'status', value)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <ProjectSelect
                            value={invoice.project_id}
                            projects={projects}
                            onChange={(value) => handleQuickUpdate(invoice.id, 'project_id', value)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <AssignedToSelect
                            value={invoice.assigned_to}
                            users={users}
                            onChange={(value) => handleQuickUpdate(invoice.id, 'assigned_to', value)}
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handlePreview(invoice)}
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewInvoice(invoice)}
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            {invoice.status !== 'archived' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleArchiveInvoice(invoice.id)}
                                title="Archive"
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        {showDetailModal && selectedInvoice && (
          <InvoiceDetailModal
            invoice={selectedInvoice}
            users={users}
            projects={projects}
            onClose={() => setShowDetailModal(false)}
            onUpdate={handleInvoiceUpdated}
          />
        )}

        {/* Preview Modal */}
        {showPreviewModal && previewInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowPreviewModal(false)}>
            <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">
                  {previewInvoice.vendor_name} - {previewInvoice.invoice_number || 'Invoice'}
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setShowPreviewModal(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <PDFViewer fileUri={previewInvoice.file_uri} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PDFViewer({ fileUri }) {
  const [signedUrl, setSignedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadFile = async () => {
      try {
        const response = await base44.integrations.Core.CreateFileSignedUrl({
          file_uri: fileUri,
          expires_in: 300
        });
        setSignedUrl(response.signed_url);
      } catch (error) {
        console.error('Failed to load file:', error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    };
    if (fileUri) {
      loadFile();
    }
  }, [fileUri]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">Failed to load file preview</p>
        <p className="text-sm text-gray-500">{error || 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <iframe
        src={`${signedUrl}#view=FitH`}
        className="w-full border-0 rounded"
        style={{ height: '70vh', minHeight: '500px' }}
        title="Invoice Preview"
      />
    </div>
  );
}