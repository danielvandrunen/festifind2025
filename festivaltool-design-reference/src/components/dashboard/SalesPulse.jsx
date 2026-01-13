import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { startOfWeek, format, addWeeks, subMonths, addMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function SalesPulse({ projects, offers }) {
  const [products, setProducts] = React.useState([]);
  const [categorySettings, setCategorySettings] = React.useState([]);

  React.useEffect(() => {
    const loadData = async () => {
      const [productsData, categorySettingsData] = await Promise.all([
        base44.entities.Product.list(),
        base44.entities.ProductCategorySetting.list()
      ]);
      setProducts(productsData || []);
      setCategorySettings(categorySettingsData || []);
    };
    loadData();
  }, []);

  const calculateOfferBreakdown = (offer) => {
    if (!offer.offer_lines || !Array.isArray(offer.offer_lines) || products.length === 0) {
      return { standardProfit: 0, postCalcProfit: 0, totalProfit: 0 };
    }
    
    let standardProfit = 0;
    let postCalcProfit = 0;
    
    // Calculate standard items profit
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
        standardProfit += revenue - cost;
      }
    });
    
    // Calculate post-calc items profit (use forecasted quantities)
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isPostCalcSection = setting?.calculation_type === 'post_event';
      
      if (isPostCalcSection) {
        const forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
        if (forecastQuantity > 0) {
          const unitPrice = line.unit_price || product.default_price || 0;
          postCalcProfit += forecastQuantity * (unitPrice - (product.cost_basis || 0));
        }
      }
    });
    
    return {
      standardProfit,
      postCalcProfit,
      totalProfit: standardProfit + postCalcProfit
    };
  };

  const { chartData, monthlyTargets } = useMemo(() => {
    if (products.length === 0 || categorySettings.length === 0) {
      return { chartData: [], monthlyTargets: {} };
    }
    const now = new Date();
    const startDate = subMonths(now, 2);
    const endDate = addMonths(now, 12);
    
    // Generate weeks
    const weeks = [];
    let currentWeek = startOfWeek(startDate, { weekStartsOn: 1 });
    
    while (currentWeek <= endDate) {
      weeks.push({
        weekStart: new Date(currentWeek),
        weekLabel: format(currentWeek, 'dd MMM', { locale: nl }),
        monthLabel: format(currentWeek, 'MMM yyyy', { locale: nl }),
        confirmedProfit: 0,
        pipelineProfit: 0
      });
      currentWeek = addWeeks(currentWeek, 1);
    }
    
    // Add confirmed profit from accepted/signed offers (shown in week of show date)
    offers
      .filter(o => o.status !== 'archived' && (o.status === 'accepted' || o.signed_date))
      .forEach(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return;
        
        const firstShowdate = new Date(Math.min(...offer.showdates.map(d => new Date(d).getTime())));
        const showWeekStart = startOfWeek(firstShowdate, { weekStartsOn: 1 });
        
        const breakdown = calculateOfferBreakdown(offer);
        
        const showWeekData = weeks.find(w => w.weekStart.getTime() === showWeekStart.getTime());
        if (showWeekData) {
          showWeekData.confirmedProfit += breakdown.totalProfit;
        }
      });
    
    // Add pipeline profit (from open offers)
    offers
      .filter(o => o.status !== 'archived' && ['draft', 'sent', 'under_review'].includes(o.status))
      .forEach(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return;
        
        const firstShowdate = new Date(Math.min(...offer.showdates.map(d => new Date(d).getTime())));
        const weekStart = startOfWeek(firstShowdate, { weekStartsOn: 1 });
        
        const breakdown = calculateOfferBreakdown(offer);
        
        const weekData = weeks.find(w => w.weekStart.getTime() === weekStart.getTime());
        if (weekData) {
          weekData.pipelineProfit += breakdown.totalProfit;
        }
      });
    
    // Calculate monthly targets with event counts
    const targets = {};
    const eventCounts = {};
    
    weeks.forEach(week => {
      const monthKey = format(week.weekStart, 'MMM yyyy', { locale: nl });
      if (!targets[monthKey]) {
        targets[monthKey] = {
          confirmedProfit: 0,
          pipelineProfit: 0,
          total: 0
        };
        eventCounts[monthKey] = {
          confirmedProjects: new Set(),
          pipelineOffers: new Set()
        };
      }
      targets[monthKey].confirmedProfit += week.confirmedProfit;
      targets[monthKey].pipelineProfit += week.pipelineProfit;
      targets[monthKey].total = targets[monthKey].confirmedProfit + targets[monthKey].pipelineProfit;
    });
    
    // Count confirmed offers per month
    offers
      .filter(o => o.status !== 'archived' && (o.status === 'accepted' || o.signed_date))
      .forEach(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return;
        const firstShowdate = new Date(Math.min(...offer.showdates.map(d => new Date(d).getTime())));
        const monthKey = format(firstShowdate, 'MMM yyyy', { locale: nl });
        if (eventCounts[monthKey]) {
          eventCounts[monthKey].confirmedProjects.add(offer.id);
        }
      });
    
    offers
      .filter(o => o.status !== 'archived' && ['draft', 'sent', 'under_review'].includes(o.status))
      .forEach(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return;
        const firstShowdate = new Date(Math.min(...offer.showdates.map(d => new Date(d).getTime())));
        const monthKey = format(firstShowdate, 'MMM yyyy', { locale: nl });
        if (eventCounts[monthKey]) {
          eventCounts[monthKey].pipelineOffers.add(offer.id);
        }
      });
    
    // Convert sets to counts
    Object.keys(targets).forEach(monthKey => {
      targets[monthKey].confirmedCount = eventCounts[monthKey]?.confirmedProjects.size || 0;
      targets[monthKey].pipelineCount = eventCounts[monthKey]?.pipelineOffers.size || 0;
      targets[monthKey].totalCount = targets[monthKey].confirmedCount + targets[monthKey].pipelineCount;
    });
    
    return { chartData: weeks, monthlyTargets: targets };
  }, [projects, offers, products, categorySettings]);
  
  const formatCurrency = (value) => {
    return `€${(value / 1000).toFixed(0)}k`;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-gray-300 rounded shadow-lg">
          <p className="font-semibold mb-2">{label}</p>
          {data.confirmedProfit > 0 && (
            <p className="text-sm text-blue-700">
              Bevestigde winst: €{data.confirmedProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          )}
          {data.pipelineProfit > 0 && (
            <p className="text-sm text-orange-700">
              Pipeline winst: €{data.pipelineProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </p>
          )}
          <p className="text-sm font-semibold mt-1 pt-1 border-t">
            Totale potentie: €{(data.confirmedProfit + data.pipelineProfit).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            Sales Pulse
          </CardTitle>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span className="text-gray-600">Bevestigde winst</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-orange-500 rounded"></div>
              <span className="text-gray-600">Pipeline winst</span>
            </div>
          </div>
        </div>
        
        {/* Monthly Targets */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(monthlyTargets).slice(0, 12).map(([month, data]) => (
            <div key={month} className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-300 shadow-sm">
              <p className="text-xs font-bold text-gray-800 mb-2">{month}</p>
              <div className="space-y-1.5">
                <div>
                  <p className="text-lg font-bold text-gray-900">{formatCurrency(data.total)}</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600 mt-0.5">
                    <span className="text-blue-700 font-semibold">€{(data.confirmedProfit / 1000).toFixed(0)}k</span>
                    <span className="text-gray-400">+</span>
                    <span className="text-orange-600 font-semibold">€{(data.pipelineProfit / 1000).toFixed(0)}k</span>
                  </div>
                </div>
                <div className="pt-1.5 border-t border-gray-300">
                  <p className="text-xs font-semibold text-gray-700">{data.totalCount} events</p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-600">
                    <span className="text-green-700">{data.confirmedCount} bevestigd</span>
                    <span className="text-gray-400">+</span>
                    <span className="text-orange-600">{data.pipelineCount} open</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="weekLabel" 
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="confirmedProfit" stackId="a" fill="#3b82f6" name="Bevestigde winst" />
            <Bar dataKey="pipelineProfit" stackId="a" fill="#f59e0b" name="Pipeline winst" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}