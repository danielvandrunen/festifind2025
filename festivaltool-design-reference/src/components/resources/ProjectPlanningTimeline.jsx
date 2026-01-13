import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, AlertTriangle, TrendingUp, Calendar } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth, eachMonthOfInterval, addMonths, isWithinInterval } from "date-fns";

const HARDWARE_GROUPS = [
  { key: 'workstation', label: 'Workstations', color: 'bg-blue-100 text-blue-800' },
  { key: 'handheld', label: 'Handhelds', color: 'bg-green-100 text-green-800' },
  { key: 'cashpoint', label: 'Cashpoints', color: 'bg-purple-100 text-purple-800' },
  { key: 'bonnenprinter', label: 'Bonnenprinters', color: 'bg-orange-100 text-orange-800' }
];

export default function ProjectPlanningTimeline() {
  const [projects, setProjects] = useState([]);
  const [offers, setOffers] = useState([]);
  const [capacities, setCapacities] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedMonths, setExpandedMonths] = useState({});
  const [timelineMonths, setTimelineMonths] = useState(6);

  useEffect(() => {
    loadData();
  }, []);

  const [products, setProducts] = useState([]);

  const loadData = async () => {
    try {
      const [projectsData, offersData, capacitiesData, productsData] = await Promise.all([
        base44.entities.Project.list(),
        base44.entities.Offer.list(),
        base44.entities.HardwareCapacity.list(),
        base44.entities.Product.list()
      ]);

      setProjects(projectsData.filter(p => p.status !== 'archived'));
      setOffers(offersData.filter(o => ['sent', 'under_review'].includes(o.status)));
      setProducts(productsData || []);
      
      const capacityMap = {};
      capacitiesData.forEach(item => {
        capacityMap[item.hardware_group] = item.quantity || 0;
      });
      setCapacities(capacityMap);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load planning data');
    } finally {
      setLoading(false);
    }
  };

  // Generate timeline: next 6 or 12 months
  const timeline = useMemo(() => {
    const today = new Date();
    const endDate = addMonths(today, timelineMonths);
    
    const months = eachMonthOfInterval({ start: today, end: endDate });
    
    return months.map(monthStart => {
      const monthEnd = endOfMonth(monthStart);
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd }, { weekStartsOn: 1 });
      
      return {
        month: monthStart,
        weeks: weeks.map(weekStart => ({
          start: weekStart,
          end: endOfWeek(weekStart, { weekStartsOn: 1 })
        }))
      };
    });
  }, [timelineMonths]);

  // Calculate hardware usage for a given date range
  const calculateUsage = (startDate, endDate) => {
    const usage = {
      workstation: { confirmed: 0, buffer: 0, offers: 0 },
      handheld: { confirmed: 0, buffer: 0, offers: 0 },
      cashpoint: { confirmed: 0, buffer: 0, offers: 0 },
      bonnenprinter: { confirmed: 0, buffer: 0, offers: 0 }
    };

    // Add confirmed projects
    projects.forEach(project => {
      if (project.showdates && project.showdates.length > 0) {
        const hasOverlap = project.showdates.some(showdate => 
          isWithinInterval(new Date(showdate), { start: startDate, end: endDate })
        );

        if (hasOverlap) {
          // Add hardware summary (confirmed quantities)
          if (project.hardware_summary) {
            Object.entries(project.hardware_summary).forEach(([group, quantity]) => {
              if (usage[group]) {
                usage[group].confirmed += quantity;
              }
            });
          }

          // Add buffer/spares
          if (project.hardware_spares) {
            Object.entries(project.hardware_spares).forEach(([group, quantity]) => {
              if (usage[group]) {
                usage[group].buffer += quantity;
              }
            });
          }
        }
      }
    });

    // Add open offers - calculate hardware from offer lines
    offers.forEach(offer => {
      if (offer.showdates && offer.showdates.length > 0) {
        const hasOverlap = offer.showdates.some(showdate => 
          isWithinInterval(new Date(showdate), { start: startDate, end: endDate })
        );

        if (hasOverlap && offer.offer_lines) {
          offer.offer_lines.forEach(line => {
            const product = products.find(p => p.id === line.product_id);
            if (product && product.hardware_group && product.hardware_group !== 'none' && line.quantity > 0) {
              if (usage[product.hardware_group]) {
                usage[product.hardware_group].offers += line.quantity;
              }
            }
          });
        }
      }
    });

    return usage;
  };

  // Monthly summary - find the busiest week in each month
  const monthlySummary = useMemo(() => {
    return timeline.map(({ month, weeks }) => {
      // Calculate usage for each week and find the maximum
      const maxUsage = {
        workstation: { confirmed: 0, buffer: 0, offers: 0 },
        handheld: { confirmed: 0, buffer: 0, offers: 0 },
        cashpoint: { confirmed: 0, buffer: 0, offers: 0 },
        bonnenprinter: { confirmed: 0, buffer: 0, offers: 0 }
      };

      weeks.forEach(week => {
        const weekUsage = calculateUsage(week.start, week.end);
        
        HARDWARE_GROUPS.forEach(group => {
          maxUsage[group.key].confirmed = Math.max(maxUsage[group.key].confirmed, weekUsage[group.key].confirmed);
          maxUsage[group.key].buffer = Math.max(maxUsage[group.key].buffer, weekUsage[group.key].buffer);
          maxUsage[group.key].offers = Math.max(maxUsage[group.key].offers, weekUsage[group.key].offers);
        });
      });
      
      const critical = HARDWARE_GROUPS.some(group => {
        const total = maxUsage[group.key].confirmed + maxUsage[group.key].buffer + maxUsage[group.key].offers;
        return total > (capacities[group.key] || 0);
      });

      return { month, usage: maxUsage, critical };
    });
  }, [timeline, projects, offers, capacities]);

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => ({ ...prev, [monthKey]: !prev[monthKey] }));
  };

  if (loading) {
    return <div className="text-center py-12">Loading timeline...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={timelineMonths === 6 ? 'default' : 'outline'}
            onClick={() => setTimelineMonths(6)}
          >
            6 Months
          </Button>
          <Button
            variant={timelineMonths === 12 ? 'default' : 'outline'}
            onClick={() => setTimelineMonths(12)}
          >
            12 Months
          </Button>
        </div>
      </div>

      {/* Monthly Summary Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Overview - Critical Moments
          </h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Month</th>
              {HARDWARE_GROUPS.map(group => (
                <th key={group.key} className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">
                  {group.label}
                </th>
              ))}
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {monthlySummary.map(({ month, usage, critical }) => (
              <tr key={month.toISOString()} className={critical ? 'bg-red-50' : 'hover:bg-gray-50'}>
                <td className="px-6 py-4 font-semibold text-gray-900">{format(month, 'MMMM yyyy')}</td>
                {HARDWARE_GROUPS.map(group => {
                  const confirmed = usage[group.key].confirmed;
                  const buffer = usage[group.key].buffer;
                  const offers = usage[group.key].offers;
                  const total = confirmed + buffer + offers;
                  const capacity = capacities[group.key] || 0;
                  const isOver = total > capacity;
                  return (
                    <td key={group.key} className="px-6 py-4 text-center">
                      <div className={`font-semibold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>
                        {total} / {capacity}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {confirmed}+{buffer}+{offers}
                      </div>
                      {isOver && (
                        <div className="text-xs text-red-600 mt-1">
                          +{total - capacity} over
                        </div>
                      )}
                    </td>
                  );
                })}
                <td className="px-6 py-4 text-center">
                  {critical ? (
                    <Badge variant="destructive" className="bg-red-600">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Critical
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-700 border-green-700">OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Timeline by Month */}
      <div className="space-y-4">
        {timeline.map(({ month, weeks }) => {
          const monthKey = month.toISOString();
          const isExpanded = expandedMonths[monthKey];

          return (
            <div key={monthKey} className="bg-white rounded-lg border overflow-hidden">
              <div 
                className="px-6 py-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors border-b"
                onClick={() => toggleMonth(monthKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    <Calendar className="w-5 h-5" />
                    <h3 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h3>
                  </div>
                  <Badge variant="outline">{weeks.length} weeks</Badge>
                </div>
              </div>

              {isExpanded && (
                <div className="p-6 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2">
                        <th className="text-left py-3 px-3 font-semibold text-gray-900 bg-gray-100 sticky left-0">Week</th>
                        {HARDWARE_GROUPS.map(group => (
                          <th key={group.key} className="text-center py-3 px-4 font-semibold text-gray-900 border-l-2" colSpan="4">
                            <div className="flex flex-col items-center gap-1">
                              <span>{group.label}</span>
                              <Badge variant="outline" className="text-xs">Cap: {capacities[group.key] || 0}</Badge>
                            </div>
                          </th>
                        ))}
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <th className="py-2 px-3 bg-gray-100 sticky left-0"></th>
                        {HARDWARE_GROUPS.map(group => (
                          <React.Fragment key={group.key}>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-green-700 border-l-2">Conf</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-purple-700">Buff</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-blue-700">Offer</th>
                            <th className="text-center py-2 px-2 text-xs font-semibold text-gray-900">Total</th>
                          </React.Fragment>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, idx) => {
                        const usage = calculateUsage(week.start, week.end);
                        
                        // Check if any hardware group is over capacity
                        const isWeekCritical = HARDWARE_GROUPS.some(group => {
                          const total = usage[group.key].confirmed + usage[group.key].buffer + usage[group.key].offers;
                          return total > (capacities[group.key] || 0);
                        });

                        return (
                          <tr 
                            key={idx} 
                            className={`border-b last:border-b-0 ${isWeekCritical ? 'bg-red-50' : 'hover:bg-gray-50'}`}
                          >
                            <td className="py-3 px-3 font-medium bg-white sticky left-0">
                              Week {format(week.start, 'w')} ({format(week.start, 'dd MMM')})
                            </td>
                            {HARDWARE_GROUPS.map(group => {
                              const confirmed = usage[group.key].confirmed;
                              const buffer = usage[group.key].buffer;
                              const offers = usage[group.key].offers;
                              const total = confirmed + buffer + offers;
                              const capacity = capacities[group.key] || 0;
                              const isOver = total > capacity;

                              return (
                                <React.Fragment key={group.key}>
                                  <td className="py-3 px-2 text-center font-semibold text-green-700 border-l-2">{confirmed}</td>
                                  <td className="py-3 px-2 text-center font-semibold text-purple-700">{buffer}</td>
                                  <td className="py-3 px-2 text-center font-semibold text-blue-700">{offers}</td>
                                  <td className={`py-3 px-2 text-center font-bold ${isOver ? 'text-red-600' : 'text-gray-900'}`}>
                                    {total}
                                    {isOver && <span className="text-xs ml-1">(+{total - capacity})</span>}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}