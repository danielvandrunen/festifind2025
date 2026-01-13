import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  X, Building2, Mail, Phone, MapPin, Hash, Globe, Calendar, 
  Plus, Edit, Trash2, Save, Users, FolderOpen, TrendingUp, Euro, Eye
} from "lucide-react";
import { format, getISOWeek } from "date-fns";
import { Client, ClientPortalAccess } from "@/api/entities"; // Updated import
import { toast } from "sonner";
import { useLocalization } from "../Localization";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ClientDetailModal({ client, projects, offers, products, categorySettings, onClose, onUpdate }) {
  const { t } = useLocalization();
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [contacts, setContacts] = useState(client.additional_contacts || []);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", role: "", notes: "" });
  const [portalAccess, setPortalAccess] = useState(null);

  useEffect(() => {
    loadPortalAccess();
  }, [client.id]);

  const loadPortalAccess = async () => {
    try {
      const portalAccessList = await ClientPortalAccess.filter({ client_id: client.id });
      if (portalAccessList && portalAccessList.length > 0) {
        setPortalAccess(portalAccessList[0]);
      } else {
        setPortalAccess(null);
      }
    } catch (error) {
      console.error("Failed to load portal access:", error);
      setPortalAccess(null);
    }
  };

  const handleCreatePortalAccess = async () => {
    try {
      const portalUrlId = `${client.id}_${Date.now()}`; // Simple unique ID
      const newPortalAccess = await ClientPortalAccess.create({
        client_id: client.id,
        company_name: client.company_name,
        portal_url_id: portalUrlId,
        is_active: true
      });
      setPortalAccess(newPortalAccess);
      toast.success(t('Client portal created!'));
    } catch (error) {
      console.error("Failed to create portal access:", error);
      toast.error(t('Failed to create portal access'));
    }
  };

  const clientProjects = useMemo(() => {
    return projects
      .filter(p => {
        // First check if project belongs to this client
        if (p.client_id !== client.id) return false;
        
        // Then filter out projects whose offers are archived
        if (p.offer_id) {
          const offer = offers.find(o => o.id === p.offer_id);
          if (offer && offer.status === 'archived') {
            return false;
          }
        }
        
        return true;
      })
      .sort((a, b) => new Date(b.start_date || 0) - new Date(a.start_date || 0));
  }, [projects, offers, client.id]);

  const clientOffers = useMemo(() => {
    return offers
      .filter(o => o.client_id === client.id)
      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
  }, [offers, client.id]);

  const activeClientOffers = useMemo(() => {
    return clientOffers.filter(o => o.status !== 'archived');
  }, [clientOffers]);

  const archivedClientOffers = useMemo(() => {
    return clientOffers.filter(o => o.status === 'archived');
  }, [clientOffers]);

  // Comprehensive profit calculation function matching Dashboard logic
  const calculateOfferProfit = (offer) => {
    if (!offer?.offer_lines || !products || !categorySettings) return { standardProfit: 0, postCalcProfit: 0, totalProfit: 0 };

    let standardProfit = 0;
    let postCalcProfit = 0;

    // Standard items profit
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
        standardProfit += (revenue - cost);
      }
    });

    // Post-calc items profit
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;

      const setting = categorySettings.find(s => s.category === product.category);
      const isPostCalc = setting?.calculation_type === 'post_event';

      if (isPostCalc) {
        const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
        const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
        const euroSpendPerPerson = offer.euro_spend_per_person || 0;
        const transactionProcessingRevenue = totalVisitorsFromShowdates * euroSpendPerPerson;
        const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
            ? offer.total_visitors_override
            : totalVisitorsFromShowdates;

        const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
        const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;
        const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);

        if (product.unit_type === 'percentage_of_revenue') {
          let baseValue = 0;
          const isTransactionProduct = product.category === 'transaction_processing';

          if (product.key_figure && product.key_figure !== 'none') {
            switch (product.key_figure) {
              case 'total_visitors':
                baseValue = isTransactionProduct ? totalVisitorsFromShowdates : ticketingVisitors;
                break;
              case 'expected_revenue':
                baseValue = isTransactionProduct ? transactionProcessingRevenue : (ticketingVisitors * euroSpendPerPerson);
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
              default:
                baseValue = 0;
            }
          }

          const multipliedValue = baseValue * (product.key_figure_multiplier || 1);
          const revenue = multipliedValue * (percentageFee / 100);
          const cost = multipliedValue * (percentageCostBasis / 100);
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
              case 'expected_revenue':
                baseValue = isTransactionProduct ? transactionProcessingRevenue : (ticketingVisitors * euroSpendPerPerson);
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
              default:
                baseValue = 0;
            }
            forecastQuantity = Math.round(baseValue * (product.key_figure_multiplier || 0));
          } else {
            forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
          }

          if (forecastQuantity > 0) {
            const revenue = forecastQuantity * unitPrice;
            const cost = forecastQuantity * (product.cost_basis || 0);
            postCalcProfit += (revenue - cost);
          }
        }
      }
    });

    // Subtract additional costs
    const additionalCosts = offer.additional_costs || {};
    const totalAdditionalCosts = Object.values(additionalCosts).reduce((sum, cost) => sum + (cost || 0), 0);
    const totalProfit = standardProfit + postCalcProfit - totalAdditionalCosts;

    return { standardProfit, postCalcProfit, totalProfit };
  };

  const metrics = useMemo(() => {
    const totalRevenue = clientProjects.reduce((sum, p) => sum + (p.confirmed_revenue || 0), 0);
    const totalProfit = clientProjects.reduce((sum, p) => sum + (p.estimated_profit || 0), 0);
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    
    // Separate offers into open and confirmed, exclude archived
    const openOffers = activeClientOffers.filter(o => ['draft', 'sent', 'under_review'].includes(o.status));
    const confirmedOffers = activeClientOffers.filter(o => o.status === 'confirmed' || o.signed_date);

    // Calculate forecast summaries from post-calculation items
    const postCalcCategories = (categorySettings || [])
      .filter(s => s.calculation_type === 'post_event')
      .map(s => s.category);
    
    const postCalcProducts = (products || [])
      .filter(p => postCalcCategories.includes(p.category));

    const forecastsByProduct = {};
    
    // Calculate forecasts for each offer, matching the logic from DocumentFooter
    activeClientOffers.forEach(offer => {
      postCalcProducts.forEach(product => {
        let forecastQuantity = 0;
        
        // Check if product has a key figure for auto-calculation
        if (product.key_figure && product.key_figure !== 'none') {
          // Calculate base value from offer's cockpit data
          const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
          const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
          const euroSpendPerPerson = offer.euro_spend_per_person || 0;
          
          const transactionProcessingRevenue = totalVisitorsFromShowdates * euroSpendPerPerson;
          const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
            ? offer.total_visitors_override
            : totalVisitorsFromShowdates;
          
          const isTransactionProduct = product.category === 'transaction_processing';
          
          let baseValue = 0;
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
          // Use manual forecast if no key figure
          forecastQuantity = offer.post_calc_forecasts?.[product.id] || 0;
        }
        
        // Only add if forecast is greater than zero
        if (forecastQuantity > 0) {
          if (!forecastsByProduct[product.id]) {
            forecastsByProduct[product.id] = 0;
          }
          forecastsByProduct[product.id] += forecastQuantity;
        }
      });
    });
    
    // Calculate profit for open offers
    let openStandardProfit = 0;
    let openPostCalcProfit = 0;
    let openTotalProfit = 0;
    let openTotalRevenue = 0;
    
    openOffers.forEach(offer => {
      const profitBreakdown = calculateOfferProfit(offer);
      openStandardProfit += profitBreakdown.standardProfit;
      openPostCalcProfit += profitBreakdown.postCalcProfit;
      openTotalProfit += profitBreakdown.totalProfit;
      openTotalRevenue += (offer.subtotal_excl_btw || 0);
    });
    
    // Calculate profit for confirmed offers
    let confirmedStandardProfit = 0;
    let confirmedPostCalcProfit = 0;
    let confirmedTotalProfit = 0;
    let confirmedTotalRevenue = 0;
    
    confirmedOffers.forEach(offer => {
      const profitBreakdown = calculateOfferProfit(offer);
      confirmedStandardProfit += profitBreakdown.standardProfit;
      confirmedPostCalcProfit += profitBreakdown.postCalcProfit;
      confirmedTotalProfit += profitBreakdown.totalProfit;
      confirmedTotalRevenue += (offer.subtotal_excl_btw || 0);
    });
    
    // Total across all active offers
    const totalStandardProfit = openStandardProfit + confirmedStandardProfit;
    const totalPostCalcProfit = openPostCalcProfit + confirmedPostCalcProfit;
    const totalOffersProfit = openTotalProfit + confirmedTotalProfit;
    
    return {
      totalProjects: clientProjects.length,
      activeProjects: clientProjects.filter(p => ['planning', 'active'].includes(p.status)).length,
      completedProjects: clientProjects.filter(p => p.status === 'complete').length,
      totalRevenue,
      totalProfit,
      avgMargin,
      pendingOffers: openOffers.length,
      acceptedOffers: confirmedOffers.length,
      openTotalRevenue,
      confirmedTotalRevenue,
      forecastsByProduct,
      // Profit breakdowns
      openStandardProfit,
      openPostCalcProfit,
      openTotalProfit,
      confirmedStandardProfit,
      confirmedPostCalcProfit,
      confirmedTotalProfit,
      totalStandardProfit,
      totalPostCalcProfit,
      totalOffersProfit,
    };
  }, [clientProjects, activeClientOffers, products, categorySettings, calculateOfferProfit]);

  const handleAddContact = async () => {
    if (!newContact.name || !newContact.email) {
      toast.error("Name and email are required");
      return;
    }

    const updatedContacts = [...contacts, newContact];
    try {
      await Client.update(client.id, { additional_contacts: updatedContacts });
      setContacts(updatedContacts);
      setNewContact({ name: "", email: "", phone: "", role: "", notes: "" });
      toast.success("Contact added");
      onUpdate();
    } catch (error) {
      toast.error("Failed to add contact");
    }
  };

  const handleRemoveContact = async (index) => {
    const updatedContacts = contacts.filter((_, i) => i !== index);
    try {
      await Client.update(client.id, { additional_contacts: updatedContacts });
      setContacts(updatedContacts);
      toast.success("Contact removed");
      onUpdate();
    } catch (error) {
      toast.error("Failed to remove contact");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-xl flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Building2 className="w-8 h-8" />
                <h2 className="text-2xl font-bold">{client.company_name}</h2>
                <Badge className="bg-white/20 text-white border-white/30">
                  {client.status}
                </Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/10">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs - with fixed height container */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <div className="px-6 pt-6 flex-shrink-0">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview" onClick={(e) => e.stopPropagation()}>{t('Overview')}</TabsTrigger>
                <TabsTrigger value="contacts" onClick={(e) => e.stopPropagation()}>{t('Contacts')}</TabsTrigger>
                <TabsTrigger value="projects" onClick={(e) => e.stopPropagation()}>{t('Projects')} ({clientProjects.length})</TabsTrigger>
                <TabsTrigger value="offers" onClick={(e) => e.stopPropagation()}>{t('Offers')} ({activeClientOffers.length})</TabsTrigger>
                <TabsTrigger value="archived" onClick={(e) => e.stopPropagation()}>{t('Archived')} ({archivedClientOffers.length})</TabsTrigger>
              </TabsList>
            </div>

            {/* Scrollable content area with fixed height */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-6 mt-6 h-full" onClick={(e) => e.stopPropagation()}>
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        {t('Company Information')}
                      </h3>
                      <div className="space-y-3 text-sm">
                        {client.vat_number && (
                          <div className="flex items-start gap-3">
                            <Hash className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-gray-500">{t('BTW/VAT Number')}</div>
                              <div className="font-medium">{client.vat_number}</div>
                            </div>
                          </div>
                        )}
                        {client.address && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-gray-500">{t('Address')}</div>
                              <div className="font-medium">{client.address}</div>
                            </div>
                          </div>
                        )}
                        {client.website && (
                          <div className="flex items-start gap-3">
                            <Globe className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-gray-500">{t('Website')}</div>
                              <a href={client.website} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
                                {client.website}
                              </a>
                            </div>
                          </div>
                        )}
                        {client.client_since && (
                          <div className="flex items-start gap-3">
                            <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                            <div>
                              <div className="text-xs text-gray-500">{t('Client Since')}</div>
                              <div className="font-medium">{format(new Date(client.client_since), 'dd MMMM yyyy')}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        {t('Financial Summary')}
                      </h3>
                      <div className="space-y-6">
                        {/* Revenue Summary */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-orange-600">{t('Potential Revenue')} ({metrics.pendingOffers} {t('open offers')})</div>
                            <div className="text-xl font-bold text-orange-600">
                              €{metrics.openTotalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-green-700">{t('Confirmed Revenue')} ({metrics.acceptedOffers} {t('signed offers')})</div>
                            <div className="text-xl font-bold text-green-700">
                              €{metrics.confirmedTotalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </div>
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <div className="text-xs text-gray-500 mb-1">{t('Project Revenue (Realized)')}</div>
                          <div className="text-2xl font-bold text-gray-900">
                            €{metrics.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-xs text-gray-500 mb-1">{t('Average Margin')}</div>
                          <div className={`text-2xl font-bold ${metrics.avgMargin >= 20 ? 'text-green-600' : metrics.avgMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {metrics.avgMargin.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Profit Breakdown Table */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Euro className="w-5 h-5 text-green-600" />
                      {t('Profit Breakdown')}
                    </h3>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="font-semibold">Type</TableHead>
                            <TableHead className="font-semibold text-right">Open Offers</TableHead>
                            <TableHead className="font-semibold text-right">Confirmed Offers</TableHead>
                            <TableHead className="font-semibold text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">Standard Items</TableCell>
                            <TableCell className="text-right">
                              €{metrics.openStandardProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right">
                              €{metrics.confirmedStandardProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              €{metrics.totalStandardProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">Post-Calculation</TableCell>
                            <TableCell className="text-right">
                              €{metrics.openPostCalcProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right">
                              €{metrics.confirmedPostCalcProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              €{metrics.totalPostCalcProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                          </TableRow>
                          <TableRow className="bg-gray-50 font-bold">
                            <TableCell>Total Profit</TableCell>
                            <TableCell className="text-right text-orange-600">
                              €{metrics.openTotalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              €{metrics.confirmedTotalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right text-green-700 text-lg">
                              €{metrics.totalOffersProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                {Object.keys(metrics.forecastsByProduct).length > 0 && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                        Post-Calculation Forecasts
                      </h3>
                      <p className="text-xs text-gray-600 mb-4">
                        Aggregated forecasts from all active offers (excluding zero values)
                      </p>
                      <div className="space-y-2">
                        {Object.entries(metrics.forecastsByProduct)
                          .sort((a, b) => {
                            const productA = (products || []).find(p => p.id === a[0]);
                            const productB = (products || []).find(p => p.id === b[0]);
                            return (productA?.name || '').localeCompare(productB?.name || '');
                          })
                          .map(([productId, totalQuantity]) => {
                            const product = (products || []).find(p => p.id === productId);
                            if (!product) return null;
                            
                            return (
                              <div key={productId} className="flex justify-between items-center py-2 border-b border-gray-100">
                                <span className="text-sm font-medium text-gray-700">{product.name}</span>
                                <span className="text-sm font-bold text-purple-600">
                                  {totalQuantity.toLocaleString('nl-NL')}
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {client.notes && (
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="font-semibold text-lg mb-3">{t('Notes')}</h3>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{client.notes}</p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Contacts Tab */}
              <TabsContent value="contacts" className="space-y-6 mt-6 h-full" onClick={(e) => e.stopPropagation()}>
                <Card>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      {t('Primary Contact')}
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-xs text-gray-500">{t('Name')}</div>
                          <div className="font-medium">{client.contact_person}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <div>
                          <div className="text-xs text-gray-500">{t('Email')}</div>
                          <a href={`mailto:${client.email}`} className="font-medium text-blue-600 hover:underline">
                            {client.email}
                          </a>
                        </div>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-3">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <div>
                            <div className="text-xs text-gray-500">{t('Phone')}</div>
                            <div className="font-medium">{client.phone}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600" />
                        {t('Additional Contacts')} ({contacts.length})
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingContacts(!isEditingContacts)}
                      >
                        {isEditingContacts ? <X className="w-4 h-4 mr-2" /> : <Edit className="w-4 h-4 mr-2" />}
                        {isEditingContacts ? t('Cancel') : t('Edit')}
                      </Button>
                    </div>

                    {isEditingContacts && (
                      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                        <h4 className="font-medium mb-3">{t('Add New Contact')}</h4>
                        <div className="grid md:grid-cols-2 gap-3 mb-3">
                          <Input
                            placeholder={t('Name') + ' *'}
                            value={newContact.name}
                            onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                          />
                          <Input
                            placeholder={t('Email') + ' *'}
                            type="email"
                            value={newContact.email}
                            onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                          />
                          <Input
                            placeholder={t('Phone')}
                            value={newContact.phone}
                            onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                          />
                          <Input
                            placeholder={t('Role')}
                            value={newContact.role}
                            onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                          />
                        </div>
                        <Textarea
                          placeholder={t('Notes')}
                          value={newContact.notes}
                          onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                          className="mb-3"
                          rows={2}
                        />
                        <Button onClick={handleAddContact} size="sm">
                          <Plus className="w-4 h-4 mr-2" />
                          {t('Add Contact')}
                        </Button>
                      </div>
                    )}

                    <div className="space-y-3">
                      {contacts.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">{t('No additional contacts added yet')}</p>
                      ) : (
                        contacts.map((contact, index) => (
                          <div key={index} className="p-4 border rounded-lg hover:bg-gray-50">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 grid md:grid-cols-2 gap-3 text-sm">
                                <div>
                                  <div className="font-medium text-gray-900">{contact.name}</div>
                                  {contact.role && <div className="text-xs text-gray-500">{contact.role}</div>}
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="w-3 h-3" />
                                    <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                                      {contact.email}
                                    </a>
                                  </div>
                                  {contact.phone && (
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <Phone className="w-3 h-3" />
                                      <span>{contact.phone}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {isEditingContacts && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:bg-red-50"
                                  onClick={() => handleRemoveContact(index)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                            {contact.notes && (
                              <p className="text-xs text-gray-600 mt-2 pl-0">{contact.notes}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Projects Tab */}
              <TabsContent value="projects" className="mt-6 h-full" onClick={(e) => e.stopPropagation()}>
                <Card>
                  <CardContent className="p-0">
                    {clientProjects.length === 0 ? (
                      <div className="p-12 text-center">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No projects yet')}</h3>
                        <p className="text-gray-500">{t('Projects will appear here once offers are accepted')}</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="font-semibold">{t('Week')}</TableHead>
                              <TableHead className="font-semibold">{t('Project Name')}</TableHead>
                              <TableHead className="font-semibold">{t('Location')}</TableHead>
                              <TableHead className="font-semibold">{t('Dates')}</TableHead>
                              <TableHead className="font-semibold text-right">{t('Visitors')}</TableHead>
                              <TableHead className="font-semibold text-right">{t('Bar Meters')}</TableHead>
                              <TableHead className="font-semibold text-right">{t('Revenue')}</TableHead>
                              <TableHead className="font-semibold text-right">{t('Profit')}</TableHead>
                              <TableHead className="font-semibold text-center">{t('Status')}</TableHead>
                              <TableHead className="font-semibold text-center">{t('Action')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {clientProjects.map((project) => {
                              const offer = offers.find(o => o.id === project.offer_id);
                              const firstShowdate = project.showdates && project.showdates.length > 0 
                                ? new Date(project.showdates[0]) 
                                : project.start_date ? new Date(project.start_date) : null;
                              const weekNumber = firstShowdate ? getISOWeek(firstShowdate) : null;
                              
                              const totalVisitors = offer?.total_visitors_override !== null && offer?.total_visitors_override !== undefined
                                ? offer.total_visitors_override
                                : Object.values(offer?.expected_visitors_per_showdate || {}).reduce((sum, val) => sum + (val || 0), 0);
                              const barMeters = offer?.bar_meters || 0;
                              
                              const statusColors = {
                                planning: "bg-blue-100 text-blue-800",
                                active: "bg-green-100 text-green-800",
                                closing: "bg-orange-100 text-orange-800",
                                complete: "bg-gray-100 text-gray-800",
                              };

                              return (
                                <TableRow key={project.id} className="hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                                  <TableCell>
                                    {weekNumber && (
                                      <div className="text-xs">
                                        <div className="font-semibold">W{weekNumber}</div>
                                        <div className="text-gray-500">{format(firstShowdate, 'dd/MM')}</div>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Link 
                                      to={createPageUrl(`ProjectDetail?id=${project.id}`)}
                                      className="font-medium text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {project.project_name}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600">{project.project_location || '-'}</TableCell>
                                  <TableCell className="text-xs text-gray-600">
                                    {project.start_date && project.end_date && (
                                      <div>
                                        <div>{format(new Date(project.start_date), 'dd/MM/yy')}</div>
                                        <div className="text-gray-400">- {format(new Date(project.end_date), 'dd/MM/yy')}</div>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {totalVisitors > 0 ? totalVisitors.toLocaleString('nl-NL') : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {barMeters > 0 ? barMeters : '-'}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    €{(project.confirmed_revenue || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-green-600">
                                    €{(project.estimated_profit || 0).toLocaleString('nl-NL', { minimumFractionDigits: 0 })}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={statusColors[project.status]} variant="outline">
                                      {project.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)} onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                        <Eye className="w-3 h-3" />
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
              </TabsContent>

              {/* Offers Tab */}
              <TabsContent value="offers" className="mt-6 h-full" onClick={(e) => e.stopPropagation()}>
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 mb-1">{t('Total Offers')}</div>
                      <div className="text-2xl font-bold text-gray-900">{activeClientOffers.length}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 mb-1">{t('Total Visitors')}</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {activeClientOffers.reduce((sum, offer) => {
                          const totalFromShowdates = Object.values(offer.expected_visitors_per_showdate || {}).reduce((s, v) => s + (v || 0), 0);
                          return sum + ((offer.total_visitors_override !== null && offer.total_visitors_override > 0) ? offer.total_visitors_override : totalFromShowdates);
                        }, 0).toLocaleString('nl-NL')}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 mb-1">{t('Open Offers')}</div>
                      <div className="text-2xl font-bold text-orange-600">{metrics.pendingOffers}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        €{metrics.openTotalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} profit
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-600 mb-1">{t('Signed Offers')}</div>
                      <div className="text-2xl font-bold text-green-600">{metrics.acceptedOffers}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        €{metrics.confirmedTotalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} profit
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Share Client Portal Button */}
                {activeClientOffers.length > 0 && (
                  <div className="mb-6">
                    {portalAccess ? (
                      <Button
                        onClick={() => {
                          const portalUrl = `${window.location.origin}${createPageUrl(`ClientPortal?portal=${portalAccess.portal_url_id}`)}`;
                          navigator.clipboard.writeText(portalUrl);
                          toast.success(t('Link copied to clipboard!'));
                        }}
                        className="w-full bg-blue-600 hover:bg-blue-700"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        {t('View Client Page')} - {t('Copy Link')}
                      </Button>
                    ) : (
                      <Button
                        onClick={handleCreatePortalAccess}
                        className="w-full bg-green-600 hover:bg-green-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        {t('Create Client Portal Link')}
                      </Button>
                    )}
                  </div>
                )}

                <Card>
                  <CardContent className="p-0">
                    {activeClientOffers.length === 0 ? (
                      <div className="p-12 text-center">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No active offers')}</h3>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="font-semibold">{t('Offer #')}</TableHead>
                              <TableHead className="font-semibold">{t('Project Name')}</TableHead>
                              <TableHead className="font-semibold">{t('Created')}</TableHead>
                              <TableHead className="font-semibold text-right">{t('Total')}</TableHead>
                              <TableHead className="font-semibold text-center">{t('Status')}</TableHead>
                              <TableHead className="font-semibold text-center">{t('Action')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {activeClientOffers.map((offer) => {
                              const statusColors = {
                                draft: "bg-gray-100 text-gray-800",
                                sent: "bg-blue-100 text-blue-800",
                                under_review: "bg-yellow-100 text-yellow-800",
                                confirmed: "bg-green-100 text-green-800",
                                rejected: "bg-red-100 text-red-800",
                              };
                              const status = offer.signed_date ? 'confirmed' : offer.status;

                              return (
                                <TableRow key={offer.id} className="hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                                  <TableCell className="font-mono text-sm">{offer.offer_number}</TableCell>
                                  <TableCell>
                                    <Link 
                                      to={createPageUrl(`OfferEditor?id=${offer.id}`)}
                                      className="font-medium text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {offer.project_name}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600">
                                    {format(new Date(offer.created_date), 'dd/MM/yyyy')}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    €{(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className={statusColors[status]} variant="outline">
                                      {status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Link to={createPageUrl(`OfferEditor?id=${offer.id}`)} onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                        <Eye className="w-3 h-3" />
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
              </TabsContent>

              {/* Archived Offers Tab */}
              <TabsContent value="archived" className="mt-6 h-full" onClick={(e) => e.stopPropagation()}>
                <Card>
                  <CardContent className="p-0">
                    {archivedClientOffers.length === 0 ? (
                      <div className="p-12 text-center">
                        <FolderOpen className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No archived offers')}</h3>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50">
                              <TableHead className="font-semibold">{t('Offer #')}</TableHead>
                              <TableHead className="font-semibold">{t('Project Name')}</TableHead>
                              <TableHead className="font-semibold">{t('Created')}</TableHead>
                              <TableHead className="font-semibold text-right">{t('Total')}</TableHead>
                              <TableHead className="font-semibold text-center">{t('Status')}</TableHead>
                              <TableHead className="font-semibold text-center">{t('Action')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {archivedClientOffers.map((offer) => {
                              return (
                                <TableRow key={offer.id} className="hover:bg-gray-50" onClick={(e) => e.stopPropagation()}>
                                  <TableCell className="font-mono text-sm">{offer.offer_number}</TableCell>
                                  <TableCell>
                                    <Link 
                                      to={createPageUrl(`OfferEditor?id=${offer.id}`)}
                                      className="font-medium text-blue-600 hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {offer.project_name}
                                    </Link>
                                  </TableCell>
                                  <TableCell className="text-sm text-gray-600">
                                    {format(new Date(offer.created_date), 'dd/MM/yyyy')}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    €{(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge className="bg-gray-100 text-gray-600" variant="outline">
                                      {t('archived')}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Link to={createPageUrl(`OfferEditor?id=${offer.id}`)} onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                        <Eye className="w-3 h-3" />
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
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </motion.div>
    </motion.div>
  );
}