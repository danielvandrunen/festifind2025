
import React, { useState, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useLocalization } from '../../../Localization';

// Shared function to calculate profit for a single post-calc line
const calculateLineProfit = (line, product, offer, products) => {
    if (!product) return 0;

    const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
    const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;

    const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
    const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
    const euroSpendPerPerson = offer.euro_spend_per_person || 0;
    
    // For transaction processing: ALWAYS use sum of showdates
    const transactionProcessingRevenue = totalVisitorsFromShowdates * euroSpendPerPerson;
    
    // For ticketing: use override if set, otherwise sum of showdates
    const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
        ? offer.total_visitors_override
        : totalVisitorsFromShowdates;

    // Check if this is a percentage-based product
    if (product.unit_type === 'percentage_of_revenue' && (percentageFee > 0 || percentageCostBasis > 0)) {
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
                    baseValue = 0;
            }
        }
        
        const multipliedValue = baseValue * (product.key_figure_multiplier || 1);
        const revenue = multipliedValue * (percentageFee / 100);
        const cost = multipliedValue * (percentageCostBasis / 100);
        return revenue - cost;
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
                    baseValue = 0;
            }
            forecastQuantity = Math.round(baseValue * (product.key_figure_multiplier || 0));
        } else {
            forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
        }

        if (forecastQuantity > 0) {
            const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);
            return forecastQuantity * (unitPrice - (product.cost_basis || 0));
        }
    }
    
    return 0;
};

