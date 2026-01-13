import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Plus, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { Offer, OfferFolder } from "@/api/entities";
import { useLocalization } from "../Localization";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DraggableOfferRow from "./DraggableOfferRow";

export default function OfferListWithFolders({
  offers,
  folders,
  clients,
  projects,
  products,
  categorySettings,
  isLoading,
  onDataChange,
  onUpdateOffer,
  onRemoveOffer,
  showArchived = false,
  allTags = []
}) {
  const { t } = useLocalization();
  const [sortBy, setSortBy] = useState('updated_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [showHistorical, setShowHistorical] = useState(false);


  const projectOfferMap = useMemo(() => {
    const map = new Map();
    if (Array.isArray(projects)) {
      for (const project of projects) {
        if (project.offer_id) {
          map.set(project.offer_id, project.id);
        }
      }
    }
    return map;
  }, [projects]);

  // Get unique years from offers
  const availableYears = useMemo(() => {
    const years = new Set();
    offers.forEach(offer => {
      if (offer.showdates && offer.showdates.length > 0) {
        const year = new Date(offer.showdates[0]).getFullYear();
        years.add(year);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [offers]);

  // Sort offers
  const sortOffers = (offersToSort) => {
    const sorted = [...offersToSort];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'showdate':
          // Get first showdate, push items without showdates to end
          aValue = a.showdates && a.showdates.length > 0 ? new Date(a.showdates[0]).getTime() : Infinity;
          bValue = b.showdates && b.showdates.length > 0 ? new Date(b.showdates[0]).getTime() : Infinity;
          break;
        case 'project_name':
          aValue = a.project_name?.toLowerCase() || '';
          bValue = b.project_name?.toLowerCase() || '';
          break;
        case 'client':
          aValue = clients.find(c => c.id === a.client_id)?.company_name?.toLowerCase() || '';
          bValue = clients.find(c => c.id === b.client_id)?.company_name?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'total':
          aValue = a.total_incl_btw || 0;
          bValue = b.total_incl_btw || 0;
          break;
        case 'created_date':
          aValue = new Date(a.created_date).getTime();
          bValue = new Date(b.created_date).getTime();
          break;
        case 'updated_date':
          aValue = new Date(a.updated_date).getTime();
          bValue = new Date(b.updated_date).getTime();
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  };

  // Filter offers (search looks inside folders too)
  const filteredOffers = useMemo(() => {
    let filtered = [...offers];
    
    // Hide historical offers (with showdates in the past) unless showHistorical is true
    if (!showArchived && !showHistorical) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      filtered = filtered.filter(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return true; // Keep offers without showdates
        const lastShowdate = new Date(offer.showdates[offer.showdates.length - 1]);
        return lastShowdate >= today; // Only show if last showdate is today or in the future
      });
    }
    
    if (!showArchived && statusFilter !== 'all') {
      filtered = filtered.filter(offer => {
        const isSigned = !!offer.signed_date;
        const effectiveStatus = isSigned ? 'confirmed' : offer.status;
        return effectiveStatus === statusFilter;
      });
    }
    
    if (!showArchived && yearFilter !== 'all') {
      filtered = filtered.filter(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return false;
        const year = new Date(offer.showdates[0]).getFullYear();
        return year === parseInt(yearFilter);
      });
    }
    
    return filtered;
  }, [offers, statusFilter, yearFilter, showArchived, showHistorical]);

  // All offers are now unfiled (folder structure disabled)
  const sortedOffers = useMemo(() => {
    return sortOffers(filteredOffers);
  }, [filteredOffers, sortBy, sortOrder]);

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

  return (
    <div className="space-y-4">
      {/* Filters */}
      {!showArchived && (
        <div className="flex flex-wrap gap-4 items-center justify-between w-full">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{t('Status')}:</span>
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
                className={statusFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                {t('All')}
              </Button>
              {Object.entries({
                draft: 'Created',
                sent: 'Offered',
                confirmed: 'Confirmed',
                rejected: 'Lost'
              }).map(([value, label]) => (
                <Button
                  key={value}
                  variant={statusFilter === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(value)}
                  className={statusFilter === value ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                >
                  {t(label)}
                </Button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">{t('Year')}:</span>
            <div className="flex gap-2">
              <Button
                variant={yearFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setYearFilter('all')}
                className={yearFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
              >
                {t('All')}
              </Button>
              {availableYears.map((year) => (
                <Button
                  key={year}
                  variant={yearFilter === year.toString() ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setYearFilter(year.toString())}
                  className={yearFilter === year.toString() ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                >
                  {year}
                </Button>
              ))}
            </div>
          </div>
          </div>
          
          <Button
            variant={showHistorical ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHistorical(!showHistorical)}
            className={showHistorical ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}
          >
            {showHistorical ? 'Verberg historische offertes' : 'Toon historische offertes'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-1">{t('No offers match your filters')}</h3>
          <p className="text-gray-500 mb-4">{showArchived ? t('No archived offers') : t('Try adjusting your search or create a new offer.')}</p>
          {!showArchived && (
            <Link to={createPageUrl("OfferEditor")}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                {t('Create Offer')}
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-32">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('showdate')} className="font-semibold h-8 px-2">
                    Showdatum
                    <SortIcon column="showdate" />
                  </Button>
                </TableHead>
                <TableHead className="w-40">
                  <Button variant="ghost" size="sm" onClick={() => handleSort('updated_date')} className="font-semibold h-8 px-2">
                    Laatst aangepast
                    <SortIcon column="updated_date" />
                  </Button>
                </TableHead>
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
                <TableHead className="w-48">
                  <span className="font-semibold px-2">{t('Tags')}</span>
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
                <TableHead className="w-32 text-center">
                  <div className="font-semibold text-xs px-2">{t('Actions')}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOffers.map(offer => (
                <DraggableOfferRow
                  key={offer.id}
                  offer={offer}
                  clients={clients}
                  products={products}
                  categorySettings={categorySettings}
                  projectOfferMap={projectOfferMap}
                  onDataChange={onDataChange}
                  onUpdateOffer={onUpdateOffer}
                  onRemoveOffer={onRemoveOffer}
                  showArchived={showArchived}
                  allTags={allTags}
                  isInFolder={false}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}


    </div>
  );
}