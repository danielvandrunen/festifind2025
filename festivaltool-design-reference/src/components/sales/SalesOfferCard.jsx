import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Edit, Eye, MapPin, Calendar, Building2, DollarSign } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Offer } from "@/api/entities";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

// Calculate profit from offer data - comprehensive version matching Dashboard logic
const calculateProfit = (offer, products, categorySettings) => {
  if (!offer?.offer_lines || !products || !categorySettings) return 0;

  let totalProfit = 0;

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
      totalProfit += (revenue - cost);
    }
  });

  // Post-calc items profit - comprehensive calculation
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
        totalProfit += (revenue - cost);
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
          totalProfit += (revenue - cost);
        }
      }
    }
  });

  // Subtract additional costs
  const additionalCosts = offer.additional_costs || {};
  const totalAdditionalCosts = Object.values(additionalCosts).reduce((sum, cost) => sum + (cost || 0), 0);
  totalProfit -= totalAdditionalCosts;

  return totalProfit;
};

export default function SalesOfferCard({ 
  offer, 
  client, 
  products, 
  categorySettings,
  onUpdate,
  isDragging 
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notes, setNotes] = useState(offer.sales_notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const profit = useMemo(() => 
    calculateProfit(offer, products, categorySettings), 
    [offer, products, categorySettings]
  );

  const firstShowdate = offer.showdates?.[0];
  const lastClientView = offer.last_client_view;
  const isSigned = !!offer.signed_date;

  const handleSaveNotes = async () => {
    if (notes === offer.sales_notes) {
      setIsEditingNotes(false);
      return;
    }
    setIsSaving(true);
    try {
      await Offer.update(offer.id, { sales_notes: notes });
      setIsEditingNotes(false);
      // Silently saved, no toast needed
    } catch (error) {
      toast.error("Failed to save notes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveNotes();
    }
    if (e.key === 'Escape') {
      setNotes(offer.sales_notes || '');
      setIsEditingNotes(false);
    }
  };

  const handleOpenEditor = () => {
    window.open(createPageUrl(`OfferEditor?id=${offer.id}`), '_blank');
  };

  return (
    <>
      <Card 
        className={`bg-white shadow-sm hover:shadow-md transition-shadow cursor-grab ${isDragging ? 'opacity-50 rotate-2' : ''} ${isSigned ? 'border-l-4 border-l-green-500' : ''}`}
      >
        <CardContent className="p-3 space-y-2">
          {/* Header: Project name + actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-gray-900 truncate">
                {offer.project_name}
              </h4>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Building2 className="w-3 h-3" />
                <span className="truncate">{client?.company_name || 'Unknown'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPreview(true);
                }}
                title="Preview offer"
              >
                <Eye className="w-3.5 h-3.5 text-gray-500" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEditor();
                }}
                title="Edit offer"
              >
                <Edit className="w-3.5 h-3.5 text-gray-500" />
              </Button>
            </div>
          </div>

          {/* Show date */}
          {firstShowdate && (
            <div className="flex items-center gap-1 text-xs text-gray-600">
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(firstShowdate), 'dd MMM yyyy')}</span>
              {offer.showdates?.length > 1 && (
                <span className="text-gray-400">+{offer.showdates.length - 1}</span>
              )}
            </div>
          )}

          {/* Last viewed */}
          {lastClientView ? (
            <div className="flex items-center gap-1 text-xs">
              <MapPin className="w-3 h-3 text-purple-500" />
              <span className="text-purple-600">
                {formatDistanceToNow(new Date(lastClientView.timestamp), { addSuffix: true })}
              </span>
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">Never viewed by client</div>
          )}

          {/* Profit */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <div className="flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5 text-green-600" />
              <span className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                €{profit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
            {isSigned && (
              <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">
                Signed
              </Badge>
            )}
          </div>

          {/* Inline Notes */}
          <div className="pt-1">
            {isEditingNotes ? (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={handleNotesKeyDown}
                onBlur={handleSaveNotes}
                placeholder="Add notes... (Enter to save, Esc to cancel)"
                className="w-full text-xs p-1.5 border border-blue-300 rounded bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                rows={2}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div 
                className="text-xs cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingNotes(true);
                }}
              >
                {notes ? (
                  <div className="line-clamp-2 italic bg-yellow-50 p-1.5 rounded text-gray-600 hover:bg-yellow-100 transition-colors">
                    {notes}
                  </div>
                ) : (
                  <span className="text-gray-400 hover:text-blue-600">+ Add notes</span>
                )}
              </div>
            )}
          </div>
          </CardContent>
          </Card>



      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Offer Preview - {offer.project_name}</DialogTitle>
          </DialogHeader>
          <div className="border rounded-lg overflow-hidden">
            <iframe
              src={`${createPageUrl(`OfferReview?id=${offer.id}`)}&preview=true`}
              className="w-full h-[70vh] border-0"
              title="Offer Preview"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}