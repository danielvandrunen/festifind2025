
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Plus, Equal } from "lucide-react";
import { useLocalization } from '../../Localization';

export default function ProfitCockpit({ offer, products, categorySettings }) {
    const { t } = useLocalization();
    
    if (!offer || !products || !categorySettings) {
        return null;
    }

    // Calculate standard profit (from regular sections)
    const standardProfit = (Array.isArray(offer.offer_lines) ? offer.offer_lines : [])
        .reduce((acc, line) => {
            const product = products.find(p => p.id === line.product_id);
            if (!product) return acc;
            
            const setting = categorySettings.find(s => s.category === product.category);
            const isStandardSection = !setting || setting.calculation_type !== 'post_event';
            
            if (isStandardSection && line.quantity > 0) {
                const revenue = line.quantity * line.unit_price;
                const cost = line.quantity * (product.cost_basis || 0);
                const profit = revenue - cost;
                return acc + profit;
            }
            return acc;
        }, 0);

    // Calculate post-calc profit (from forecasted quantities)
    const postCalcProfit = (Array.isArray(offer.offer_lines) ? offer.offer_lines : [])
        .reduce((acc, line) => {
            const product = products.find(p => p.id === line.product_id);
            if (!product) return acc;
            
            const setting = categorySettings.find(s => s.category === product.category);
            const isPostCalcSection = setting?.calculation_type === 'post_event';
            
            if (isPostCalcSection) {
                const forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
                if (!forecastQuantity) return acc;
                
                const unitPrice = line.unit_price || product.default_price || 0;
                const profit = forecastQuantity * (unitPrice - (product.cost_basis || 0));
                return acc + profit;
            }
            return acc;
        }, 0);

    const totalProfit = standardProfit + postCalcProfit;

    return (
        <Card className="mb-4 border shadow-sm">
            <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    {t('Total Profit Forecast')}
                </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
                <div className="space-y-1 text-xs">
                    {/* Standard Items */}
                    <div className="flex items-center justify-between py-1.5">
                        <span className="text-gray-600">{t('Standard Items Profit')}</span>
                        <span className="font-semibold text-gray-900">
                            €{standardProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Plus Icon */}
                    <div className="flex justify-center py-0.5">
                        <Plus className="w-3 h-3 text-gray-400" />
                    </div>

                    {/* Post-Event Items */}
                    <div className="flex items-center justify-between py-1.5">
                        <span className="text-gray-600">{t('Post-Event Forecast Profit')}</span>
                        <span className="font-semibold text-gray-900">
                            €{postCalcProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </span>
                    </div>

                    {/* Equals Line */}
                    <div className="border-t border-gray-300 my-1"></div>

                    {/* Total */}
                    <div className="flex items-center justify-between py-1.5 bg-green-50 rounded px-2">
                        <span className="font-semibold text-gray-800">{t('Total Profit Forecast')}</span>
                        <span className="text-base font-bold text-green-700">
                            €{totalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
