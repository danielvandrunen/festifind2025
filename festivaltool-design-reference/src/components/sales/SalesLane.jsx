import React, { useMemo } from "react";
import { Droppable, Draggable } from "@hello-pangea/dnd";
import SalesOfferCard from "./SalesOfferCard";

// Shared profit calculation matching Dashboard logic
const calculateOfferProfit = (offer, products, categorySettings) => {
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

export default function SalesLane({
  id,
  title,
  color,
  offers,
  clients,
  products,
  categorySettings,
  onUpdate
}) {
  const totalProfit = useMemo(() => {
    return offers.reduce((sum, offer) => {
      return sum + calculateOfferProfit(offer, products, categorySettings);
    }, 0);
  }, [offers, products, categorySettings]);

  return (
    <div className="flex flex-col w-72 flex-shrink-0">
      {/* Lane Header */}
      <div className={`${color} rounded-t-lg px-3 py-2.5 border border-b-0 border-gray-200`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <span className="text-xs bg-white/70 rounded-full px-2 py-0.5 font-medium text-gray-700">
            {offers.length}
          </span>
        </div>
        <div className={`text-xs mt-1 font-medium ${totalProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
          €{totalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0 })} potential
        </div>
      </div>

      {/* Droppable Area */}
      <Droppable droppableId={id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 p-2 space-y-2 overflow-y-auto bg-white/60 rounded-b-lg min-h-[200px] border border-t-0 border-gray-200 ${
              snapshot.isDraggingOver ? 'bg-blue-50 ring-2 ring-blue-300 ring-inset' : ''
            }`}
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            {offers.map((offer, index) => {
              const client = clients.find(c => c.id === offer.client_id);
              return (
                <Draggable key={offer.id} draggableId={offer.id} index={index}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <SalesOfferCard
                        offer={offer}
                        client={client}
                        products={products}
                        categorySettings={categorySettings}
                        onUpdate={onUpdate}
                        isDragging={snapshot.isDragging}
                      />
                    </div>
                  )}
                </Draggable>
              );
            })}
            {provided.placeholder}
            
            {offers.length === 0 && !snapshot.isDraggingOver && (
              <div className="text-center text-gray-400 text-sm py-8">
                No offers
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}