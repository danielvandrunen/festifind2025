
import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, getISOWeek, subDays, formatDistanceToNow } from "date-fns";
import { Edit, Eye, Trash2, CheckCircle, Plus, Copy, RotateCcw, ArrowUpDown, ArrowUp, ArrowDown, Tags, X, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Offer, Project } from "@/api/entities";
import { defaultTasks } from "../projects/ProjectForm";
import { useLocalization } from "../../components/Localization";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const statusColors = {
  draft: "bg-gray-100 text-gray-800 border-gray-300",
  sent: "bg-blue-100 text-blue-800 border-blue-300",
  under_review: "bg-yellow-100 text-yellow-800 border-yellow-300",
  confirmed: "bg-green-100 text-green-800 border-green-300",
  rejected: "bg-red-100 text-red-800 border-red-300",
  expired: "bg-gray-200 text-gray-600 border-gray-400",
  archived: "bg-gray-100 text-gray-500 border-gray-200"
};

// Generate consistent colors for tags
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
  
  // Generate consistent hash from tag string
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

// Shared function to calculate revenue and profit for a single post-calc line
const calculateLineMetrics = (line, product, offer) => {
    if (!product) return { revenue: 0, profit: 0 };

    const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
    const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;
    const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);

    const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
    const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
    const euroSpendPerPerson = offer.euro_spend_per_person || 0;
    
    // For transaction processing: ALWAYS use sum of showdates
    const transactionProcessingRevenue = totalVisitorsFromShowdates * euroSpendPerPerson;
    
    // For ticketing: use override if set, otherwise sum of showdates
    const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
        ? offer.total_visitors_override
        : totalVisitorsFromShowdates;

    let revenue = 0;
    let cost = 0;
    let profit = 0;

    // Check if this is a percentage-based product
    if (product.unit_type === 'percentage_of_revenue') {
        let baseValue = 0;
        const isTransactionProduct = product.category === 'transaction_processing';

        // Calculate base value from key figure
        if (product.key_figure && product.key_figure !== 'none') {
            switch (product.key_figure) {
                case 'total_visitors':
                    baseValue = isTransactionProduct ? totalVisitorsFromShowdates : ticketingVisitors;
                    break;
                case 'bar_meters':
                    baseValue = offer.bar_meters || 0;
                    break;
                case 'food_sales_positions':
                    baseValue = offer.food_sales_positions || 0;
                    break;
                case 'euro_spend_per_person':
                    baseValue = euroSpendPerPerson;
                    break;
                case 'number_of_showdates':
                    baseValue = offer.showdates?.length || 0;
                    break;
                case 'expected_revenue':
                    baseValue = isTransactionProduct ? transactionProcessingRevenue : (ticketingVisitors * euroSpendPerPerson);
                    break;
                default:
                    baseValue = 0; // Fallback for unknown key figures
            }
        }
        
        const multipliedValue = baseValue * (product.key_figure_multiplier || 1);
        revenue = multipliedValue * (percentageFee / 100);
        cost = multipliedValue * (percentageCostBasis / 100);
        profit = revenue - cost;
    } else {
        // Unit-based calculation
        let forecastQuantity = 0;

        if (product.key_figure && product.key_figure !== 'none') {
            let baseValue = 0;
            const isTransactionProduct = product.category === 'transaction_processing';
            
            switch (product.key_figure) {
                case 'total_visitors':
                    baseValue = isTransactionProduct ? totalVisitorsFromShowdates : ticketingVisitors;
                    break;
                case 'bar_meters':
                    baseValue = offer.bar_meters || 0;
                    break;
                case 'food_sales_positions':
                    baseValue = offer.food_sales_positions || 0;
                    break;
                case 'euro_spend_per_person':
                    baseValue = euroSpendPerPerson;
                    break;
                case 'number_of_showdates':
                    baseValue = offer.showdates?.length || 0;
                    break;
                case 'expected_revenue':
                    baseValue = isTransactionProduct ? transactionProcessingRevenue : (ticketingVisitors * euroSpendPerPerson);
                    break;
                default:
                    baseValue = 0; // Fallback for unknown key figures
            }
            forecastQuantity = Math.round(baseValue * (product.key_figure_multiplier || 0));
        } else {
            forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
        }

        revenue = forecastQuantity * unitPrice;
        cost = forecastQuantity * (product.cost_basis || 0);
        profit = revenue - cost;
    }
    
    return { revenue, profit };
};


