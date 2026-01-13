import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Gauge, Users, Store, Utensils, Euro, TrendingUp, CalendarIcon, Plus, Ticket, DollarSign, Activity, Edit2, Building2, Briefcase, PlusCircle, Eye, MapPin, Copy, Clock, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { format, setMonth, setYear, getMonth, getYear } from "date-fns";
import { formatDistanceToNow } from "date-fns";
import { useLocalization } from '../../Localization';
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function EventCockpit({ offer, products, categorySettings, onDetailsChange, clients, onAddNewClient, isReview = false, versions = [], onShowVersionHistory }) {
  const { t } = useLocalization();
  const [allOffers, setAllOffers] = useState([]);
  const [selectedSourceOfferId, setSelectedSourceOfferId] = useState('');
  const [isLoadingOffers, setIsLoadingOffers] = useState(false);
  const [showCopyConfirm, setShowCopyConfirm] = useState(false);
  const [offerSearchTerm, setOfferSearchTerm] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Sort clients alphabetically by company name
  const sortedClients = useMemo(() => {
    if (!clients) return [];
    return [...clients].sort((a, b) =>
      (a.company_name || '').localeCompare(b.company_name || '')
    );
  }, [clients]);

  // Filter offers by search term
  const filteredOffers = useMemo(() => {
    if (!offerSearchTerm) return allOffers;
    const term = offerSearchTerm.toLowerCase();
    return allOffers.filter(o => 
      o.project_name?.toLowerCase().includes(term) ||
      o.offer_number?.toLowerCase().includes(term)
    );
  }, [allOffers, offerSearchTerm]);

  // These can be safely derived at the top level using optional chaining and default values
  const showdates = offer?.showdates || [];
  const visitorsPerShowdate = offer?.expected_visitors_per_showdate || {};

  // Calculate total profit with all corrections (only used internally, never shown to clients)
  // This useMemo is a hook and stays at the top. Its internal logic handles 'isReview' and '!offer'.
  const totalProfit = useMemo(() => {
    if (!offer || isReview) return {
      standard: 0,
      standardRevenue: 0,
      postCalc: 0,
      postCalcRevenue: 0,
      realizationCorrection: 0,
      additionalCosts: 0,
      total: 0
    };

    let standardProfit = 0;
    let standardRevenue = 0;

    (Array.isArray(offer.offer_lines) ? offer.offer_lines : []).forEach(line => {
      const product = products?.find(p => p.id === line.product_id);
      if (!product) return;

      const setting = categorySettings?.find(s => s.category === product.category);
      const isStandardSection = !setting || setting.calculation_type !== 'post_event';

      if (isStandardSection && line.quantity > 0) {
        const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
        const effectiveQuantity = line.quantity * staffelMultiplier;
        const revenue = effectiveQuantity * (line.unit_price || 0); // Added default to unit_price
        const cost = effectiveQuantity * (product.cost_basis || 0);
        const profit = revenue - cost;

        standardProfit += profit;
        standardRevenue += revenue;
      }
    });

    let postCalcProfit = 0;
    let postCalcRevenue = 0;

    (Array.isArray(offer.offer_lines) ? offer.offer_lines : []).forEach(line => {
      const product = products?.find(p => p.id === line.product_id);
      if (!product) return;

      const setting = categorySettings?.find(s => s.category === product.category);
      const isPostCalcSection = setting?.calculation_type === 'post_event';

      if (isPostCalcSection) {
        const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
        const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;

        const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
        const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
        const euroSpendPerPerson = offer.euro_spend_per_person || 0;

        const transactionProcessingRevenue = totalVisitorsFromShowdates * euroSpendPerPerson;
        const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
            ? offer.total_visitors_override
            : totalVisitorsFromShowdates;

        if (product.unit_type === 'percentage_of_revenue' && (percentageFee > 0 || percentageCostBasis > 0)) {
          let baseValue = 0;
          const isTransactionProduct = product.category === 'transaction_processing';

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
                baseValue = 0;
            }
          }

          const multipliedValue = baseValue * (product.key_figure_multiplier || 1);
          const revenue = multipliedValue * (percentageFee / 100);
          const cost = multipliedValue * (percentageCostBasis / 100);

          postCalcRevenue += revenue;
          postCalcProfit += (revenue - cost);
        } else {
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
                baseValue = 0;
            }
            forecastQuantity = Math.round(baseValue * (product.key_figure_multiplier || 0));
          } else {
            forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
          }

          if (forecastQuantity > 0) {
            const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);
            const revenue = forecastQuantity * unitPrice;
            const cost = forecastQuantity * (product.cost_basis || 0);

            postCalcRevenue += revenue;
            postCalcProfit += (revenue - cost);
          }
        }
      }
    });

    // Calculate realization corrections
    let totalRealizationCorrection = 0;
    const realizationCosts = offer.realization_costs || {};
    const budgetByCategory = {};

    (offer.offer_lines || []).forEach(line => {
      const product = products?.find(p => p.id === line.product_id);
      if (!product) return;

      const setting = categorySettings?.find(s => s.category === product.category);
      const isPostCalc = setting?.calculation_type === 'post_event';

      if (!isPostCalc && line.quantity > 0) {
        if (!budgetByCategory[product.category]) {
          budgetByCategory[product.category] = 0;
        }
        const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
        budgetByCategory[product.category] += (line.quantity * staffelMultiplier) * (product.cost_basis || 0);
      }
    });

    Object.entries(realizationCosts).forEach(([category, realizationCost]) => {
      if (realizationCost > 0) {
        const offerBudget = budgetByCategory[category] || 0;
        totalRealizationCorrection += (offerBudget - realizationCost);
      }
    });

    // Calculate total additional costs
    const additionalCosts = offer.additional_costs || {};
    const totalAdditionalCosts = Object.values(additionalCosts).reduce((sum, cost) => sum + (cost || 0), 0);

    const totalProfitCalculated = standardProfit + postCalcProfit + totalRealizationCorrection - totalAdditionalCosts;

    return {
      standard: standardProfit,
      standardRevenue: standardRevenue,
      postCalc: postCalcProfit,
      postCalcRevenue: postCalcRevenue,
      realizationCorrection: totalRealizationCorrection,
      realizationCosts: realizationCosts,
      budgetByCategory: budgetByCategory,
      additionalCosts: totalAdditionalCosts,
      additionalCostsBreakdown: additionalCosts,
      total: totalProfitCalculated,
    };
  }, [offer, products, categorySettings, isReview]); // Kept isReview in dependencies for correctness

  // Calculate actual platform cost based on transaction_processing product in offer lines
  const { actualPlatformCost, actualPlatformCostPercentage } = useMemo(() => {
    if (!offer || !products) return { actualPlatformCost: 0, actualPlatformCostPercentage: 0 };

    const currentVisitorsPerShowdate = offer.expected_visitors_per_showdate || {};
    const currentTotalVisitorsFromShowdates = Object.values(currentVisitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
    const currentEuroSpendPerPerson = offer.euro_spend_per_person || 0;
    const currentExpectedRevenue = currentTotalVisitorsFromShowdates * currentEuroSpendPerPerson;

    let platformCostPercentage = 0;
    // Find the transaction processing product in offer lines
    // We assume there's at most one such product for platform cost calculation display
    for (const line of (offer.offer_lines || [])) {
      const product = products.find(p => p.id === line.product_id);
      if (product?.category === 'transaction_processing' && product.unit_type === 'percentage_of_revenue') {
        platformCostPercentage = line.percentage_fee !== undefined ? line.percentage_fee : (product.percentage_fee || 0);
        break; // Found it, no need to continue
      }
    }

    const cost = currentExpectedRevenue * (platformCostPercentage / 100);
    return { actualPlatformCost: cost, actualPlatformCostPercentage: platformCostPercentage };
  }, [offer, products]);

  // Get client view history (last 10)
  const clientViewHistory = useMemo(() => {
    if (!offer || !offer.view_history || !Array.isArray(offer.view_history)) return [];
    return offer.view_history
      .filter(view => view.is_client_view)
      .slice(0, 10);
  }, [offer]);

  // Load all offers for the dropdown
  React.useEffect(() => {
    if (!isReview) {
      const loadOffers = async () => {
        setIsLoadingOffers(true);
        try {
          const offers = await base44.entities.Offer.list('-created_date');
          setAllOffers(offers.filter(o => o.status !== 'archived' && o.id !== offer?.id) || []);
        } catch (error) {
          console.error('Failed to load offers:', error);
        } finally {
          setIsLoadingOffers(false);
        }
      };
      loadOffers();
    }
  }, [isReview, offer?.id]);

  const handleCopyPostCalcPricing = async () => {
    if (!selectedSourceOfferId) return;
    
    const sourceOffer = allOffers.find(o => o.id === selectedSourceOfferId);
    if (!sourceOffer) {
      toast.error('Source offer not found');
      return;
    }

    // Get post-calc product IDs from category settings
    const postCalcCategories = (categorySettings || [])
      .filter(s => s.calculation_type === 'post_event')
      .map(s => s.category);
    
    const postCalcProductIds = new Set(
      (products || [])
        .filter(p => postCalcCategories.includes(p.category))
        .map(p => p.id)
    );

    // Copy only pricing fields for post-calc items
    const updatedLines = (offer.offer_lines || []).map(line => {
      if (!postCalcProductIds.has(line.product_id)) {
        return line; // Keep non-post-calc items unchanged
      }

      const sourceLine = (sourceOffer.offer_lines || []).find(sl => sl.product_id === line.product_id);
      if (!sourceLine) {
        return line; // No matching line in source, keep current
      }

      // Only copy pricing fields, NOT quantities
      return {
        ...line,
        unit_price: sourceLine.unit_price,
        percentage_fee: sourceLine.percentage_fee,
        percentage_cost_basis: sourceLine.percentage_cost_basis
      };
    });

    onDetailsChange('offer_lines', updatedLines);
    setShowCopyConfirm(false);
    setSelectedSourceOfferId('');
    toast.success(`Post-calculation pricing copied from ${sourceOffer.project_name}`);
  };

  // Early return if offer is null. All calculations below this point can assume 'offer' is defined.
  if (!offer) return null;

  const handleVisitorChange = (date, value) => {
    const numValue = parseInt(value, 10) || 0;
    const updated = { ...visitorsPerShowdate, [date]: numValue };
    onDetailsChange('expected_visitors_per_showdate', updated);
  };

  const handleShowdatesChange = (dates) => {
    const dateStrings = dates ? dates.map(date => format(date, 'yyyy-MM-dd')) : [];
    onDetailsChange('showdates', dateStrings);
  };

  // Derived variables that depend on 'offer' and are used in rendering, placed after early return
  const selectedDates = showdates.map(date => new Date(date));
  const totalExpectedVisitors = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);

  // Calculate expected revenue for display
  const expectedRevenue = totalExpectedVisitors * (offer.euro_spend_per_person || 0);

  return (
    <Card className="border shadow-sm bg-white">
      <CardHeader className="pb-2 pt-3 px-4 bg-gray-50 border-b">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <Gauge className="w-4 h-4 text-blue-600" />
          {t('Event Cockpit')}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 pt-3">
        {!isReview && (
          <div className="mb-6 pb-4 border-b border-gray-200 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4" />
                  {t('Client')} *
                </Label>
                <div className="flex items-center gap-2">
                  <Select
                    value={offer.client_id || ""}
                    onValueChange={(val) => onDetailsChange('client_id', val)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t("Select Client")} />
                    </SelectTrigger>
                    <SelectContent>
                      {sortedClients.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={onAddNewClient} className="group h-9 w-9">
                    <PlusCircle className="w-4 h-4 text-gray-400 group-hover:text-blue-600 transition-colors"/>
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4" />
                  {t('Project Name')} *
                </Label>
                <Input
                  value={offer.project_name || ''}
                  onChange={(e) => onDetailsChange('project_name', e.target.value)}
                  placeholder={t("Enter project name")}
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4" />
                  {t('Location')}
                </Label>
                <Input
                  value={offer.project_location || ''}
                  onChange={(e) => onDetailsChange('project_location', e.target.value)}
                  placeholder={t("Enter project location")}
                  className="h-9 text-sm"
                />
              </div>

              {offer?.id && (
                <div>
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4" />
                    {t('Version')}
                  </Label>
                  <Button 
                    variant="outline" 
                    onClick={onShowVersionHistory}
                    className="h-9 w-full gap-2 text-sm"
                  >
                    <Clock className="w-4 h-4" />
                    {t('View History')} ({versions.length})
                  </Button>
                </div>
              )}
            </div>

            {/* Copy Post-Calc Pricing Tool */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <Copy className="w-4 h-4" />
                Copy Post-Calculation Pricing
              </Label>
              <p className="text-xs text-gray-600 mb-3">
                Copy pricing (not quantities) from another offer's post-calculation items
              </p>
              <div className="flex items-center gap-2">
                <Select
                  value={selectedSourceOfferId}
                  onValueChange={(val) => {
                    setSelectedSourceOfferId(val);
                    setOfferSearchTerm('');
                  }}
                  disabled={isLoadingOffers}
                >
                  <SelectTrigger className="h-9 text-sm flex-1">
                    <SelectValue placeholder={isLoadingOffers ? "Loading offers..." : "Select source offer..."} />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-2 sticky top-0 bg-white border-b">
                      <Input
                        placeholder="Search offers..."
                        value={offerSearchTerm}
                        onChange={(e) => setOfferSearchTerm(e.target.value)}
                        className="h-8 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <div className="max-h-[300px] overflow-y-auto">
                      {filteredOffers.length === 0 ? (
                        <div className="px-2 py-4 text-sm text-gray-500 text-center">
                          No offers found
                        </div>
                      ) : (
                        filteredOffers.map(o => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.project_name} - {o.offer_number}
                          </SelectItem>
                        ))
                      )}
                    </div>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCopyConfirm(true)}
                  disabled={!selectedSourceOfferId}
                  className="h-9"
                >
                  <Copy className="w-4 h-4 mr-1" />
                  Copy
                </Button>
              </div>
            </div>

            {/* Sales -> Operations Handoff */}
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                Sales → Operations Handoff
              </Label>
              <p className="text-xs text-gray-600 mb-3">
                Detailed briefing from Sales to the Project Manager
              </p>
              <div style={{ height: '400px' }}>
                <ReactQuill
                  value={offer.sales_handoff_notes || ''}
                  onChange={(content) => onDetailsChange('sales_handoff_notes', content)}
                  className="bg-white rounded border border-gray-300"
                  theme="snow"
                  style={{ height: '350px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['clean']
                    ]
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showCopyConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Copy</h3>
              <p className="text-sm text-gray-600 mb-4">
                This will replace all post-calculation pricing (unit prices, percentage fees, cost basis) with values from the selected offer. Quantities and forecasts will not be changed.
              </p>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowCopyConfirm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCopyPostCalcPricing} className="bg-blue-600 hover:bg-blue-700">
                  Confirm Copy
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW HISTORY SECTION - ONLY FOR INTERNAL USE, BETWEEN PROFIT AND INPUT FIELDS */}
        {!isReview && clientViewHistory.length > 0 && (
          <div className="mb-6 pb-4 border-b border-gray-200">
            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4 text-purple-600" />
                <h4 className="text-sm font-semibold text-gray-800">Client View History</h4>
                <Badge variant="outline" className="ml-auto text-xs bg-purple-100 text-purple-700 border-purple-300">
                  {clientViewHistory.length} {clientViewHistory.length === 1 ? 'view' : 'views'}
                </Badge>
              </div>
              
              <div className="space-y-2">
                {clientViewHistory.map((view, index) => (
                  <div 
                    key={index} 
                    className="flex items-center justify-between text-xs bg-white rounded p-2 border border-purple-100"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">{view.location}</div>
                        <div className="text-gray-500 text-[10px]">IP: {view.ip_masked}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-gray-600 font-medium">
                        {formatDistanceToNow(new Date(view.timestamp), { addSuffix: true })}
                      </div>
                      <div className="text-gray-400 text-[10px]">
                        {format(new Date(view.timestamp), 'dd MMM yyyy HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {offer.view_history && offer.view_history.length > 10 && (
                <div className="text-xs text-gray-500 text-center mt-2">
                  +{offer.view_history.length - 10} more views
                </div>
              )}
            </div>
          </div>
        )}

        {isReview ? (
          // COMPACT FORMAL DESIGN FOR CLIENTS
          <>
            <div className="grid grid-cols-[2fr_1fr] gap-4">
              {/* Left side: Event details in compact format */}
              <div className="space-y-3">
                {/* Showdates */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <CalendarIcon className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t('Showdates')}</span>
                  </div>
                  <div className="text-xs text-gray-800">
                    {selectedDates.length > 0
                      ? selectedDates.map(date => format(date, 'dd-MM-yyyy')).join(', ')
                      : t('N.A.')
                    }
                  </div>
                </div>

                {/* Visitors per showdate */}
                {showdates.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Users className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t('Expected Visitors per Showdate')}</span>
                    </div>
                    <div className="space-y-0.5">
                      {showdates.map(date => (
                        <div key={date} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{format(new Date(date), 'dd-MM-yyyy')}</span>
                          <span className="font-medium text-gray-800">{(visitorsPerShowdate[date] || 0).toLocaleString('nl-NL')}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-200">
                        <span className="font-semibold text-gray-700">{t('Total (auto)')}</span>
                        <span className="font-bold text-gray-900">{totalExpectedVisitors.toLocaleString('nl-NL')}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Other metrics in compact grid */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Store className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t('Bar Meters')}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-800">{offer.bar_meters || 0}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Utensils className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t('Food Sales Positions')}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-800">{offer.food_sales_positions || 0}</div>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Euro className="w-3.5 h-3.5 text-gray-500" />
                      <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{t('Euro Spend per Person')}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-800">€{(offer.euro_spend_per_person || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Right side: Financial overview */}
              <div className="bg-blue-50 rounded border border-blue-200 p-3 space-y-3">
                {/* Expected Revenue */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Euro className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{t('Expected Revenue')}</span>
                  </div>
                  <div className="text-lg font-bold text-blue-700">
                    €{expectedRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-gray-600 mt-1 space-y-0.5">
                    <div className="flex justify-between">
                      <span>{t('visitors')}</span>
                      <span className="font-medium">
                        {totalExpectedVisitors.toLocaleString('nl-NL')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>× €{(offer.euro_spend_per_person || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Expected Transactions */}
                <div className="pt-2 border-t border-blue-300">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{t('Expected Transactions')}</span>
                  </div>
                  <div className="text-base font-bold text-blue-700">
                    {(() => {
                      const avgTransaction = offer.average_transaction_value || 13;
                      return Math.round(expectedRevenue / avgTransaction).toLocaleString('nl-NL');
                    })()}
                  </div>
                  <div className="text-[9px] text-gray-500 mt-0.5">
                    {t('avg. festival transaction')}: €{(offer.average_transaction_value || 13).toFixed(2)}
                  </div>
                </div>

                {/* Expected Platform Cost */}
                {actualPlatformCost > 0 && (
                  <div className="pt-2 border-t border-blue-300">
                    <div className="flex items-center gap-1.5 mb-1">
                      <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                      <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{t('Expected Platform Cost')}</span>
                    </div>
                    <div className="text-base font-bold text-blue-700">
                      €{actualPlatformCost.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          // FULL INTERNAL EDITOR VIEW
          <div className="grid grid-cols-3 gap-6">
            {/* Left column: Showdates selector */}
            <div>
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                <CalendarIcon className="w-4 h-4" />
                {t('Showdates')}
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal h-8 mb-4">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDates.length > 0
                      ? `${selectedDates.length} ${selectedDates.length === 1 ? t('date') : t('dates')} ${t('selected')}`
                      : t('Select show dates')
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <div className="p-3 border-b bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCalendarMonth(new Date(getYear(calendarMonth) - 1, getMonth(calendarMonth)))}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="font-semibold text-sm">{getYear(calendarMonth)}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCalendarMonth(new Date(getYear(calendarMonth) + 1, getMonth(calendarMonth)))}
                        className="h-7 w-7 p-0"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                        <Button
                          key={month}
                          variant={getMonth(calendarMonth) === idx ? "default" : "ghost"}
                          size="sm"
                          onClick={() => setCalendarMonth(new Date(getYear(calendarMonth), idx))}
                          className="h-7 text-xs px-1"
                        >
                          {month}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={handleShowdatesChange}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                  />
                </PopoverContent>
              </Popover>

              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
                <Users className="w-4 h-4" />
                {t('Expected Visitors per Showdate')}
              </Label>
              <div className="space-y-2">
                {showdates.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">{t('No showdates selected yet')}</p>
                ) : (
                  <>
                    {showdates.map(date => (
                      <div key={date} className="flex items-center gap-2">
                        <span className="text-xs text-gray-600 w-24">
                          {format(new Date(date), 'dd-MM-yyyy')}
                        </span>
                        <Input
                          type="number"
                          value={visitorsPerShowdate[date] || ''}
                          onChange={(e) => handleVisitorChange(date, e.target.value)}
                          placeholder="0"
                          className="h-8 text-sm"
                          min="0"
                        />
                      </div>
                    ))}
                    {showdates.length > 0 && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-xs font-semibold text-gray-700 w-24">{t('Total (auto)')}</span>
                        <span className="text-sm font-bold">{totalExpectedVisitors.toLocaleString('nl-NL')}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Middle column: Other metrics */}
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Store className="w-4 h-4" />
                  {t('Bar Meters')}
                </Label>
                <Input
                  type="number"
                  value={offer.bar_meters || ''}
                  onChange={(e) => onDetailsChange('bar_meters', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="h-8 text-sm"
                  min="0"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Utensils className="w-4 h-4" />
                  {t('Food Sales Positions')}
                </Label>
                <Input
                  type="number"
                  value={offer.food_sales_positions || ''}
                  onChange={(e) => onDetailsChange('food_sales_positions', parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="h-8 text-sm"
                  min="0"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Euro className="w-4 h-4" />
                  {t('Euro Spend per Person')}
                </Label>
                <Input
                  type="number"
                  value={offer.euro_spend_per_person || ''}
                  onChange={(e) => onDetailsChange('euro_spend_per_person', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="h-8 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4" />
                  {t('Staffel')}
                </Label>
                <Input
                  type="number"
                  value={offer.staffel || 1}
                  onChange={(e) => onDetailsChange('staffel', parseFloat(e.target.value) || 1)}
                  placeholder="1.00"
                  className="h-8 text-sm"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <Label className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  {t('Total Visitors')}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={offer.total_visitors_override !== null && offer.total_visitors_override !== undefined ? offer.total_visitors_override : ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? null : parseFloat(e.target.value);
                      onDetailsChange('total_visitors_override', val);
                    }}
                    placeholder={totalExpectedVisitors.toString()}
                    className="h-8 text-sm"
                    min="0"
                  />
                  {(offer.total_visitors_override === null || offer.total_visitors_override === undefined) && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                      (auto: {totalExpectedVisitors.toLocaleString('nl-NL')})
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  {t('Leave empty to auto-calculate from showdates')}
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="ticketing-deal"
                  checked={offer.ticketing_deal || false}
                  onCheckedChange={(checked) => {
                    onDetailsChange('ticketing_deal', checked);
                  }}
                />
                <Label htmlFor="ticketing-deal" className="flex items-center gap-2 cursor-pointer">
                  <Ticket className="w-4 h-4 text-purple-600" />
                  <span className="font-medium">{t('Ticketing Deal')}</span>
                </Label>
                <span className="text-xs text-gray-500">
                  ({offer.ticketing_deal ? t('Yes') : t('No')})
                </span>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="is-ticketing-project"
                  checked={offer.is_ticketing_project || false}
                  onCheckedChange={(checked) => {
                    onDetailsChange('is_ticketing_project', checked);
                  }}
                />
                <Label htmlFor="is-ticketing-project" className="flex items-center gap-2 cursor-pointer">
                  <Ticket className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Is Ticketing Project?</span>
                </Label>
              </div>
            </div>

            {/* Right column: Expected Revenue & Transactions */}
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-3">
                <Euro className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-semibold text-gray-800">{t('Expected Revenue')}</h4>
              </div>
              <div className="text-2xl font-bold text-blue-700 mb-4">
                €{expectedRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>

              <div className="text-xs text-gray-600 space-y-1 mb-4">
                <div className="flex justify-between">
                  <span>{t('visitors')}</span>
                  <span className="font-medium">
                    {totalExpectedVisitors.toLocaleString('nl-NL')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>× €{(offer.euro_spend_per_person || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Expected Transactions */}
              <div className="border-t border-blue-300 pt-3 mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h4 className="text-sm font-semibold text-gray-800">{t('Expected Transactions')}</h4>
                </div>
                <div className="text-xl font-bold text-blue-700">
                  {(() => {
                    const avgTransaction = offer.average_transaction_value || 13;
                    return Math.round(expectedRevenue / avgTransaction).toLocaleString('nl-NL');
                  })()}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={offer.average_transaction_value || 13}
                    onChange={(e) => onDetailsChange('average_transaction_value', parseFloat(e.target.value) || 13)}
                    className="h-6 w-16 text-xs"
                    min="0.01"
                    step="0.01"
                  />
                  <span className="text-xs text-gray-600">{t('avg. festival transaction')}</span>
                  <Edit2 className="w-3 h-3 text-gray-400" />
                </div>
              </div>

              {/* Expected Platform Cost */}
              {actualPlatformCost > 0 && (
                <div className="border-t border-blue-300 pt-3 mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                    <h4 className="text-sm font-semibold text-gray-800">{t('Expected Platform Cost')}</h4>
                  </div>
                  <div className="text-xl font-bold text-blue-700">
                    €{actualPlatformCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    {totalExpectedVisitors.toLocaleString('nl-NL')} {t('visitors')} × €{(offer.euro_spend_per_person || 0).toFixed(2)} × {actualPlatformCostPercentage}%
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PROFIT SECTION - ONLY FOR INTERNAL USE */}
        {!isReview && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border-2 border-green-200">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                {t('Total Profit Summary')}
              </h3>

              <div className="space-y-4">
                {/* Standard Items - Breakdown by Category */}
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                    <span>{t('Standard Items')}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-blue-600">{t('Revenue')}: €{totalProfit.standardRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      <span className="text-green-600 w-24 text-right">{t('Profit')}: €{totalProfit.standard.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  {/* Breakdown by category */}
                  <div className="space-y-1.5 ml-4">
                    {(() => {
                      const categoryBreakdown = {};

                      (offer.offer_lines || []).forEach(line => {
                        const product = products?.find(p => p.id === line.product_id);
                        if (!product) return;

                        const setting = categorySettings?.find(s => s.category === product.category);
                        const isStandardSection = !setting || setting.calculation_type === 'standard'; // Check if standard

                        if (isStandardSection && line.quantity > 0) {
                          const category = product.category || 'other';
                          if (!categoryBreakdown[category]) {
                            categoryBreakdown[category] = { revenue: 0, profit: 0 };
                          }

                          const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
                          const effectiveQuantity = line.quantity * staffelMultiplier;
                          const revenue = effectiveQuantity * (line.unit_price || 0);
                          const cost = effectiveQuantity * (product.cost_basis || 0);

                          categoryBreakdown[category].revenue += revenue;
                          categoryBreakdown[category].profit += (revenue - cost);
                        }
                      });

                      return Object.entries(categoryBreakdown).map(([category, data]) => (
                        <div key={category} className="flex justify-between items-center text-xs text-gray-600">
                          <span className="capitalize">{t(category.replace(/_/g, ' '))}</span>
                          <div className="flex gap-4">
                            <span className="text-blue-600">€{data.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className="text-green-600 w-24 text-right">€{data.profit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                {/* Post-Event Items - Breakdown by Category */}
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="font-semibold text-gray-900 mb-3 flex items-center justify-between">
                    <span>{t('Post-Event')}</span>
                    <div className="flex gap-4 text-sm">
                      <span className="text-blue-600">{t('Revenue')}: €{totalProfit.postCalcRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      <span className="text-green-600 w-24 text-right">{t('Profit')}: €{totalProfit.postCalc.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  {/* Breakdown by category */}
                  <div className="space-y-1.5 ml-4">
                    {(() => {
                      const categoryBreakdown = {};

                      const totalVisitorsFromShowdates_local = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
                      const euroSpendPerPerson_local = offer.euro_spend_per_person || 0;
                      const transactionProcessingRevenue_local = totalVisitorsFromShowdates_local * euroSpendPerPerson_local;
                      const ticketingVisitors_local = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
                          ? offer.total_visitors_override
                          : totalVisitorsFromShowdates_local;

                      (offer.offer_lines || []).forEach(line => {
                        const product = products?.find(p => p.id === line.product_id);
                        if (!product) return;

                        const setting = categorySettings?.find(s => s.category === product.category);
                        const isPostCalcSection = setting?.calculation_type === 'post_event';

                        if (isPostCalcSection) {
                          const category = product.category || 'other';
                          if (!categoryBreakdown[category]) {
                            categoryBreakdown[category] = { revenue: 0, profit: 0 };
                          }

                          let currentLineRevenue = 0;
                          let currentLineProfit = 0;

                          const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
                          const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;

                          if (product.unit_type === 'percentage_of_revenue' && (percentageFee > 0 || percentageCostBasis > 0)) {
                            let baseValue = 0;
                            const isTransactionProduct = product.category === 'transaction_processing';

                            if (product.key_figure && product.key_figure !== 'none') {
                              switch (product.key_figure) {
                                case 'total_visitors':
                                  baseValue = isTransactionProduct ? totalVisitorsFromShowdates_local : ticketingVisitors_local;
                                  break;
                                case 'bar_meters':
                                  baseValue = offer.bar_meters || 0;
                                  break;
                                case 'food_sales_positions':
                                  baseValue = offer.food_sales_positions || 0;
                                  break;
                                case 'euro_spend_per_person':
                                  baseValue = euroSpendPerPerson_local;
                                  break;
                                case 'number_of_showdates':
                                  baseValue = offer.showdates?.length || 0;
                                  break;
                                case 'expected_revenue':
                                  baseValue = isTransactionProduct ? transactionProcessingRevenue_local : (ticketingVisitors_local * euroSpendPerPerson_local);
                                  break;
                                default:
                                  baseValue = 0;
                              }
                            }

                            const multipliedValue = baseValue * (product.key_figure_multiplier || 1);
                            currentLineRevenue = multipliedValue * (percentageFee / 100);
                            currentLineProfit = currentLineRevenue - (multipliedValue * (percentageCostBasis / 100));
                          } else {
                            let forecastQuantity = 0;

                            if (product.key_figure && product.key_figure !== 'none') {
                              let baseValue = 0;
                              const isTransactionProduct = product.category === 'transaction_processing';

                              switch (product.key_figure) {
                                case 'total_visitors':
                                  baseValue = isTransactionProduct ? totalVisitorsFromShowdates_local : ticketingVisitors_local;
                                  break;
                                case 'bar_meters':
                                  baseValue = offer.bar_meters || 0;
                                  break;
                                case 'food_sales_positions':
                                  baseValue = offer.food_sales_positions || 0;
                                  break;
                                case 'euro_spend_per_person':
                                  baseValue = euroSpendPerPerson_local;
                                  break;
                                case 'number_of_showdates':
                                  baseValue = offer.showdates?.length || 0;
                                  break;
                                case 'expected_revenue':
                                  baseValue = isTransactionProduct ? transactionProcessingRevenue_local : (ticketingVisitors_local * euroSpendPerPerson_local);
                                  break;
                                default:
                                  baseValue = 0;
                              }
                              forecastQuantity = Math.round(baseValue * (product.key_figure_multiplier || 0));
                            } else {
                              forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
                            }

                            if (forecastQuantity > 0) {
                              const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);
                              currentLineRevenue = forecastQuantity * unitPrice;
                              currentLineProfit = currentLineRevenue - (forecastQuantity * (product.cost_basis || 0));
                            }
                          }

                          categoryBreakdown[category].revenue += currentLineRevenue;
                          categoryBreakdown[category].profit += currentLineProfit;
                        }
                      });

                      return Object.entries(categoryBreakdown).map(([category, data]) => (
                        <div key={category} className="flex justify-between items-center text-xs text-gray-600">
                          <span className="capitalize">{t(category.replace(/_/g, ' '))}</span>
                          <div className="flex gap-4">
                            <span className="text-blue-600">€{data.revenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className="text-green-600 w-24 text-right">€{data.profit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>

                <div className="border-t border-gray-300 pt-2"></div>

                {/* Show realization corrections per category if they exist */}
                {totalProfit.realizationCorrection !== 0 && (
                  <>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('Realization Corrections')}</h4>
                      <div className="space-y-1 ml-4">
                        {Object.entries(totalProfit.realizationCosts || {}).map(([category, realizationCost]) => {
                          if (realizationCost === 0) return null;

                          const offerBudget = totalProfit.budgetByCategory[category] || 0;
                          const correction = offerBudget - realizationCost;

                          return (
                            <div key={category} className="flex justify-between text-xs">
                              <span className="text-gray-600 capitalize">{t(category.replace(/_/g, ' '))}:</span>
                              <span className={`font-medium w-24 text-right ${correction >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {correction >= 0 ? '+' : ''}€{correction.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold text-xs">
                          <span className="text-gray-700">{t('Total Corrections')}:</span>
                          <span className={`w-24 text-right ${totalProfit.realizationCorrection >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totalProfit.realizationCorrection >= 0 ? '+' : ''}€{totalProfit.realizationCorrection.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-gray-300 pt-2"></div>
                  </>
                )}

                {/* Show additional costs breakdown if they exist */}
                {totalProfit.additionalCosts > 0 && (
                  <>
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('Additional Costs')}</h4>
                      <div className="space-y-1 ml-4">
                        {Object.entries(totalProfit.additionalCostsBreakdown || {}).map(([key, cost]) => {
                          if (cost === 0) return null;

                          return (
                            <div key={key} className="flex justify-between text-xs">
                              <span className="text-gray-600">{t(key.replace(/_/g, ' '))}:</span>
                              <span className="font-medium text-red-600 w-24 text-right">
                                -€{cost.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          );
                        })}
                        <div className="flex justify-between pt-1 border-t border-gray-200 font-semibold text-xs">
                          <span className="text-gray-700">{t('Total Additional Costs')}:</span>
                          <span className="text-red-600 w-24 text-right">
                            -€{totalProfit.additionalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="border-t border-gray-300 pt-2"></div>
                  </>
                )}

                {/* Total Net Profit */}
                <div className="flex justify-between items-center py-3 bg-green-100 rounded-lg px-4 border border-green-300">
                  <span className="font-bold text-gray-900">{t('Net Profit (excl. BTW)')}:</span>
                  <div className="flex gap-4">
                    <span className="text-xl font-bold text-blue-700">
                      €{(totalProfit.standardRevenue + totalProfit.postCalcRevenue).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-2xl font-bold text-green-700 w-24 text-right">
                      €{totalProfit.total.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </CardContent>
    </Card>
  );
}