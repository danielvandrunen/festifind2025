import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

export default function FinancialGrid({ project, offer, products, onUpdate }) {
  const [realizedCosts, setRealizedCosts] = useState({});
  const [customLines, setCustomLines] = useState([]);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    // Load existing realized costs from project, prepopulate with budget if empty
    const existingRealized = project.realized_costs || {};
    setRealizedCosts(existingRealized);
    setCustomLines(project.custom_cost_lines || []);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [project]);

  const revenue = project.confirmed_revenue || 0;

  // Build cost lines from offer lines that have cost_basis
  // Only include lines that are NOT in post_calculation_sections
  const costLines = [];
  if (offer && offer.offer_lines && products) {
    const postCalcSections = offer.post_calculation_sections || [];
    
    offer.offer_lines.forEach((line) => {
      if (!line.product_id) return;
      
      // Skip post-calculation sections
      if (line.section && postCalcSections.includes(line.section)) return;
      
      const product = products.find(p => p.id === line.product_id);
      if (!product || !product.cost_basis || product.cost_basis === 0) return;
      
      const budgetCost = line.quantity * product.cost_basis;
      
      // Skip if budget is 0
      if (budgetCost === 0) return;
      
      costLines.push({
        id: line.product_id,
        name: line.product_name || product.name,
        quantity: line.quantity,
        costBasis: product.cost_basis,
        budget: budgetCost
      });
    });
  }

  const autoSave = async () => {
    try {
      await base44.entities.Project.update(project.id, {
        realized_costs: realizedCosts,
        custom_cost_lines: customLines
      });
    } catch (error) {
      console.error('Error saving costs:', error);
    }
  };

  const debouncedSave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      autoSave();
    }, 1000);
  };

  const handleAddCustomLine = () => {
    const newLine = {
      id: `custom_${Date.now()}`,
      name: '',
      budget: 0
    };
    setCustomLines([...customLines, newLine]);
  };

  const handleCustomLineChange = (id, field, value) => {
    setCustomLines(customLines.map(line => 
      line.id === id ? { ...line, [field]: value } : line
    ));
    debouncedSave();
  };

  const handleRemoveCustomLine = (id) => {
    setCustomLines(customLines.filter(line => line.id !== id));
  };

  const calculateTotals = () => {
    let totalBudget = 0;
    let totalRealized = 0;
    let actualCosts = 0;
    
    // Calculate for offer lines
    costLines.forEach(line => {
      totalBudget += line.budget;
      const realized = realizedCosts[line.id];
      totalRealized += realized !== undefined && realized !== null ? realized : 0;
      
      // Use realized if filled, else use budget
      if (realized !== undefined && realized !== null) {
        actualCosts += realized;
      } else {
        actualCosts += line.budget;
      }
    });
    
    // Calculate for custom lines
    customLines.forEach(line => {
      const budget = line.budget || 0;
      const realized = realizedCosts[line.id];
      
      totalBudget += budget;
      totalRealized += realized !== undefined && realized !== null ? realized : 0;
      
      // Use realized if filled, else use budget
      if (realized !== undefined && realized !== null) {
        actualCosts += realized;
      } else {
        actualCosts += budget;
      }
    });
    
    const margin = revenue - actualCosts;
    const marginPercentage = revenue > 0 ? (margin / revenue) * 100 : 0;
    const budgetDifference = totalBudget - actualCosts;
    const withinBudget = budgetDifference >= 0;

    return { 
      budgetTotal: totalBudget, 
      realizedTotal: totalRealized, 
      margin, 
      marginPercentage, 
      actualCosts,
      budgetDifference,
      withinBudget
    };
  };

  const totals = calculateTotals();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Kostenbewaking</h3>
      </div>

      {/* Revenue Card */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-blue-900">Bevestigde Omzet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-blue-900">€ {revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-blue-700 mt-1">Uit bevestigde offerte (excl. BTW)</p>
        </CardContent>
      </Card>

      {/* Cost Grid */}
      <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
        <div className="grid grid-cols-4 bg-gray-100 font-semibold text-sm border-b-2 border-gray-200">
          <div className="p-3 border-r border-gray-200">Product</div>
          <div className="p-3 border-r border-gray-200 text-right">Berekening</div>
          <div className="p-3 border-r border-gray-200 text-right">Begroot</div>
          <div className="p-3 text-right">Gerealiseerd</div>
        </div>

        {costLines.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Geen producten met basiskosten gevonden in de offerte
          </div>
        ) : (
          costLines.map((line) => (
            <div key={line.id} className="grid grid-cols-4 border-b border-gray-200 hover:bg-gray-50">
              <div className="p-3 border-r border-gray-200 text-sm font-medium">{line.name}</div>
              <div className="p-3 border-r border-gray-200 text-right text-xs text-gray-500">
                {line.quantity} × €{line.costBasis.toFixed(2)}
              </div>
              <div className="p-3 border-r border-gray-200 text-right text-sm font-semibold text-gray-900">
                € {line.budget.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="p-2">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={realizedCosts[line.id] !== undefined ? realizedCosts[line.id] : line.budget}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                    setRealizedCosts({ ...realizedCosts, [line.id]: val });
                    debouncedSave();
                  }}
                  className="text-right text-sm h-8"
                  placeholder={line.budget.toFixed(2)}
                />
              </div>
            </div>
          ))
        )}

        {/* Custom Cost Lines */}
        {customLines.map((line) => (
          <div key={line.id} className="grid grid-cols-4 border-b border-gray-200 hover:bg-gray-50 bg-yellow-50">
            <div className="p-2 border-r border-gray-200">
              <Input
                value={line.name}
                onChange={(e) => handleCustomLineChange(line.id, 'name', e.target.value)}
                className="text-sm h-8"
                placeholder="Naam kostenpost..."
              />
            </div>
            <div className="p-3 border-r border-gray-200 text-right text-xs text-gray-400">
              -
            </div>
            <div className="p-2 border-r border-gray-200">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={line.budget || ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  handleCustomLineChange(line.id, 'budget', val);
                }}
                className="text-right text-sm h-8"
                placeholder="0.00"
              />
            </div>
            <div className="p-2 flex gap-1">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={realizedCosts[line.id] !== undefined ? realizedCosts[line.id] : (line.budget || 0)}
                onChange={(e) => {
                  const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                  setRealizedCosts({ ...realizedCosts, [line.id]: val });
                  debouncedSave();
                }}
                className="text-right text-sm h-8 flex-1"
                placeholder={(line.budget || 0).toFixed(2)}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveCustomLine(line.id)}
                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                ×
              </Button>
            </div>
          </div>
        ))}

        {/* Add Custom Line Button */}
        <div className="grid grid-cols-4 border-b border-gray-300 bg-gray-50">
          <div className="col-span-4 p-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddCustomLine}
              className="w-full text-sm"
            >
              + Extra kostenpost toevoegen
            </Button>
          </div>
        </div>

        {/* Totals Row */}
        <div className="grid grid-cols-4 bg-gray-50 font-bold text-sm border-t-2 border-gray-300">
          <div className="p-3 border-r border-gray-200">TOTAAL</div>
          <div className="p-3 border-r border-gray-200"></div>
          <div className="p-3 border-r border-gray-200 text-right">
            € {totals.budgetTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="p-3 text-right">
            € {totals.realizedTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Margin Card */}
      <Card className={`border-2 ${totals.margin >= 0 ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {totals.margin >= 0 ? (
              <>
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-green-900">Marge</span>
              </>
            ) : (
              <>
                <TrendingDown className="w-5 h-5 text-red-600" />
                <span className="text-red-900">Verlies</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Omzet:</span>
              <span className="font-semibold">€ {revenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-700">Kosten (actueel):</span>
              <span className="font-semibold">€ {totals.actualCosts.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t-2 border-gray-300 pt-2 mt-2 flex justify-between items-center">
              <span className="text-base font-bold">Marge:</span>
              <div className="text-right">
                <p className={`text-2xl font-bold ${totals.margin >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                  € {totals.margin.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-sm ${totals.margin >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  ({totals.marginPercentage.toFixed(1)}%)
                </p>
              </div>
            </div>
            
            {/* Budget comparison */}
            <div className={`mt-3 p-3 rounded-lg flex items-center justify-between ${totals.withinBudget ? 'bg-green-100' : 'bg-red-100'}`}>
              <div className="flex items-center gap-2">
                {totals.withinBudget ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                <span className={`text-sm font-medium ${totals.withinBudget ? 'text-green-900' : 'text-red-900'}`}>
                  {totals.withinBudget ? 'Binnen budget' : 'Buiten budget'}
                </span>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${totals.withinBudget ? 'text-green-900' : 'text-red-900'}`}>
                  {totals.withinBudget ? '+' : ''}€ {totals.budgetDifference.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className={`text-xs ${totals.withinBudget ? 'text-green-700' : 'text-red-700'}`}>
                  t.o.v. begroot
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}