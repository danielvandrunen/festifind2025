import React, { useState, useEffect } from "react";
import { Client, Product, Offer, Project, ProductCategorySetting } from "@/api/entities"; // Added ProductCategorySetting
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { addMonths, addYears, subMonths, isAfter, isBefore, startOfDay } from "date-fns";

import DashboardStats from "../components/dashboard/DashboardStats";
import QuickActions from "../components/dashboard/QuickActions";
import RecentOffers from "../components/dashboard/RecentOffers";
import ActiveProjects from "../components/dashboard/ActiveProjects";
import SalesPulse from "../components/dashboard/SalesPulse";
import OperationalUrgency from "../components/dashboard/OperationalUrgency";

export default function Dashboard() {
  const { t } = useLocalization();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [dateFilter, setDateFilter] = useState('year');
  const [stats, setStats] = useState({
    pendingOffers: 0,
    activeProjects: 0,
    confirmedStandard: 0, // Updated for detailed breakdown, now holds profit
    confirmedPostCalc: 0, // Updated for detailed breakdown, now holds profit
    confirmedTotal: 0,    // Updated for detailed breakdown, now holds profit
    potentialStandard: 0, // Updated for detailed breakdown, now holds profit
    potentialPostCalc: 0, // Updated for detailed breakdown, now holds profit
    potentialTotal: 0     // Updated for detailed breakdown, now holds profit
  });
  const [recentOffers, setRecentOffers] = useState([]);
  const [upcomingProjects, setUpcomingProjects] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [allOffers, setAllOffers] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { isAuthorized, user, error } = await checkUserAuthorization();
      
      if (error === 'not_authenticated') {
        window.location.href = '/login';
        return;
      }
      
      setAuthState({ checking: false, authorized: isAuthorized, user });
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (authState.authorized) {
      console.log("Loading dashboard data...");
      loadDashboardData();
    }
  }, [authState.authorized, dateFilter]);

  const getDateFilterRange = () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    console.log('🕒 Current date for filter:', {
      now: now.toISOString(),
      todayStart: todayStart.toISOString(),
      filter: dateFilter
    });
    
    switch(dateFilter) {
      case '3months':
        return { start: todayStart, end: addMonths(todayStart, 3) };
      case '6months':
        return { start: todayStart, end: addMonths(todayStart, 6) };
      case 'year':
        return { start: todayStart, end: addYears(todayStart, 1) };
      case 'past_6months':
        return { start: subMonths(todayStart, 6), end: todayStart };
      case 'past_12months':
        return { start: subMonths(todayStart, 12), end: todayStart };
      case '2025':
        return { start: new Date(2025, 0, 1), end: new Date(2025, 11, 31, 23, 59, 59) };
      case '2026':
        return { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31, 23, 59, 59) };
      case '2027':
        return { start: new Date(2027, 0, 1), end: new Date(2027, 11, 31, 23, 59, 59) };
      case 'all':
      default:
        return null;
    }
  };

  const calculateLineMetrics = (line, product, offer) => {
    if (!product) return { profit: 0 };

    const percentageFee = line.percentage_fee !== undefined ? line.percentage_fee : product.percentage_fee || 0;
    const percentageCostBasis = line.percentage_cost_basis !== undefined ? line.percentage_cost_basis : product.percentage_cost_basis || 0;
    const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);

    const visitorsPerShowdate = offer.expected_visitors_per_showdate || {};
    const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
    const euroSpendPerPerson = offer.euro_spend_per_person || 0;
    
    const transactionProcessingRevenue = totalVisitorsFromShowdates * euroSpendPerPerson;
    
    const ticketingVisitors = (offer.total_visitors_override !== null && offer.total_visitors_override !== undefined && offer.total_visitors_override > 0)
        ? offer.total_visitors_override
        : totalVisitorsFromShowdates;

    let revenue = 0;
    let cost = 0;

    if (product.unit_type === 'percentage_of_revenue') {
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
        revenue = multipliedValue * (percentageFee / 100);
        cost = multipliedValue * (percentageCostBasis / 100);
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

        revenue = forecastQuantity * unitPrice;
        cost = forecastQuantity * (product.cost_basis || 0);
    }
    
    return { profit: revenue - cost };
  };

  const calculateOfferBreakdown = (offer, products, categorySettings) => {
    if (!offer.offer_lines || !Array.isArray(offer.offer_lines) || !products || !categorySettings) {
      return {
        standardProfit: 0,
        postCalcProfit: 0,
        totalProfit: 0
      };
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
        const profit = revenue - cost;
        standardProfit += profit;
      }
    });
    
    // Calculate post-calc items profit
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const setting = categorySettings.find(s => s.category === product.category);
      const isPostCalcSection = setting?.calculation_type === 'post_event';
      
      if (isPostCalcSection) {
        const { profit } = calculateLineMetrics(line, product, offer);
        postCalcProfit += profit;
      }
    });
    
    return {
      standardProfit,
      postCalcProfit,
      totalProfit: standardProfit + postCalcProfit
    };
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const [offers, projects, clientsData, productsData, categorySettingsData] = await Promise.all([
        Offer.list('-updated_date'),
        Project.list(),
        Client.list(),
        Product.list(), // Added Product.list()
        ProductCategorySetting.list() // Added ProductCategorySetting.list()
      ]);

      console.log('📊 Dashboard - All projects:', projects.map(p => ({ 
        name: p.project_name, 
        status: p.status,
        offer_id: p.offer_id,
        showdates: p.showdates,
        start_date: p.start_date
      })));

      const activeOffers = (offers || []).filter(o => o.status !== 'archived');
      
      console.log('📊 Dashboard - Active offer IDs:', activeOffers.map(o => o.id));

      const activeProjectsFiltered = (projects || []).filter(project => {
        if (project.status === 'archived') {
          console.log('❌ Filtered out (archived):', project.project_name);
          return false;
        }
        
        if (project.offer_id) {
          const offerExists = activeOffers.some(o => o.id === project.offer_id);
          if (!offerExists) {
            console.log('❌ Filtered out (offer not in activeOffers):', project.project_name, 'offer_id:', project.offer_id);
            return false;
          }
        }
        
        console.log('✅ Passed initial filter:', project.project_name);
        return true;
      });

      console.log('📊 Dashboard - After initial filter:', activeProjectsFiltered.map(p => p.project_name));

      let filteredProjects = activeProjectsFiltered;
      const range = getDateFilterRange();
      
      if (range) {
        console.log('📅 Date filter range:', { 
          start: range.start, 
          end: range.end,
          filter: dateFilter
        });
        
        filteredProjects = activeProjectsFiltered.filter(project => {
          if (!project.showdates || project.showdates.length === 0) {
            console.log('❌ No showdates:', project.project_name);
            return false;
          }
          
          const hasShowdateInRange = project.showdates.some(showdate => {
            const projectDate = new Date(showdate);
            const projectDateStart = new Date(projectDate.getFullYear(), projectDate.getMonth(), projectDate.getDate(), 0, 0, 0, 0);
            const isAfterStart = projectDateStart >= range.start;
            const isBeforeEnd = projectDateStart <= range.end;
            const passes = isAfterStart && isBeforeEnd;
            
            console.log(`  📆 Checking showdate:`, {
              showdate,
              projectDate: projectDate.toISOString(),
              projectDateStart: projectDateStart.toISOString(),
              rangeStart: range.start.toISOString(),
              rangeEnd: range.end.toISOString(),
              isAfterStart,
              isBeforeEnd,
              passes
            });
            
            return passes;
          });
          
          console.log(`📅 ${project.project_name}:`, {
            showdates: project.showdates,
            hasShowdateInRange
          });
          
          return hasShowdateInRange;
        });
      } else {
        filteredProjects = activeProjectsFiltered.filter(project => {
          if (!project.showdates || project.showdates.length === 0) {
            console.log('❌ No showdates (no filter):', project.project_name);
            return false;
          }
          return true;
        });
      }

      console.log('📊 Dashboard - After date filter:', filteredProjects.map(p => p.project_name));

      let filteredOffers = activeOffers;
      if (range) {
        filteredOffers = activeOffers.filter(offer => {
          if (offer.showdates && offer.showdates.length > 0) {
            return offer.showdates.some(showdate => {
              const offerDate = new Date(showdate);
              const offerDateStart = new Date(offerDate.getFullYear(), offerDate.getMonth(), offerDate.getDate(), 0, 0, 0, 0);
              return offerDateStart >= range.start && offerDateStart <= range.end;
            });
          }
          return false;
        });
      }

      const pendingOffers = filteredOffers.filter(o => ['draft', 'sent', 'under_review'].includes(o.status));
      const confirmedOffers = filteredOffers.filter(o => o.status === 'confirmed' || o.signed_date);
      
      // Calculate confirmed profit breakdown (from CONFIRMED offers, not projects)
      let confirmedStandard = 0;
      let confirmedPostCalc = 0;
      confirmedOffers.forEach(offer => {
        const breakdown = calculateOfferBreakdown(offer, productsData, categorySettingsData);
        confirmedStandard += breakdown.standardProfit;
        confirmedPostCalc += breakdown.postCalcProfit;
      });
      
      // Calculate potential profit breakdown (pending + confirmed offers)
      let potentialStandard = 0;
      let potentialPostCalc = 0;
      [...pendingOffers, ...confirmedOffers].forEach(offer => {
        const breakdown = calculateOfferBreakdown(offer, productsData, categorySettingsData);
        potentialStandard += breakdown.standardProfit;
        potentialPostCalc += breakdown.postCalcProfit;
      });

      // Count active projects (all non-archived projects with valid dates in range)
      const activeProjectsCount = filteredProjects.length;

      console.log('📊 Dashboard Stats:', {
        pendingOffers: pendingOffers.length,
        confirmedOffers: confirmedOffers.length,
        activeProjects: activeProjectsCount,
        totalFilteredProjects: filteredProjects.length
      });

      setStats({
        pendingOffers: pendingOffers.length,
        activeProjects: activeProjectsCount,
        confirmedStandard,
        confirmedPostCalc,
        confirmedTotal: confirmedStandard + confirmedPostCalc,
        potentialStandard,
        potentialPostCalc,
        potentialTotal: potentialStandard + potentialPostCalc
      });

      const sortedProjects = [...filteredProjects].sort((a, b) => {
        const getEarliestShowdate = (project) => {
          if (project.showdates && project.showdates.length > 0) {
            return new Date(Math.min(...project.showdates.map(d => new Date(d).getTime())));
          }
          return new Date(0);
        };
        const dateA = getEarliestShowdate(a);
        const dateB = getEarliestShowdate(b);
        return dateA.getTime() - dateB.getTime();
      });

      setRecentOffers(filteredOffers.slice(0, 20));
      setUpcomingProjects(sortedProjects.slice(0, 20));
      setAllProjects(projects || []);
      setAllOffers(offers || []);
      setClients(clientsData || []);
      
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    }
    
    setIsLoading(false);
  };

  if (authState.checking) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('Business Overview')}</h1>
            <p className="text-gray-600 mt-2">{t('Monitor your festival services operations')}</p>
          </div>
          
          <QuickActions />
        </div>

        <div className="flex justify-end">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('Filter by date')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('All Time')}</SelectItem>
              <SelectItem value="past_6months">{t('Past 6 Months')}</SelectItem>
              <SelectItem value="past_12months">{t('Past 12 Months')}</SelectItem>
              <SelectItem value="3months">{t('Next 3 Months')}</SelectItem>
              <SelectItem value="6months">{t('Next 6 Months')}</SelectItem>
              <SelectItem value="year">{t('Next 12 Months')}</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2027">2027</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DashboardStats stats={stats} isLoading={isLoading} />

        {/* Sales Pulse - Full Width */}
        <SalesPulse projects={allProjects} offers={allOffers} />

        {/* Operational Urgency - Full Width */}
        <OperationalUrgency projects={allProjects} />
      </div>
    </div>
  );
}