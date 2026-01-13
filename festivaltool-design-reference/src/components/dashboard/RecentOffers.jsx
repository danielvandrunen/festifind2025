
import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { FileText, ExternalLink, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocalization } from "../../components/Localization";

const statusColors = {
  draft: "bg-gray-100 text-gray-800",
  sent: "bg-blue-100 text-blue-800", 
  under_review: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-gray-100 text-gray-600"
};

export default function RecentOffers({ offers, clients, isLoading, onRefresh }) {
  const { t } = useLocalization();
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_date');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const filteredAndSortedOffers = useMemo(() => {
    let filtered = [...offers];

    // Status filter - check for signed offers
    if (statusFilter === 'draft') {
      filtered = filtered.filter(o => o.status === 'draft' && !o.signed_date);
    } else if (statusFilter === 'confirmed') {
      filtered = filtered.filter(o => o.status === 'confirmed' || o.signed_date);
    }

    // Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'project_name':
          aValue = a.project_name?.toLowerCase() || '';
          bValue = b.project_name?.toLowerCase() || '';
          break;
        case 'client':
          const clientA = clients.find(c => c.id === a.client_id)?.company_name?.toLowerCase() || '';
          const clientB = clients.find(c => c.id === b.client_id)?.company_name?.toLowerCase() || '';
          aValue = clientA;
          bValue = clientB;
          break;
        case 'status':
          // Use effective status for sorting (signed = confirmed)
          aValue = a.signed_date ? 'confirmed' : (a.status || '');
          bValue = b.signed_date ? 'confirmed' : (b.status || '');
          break;
        case 'total':
          aValue = a.total_incl_btw || 0;
          bValue = b.total_incl_btw || 0;
          break;
        case 'created_date':
        default:
          aValue = a.created_date ? new Date(a.created_date).getTime() : 0;
          bValue = b.created_date ? new Date(b.created_date).getTime() : 0;
          break;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [offers, clients, statusFilter, sortBy, sortOrder]);

  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.company_name || t('N/A');
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            {t('Recent Offers')}
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Link to={createPageUrl("Offers")}>
              <Button variant="outline" size="sm">
                {t('View All')}
              </Button>
            </Link>
          </div>
        </div>
        
        {/* Status filter buttons */}
        <div className="flex gap-2">
          <Button
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('all')}
            className={statusFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
          >
            {t('All')}
          </Button>
          <Button
            variant={statusFilter === 'draft' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('draft')}
            className={statusFilter === 'draft' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
          >
            {t('Draft')}
          </Button>
          <Button
            variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter('confirmed')}
            className={statusFilter === 'confirmed' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
          >
            {t('Confirmed')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredAndSortedOffers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p>{t('No offers found')}</p>
            <Link to={createPageUrl("Offers?action=create")}>
              <Button className="mt-3" size="sm">
                {t('Create Your First Offer')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('project_name')} className="font-semibold h-8 px-2">
                      {t('Project')}
                      <SortIcon column="project_name" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('client')} className="font-semibold h-8 px-2">
                      {t('Client')}
                      <SortIcon column="client" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="font-semibold h-8 px-2">
                      {t('Status')}
                      <SortIcon column="status" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('total')} className="font-semibold h-8 px-2">
                      {t('Total')}
                      <SortIcon column="total" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('created_date')} className="font-semibold h-8 px-2">
                      {t('Created')}
                      <SortIcon column="created_date" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAndSortedOffers.map((offer) => {
                  // Determine effective status - if signed, show as confirmed
                  const isSigned = !!offer.signed_date;
                  const effectiveStatus = isSigned ? 'confirmed' : offer.status;
                  
                  return (
                    <TableRow key={offer.id} className="hover:bg-gray-50">
                      <TableCell className="font-mono text-xs text-gray-500">
                        {offer.offer_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {offer.project_name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {getClientName(offer.client_id)}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[effectiveStatus]} variant="outline">
                          {effectiveStatus === 'under_review' ? 'under review' : effectiveStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="font-semibold text-gray-900">
                          €{(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">{t('incl. BTW')}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {format(new Date(offer.created_date), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`OfferEditor?id=${offer.id}`)}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