const PostCalculationForecastLine = ({ line, product, offer, onDetailsChange, onLineChange, isReview }) => {
    const { t } = useLocalization();
    const [isEditingPrice, setIsEditingPrice] = useState(false);
    const [isEditingPercentageFee, setIsEditingPercentageFee] = useState(false);
    const [isEditingPercentageCost, setIsEditingPercentageCost] = useState(false);
    
    const unitPrice = line.unit_price || product.default_price || 0;
    const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
    const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;

    // Calculate base value for key figure (raw value before multiplier for percentage calculations)
    const calculateKeyFigureValue = () => {
        if (!product.key_figure || product.key_figure === 'none') {
            return 0;
        }

        const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
        const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
        const euroSpendPerPerson = offer.euro_spend_per_person || 0;
        
        // Use override if set, otherwise use calculated from showdates
        const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
            ? offer.total_visitors_override
            : totalVisitorsFromShowdates;
        
        const isTransactionProduct = product.category === 'transaction_processing';
        const effectiveTotalVisitors = isTransactionProduct ? totalVisitorsFromShowdates : ticketingVisitors;
        const expectedRevenue = effectiveTotalVisitors * euroSpendPerPerson;

        switch (product.key_figure) {
            case 'total_visitors':
                return effectiveTotalVisitors;
            case 'bar_meters':
                return offer.bar_meters || 0;
            case 'food_sales_positions':
                return offer.food_sales_positions || 0;
            case 'euro_spend_per_person':
                return euroSpendPerPerson;
            case 'number_of_showdates':
                return offer.showdates?.length || 0;
            case 'expected_revenue':
                return expectedRevenue;
            default:
                return 0;
        }
    };

    // Calculate forecasted quantity (for display of unit-based products or manual inputs)
    const calculateForecastedQuantity = () => {
        if (!product.key_figure || product.key_figure === 'none') {
            return offer.post_calc_forecasts?.[product.id] || 0;
        }

        const baseValue = calculateKeyFigureValue();
        return Math.round(baseValue * (product.key_figure_multiplier || 0));
    };

    // Calculate forecasted revenue and profit
    const calculateForecastedAmounts = () => {
        let forecastRevenue = 0;
        let forecastCost = 0;

        if (product.unit_type === 'percentage_of_revenue' && (percentageFee > 0 || percentageCostBasis > 0)) {
            // For percentage-based products, calculate based on expected revenue or other key figure
            const baseValue = calculateKeyFigureValue(); // Get the raw base value from the key figure
            const multipliedValue = baseValue * (product.key_figure_multiplier || 1); // Apply multiplier for the base

            forecastRevenue = multipliedValue * (percentageFee / 100);
            forecastCost = multipliedValue * (percentageCostBasis / 100);
        } else {
            // For unit-based products or percentage products with no fee/cost, calculate normally
            const quantity = forecastQuantity; // Use the value from calculateForecastedQuantity
            forecastRevenue = quantity * unitPrice;
            forecastCost = quantity * (product.cost_basis || 0);
        }

        return {
            revenue: forecastRevenue,
            cost: forecastCost,
            profit: forecastRevenue - forecastCost
        };
    };

    const forecastQuantity = calculateForecastedQuantity();
    const { revenue: forecastRevenue, cost: forecastCost, profit } = calculateForecastedAmounts();

    if (isReview) {
        const formatDisplay = () => {
            const parts = [];
            if (unitPrice > 0) {
                parts.push(`€${unitPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}`);
            }
            // Only show percentage fee to client, not cost basis
            if (percentageFee > 0) {
                parts.push(`${percentageFee}%`);
            }
            return parts.join(' + ') || '€0,00';
        };

        return (
            <tr className="border-b border-gray-100 last:border-b-0">
                <td className="py-1 pr-2 text-[10px] text-gray-700">{line.product_name}</td>
                <td className="py-1 w-32 text-right text-[10px] font-medium text-gray-800 whitespace-nowrap">
                    {formatDisplay()}
                </td>
            </tr>
        );
    }
    
    const handleForecastChange = (productId, value) => {
        const numValue = parseInt(value, 10) || 0;
        const newForecasts = { ...(offer.post_calc_forecasts || {}), [productId]: numValue };
        onDetailsChange('post_calc_forecasts', newForecasts);
    };

    const handlePriceChange = (value) => {
        const newPrice = parseFloat(value) || 0;
        onLineChange(line.product_id, 'unit_price', newPrice);
    };

    const handlePercentageFeeChange = (value) => {
        const newPercentage = parseFloat(value) || 0;
        onLineChange(line.product_id, 'percentage_fee', newPercentage);
    };

    const handlePercentageCostChange = (value) => {
        const newPercentage = parseFloat(value) || 0;
        onLineChange(line.product_id, 'percentage_cost_basis', newPercentage);
    };

    const formatEditorDisplay = () => {
        const parts = [];
        
        if (unitPrice > 0 || isEditingPrice) {
            parts.push(
                isEditingPrice ? (
                    <Input
                        key="price-input"
                        type="number"
                        value={unitPrice}
                        onChange={(e) => handlePriceChange(e.target.value)}
                        onBlur={() => setIsEditingPrice(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setIsEditingPrice(false);
                            if (e.key === 'Escape') setIsEditingPrice(false);
                        }}
                        className="h-6 w-20 text-xs text-right inline-block"
                        step="0.01"
                        autoFocus
                    />
                ) : (
                    <span 
                        key="price-display"
                        onClick={() => setIsEditingPrice(true)}
                        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                    >
                        €{unitPrice.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                    </span>
                )
            );
        }
        
        if (percentageFee > 0 || isEditingPercentageFee) {
            if (parts.length > 0) parts.push(<span key="plus-separator-1" className="whitespace-nowrap"> + </span>);
            parts.push(
                isEditingPercentageFee ? (
                    <Input
                        key="percentage-fee-input"
                        type="number"
                        value={percentageFee}
                        onChange={(e) => handlePercentageFeeChange(e.target.value)}
                        onBlur={() => setIsEditingPercentageFee(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setIsEditingPercentageFee(false);
                            if (e.key === 'Escape') setIsEditingPercentageFee(false);
                        }}
                        className="h-6 w-16 text-xs text-right inline-block"
                        step="0.1"
                        autoFocus
                    />
                ) : (
                    <span 
                        key="percentage-fee-display"
                        onClick={() => setIsEditingPercentageFee(true)}
                        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                    >
                        {percentageFee}%
                    </span>
                )
            );
        }

        if (percentageCostBasis > 0 || isEditingPercentageCost) {
            if (parts.length > 0) parts.push(<span key="plus-separator-2" className="whitespace-nowrap"> + </span>);
            parts.push(
                isEditingPercentageCost ? (
                    <Input
                        key="percentage-cost-input"
                        type="number"
                        value={percentageCostBasis}
                        onChange={(e) => handlePercentageCostChange(e.target.value)}
                        onBlur={() => setIsEditingPercentageCost(false)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') setIsEditingPercentageCost(false);
                            if (e.key === 'Escape') setIsEditingPercentageCost(false);
                        }}
                        className="h-6 w-16 text-xs text-right inline-block"
                        step="0.01"
                        autoFocus
                    />
                ) : (
                    <span 
                        key="percentage-cost-display"
                        onClick={() => setIsEditingPercentageCost(true)}
                        className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                    >
                        {percentageCostBasis}%
                    </span>
                )
            );
        }

        if (parts.length === 0 && !isEditingPrice && !isEditingPercentageFee && !isEditingPercentageCost) {
            parts.push(
                <span 
                    key="default-price-display"
                    onClick={() => setIsEditingPrice(true)}
                    className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs font-medium whitespace-nowrap"
                >
                    €0,00
                </span>
            );
        }
        
        return parts;
    };

    // Check if this product has a key figure for auto-calculation
    const hasAutoCalculation = product.key_figure && product.key_figure !== 'none';
    const isPercentageBased = product.unit_type === 'percentage_of_revenue' && (percentageFee > 0 || percentageCostBasis > 0);

    return (
        <tr className="relative h-[38px]">
            <td className="py-2 pr-4 text-xs text-gray-600">
                {line.product_name}
                {hasAutoCalculation && (
                    <span className="ml-1 text-[10px] text-blue-600" title={t("Auto-calculated from cockpit")}>●</span>
                )}
            </td>
            <td className="py-2 w-52 text-right">
                <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                    {formatEditorDisplay()}
                </div>
            </td>
            <td className="absolute left-[calc(100%+100px)] top-0 h-full flex items-center gap-4 py-2 text-sm">
                {isPercentageBased ? (
                    // For percentage-based: show the forecasted revenue amount
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{t('Prognose')}:</span>
                            <div className="h-6 w-24 text-xs bg-blue-50 border border-blue-200 rounded px-2 flex items-center justify-end text-blue-700 font-medium">
                                €{forecastRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                            </div>
                        </div>
                        <div className="font-semibold text-green-700 w-24">
                            <span>€{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </>
                ) : (
                    // For unit-based: show quantity
                    <>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{t('Aantal')}:</span>
                            {hasAutoCalculation ? (
                                <div className="h-6 w-20 text-xs bg-blue-50 border border-blue-200 rounded px-2 flex items-center justify-end text-blue-700 font-medium">
                                    {forecastQuantity.toLocaleString('nl-NL')}
                                </div>
                            ) : (
                                <Input
                                    type="number"
                                    value={forecastQuantity || ''}
                                    onChange={(e) => handleForecastChange(line.product_id, e.target.value)}
                                    placeholder="0"
                                    className="h-6 w-20 text-xs"
                                    step="1"
                                />
                            )}
                        </div>
                        <div className="font-semibold text-green-700 w-24">
                            <span>€{profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </>
                )}
            </td>
        </tr>
    );
};

export default function DocumentFooter({ offer, products, categorySettings, onDetailsChange, onLinesChange, isReview = false }) {
    const { t } = useLocalization();
    
    if (!offer) return null;

    const postCalculationLines = (Array.isArray(offer.offer_lines) ? offer.offer_lines : [])
        .filter(line => {
            const product = products.find(p => p.id === line.product_id);
            if (!product) return false;
            const setting = categorySettings.find(s => s.category === product?.category);
            return setting?.calculation_type === 'post_event';
        });

    const handleLineChange = (productId, field, value) => {
        const updatedLines = (offer.offer_lines || []).map(line => 
            line.product_id === productId 
                ? { ...line, [field]: value }
                : line
        );
        onLinesChange(updatedLines);
    };

    // Calculate profit by summing individual line profits using the shared function
    const calculatePostCalcProfit = () => {
        let profit = 0;
        
        postCalculationLines.forEach(line => {
            const product = products.find(p => p.id === line.product_id);
            const lineProfit = calculateLineProfit(line, product, offer, products);
            
            console.log('💰 DocumentFooter - Line profit:', {
                productName: product?.name,
                lineProfit
            });
            
            profit += lineProfit;
        });

        console.log('💰 DocumentFooter - Total post-calc profit:', profit);
        return profit;
    };

    const standardProfit = (Array.isArray(offer.offer_lines) ? offer.offer_lines : [])
        .reduce((acc, line) => {
            const product = products.find(p => p.id === line.product_id);
            if (!product) return acc;
            
            const setting = categorySettings.find(s => s.category === product.category);
            const isStandardSection = !setting || setting.calculation_type !== 'post_event';
            
            if (isStandardSection && line.quantity > 0) {
                const staffelMultiplier = product.has_staffel ? (offer.staffel || 1) : 1;
                const effectiveQuantity = line.quantity * staffelMultiplier;
                const revenue = effectiveQuantity * line.unit_price;
                const cost = effectiveQuantity * (product.cost_basis || 0);
                const profit = revenue - cost;
                return acc + profit;
            }
            return acc;
        }, 0);

    const postCalcProfit = calculatePostCalcProfit();

    const subtotal = offer.subtotal_excl_btw || 0;
    const btwAmount = offer.btw_amount || 0;
    const total = offer.total_incl_btw || 0;

    const postCalcCategories = (Array.isArray(categorySettings) ? categorySettings : [])
        .filter(s => s && s.calculation_type === 'post_event')
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(s => s.category);

    return (
        <>
            <div className="mt-3 text-xs" style={{ pageBreakInside: 'avoid' }}>
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold text-gray-800 mb-1 text-xs">{t('Aanvullende afspraken over dit project')}</h4>
                        {isReview ? (
                            <div className="text-[10px] text-gray-800 whitespace-pre-wrap leading-tight">
                                {offer.terms_and_conditions || t('No additional agreements specified')}
                            </div>
                        ) : (
                            <Textarea
                                value={offer.terms_and_conditions || ''}
                                onChange={(e) => onDetailsChange('terms_and_conditions', e.target.value)}
                                className="text-xs h-24 border-gray-300 rounded-md"
                                placeholder={t('Enter additional project agreements...')}
                            />
                        )}
                    </div>
                    <div className="space-y-1 relative">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">{t('Subtotal (excl. BTW)')}</span>
                            <span className="font-medium text-gray-800">€{subtotal.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-gray-600">BTW (21%)</span>
                            <span className="font-medium text-gray-800">€{btwAmount.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-base font-bold border-t-2 border-gray-800 pt-1 mt-1">
                            <span>{t('Total (incl. BTW)')}</span>
                            <span>€{total.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        
                        {!isReview && (
                            <div className="absolute left-[calc(100%+60px)] top-0 pt-0.5">
                                <div className="flex items-center gap-3 text-sm font-bold">
                                    <span className="text-gray-700 text-xs whitespace-nowrap">{t('Standard Items Profit')}:</span>
                                    <div className="text-green-700 text-sm">
                                        €{standardProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {postCalculationLines.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200" style={{ pageBreakInside: 'avoid' }}>
                    <h3 className="font-semibold text-gray-800 mb-2">{t('Post-Event Calculation Items')}</h3>
                    <p className="text-xs text-gray-600 mb-3">
                        {t('These items are usage-based and will be billed separately after the event.')}
                        <br />
                        {t('Prices are excl. VAT')}.
                    </p>
                    <div className="space-y-2">
                        {postCalcCategories.map(category => {
                            const categoryLines = postCalculationLines.filter(line => {
                                const product = products.find(p => p.id === line.product_id);
                                return product?.category === category;
                            });

                            if (categoryLines.length === 0) return null;

                            return (
                                <div key={category} className="bg-gray-50 rounded-md p-2" style={{ pageBreakInside: 'avoid' }}>
                                    <h5 className="font-semibold text-gray-700 mb-1 text-[11px] capitalize">
                                        {t(category.replace(/_/g, ' '))}
                                    </h5>
                                    <table className="w-full">
                                        <tbody>
                                            {categoryLines.map(line => {
                                                const product = products.find(p => p.id === line.product_id);
                                                return product ? (
                                                    <PostCalculationForecastLine
                                                        key={line.product_id}
                                                        line={line}
                                                        product={product}
                                                        offer={offer}
                                                        onDetailsChange={onDetailsChange}
                                                        onLineChange={handleLineChange}
                                                        isReview={isReview}
                                                    />
                                                ) : null;
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                    
                    {!isReview && (
                        <div className="mt-3 pt-2 border-t border-gray-300">
                            <div className="absolute left-[calc(100%+60px)] flex items-center gap-3 text-sm font-bold">
                                <span className="text-gray-700 text-xs whitespace-nowrap">{t('Post-Event Forecast Profit')}:</span>
                                <div className="text-green-700 text-sm">
                                    €{postCalcProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-6 pt-6 text-[10px] leading-snug" style={{ pageBreakBefore: 'always', pageBreakInside: 'avoid' }}>
                <h2 className="text-center text-base font-bold mb-4 uppercase tracking-wide">DIENSTVERLENINGSOVEREENKOMST FASTLANE B.V.</h2>
                
                <div className="space-y-4">
                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">PARTIJEN</h3>
                        <p>Fastlane B.V., statutair gevestigd te Haarlem, ingeschreven bij de Kamer van Koophandel onder nummer 85534501, hierna te noemen &quot;Fastlane&quot;</p>
                        <p className="mt-1">EN</p>
                        <p>Organisator, hierna te noemen &quot;Organisator&quot; zoals gespecificeerd als de opdrachtgever in de offerte</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">OVERWEGINGEN</h3>
                        <div className="pl-3 space-y-1">
                            <p>1. Fastlane houdt zich bezig met het verlenen van diensten op het gebied van cashless betaaloplossingen, ticketingdiensten inclusief tweedehandsplatform en white-label festival applicaties voor evenementen en organisaties;</p>
                            <p>2. Organisator wenst de diensten van Fastlane exclusief te gebruiken voor alle activiteiten zoals gespecificeerd in de offerte. Dit geldt tevens voor activiteiten van toekomstige ondernemingen die Organisator gedurende de looptijd van deze overeenkomst opricht, alsmede bij afstoting van activiteiten of een &apos;Change of Control&apos;. Evenementen waarbij keuzevrijheid wettelijk vereist is, zijn hiervan uitgesloten;</p>
                            <p>3. Partijen wensen hun samenwerking schriftelijk vast te leggen met nadere voorwaarden zoals neergelegd in deze overeenkomst.</p>
                        </div>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 1 - DEFINITIES</h3>
                        <p>In deze Overeenkomst wordt verstaan onder:</p>
                        <ul className="list-disc pl-5 mt-1 space-y-0.5">
                            <li><strong>Algemene Voorwaarden:</strong> de op deze Overeenkomst van toepassing zijnde algemene voorwaarden van Fastlane</li>
                            <li><strong>Ticketshop:</strong> het door Fastlane ontwikkelde online systeem voor aankoop, behandeling, verwerking en afwikkeling van eTickets uit primaire verkoop en tweedehands doorverkoop</li>
                            <li><strong>eTicket(s):</strong> het digitale toegangsbewijs dat door Organisator aan Gebruiker via de Ticketshop wordt verkocht</li>
                            <li><strong>Tickets:</strong> alle verkochte toegangsbewijzen die geen eTickets zijn</li>
                            <li><strong>Gebruiker:</strong> de (rechts)persoon die een eTicket of Ticket koopt voor een door Organisator georganiseerd evenement of gebruik maakt van een app of point of sale eenheid</li>
                            <li><strong>Servicekosten:</strong> de vaste kosten die Fastlane rechtstreeks aan Gebruiker in rekening brengt voor het gebruik van de Ticketshop of cashless producten</li>
                            <li><strong>Transactiekosten:</strong> de variabele kosten die Fastlane aan Gebruiker of Organisator in rekening brengt voor het gebruik van de Ticketshop en de kassasystemen</li>
                            <li><strong>Offerte:</strong> het document waarin project, hoeveelheden en financiële waarden worden gespecificeerd</li>
                            <li><strong>Festival App:</strong> de mobiele applicatie ontwikkeld door Fastlane volgens de stijlgids van het evenement</li>
                            <li><strong>Fastlane PoS Software:</strong> de point of sale software geleverd door Fastlane</li>
                            <li><strong>Hardware:</strong> de fysieke apparatuur (workstations, iPads, iPhones) geleverd door Fastlane</li>
                            <li><strong>Kickback:</strong> de toeslag die Organisator aan Gebruiker kan doorberekenen per verkocht (e)Ticket</li>
                        </ul>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 2 - CASHLESS BETAALDIENSTEN</h3>
                        <h4 className="font-semibold text-xs mt-2 mb-1">2.1 Hardware en Software</h4>
                        <p>Fastlane levert de cashless betaaloplossing zoals gespecificeerd in de bijbehorende offerte, inclusief hardware, software en diensten. Hoeveelheden, prijzen en specificaties staan gedetailleerd in de offerte en vormen een integraal onderdeel van deze Overeenkomst.</p>
                        
                        <h4 className="font-semibold text-xs mt-2 mb-1">2.3 Afrekening en Rapportage</h4>
                        <p>a. Fastlane streeft ernaar binnen 24 uur na afloop van het evenement een financiële rapportage te verstrekken.</p>
                        <p className="mt-1">b. Betaling van opbrengsten, minus overeengekomen vergoedingen, geschiedt op de derde werkdag na het evenement via elektronische bankoverschrijving naar de door Organisator opgegeven rekening.</p>
                        <p className="mt-1">c. Indien Organisator niet binnen 3 werkdagen na ontvangst van de afrekening reageert met correcties of opmerkingen, wordt de afrekening als definitief beschouwd. Fastlane mag in dat geval de verrekening doorvoeren. Eventuele aanpassingen kunnen na overleg alsnog na de verrekening en storting worden doorgevoerd.</p>
                        <p className="mt-1">d. Niet-geclaimde saldi van bezoekers worden gedurende 3 weken bewaard, waarna automatische terugstorting volgt naar de oorspronkelijke rekening, verminderd met restitutiekosten en €0,99 administratiekosten.</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 3 - TICKETINGDIENSTEN</h3>
                        <h4 className="font-semibold text-xs mt-2 mb-1">3.1 Ticketingplatform</h4>
                        <p>a. Fastlane levert het ticketingplatform zoals gespecificeerd in de offerte voor alle onder deze Overeenkomst vallende evenementen.</p>
                        <p className="mt-1">b. Voor deze dienst worden vergoedingen in rekening gebracht per (e)Ticket, per transactie, per ticketoverdracht en voor doorverkoop tweedehands tickets.</p>
                        <p className="mt-1">c. Ticketgelden worden maandelijks aan Organisator uitbetaald. De bijbehorende factuur voor ticketingdiensten wordt eveneens maandelijks verrekend met de uit te betalen ticketgelden en verstuurd aan Organisator.</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 4 - WHITE-LABEL FESTIVAL APP</h3>
                        <p>Fastlane ontwikkelt, levert en onderhoudt een white-label festival app volgens de stijlgids van het evenement voor de prijs zoals gespecificeerd in de offerte. De app bevat minimaal ticketing-integratie, interactieve kaart, directe berichtgeving, tijdschema met favorietenfunctionaliteit en offline functionaliteit.</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 5 - BEPERKING VAN AANSPRAKELIJKHEID</h3>
                        <p>Voor zover wettelijk toegestaan sluit Fastlane aansprakelijkheid uit voor directe of indirecte schade voortvloeiend uit installatie en/of gebruik van Fastlane-systemen, onmogelijkheid systemen te gebruiken, uitvoering van overeenkomsten tussen consument en leverancier, afhandeling transacties en beheer digitale portemonnees, of handelen of nalaten van door Fastlane ingeschakelde derden.</p>
                        <p className="mt-1">De totale aansprakelijkheid van Fastlane blijft beperkt tot de totale vergoedingen betaald door Organisator voor het specifieke evenement dat aanleiding geeft tot de claim.</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 6 - INTELLECTUELE EIGENDOMSRECHTEN</h3>
                        <p>Alle intellectuele eigendomsrechten op de Fastlane PoS Software, Ticketshop, Festival App en diensten berusten exclusief bij Fastlane of diens licentiegevers. Fastlane verleent Organisator een beperkt, persoonlijk, herroepelijk, niet-exclusief, niet-overdraagbaar gebruiksrecht.</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 7 - VERWERKING VAN PERSOONSGEGEVENS</h3>
                        <p>Bij verwerking van persoonsgegevens via Fastlane-systemen is Organisator verwerkingsverantwoordelijke conform toepasselijke privacywetgeving. Fastlane wordt aangemerkt als verwerker in de zin van de AVG. Beide partijen garanderen volledige naleving van de Algemene Verordening Gegevensbescherming (AVG/GDPR).</p>
                    </section>

                    <section style={{ pageBreakInside: 'avoid' }}>
                        <h3 className="font-bold text-sm mb-2 uppercase">ARTIKEL 8 - SLOTBEPALINGEN</h3>
                        <p>Deze Overeenkomst bevat alle afspraken tussen partijen. De Algemene Voorwaarden van Fastlane zijn van toepassing op alle onder deze Overeenkomst verrichte diensten. Op deze Overeenkomst is uitsluitend Nederlands recht van toepassing. Alle geschillen worden beslecht door de bevoegde rechter te Amsterdam.</p>
                        <p className="mt-2 text-center text-[10px]">Versie: 10.9.25</p>
                    </section>
                </div>
            </div>
        </>
    );
}