export default function OfferList({ offers, clients, projects, products, categorySettings, isLoading, onDataChange, onUpdateOffer, onRemoveOffer, showArchived = false, allTags = [] }) {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [isCreating, setIsCreating] = useState(null);
  const [isDuplicating, setIsDuplicating] = useState(null);
  const [isRestoring, setIsRestoring] = useState(null);
  const [sortBy, setSortBy] = useState('updated_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [tagPopoverOpen, setTagPopoverOpen] = useState({});
  const [tagInputValue, setTagInputValue] = useState('');

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
  
  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.company_name || t("Unknown Client");
  };

  const calculateOfferBreakdown = (offer) => {
    if (!offer.offer_lines || !Array.isArray(offer.offer_lines) || !products || !categorySettings) {
      return {
        standardRevenue: 0,
        standardProfit: 0,
        postCalcRevenue: 0,
        postCalcProfit: 0,
        totalRevenue: 0,
        totalProfit: 0,
        realizationCorrection: 0,
        realizationCosts: {},
        budgetByCategory: {},
        additionalCosts: 0,
        additionalCostsBreakdown: {},
        netProfit: 0
      };
    }
    
    let standardRevenue = 0;
    let standardProfit = 0;
    let postCalcRevenue = 0; // Initialize postCalcRevenue here
    let postCalcProfit = 0; // Initialize postCalcProfit here
    
    // Calculate standard items
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isStandardSection = !setting || setting.calculation_type !== 'post_event';
      
      if (isStandardSection && line.quantity > 0) {
        const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
        const effectiveQuantity = line.quantity * staffelMultiplier;
        const revenue = effectiveQuantity * (line.unit_price || 0);
        const cost = effectiveQuantity * (product.cost_basis || 0);
        standardRevenue += revenue;
        standardProfit += (revenue - cost);
      }
    });
    
    // Calculate post-calc items
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isPostCalcSection = setting?.calculation_type === 'post_event';
      
      if (isPostCalcSection) {
        const { revenue, profit } = calculateLineMetrics(line, product, offer);
        postCalcRevenue += revenue;
        postCalcProfit += profit;
      }
    });

    // Calculate realization corrections
    const realizationCosts = offer.realization_costs || {};
    const budgetByCategory = {};
    
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isStandardSection = !setting || setting.calculation_type !== 'post_event';
      
      if (isStandardSection && line.quantity > 0) {
        if (!budgetByCategory[product.category]) {
          budgetByCategory[product.category] = 0;
        }
        const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
        budgetByCategory[product.category] += (line.quantity * staffelMultiplier) * (product.cost_basis || 0);
      }
    });

    let totalRealizationCorrection = 0;
    Object.entries(realizationCosts).forEach(([category, realizationCost]) => {
      if (realizationCost !== 0) {
        const offerBudget = budgetByCategory[category] || 0;
        totalRealizationCorrection += (offerBudget - realizationCost);
      }
    });

    // Calculate additional costs
    const additionalCosts = offer.additional_costs || {};
    const totalAdditionalCosts = Object.values(additionalCosts).reduce((sum, cost) => sum + (cost || 0), 0);

    const baseProfit = standardProfit + postCalcProfit;
    const netProfit = baseProfit + totalRealizationCorrection - totalAdditionalCosts;
    
    return {
      standardRevenue,
      standardProfit,
      postCalcRevenue,
      postCalcProfit,
      totalRevenue: standardRevenue + postCalcRevenue,
      totalProfit: baseProfit,
      realizationCorrection: totalRealizationCorrection,
      realizationCosts: realizationCosts,
      budgetByCategory: budgetByCategory,
      additionalCosts: totalAdditionalCosts,
      additionalCostsBreakdown: additionalCosts,
      netProfit: netProfit
    };
  };

  const calculateDetailedBreakdown = (offer) => {
    if (!offer.offer_lines || !Array.isArray(offer.offer_lines) || !products || !categorySettings) {
      return { standardByCategory: {}, postCalcByCategory: {} };
    }
    
    const standardByCategory = {};
    const postCalcByCategory = {};
    
    // Calculate standard items by category
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isStandardSection = !setting || setting.calculation_type !== 'post_event';
      
      if (isStandardSection && line.quantity > 0) {
        const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
        const effectiveQuantity = line.quantity * staffelMultiplier;
        const revenue = effectiveQuantity * (line.unit_price || 0);
        const cost = effectiveQuantity * (product.cost_basis || 0);
        const profit = revenue - cost;
        
        // Only add if there's revenue or profit
        if (revenue !== 0 || profit !== 0) {
          if (!standardByCategory[product.category]) {
            standardByCategory[product.category] = { revenue: 0, profit: 0 };
          }
          standardByCategory[product.category].revenue += revenue;
          standardByCategory[product.category].profit += profit;
        }
      }
    });
    
    // Calculate post-calc items by category
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isPostCalcSection = setting?.calculation_type === 'post_event';
      
      if (isPostCalcSection) {
        const { revenue, profit } = calculateLineMetrics(line, product, offer);
          
        // Only add if there's revenue or profit
        if (revenue !== 0 || profit !== 0) {
          if (!postCalcByCategory[product.category]) {
            postCalcByCategory[product.category] = { revenue: 0, profit: 0 };
          }
          postCalcByCategory[product.category].revenue += revenue;
          postCalcByCategory[product.category].profit += profit;
        }
      }
    });
    
    return { standardByCategory, postCalcByCategory };
  };

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

  // Filter offers by status and year
  const filteredOffers = useMemo(() => {
    let filtered = [...offers];
    
    // Apply status filter
    // Only apply if not showing archived, otherwise the parent component should have already filtered
    if (!showArchived && statusFilter !== 'all') {
      filtered = filtered.filter(offer => {
        const isSigned = !!offer.signed_date;
        const effectiveStatus = isSigned ? 'confirmed' : offer.status;
        return effectiveStatus === statusFilter;
      });
    }
    
    // Apply year filter
    // Only apply if not showing archived
    if (!showArchived && yearFilter !== 'all') {
      filtered = filtered.filter(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return false;
        const year = new Date(offer.showdates[0]).getFullYear();
        return year === parseInt(yearFilter);
      });
    }
    
    return filtered;
  }, [offers, statusFilter, yearFilter, showArchived]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const sortedOffers = useMemo(() => {
    const sorted = [...filteredOffers];
    
    sorted.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'offer_number':
          aValue = a.offer_number?.toLowerCase() || '';
          bValue = b.offer_number?.toLowerCase() || '';
          break;
        case 'project_name':
          aValue = a.project_name?.toLowerCase() || '';
          bValue = b.project_name?.toLowerCase() || '';
          break;
        case 'client':
          aValue = getClientName(a.client_id).toLowerCase();
          bValue = getClientName(b.client_id).toLowerCase();
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
        case 'updated_date': // Kept for filter UI purposes, though not a table column anymore
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
  }, [filteredOffers, sortBy, sortOrder, clients, products, categorySettings]);

  const handleCreateProject = async (offer) => {
    setIsCreating(offer.id);
    try {
      // Calculate hardware summary
      const hardwareSummary = {};
      (offer.offer_lines || []).forEach(line => {
        const product = products.find(p => p.id === line.product_id);
        if (product && product.hardware_group && product.hardware_group !== 'none') {
          if (!hardwareSummary[product.hardware_group]) {
            hardwareSummary[product.hardware_group] = 0;
          }
          hardwareSummary[product.hardware_group] += line.quantity || 0;
        }
      });

      // Calculate estimated profit
      const estimatedProfit = calculateOfferBreakdown(offer).netProfit; // Use netProfit for project creation

      // Set setup date as day before first showdate
      const setupDate = offer.showdates && offer.showdates.length > 0
        ? format(subDays(new Date(offer.showdates[0]), 1), 'yyyy-MM-dd')
        : null;

      const newProject = await Project.create({
        offer_id: offer.id,
        client_id: offer.client_id,
        project_name: offer.project_name,
        project_location: offer.project_location,
        start_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[0] : offer.project_start_date,
        end_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[offer.showdates.length - 1] : offer.project_end_date,
        setup_date: setupDate,
        showdates: offer.showdates || [],
        expected_attendance: offer.expected_attendance,
        confirmed_revenue: offer.subtotal_excl_btw,
        estimated_profit: estimatedProfit,
        hardware_summary: hardwareSummary,
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
      setIsCreating(null);
    }
  };
  
  const handleStatusChange = async (offer, newStatus) => {
    try {
        if (isCreating === offer.id) return;

        // Optimistically update the UI
        if (onUpdateOffer) {
          onUpdateOffer(offer.id, { status: newStatus, updated_date: new Date().toISOString() });
        }

        await Offer.update(offer.id, { status: newStatus });
        toast.success(t("Offer status updated."));

        const hasProject = projectOfferMap.has(offer.id);

        if (newStatus === 'confirmed' && !hasProject) {
            await handleCreateProject(offer);
        }
        // No longer calling onDataChange() here for status changes
    } catch (error) {
        toast.error(t("Failed to update status."));
        console.error(error);
        // Revert on error
        if (onDataChange) {
          onDataChange();
        }
    }
  };
  
  const handleArchive = async (offerId) => {
    try {
        // Optimistically remove from UI
        if (onRemoveOffer) {
          onRemoveOffer(offerId);
        }

        await Offer.update(offerId, { status: 'archived' });
        toast.success(t("Offer archived."));
    } catch (error) {
        toast.error(t("Failed to archive offer."));
        console.error(error);
        // Reload on error
        if (onDataChange) {
          onDataChange();
        }
    }
  };

  const handleRestore = async (offerId) => {
    setIsRestoring(offerId);
    try {
        await Offer.update(offerId, { status: 'draft' });
        toast.success(t("Offer restored to draft."));
        // Only reload for restore since we need to move between archived/active views
        onDataChange();
    } catch (error) {
        toast.error(t("Failed to restore offer."));
        console.error(error);
    } finally {
        setIsRestoring(null);
    }
  };

  const handleDuplicate = async (offer) => {
    setIsDuplicating(offer.id);
    try {
      const duplicateData = {
        ...offer,
        project_name: `${offer.project_name} (copy)`,
        offer_number: `DRAFT-${Math.floor(Date.now() / 1000)}`, // Generate a unique draft offer number
        version: 1,
        status: 'draft',
        signed_by_name: undefined, // Clear signature fields
        signed_date: undefined,
        signature_data_url: undefined,
      };
      
      // Remove fields that should not be copied when creating a new record
      delete duplicateData.id;
      delete duplicateData.created_date;
      delete duplicateData.updated_date;
      delete duplicateData.created_by;
      delete duplicateData.last_client_view; // Clear client view data

      const newOffer = await Offer.create(duplicateData);
      toast.success(t("Offer duplicated successfully!"));
      // Optionally navigate to the new offer's editor page
      navigate(createPageUrl(`OfferEditor?id=${newOffer.id}`));
    } catch (error) {
      console.error("Failed to duplicate offer:", error);
      toast.error(t("Failed to duplicate offer."));
    } finally {
      setIsDuplicating(null);
    }
  };

  const handleAddTag = async (offer, newTag) => {
    if (!newTag || !newTag.trim()) return;
    
    const trimmedTag = newTag.trim();
    const currentTags = offer.tags || [];
    
    // Don't add duplicate tags
    if (currentTags.includes(trimmedTag)) {
      toast.error("Tag already exists");
      return;
    }
    
    const updatedTags = [...currentTags, trimmedTag];
    
    try {
      // Optimistically update UI
      if (onUpdateOffer) {
        onUpdateOffer(offer.id, { tags: updatedTags });
      }
      
      await Offer.update(offer.id, { tags: updatedTags });
      setTagInputValue('');
      setTagPopoverOpen({ ...tagPopoverOpen, [offer.id]: false });
    } catch (error) {
      toast.error("Failed to add tag");
      console.error(error);
      // Revert on error
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const handleRemoveTag = async (offer, tagToRemove) => {
    const currentTags = offer.tags || [];
    const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
    
    try {
      // Optimistically update UI
      if (onUpdateOffer) {
        onUpdateOffer(offer.id, { tags: updatedTags });
      }
      
      await Offer.update(offer.id, { tags: updatedTags });
    } catch (error) {
      toast.error("Failed to remove tag");
      console.error(error);
      // Revert on error
      if (onDataChange) {
        onDataChange();
      }
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  return (
    <div className="space-y-4">
      {/* Filters - only show if not in archived view */}
      {!showArchived && (
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
          
          {(statusFilter !== 'all' || yearFilter !== 'all') && (
            <div className="text-sm text-gray-600 ml-auto">
              {t('Showing')} {sortedOffers.length} {t('of')} {offers.length} {t('offers')}
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : sortedOffers.length === 0 ? (
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
                  <Button variant="ghost" size="sm" onClick={() => handleSort('offer_number')} className="font-semibold h-8 px-2">
                    {t('Offer #')}
                    <SortIcon column="offer_number" />
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
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleSort('created_date')} className="font-semibold h-8 px-2">
                    {t('Created')}
                    <SortIcon column="created_date" />
                  </Button>
                </TableHead>
                
                {/* NEW: Last Viewed column */}
                <TableHead className="w-48">
                  <span className="font-semibold px-2 text-xs">Last Viewed</span>
                </TableHead>
                
                <TableHead className="w-32 text-center">
                  <div className="font-semibold text-xs px-2">{t('Actions')}</div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedOffers.map((offer) => {
                const isSigned = !!offer.signed_date;
                const effectiveStatus = isSigned ? 'confirmed' : offer.status;
                const hasProject = projectOfferMap.has(offer.id);
                const offerTags = offer.tags || [];
                const lastClientView = offer.last_client_view;

                return (
                  <TableRow key={offer.id} className="hover:bg-gray-50">
                    <TableCell className="font-mono text-xs text-gray-600">
                      {offer.offer_number}
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
                              onClick={() => handleRemoveTag(offer, tag)}
                              className="hover:bg-black/10 rounded-full p-0.5"
                              aria-label={`Remove tag ${tag}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        <Popover 
                          open={tagPopoverOpen[offer.id]} 
                          onOpenChange={(open) => setTagPopoverOpen({ ...tagPopoverOpen, [offer.id]: open })}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 hover:bg-blue-50"
                              title={t('Add/manage tags')}
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
                                    if (e.key === 'Enter') {
                                      handleAddTag(offer, tagInputValue);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <Button 
                                  size="sm" 
                                  onClick={() => handleAddTag(offer, tagInputValue)}
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
                                          onClick={() => handleAddTag(offer, tag)}
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
                              {effectiveStatus === 'under_review' ? t('Under Review') : t(effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1))}
                            </Badge>
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6 p-0 text-gray-400 hover:text-orange-600 hover:bg-orange-50"
                                  title={t('Reset to Draft')}
                                >
                                  <RotateCcw className="w-3 h-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('Reset Signed Offer?')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('This will remove the signature and reset the offer to draft status. The associated project will remain unchanged.')}
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
                                        console.error('Failed to reset offer:', error);
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
                          <Select value={effectiveStatus} onValueChange={(val) => handleStatusChange(offer, val)}>
                            <SelectTrigger className={`h-8 w-32 border ${statusColors[effectiveStatus]}`}>
                              <SelectValue>
                                <Badge className={`h-auto px-2 py-0.5 text-xs rounded-md ${statusColors[effectiveStatus]} border-transparent`}>
                                  {effectiveStatus === 'under_review' ? t('Under Review') : t(effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1))}
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
                        )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">
                          €{(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">{t('incl. BTW')}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      <div>{format(new Date(offer.created_date), 'dd MMM yyyy')}</div>
                      <div className="text-xs text-gray-400">
                        {t('Updated')}: {format(new Date(offer.updated_date), 'dd MMM yyyy')}
                      </div>
                    </TableCell>
                    
                    {/* NEW: Last Viewed cell */}
                    <TableCell>
                      {lastClientView ? (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-purple-500 mt-0.5 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-gray-900 truncate" title={lastClientView.location}>
                              {lastClientView.location}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(lastClientView.timestamp), { addSuffix: true })}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400 italic">Never viewed</div>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        {showArchived ? (
                          <>
                            <Link to={createPageUrl(`OfferReview?id=${offer.id}`)} target="_blank">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('View Offer')}>
                                <Eye className="w-3 h-3"/>
                              </Button>
                            </Link>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                              onClick={() => handleRestore(offer.id)}
                              disabled={isRestoring === offer.id}
                              title={t('Restore to Draft')}
                            >
                              <RotateCcw className="w-3 h-3"/>
                            </Button>
                          </>
                        ) : (
                          <>
                            <Link to={createPageUrl(`OfferEditor?id=${offer.id}`)}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('Edit Offer')}>
                                <Edit className="w-3 h-3"/>
                              </Button>
                            </Link>
                            <Link to={createPageUrl(`OfferReview?id=${offer.id}`)} target="_blank">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title={t('View Offer')}>
                                <Eye className="w-3 h-3"/>
                              </Button>
                            </Link>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              onClick={() => handleDuplicate(offer)}
                              disabled={isDuplicating === offer.id}
                              title={t('Duplicate Offer')}
                            >
                              <Copy className="w-3 h-3"/>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600" title={t('Archive Offer')}>
                                  <Trash2 className="w-3 h-3"/>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t('This will archive the offer and remove it from the main list. You can view archived offers later.')}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleArchive(offer.id)} className="bg-red-600 hover:bg-red-700">{t('Archive')}</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
