import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Project, Client, Offer, Product, User } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { FolderOpen, Search, ArrowUpDown, ArrowUp, ArrowDown, Archive, Eye, FileText, Settings, Edit } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, getISOWeek, subDays, differenceInDays } from "date-fns";
import { useLocalization } from "../components/Localization";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const statusColors = {
  planning: "bg-blue-100 text-blue-800",
  preproduction: "bg-yellow-100 text-yellow-800",
  next_up: "bg-orange-100 text-orange-800",
  active: "bg-green-100 text-green-800",
  closing: "bg-orange-100 text-orange-800",
  complete: "bg-gray-100 text-gray-800",
  archived: "bg-gray-200 text-gray-600"
};

const AVAILABLE_SERVICES = [
  'Cashless',
  'Ticketing',
  'Festival App',
  'CRM'
];

const TRANSPORT_OPTIONS = [
  { value: 'ford_bus', label: 'Ford bus' },
  { value: 'huurbus', label: 'Huurbus' },
  { value: 'producent_vervoert', label: 'Producent vervoert' },
  { value: 'via_post', label: 'Via post' },
  { value: 'ophalen', label: 'Ophalen' }
];

// Add function to calculate auto status
const calculateAutoStatus = (project) => {
  // If explicitly archived, keep it archived.
  if (project.status === 'archived') {
    return 'archived';
  }

  // If project has no showdates, or manual status is complete/closing, respect it.
  if (!project.showdates || project.showdates.length === 0) {
    if (project.status === 'complete' || project.status === 'closing') {
      return project.status;
    }
    return 'planning'; // Default to planning if no dates and not explicit complete/closing
  }
  
  // Sort showdates to find the earliest one, robustly handling invalid dates
  const sortedShowdates = project.showdates
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime())) // Filter out invalid dates
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (sortedShowdates.length === 0) {
    if (project.status === 'complete' || project.status === 'closing') {
      return project.status;
    }
    return 'planning'; // Default to planning if no valid dates
  }

  const firstShowdate = sortedShowdates[0];
  
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Normalize today to start of day for accurate difference
  
  const daysUntilShow = differenceInDays(firstShowdate, today);
  
  if (daysUntilShow < 0) { // Event has passed
    if (project.status === 'closing') return 'closing'; // If manually set to closing, keep it
    return 'complete'; // Otherwise, it's complete
  } else if (daysUntilShow === 0) { // Event is today
    return 'active'; // Today means active
  }
  
  // Event is in the future
  if (daysUntilShow <= 5) {
    return 'next_up';
  } else if (daysUntilShow <= 19) {
    return 'preproduction';
  } else {
    return 'planning';
  }
};

// Add function to calculate days until next status change
const calculateDaysToNextStatus = (project) => {
  if (!project.showdates || project.showdates.length === 0) {
    return { daysToShow: null, daysToNextStatus: null, nextStatus: null };
  }
  
  const sortedShowdates = project.showdates
    .map(d => new Date(d))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (sortedShowdates.length === 0) {
    return { daysToShow: null, daysToNextStatus: null, nextStatus: null };
  }

  const firstShowdate = sortedShowdates[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const daysUntilShow = differenceInDays(firstShowdate, today);
  const currentStatus = calculateAutoStatus(project);
  
  let daysToNextStatus = null;
  let nextStatus = null;
  
  if (daysUntilShow < 0) {
    // Event has passed
    if (currentStatus === 'closing') {
      nextStatus = 'complete';
      daysToNextStatus = null; // Manual transition or no auto next state for closing -> complete
    }
    // If already complete or archived, no next status
  } else if (daysUntilShow === 0) {
    // Today is the show
    nextStatus = 'complete';
    daysToNextStatus = 1; // Tomorrow
  } else if (daysUntilShow <= 5) {
    // Currently next_up (or active if daysUntilShow is 0 which is handled above), will become active
    // If daysUntilShow is e.g. 3, it means 3 days until it becomes 'active'.
    nextStatus = 'active';
    daysToNextStatus = daysUntilShow; 
  } else {
    // Currently planning, will become preproduction when 19 days are left until show
    // E.g., if daysUntilShow is 30, preproduction will be in 30 - 19 = 11 days.
    nextStatus = 'preproduction';
    daysToNextStatus = daysUntilShow - 19;
  }
  
  return { daysToShow: daysUntilShow, daysToNextStatus, nextStatus };
};

// Add function to get user initials
const getUserInitials = (email) => {
  if (!email) return '?';
  const name = email.split('@')[0]; // Use the part before @ for initials
  if (!name) return '?'; // Handle cases like "@domain.com"
  const parts = name.split(/[\._-]/).filter(p => p.length > 0); // Split by common separators like ., _, - and filter empty parts
  if (parts.length === 1) { // Single part name
      return name.charAt(0).toUpperCase();
  }
  // Try to get first letter of first and last part
  const firstInitial = parts[0].charAt(0);
  const lastPart = parts[parts.length - 1];
  const lastInitial = lastPart.charAt(0);
  return `${firstInitial}${lastInitial}`.toUpperCase();
};

export default function ProjectsPage() {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all'); // NEW: State for the new date range filter
  const [selectedYears, setSelectedYears] = useState([]); // New state for multiple year selection
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState('updated_date');
  const [sortOrder, setSortOrder] = useState('desc');

  // Authentication check useEffect
  useEffect(() => {
    const checkAuth = async () => {
      const { isAuthorized, user, error } = await checkUserAuthorization();
      
      if (error === 'not_authenticated') {
        window.location.href = '/login'; // Redirect to login page
        return;
      }
      
      setAuthState({ checking: false, authorized: isAuthorized, user });
    };
    checkAuth();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Starting to load projects data...');
      
      // Load all required data concurrently with individual error handling
      const [projectsData, clientsData, offersData, productsData, usersData] = await Promise.all([
        Project.list().catch(e => { console.error('❌ Failed to load projects:', e); toast.error(t("Failed to load projects list.")); return []; }),
        Client.list().catch(e => { console.error('❌ Failed to load clients:', e); toast.error(t("Failed to load clients.")); return []; }),
        Offer.list().catch(e => { console.error('❌ Failed to load offers:', e); toast.error(t("Failed to load offers.")); return []; }),
        Product.list().catch(e => { console.error('❌ Failed to load products:', e); toast.error(t("Failed to load products.")); return []; }),
        User.list().catch(e => { console.error('❌ Failed to load users:', e); toast.error(t("Failed to load users.")); return []; })
      ]);

      console.log('✅ Data loaded - Projects:', projectsData?.length, 'Clients:', clientsData?.length, 'Offers:', offersData?.length, 'Products:', productsData?.length, 'Users:', usersData?.length);

      // Set the state with the full list of all projects (including archived).
      // The `filteredProjects` memo will handle display filtering based on `showArchived` toggle.
      setProjects(projectsData || []);
      setClients(clientsData || []);
      setOffers(offersData || []);
      setProducts(productsData || []); 
      setUsers(usersData || []);       

      // Load user's saved year filter from auth state
      if (authState.user?.project_year_filter && Array.isArray(authState.user.project_year_filter)) {
        setSelectedYears(authState.user.project_year_filter);
      }
    } catch (error) {
      // This catch block handles any critical errors not caught by individual promise catches,
      // or issues with `authState.user` access etc.
      console.error('❌ Critical error occurred during data loading:', error);
      toast.error(t("An unexpected error occurred while loading project data. Please try again."));
      // Ensure all states are reset to empty arrays to prevent rendering errors
      setProjects([]);
      setClients([]);
      setOffers([]);
      setProducts([]);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [authState.user, t]);

  // New function to update a single project in state
  const updateProjectInState = useCallback((projectId, updates) => {
    setProjects(prevProjects => 
      prevProjects.map(project => 
        project.id === projectId ? { ...project, ...updates, updated_date: new Date().toISOString() } : project
      )
    );
  }, []);

  // New function to update offer in state
  const updateOfferInState = useCallback((offerId, updates) => {
    setOffers(prevOffers => 
      prevOffers.map(offer => 
        offer.id === offerId ? { ...offer, ...updates } : offer
      )
    );
  }, []);

  // Conditional loadData useEffect, now depends on authState.authorized
  useEffect(() => {
    if (authState.authorized) {
      loadData();
    }
  }, [authState.authorized, loadData]); 

  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.company_name || t('N/A');
  };

  const getOfferData = (offerId) => {
    return offers.find(o => o.id === offerId);
  };

  const calculateHardwareSummary = (offerId) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer || !offer.offer_lines) return {};

    const summary = {};
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.hardware_group && product.hardware_group !== 'none') {
        if (!summary[product.hardware_group]) {
          summary[product.hardware_group] = 0;
        }
        summary[product.hardware_group] += line.quantity || 0; // Use 'summary' here, not 'hardwareSummary'
      }
    });
    return summary;
  };

  const calculateOfferProfitBreakdown = (offerId) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer || !offer.offer_lines) return { 
      standard: 0, 
      postCalc: 0, 
      total: 0, 
      standardRevenue: 0, 
      postCalcRevenue: 0, 
      totalRevenue: 0,
      realizationCorrection: 0,
      additionalCosts: 0,
      otherRevenue: 0,
      netProfit: 0 
    };

    let standardProfit = 0;
    let postCalcProfit = 0;
    let standardRevenue = 0;
    let postCalcRevenue = 0;

    // Calculate base profit from offer lines
    (offer.offer_lines || []).forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;

      const isPostCalc = product.category && 
        (product.category === 'transaction_processing' || 
         product.category === 'ticketing_ecommerce_fees' ||
         product.category === 'visitor_fees');

      if (isPostCalc) {
        const forecastQuantity = offer.post_calc_forecasts?.[line.product_id] || 0;
        if (forecastQuantity > 0) {
          const unitPrice = line.unit_price !== undefined && line.unit_price !== null ? line.unit_price : (product.default_price || 0);
          const revenue = forecastQuantity * unitPrice;
          const profit = forecastQuantity * (unitPrice - (product.cost_basis || 0));
          postCalcRevenue += revenue;
          postCalcProfit += profit;
        }
      } else {
        if (line.quantity > 0) {
          const revenue = line.quantity * (line.unit_price || 0);
          const cost = line.quantity * (product.cost_basis || 0);
          standardRevenue += revenue;
          standardProfit += (revenue - cost);
        }
      }
    });

    // Calculate realization corrections
    const realizationCosts = offer.realization_costs || {};
    const budgetByCategory = {};
    
    (offer.offer_lines || []).forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return;
      
      const isPostCalc = product.category && 
        (product.category === 'transaction_processing' || 
         product.category === 'ticketing_ecommerce_fees' ||
         product.category === 'visitor_fees');
      
      if (!isPostCalc && line.quantity > 0) {
        if (!budgetByCategory[product.category]) {
          budgetByCategory[product.category] = 0;
        }
        budgetByCategory[product.category] += line.quantity * (product.cost_basis || 0);
      }
    });

    let totalRealizationCorrection = 0;
    Object.entries(realizationCosts).forEach(([category, realizationCost]) => {
      // Only apply correction if realizationCost is explicitly set (not 0 or null from default)
      if (realizationCost > 0 || realizationCost < 0) { 
        const offerBudget = budgetByCategory[category] || 0;
        totalRealizationCorrection += (offerBudget - realizationCost);
      }
    });

    // Calculate additional costs (these are negative to profit)
    const additionalCosts = offer.additional_costs || {};
    const totalAdditionalCosts = Object.values(additionalCosts).reduce((sum, cost) => sum + (cost || 0), 0);

    // Get other revenue (positive to profit and revenue)
    const otherRevenue = offer.other_revenue || 0;

    const baseProfit = standardProfit + postCalcProfit;
    const netProfit = baseProfit + totalRealizationCorrection - totalAdditionalCosts + otherRevenue;

    return {
      standard: standardProfit,
      postCalc: postCalcProfit,
      total: baseProfit,
      standardRevenue,
      postCalcRevenue,
      totalRevenue: standardRevenue + postCalcRevenue + otherRevenue,
      realizationCorrection: totalRealizationCorrection,
      additionalCosts: totalAdditionalCosts,
      otherRevenue: otherRevenue,
      netProfit: netProfit
    };
  };

  // Add function to get budget columns (standard items only)
  const getBudgetColumns = useMemo(() => {
    const columns = new Set();
    
    (projects || []).forEach(project => {
      const offer = offers.find(o => o.id === project.offer_id);
      if (!offer || !offer.offer_lines) return;
      
      offer.offer_lines.forEach(line => {
        const product = products.find(p => p.id === line.product_id);
        if (!product) return;
        
        // Only include standard items (non post-calc) with quantity > 0
        const isPostCalc = product.category && 
          (product.category === 'transaction_processing' || 
           product.category === 'ticketing_ecommerce_fees' ||
           product.category === 'visitor_fees');
        
        if (!isPostCalc && line.quantity > 0) {
          columns.add(product.category);
        }
      });
    });
    
    return Array.from(columns).sort();
  }, [projects, offers, products]);

  // Function to calculate budget for a specific category in a project
  const getCategoryBudget = (project, category) => {
    const offer = offers.find(o => o.id === project.offer_id);
    if (!offer || !offer.offer_lines) return 0;
    
    let total = 0;
    (offer.offer_lines || []).forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.category === category && line.quantity > 0) {
        total += line.quantity * (product.cost_basis || 0);
      }
    });
    
    return total;
  };

  const handleCostUpdate = async (projectId, field, value) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project || !project.offer_id) return;

      const offer = offers.find(o => o.id === project.offer_id);
      if (!offer) return;

      const updatedAdditionalCosts = {
        ...(offer.additional_costs || {}),
        [field]: parseFloat(value) || 0
      };

      // Optimistically update UI
      updateOfferInState(project.offer_id, { additional_costs: updatedAdditionalCosts });

      await base44.entities.Offer.update(project.offer_id, {
        additional_costs: updatedAdditionalCosts
      });

      toast.success(t("Cost updated"));
    } catch (error) {
      console.error("Failed to update cost:", error);
      toast.error(t("Failed to update cost"));
      // Reload on error to revert
      loadData();
    }
  };

  const handleRealizationUpdate = async (projectId, category, value) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project || !project.offer_id) return;

      const offer = offers.find(o => o.id === project.offer_id);
      if (!offer) return;

      const updatedRealizationCosts = {
        ...(offer.realization_costs || {}),
        [category]: parseFloat(value) || 0
      };

      // Optimistically update UI
      updateOfferInState(project.offer_id, { realization_costs: updatedRealizationCosts });

      await base44.entities.Offer.update(project.offer_id, {
        realization_costs: updatedRealizationCosts
      });

      toast.success(t("Realization cost updated"));
    } catch (error) {
      console.error("Failed to update realization cost:", error);
      toast.error(t("Failed to update realization cost"));
      // Reload on error to revert
      loadData();
    }
  };

  const handleOtherRevenueUpdate = async (projectId, value) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project || !project.offer_id) return;

      // Optimistically update UI
      updateOfferInState(project.offer_id, { other_revenue: parseFloat(value) || 0 });

      await base44.entities.Offer.update(project.offer_id, {
        other_revenue: parseFloat(value) || 0
      });

      toast.success(t("Other revenue updated"));
    } catch (error) {
      console.error("Failed to update other revenue:", error);
      toast.error(t("Failed to update other revenue"));
      // Reload on error to revert
      loadData();
    }
  };

  const handleYearToggle = async (year) => {
    const newSelectedYears = selectedYears.includes(year)
      ? selectedYears.filter(y => y !== year)
      : [...selectedYears, year];
    
    setSelectedYears(newSelectedYears);
    setPeriodFilter('all'); // Reset period filter when years change
    
    // Save to user preferences
    try {
      await base44.auth.updateMe({ project_year_filter: newSelectedYears });
    } catch (error) {
      console.error("Failed to save year preferences:", error);
    }
  };

  const handleClearYears = async () => {
    setSelectedYears([]);
    setPeriodFilter('all');
    
    try {
      await base44.auth.updateMe({ project_year_filter: [] });
    } catch (error) {
      console.error("Failed to clear year preferences:", error);
    }
  };

  // Add function to get service items from offer
  const getServiceItems = (offerId) => {
    const offer = offers.find(o => o.id === offerId);
    if (!offer || !offer.offer_lines) return [];

    const serviceItems = [];
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.category === 'services' && line.quantity > 0) {
        serviceItems.push({
          id: product.id, // Use product.id for unique identification, which is what line.product_id usually is.
          name: product.name,
          quantity: line.quantity
        });
      }
    });
    return serviceItems;
  };

  // Add function to toggle service item scheduled status
  const handleToggleServiceScheduled = async (projectId, productId, currentStatus) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const updatedScheduled = {
        ...(project.scheduled_service_items || {}),
        [productId]: !currentStatus
      };

      // Optimistically update UI
      updateProjectInState(projectId, { scheduled_service_items: updatedScheduled });

      await base44.entities.Project.update(projectId, {
        scheduled_service_items: updatedScheduled
      });

      toast.success(t("Service item updated"));
    } catch (error) {
      console.error("Failed to update service item:", error);
      toast.error(t("Failed to update service item"));
      // Reload on error to revert
      loadData();
    }
  };

  const handleTransportChange = async (projectId, transportMethod) => {
    try {
      // Optimistically update UI
      updateProjectInState(projectId, { transport_method: transportMethod });

      await base44.entities.Project.update(projectId, { transport_method: transportMethod });
      toast.success(t("Transport method updated"));
    } catch (error) {
      console.error("Failed to update transport method:", error);
      toast.error(t("Failed to update transport method"));
      // Reload on error to revert
      loadData();
    }
  };

  // Calculate available periods from projects, using showdates, with improved robustness
  const availablePeriods = useMemo(() => {
    const weeks = new Set();
    const months = new Set();
    const quarters = new Set();
    const allYears = new Set(); // To collect all unique years from all projects for year filter dropdown

    // Populate allYears from ALL projects, regardless of their status or other filters
    (projects || []).forEach(project => {
      if (project.showdates && Array.isArray(project.showdates) && project.showdates.length > 0) {
        project.showdates.forEach(showdateStr => {
          try {
            const date = new Date(showdateStr);
            if (!isNaN(date.getTime())) {
              allYears.add(date.getFullYear());
            }
          } catch (e) {
            console.warn('Invalid showdate string encountered while populating allYears:', showdateStr, 'for project:', project.id);
          }
        });
      }
    });

    // Filter projects to be considered for specific period (weeks/months/quarters) dropdowns
    // These should reflect periods within the currently active projects (not archived).
    const projectsForPeriodCalculation = (projects || []).filter(p => calculateAutoStatus(p) !== 'archived');

    projectsForPeriodCalculation.forEach(p => {
      if (p.showdates && Array.isArray(p.showdates) && p.showdates.length > 0) {
        try {
          // Use the first valid showdate for period calculation for consistent grouping
          const firstValidShowdate = p.showdates
            .map(d => new Date(d))
            .find(d => !isNaN(d.getTime()));

          if (firstValidShowdate) {
            const date = firstValidShowdate;
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const week = getISOWeek(date);
            const quarter = Math.ceil(month / 3);

            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay() + 1); // Monday of the week
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6); // Sunday

            weeks.add(JSON.stringify({
              key: `${year}-W${week.toString().padStart(2, '0')}`,
              display: `${year}-W${week.toString().padStart(2, '0')} | ${format(weekStart, 'd.M')}-${format(weekEnd, 'd.M')}`,
              sort: `${year}-${week.toString().padStart(2, '0')}`
            }));
            months.add(`${year}-${month.toString().padStart(2, '0')}`);
            quarters.add(`${year}-Q${quarter}`);
          }
        } catch (e) {
          console.warn('Error processing showdate for period calculation:', e, 'for project:', p.id);
        }
      }
    });

    const parsedWeeks = Array.from(weeks).map(w => JSON.parse(w));
    parsedWeeks.sort((a, b) => b.sort.localeCompare(a.sort));

    return {
      weeks: parsedWeeks,
      months: Array.from(months).sort().reverse(),
      quarters: Array.from(quarters).sort().reverse(),
      years: Array.from(allYears).sort((a, b) => b - a)
    };
  }, [projects]); // Removed selectedYears from dependency as allYears is now independent.

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // 1. Filter out archived projects based on toggle
    if (!showArchived) {
      filtered = filtered.filter(p => calculateAutoStatus(p) !== 'archived');
    } else {
      filtered = filtered.filter(p => calculateAutoStatus(p) === 'archived');
    }

    // Apply date filter ONLY if a specific range is selected (not 'all')
    if (dateRangeFilter && dateRangeFilter !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      let rangeEnd;

      switch (dateRangeFilter) {
        case '3months':
          rangeEnd = new Date(todayStart);
          rangeEnd.setMonth(rangeEnd.getMonth() + 3);
          break;
        case '6months':
          rangeEnd = new Date(todayStart);
          rangeEnd.setMonth(rangeEnd.getMonth() + 6);
          break;
        case 'year':
          rangeEnd = new Date(todayStart);
          rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);
          break;
        default:
          rangeEnd = null;
      }

      if (rangeEnd) {
        filtered = filtered.filter(project => {
          // Projects without showdates are excluded ONLY when date filter is active
          if (!project.showdates || !Array.isArray(project.showdates) || project.showdates.length === 0) {
            return false;
          }

          const hasShowdateInRange = project.showdates.some(showdateStr => {
            try {
              const projectDate = new Date(showdateStr);
              if (isNaN(projectDate.getTime())) return false;
              
              const projectDateStart = new Date(projectDate.getFullYear(), projectDate.getMonth(), projectDate.getDate(), 0, 0, 0, 0);
              
              // Check if projectDateStart is ON or AFTER todayStart AND ON or BEFORE rangeEnd
              return projectDateStart >= todayStart && projectDateStart <= rangeEnd;
            } catch (e) {
              console.warn('Invalid showdate string encountered during dateRangeFilter:', showdateStr, 'for project:', project.id);
              return false; // Treat invalid dates as not in range
            }
          });

          return hasShowdateInRange;
        });
      }
    }
    // If dateRange is 'all' or undefined, we DON'T filter by showdates at all
    // This allows projects without showdates to be shown

    // Apply selectedYears filter
    if (selectedYears && Array.isArray(selectedYears) && selectedYears.length > 0) {
      filtered = filtered.filter(p => {
        if (!p.showdates || !Array.isArray(p.showdates) || p.showdates.length === 0) {
          return false;
        }
        return p.showdates.some(showdateStr => {
          try {
            const date = new Date(showdateStr);
            if (isNaN(date.getTime())) return false;
            const year = date.getFullYear();
            return selectedYears.includes(year);
          } catch (e) {
            console.warn('Invalid showdate string encountered during selectedYears filter:', showdateStr, 'for project:', p.id);
            return false; // Treat invalid dates as not matching year
          }
        });
      });
    }

    // 4. Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => {
        const currentStatus = calculateAutoStatus(p);
        return currentStatus === statusFilter;
      });
    }

    // 5. Period filter (weeks, months, quarters) - still uses showdates[0] for specific period grouping
    if (periodFilter !== 'all') {
      filtered = filtered.filter(p => {
        if (!p.showdates || !Array.isArray(p.showdates) || p.showdates.length === 0) return false;
        try {
          // Use the first valid showdate for period calculation for consistent grouping
          const firstValidShowdate = p.showdates
            .map(d => new Date(d))
            .find(d => !isNaN(d.getTime()));

          if (!firstValidShowdate) return false; // No valid showdate found

          const date = firstValidShowdate;
          const year = date.getFullYear();
          const month = date.getMonth() + 1;
          const week = getISOWeek(date);
          const quarter = Math.ceil(month / 3);

          if (periodFilter.startsWith(`${year}-W`)) {
            return periodFilter === `${year}-W${week.toString().padStart(2, '0')}`;
          } else if (periodFilter.startsWith(`${year}-Q`)) {
            return periodFilter === `${year}-Q${quarter}`;
          } else if (periodFilter.startsWith(`${year}-`) && periodFilter.length === 7) {
            return periodFilter === `${year}-${month.toString().padStart(2, '0')}`;
          }
          return false;
        } catch (e) {
          console.warn('Error processing showdate for period filter:', e, 'for project:', p.id);
          return false; // Treat as not matching period
        }
      });
    }

    // 6. Search filter
    if (searchTerm) {
      const lowercasedTerm = searchTerm.toLowerCase();
      const clientNameMap = new Map(clients.map(c => [c.id, c.company_name.toLowerCase()]));
      filtered = filtered.filter(p => {
        const clientName = clientNameMap.get(p.client_id) || ''; // Get client name safely
        return (
          (p.project_name?.toLowerCase().includes(lowercasedTerm)) ||
          (p.project_location?.toLowerCase().includes(lowercasedTerm)) ||
          (clientName.includes(lowercasedTerm))
        );
      });
    }

    // 7. Sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      const getEarliestShowdateTimestamp = (project) => {
        if (!project.showdates || !Array.isArray(project.showdates) || project.showdates.length === 0) return 0;
        // Filter out invalid dates and get timestamps, then find the minimum
        const validTimestamps = project.showdates
          .map(d => new Date(d).getTime())
          .filter(ts => !isNaN(ts));
        return validTimestamps.length > 0 ? Math.min(...validTimestamps) : 0;
      };

      switch (sortBy) {
        case 'start_date':
          aValue = getEarliestShowdateTimestamp(a);
          bValue = getEarliestShowdateTimestamp(b);
          break;
        case 'updated_date':
          aValue = a.updated_date ? new Date(a.updated_date).getTime() : 0;
          bValue = b.updated_date ? new Date(b.updated_date).getTime() : 0;
          break;
        case 'project_name': // Handles sorting for the combined column
          aValue = a.project_name?.toLowerCase() || '';
          bValue = b.project_name?.toLowerCase() || '';
          break;
        case 'client':
          const clientA = clients.find(c => c.id === a.client_id)?.company_name?.toLowerCase() || '';
          const clientB = clients.find(c => c.id === b.client_id)?.company_name?.toLowerCase() || '';
          aValue = clientA;
          bValue = clientB;
          break;
        case 'status':
          aValue = calculateAutoStatus(a) || '';
          bValue = calculateAutoStatus(b) || '';
          break;
        case 'revenue':
          aValue = calculateOfferProfitBreakdown(a.offer_id).totalRevenue || 0;
          bValue = calculateOfferProfitBreakdown(b.offer_id).totalRevenue || 0;
          break;
        case 'profit':
          aValue = calculateOfferProfitBreakdown(a.offer_id).netProfit || 0; // Use netProfit for sorting
          bValue = calculateOfferProfitBreakdown(b.offer_id).netProfit || 0; // Use netProfit for sorting
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [projects, offers, searchTerm, statusFilter, periodFilter, selectedYears, showArchived, clients, sortBy, sortOrder, products, dateRangeFilter]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const handleCreateProject = async (offer) => {
    // This function was not part of the current file code in the prompt, but it's mentioned in the outline.
    // It is assumed this function would be defined elsewhere or generated.
    // Implementing a basic version as per the outline's logic.
    try {
      const estimatedProfit = 0; // Placeholder, as full logic for this is not in prompt
      const hardwareSummary = calculateHardwareSummary(offer.id); // Placeholder

      let setupDate = null;
      if (offer.showdates && offer.showdates.length > 0) {
        const sortedShowdates = offer.showdates
          .map(d => new Date(d))
          .filter(d => !isNaN(d.getTime()))
          .sort((a, b) => a.getTime() - b.getTime());
        if (sortedShowdates.length > 0) {
          setupDate = subDays(sortedShowdates[0], 1).toISOString();
        }
      }
      
      const defaultTasks = []; // Placeholder

      const newProject = await Project.create({
        offer_id: offer.id,
        client_id: offer.client_id,
        project_name: offer.project_name,
        project_location: offer.project_location,
        start_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[0] : offer.project_start_date,
        end_date: offer.showdates && offer.showdates.length > 0 ? offer.showdates[offer.showdates.length - 1] : offer.project_end_date,
        setup_date: setupDate,
        showdates: offer.showdates || [],
        expected_attendance: offer.expected_attendance,
        confirmed_revenue: offer.subtotal_excl_btw,
        estimated_profit: estimatedProfit,
        hardware_summary: hardwareSummary,
        services: ['Cashless'],
        status: 'planning',
        tasks: defaultTasks,
      });
      
      toast.success(t(`Project "${newProject.project_name}" created!`));
      
      // Add the new project to state instead of reloading
      setProjects(prevProjects => [...prevProjects, newProject]);
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error(t("Failed to create project"));
    }
  };

  const handleUpdateProject = async (projectId, updates) => {
    try {
      // Optimistically update UI
      updateProjectInState(projectId, updates);

      await Project.update(projectId, updates);
      toast.success(t("Project updated"));
    } catch (error) {
      console.error("Failed to update project:", error);
      toast.error(t("Failed to update project"));
      // Reload on error to revert
      loadData();
    }
  };

  const handleServicesUpdate = async (projectId, newServices) => {
    try {
      // Optimistically update UI
      updateProjectInState(projectId, { services: newServices });

      await Project.update(projectId, { services: newServices });
      toast.success(t("Project services updated"));
    } catch (error) {
      console.error("Failed to update project services:", error);
      toast.error(t("Failed to update project services"));
      // Reload on error to revert
      loadData();
    }
  };

  const handleArchiveProject = async (projectId) => {
    try {
      // Optimistically update UI
      updateProjectInState(projectId, { status: 'archived' });

      await Project.update(projectId, { status: 'archived' });
      toast.success(t("Project archived"));
    } catch (error) {
      console.error("Failed to archive project:", error);
      toast.error(t("Failed to archive project"));
      // Reload on error to revert
      loadData();
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Auth checking and Unauthorized access rendering
  if (authState.checking) {
    return <div className="flex justify-center items-center h-screen">{t('Loading...')}</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  // Data loading skeleton (after auth is confirmed)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
        <div className="max-w-screen-2xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-10 w-full" />
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-screen-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-blue-600" />
              {t('Project Management')}
            </h1>
            <p className="text-gray-600 mt-2">{t('Manage and track your festival projects')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={showArchived ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={showArchived ? 'bg-gray-600 hover:bg-gray-700' : ''}
            >
              <Archive className="w-4 h-4 mr-2" />
              {showArchived ? t('Hide Archived') : t('Show Archived')}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow-md space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder={t('Search projects by name, client, or location...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            {!showArchived && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">{t('Status')}:</span>
                <div className="flex gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                    className={statusFilter === 'all' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    {t('All')}
                  </Button>
                  <Button
                    variant={statusFilter === 'planning' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('planning')}
                    className={statusFilter === 'planning' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    {t('Planning')}
                  </Button>
                  <Button
                    variant={statusFilter === 'preproduction' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('preproduction')}
                    className={statusFilter === 'preproduction' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    {t('Preproduction')}
                  </Button>
                  <Button
                    variant={statusFilter === 'next_up' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('next_up')}
                    className={statusFilter === 'next_up' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    {t('Next Up')}
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('active')}
                    className={statusFilter === 'active' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    {t('Active')}
                  </Button>
                  <Button
                    variant={statusFilter === 'complete' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('complete')}
                    className={statusFilter === 'complete' ? 'bg-blue-600 hover:bg-blue-700 text-white' : ''}
                  >
                    {t('Complete')}
                  </Button>
                </div>
              </div>
            )}

            {/* NEW: Date Range Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{t('Upcoming')}:</span>
              <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder={t('All Dates')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All Dates')}</SelectItem>
                  <SelectItem value="3months">{t('Next 3 Months')}</SelectItem>
                  <SelectItem value="6months">{t('Next 6 Months')}</SelectItem>
                  <SelectItem value="year">{t('Next Year')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Year Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{t('Year')}:</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    {selectedYears.length === 0 ? (
                      t('All Years')
                    ) : selectedYears.length === 1 ? (
                      selectedYears[0]
                    ) : (
                      `${selectedYears.length} ${t('selected')}`
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-3" align="start">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-sm text-gray-900">{t('Filter by Year')}</h4>
                      {selectedYears.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={handleClearYears}
                          className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
                        >
                          {t('Clear All')}
                        </Button>
                      )}
                    </div>
                    {availablePeriods.years.map((year) => {
                      const isSelected = selectedYears.includes(year);
                      return (
                        <label 
                          key={year} 
                          className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleYearToggle(year)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{year}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Period Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">{t('Period')}:</span>
              <Select value={periodFilter} onValueChange={setPeriodFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder={t('All')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('All')}</SelectItem>
                  {availablePeriods.weeks.length > 0 && (
                    <>
                      <SelectItem value="week-separator" disabled className="font-semibold">--- {t('Weeks')} ---</SelectItem>
                      {availablePeriods.weeks.map(week => (
                        <SelectItem key={week.key} value={week.key}>{week.display}</SelectItem>
                      ))}
                    </>
                  )}
                  {availablePeriods.months.length > 0 && (
                    <>
                      <SelectItem value="month-separator" disabled className="font-semibold">--- {t('Months')} ---</SelectItem>
                      {availablePeriods.months.map(month => (
                        <SelectItem key={month} value={month}>{format(new Date(month + '-01'), 'MMMM yyyy')}</SelectItem>
                      ))}
                    </>
                  )}
                  {availablePeriods.quarters.length > 0 && (
                    <>
                      <SelectItem value="quarter-separator" disabled className="font-semibold">--- {t('Quarters')} ---</SelectItem>
                      {availablePeriods.quarters.map(quarter => (
                        <SelectItem key={quarter} value={quarter}>{quarter}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Results count */}
          {(statusFilter !== 'all' || periodFilter !== 'all' || dateRangeFilter !== 'all' || selectedYears.length > 0 || searchTerm) && (
            <div className="text-sm text-gray-600">
              {t('Showing')} {filteredProjects.length} {t('of')} {
                projects.filter(p => showArchived ? (calculateAutoStatus(p) === 'archived') : (calculateAutoStatus(p) !== 'archived')).length
              } {t('projects')}
            </div>
          )}
        </div>

        {/* Projects Table */}
        <div className="bg-white rounded-lg shadow-md border overflow-x-auto">
          {filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No projects found')}</h3>
              <p className="text-gray-500">{t('Projects are automatically created when offers are confirmed')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-[300px] sticky left-0 z-20 bg-gray-50 border-r border-gray-200">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('project_name')} className="font-semibold h-8 px-2 pl-0">
                      {t('Account Manager')} / {t('Project Name')}
                      <SortIcon column="project_name" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-24 text-center">{t('Actions')}</TableHead>
                  <TableHead className="w-32">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('start_date')} className="font-semibold h-8 px-2">
                      {t('Showdates')}
                      <SortIcon column="start_date" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-32">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('updated_date')} className="font-semibold h-8 px-2">
                      {t('Last Edit')}
                      <SortIcon column="updated_date" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('client')} className="font-semibold h-8 px-2">
                      {t('Client')}
                      <SortIcon column="client" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-32">{t('Location')}</TableHead>
                  <TableHead className="w-28">{t('Setup Date')}</TableHead>
                  <TableHead className="w-32">{t('Hardware')}</TableHead>
                  <TableHead className="w-96">{t('Diensten')}</TableHead>
                  <TableHead className="w-40">{t('Vervoer')}</TableHead>
                  <TableHead className="w-72">{t('Services')}</TableHead>
                  <TableHead className="w-32">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="font-semibold h-8 px-2">
                      {t('Status')}
                      <SortIcon column="status" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-40 text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('profit')} className="font-semibold h-8 px-2">
                      {t('Revenue / Profit')}
                      <SortIcon column="profit" />
                    </Button>
                  </TableHead>
                  {getBudgetColumns.map(category => (
                    <TableHead key={category} className="w-32 text-right">
                      <div className="text-xs font-semibold">{t(category.replace(/_/g, ' '))}</div>
                    </TableHead>
                  ))}
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Personeelskosten intern')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Personeelskosten extern')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Reiskosten')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Mobiliteit')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Overnachtingen')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Breuk/verkoop')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Internet/techniek')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Overige kosten')}</div>
                  </TableHead>
                  <TableHead className="w-32 text-right">
                    <div className="text-xs font-semibold">{t('Overige omzet')}</div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => {
                  const offer = getOfferData(project.offer_id);
                  // Ensure showdates is an array and filter out invalid dates for display
                  const showdates = (offer?.showdates || project.showdates || [])
                    .map(d => new Date(d))
                    .filter(d => !isNaN(d.getTime()));
                  const firstShowdate = showdates.length > 0 ? showdates[0] : null;
                  const lastShowdate = showdates.length > 1 ? showdates[showdates.length - 1] : firstShowdate; // If only one date, lastShowdate is same as first
                  const weekNumber = firstShowdate ? getISOWeek(firstShowdate) : null;
                  
                  let setupDate = null;
                  if (project.setup_date) {
                    const parsedSetupDate = new Date(project.setup_date);
                    if (!isNaN(parsedSetupDate.getTime())) {
                      setupDate = parsedSetupDate;
                    }
                  } else if (firstShowdate) {
                    setupDate = subDays(firstShowdate, 1);
                  }

                  const hardwareSummary = project.hardware_summary || calculateHardwareSummary(project.offer_id);
                  const serviceItems = getServiceItems(project.offer_id);
                  const profitBreakdown = calculateOfferProfitBreakdown(project.offer_id);
                  

                  return (
                    <TableRow key={project.id} className="hover:bg-gray-50">
                      <TableCell className="w-[300px] sticky left-0 z-10 bg-white border-r border-gray-200">
                        <div className="flex items-center gap-3">
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex-shrink-0 flex items-center gap-2 hover:opacity-80">
                                <Avatar className="h-8 w-8 bg-blue-600 text-white">
                                  <AvatarFallback className="bg-blue-600 text-white font-semibold">
                                    {project.account_manager ? getUserInitials(project.account_manager) : '?'}
                                  </AvatarFallback>
                                </Avatar>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-2" align="start">
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-gray-700 px-2 py-1">{t('Account Manager')}</div>
                                {users.map(user => (
                                  <Button
                                    key={user.id}
                                    variant="ghost"
                                    className="w-full justify-start text-sm"
                                    onClick={() => handleUpdateProject(project.id, { account_manager: user.email })}
                                  >
                                    <Avatar className="h-6 w-6 mr-2 bg-blue-600 text-white text-xs">
                                      <AvatarFallback className="bg-blue-600 text-white">
                                        {getUserInitials(user.email)}
                                      </AvatarFallback>
                                    </Avatar>
                                    {user.full_name || user.email}
                                  </Button>
                                ))}
                                {project.account_manager && (
                                  <>
                                    <div className="border-t my-1"></div>
                                    <Button
                                      variant="ghost"
                                      className="w-full justify-start text-sm text-gray-500"
                                      onClick={() => handleUpdateProject(project.id, { account_manager: null })}
                                    >
                                      {t('None')}
                                    </Button>
                                  </>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Link 
                            to={createPageUrl(`ProjectDetail?id=${project.id}`)} 
                            className="font-semibold text-gray-900 hover:text-blue-700 flex-grow truncate"
                            title={project.project_name}
                          >
                            {project.project_name}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                              <Eye className="w-3 h-3" />
                            </Button>
                          </Link>
                          {project.offer_id && (
                            <Link to={createPageUrl(`OfferEditor?id=${project.offer_id}`)}>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
                                <FileText className="w-3 h-3"/>
                              </Button>
                            </Link>
                          )}
                          {!showArchived && (
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-gray-500 hover:text-red-600"
                              onClick={() => handleArchiveProject(project.id)}
                            >
                              <Archive className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {firstShowdate && (
                          <div className="flex flex-col text-xs text-gray-600">
                            <span className="font-semibold">
                              {format(firstShowdate, 'dd/MM/yy')}
                              {lastShowdate && lastShowdate.getTime() !== firstShowdate.getTime() && 
                                ` - ${format(lastShowdate, 'dd/MM/yy')}`
                              }
                            </span>
                            <span className="text-[10px] text-gray-500">W{weekNumber}</span>
                            {setupDate && (
                              <span className="text-[10px] text-gray-400">Build: {format(setupDate, 'dd/MM/yy')}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {project.updated_date ? format(new Date(project.updated_date), 'dd/MM/yy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {getClientName(project.client_id)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {project.project_location || offer?.project_location || '-'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-600">
                        {setupDate 
                          ? format(setupDate, 'dd/MM/yy')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <div className="text-xs space-y-0.5">
                          {Object.entries(hardwareSummary).map(([group, count]) => (
                            <div key={group} className="flex justify-between gap-2">
                              <span className="text-gray-600 capitalize">{group}:</span>
                              <span className="font-semibold">{count}</span>
                            </div>
                          ))}
                          {Object.keys(hardwareSummary).length === 0 && (
                            <span className="text-gray-400 italic">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {serviceItems.length > 0 ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="w-full text-left hover:bg-gray-50 p-2 rounded transition-colors">
                                <div className="text-xs space-y-0.5">
                                  {serviceItems.map((item) => {
                                    const isScheduled = project.scheduled_service_items?.[item.id] === true;
                                    // Abbreviate long names
                                    const displayName = item.name.length > 20 
                                      ? item.name.substring(0, 17) + '...' 
                                      : item.name;
                                    return (
                                      <div key={item.id} className="flex justify-between gap-2">
                                        <span className={`text-gray-700 ${isScheduled ? 'font-semibold' : ''}`}>
                                          {displayName}
                                        </span>
                                        <span className="font-semibold">{item.quantity}x</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-3" align="start">
                              <div className="space-y-3">
                                <h4 className="font-semibold text-sm mb-3">{t('Schedule Services')}</h4>
                                {serviceItems.map((item) => {
                                  const isScheduled = project.scheduled_service_items?.[item.id] === true;
                                  return (
                                    <label 
                                      key={item.id} 
                                      className="flex items-start gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                                    >
                                      <Checkbox
                                        checked={isScheduled}
                                        onCheckedChange={() => handleToggleServiceScheduled(project.id, item.id, isScheduled)}
                                        className="mt-0.5"
                                      />
                                      <div className="flex-1">
                                        <div className="flex justify-between items-start gap-2">
                                          <span className="text-sm text-gray-900 font-medium">{item.name}</span>
                                          <Badge variant="secondary" className="text-xs">
                                            {item.quantity}x
                                          </Badge>
                                        </div>
                                        <span className="text-xs text-gray-500">{t('Ingepland')}</span>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-xs text-gray-400 italic">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={project.transport_method || ''}
                          onValueChange={(value) => handleTransportChange(project.id, value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t('Select transport')} />
                          </SelectTrigger>
                          <SelectContent>
                            {TRANSPORT_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {t(option.label)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="w-full text-left hover:bg-gray-50 p-2 rounded transition-colors">
                              <div className="flex flex-wrap gap-1">
                                {(project.services || []).length > 0 ? (
                                  (project.services || []).map((service, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs px-2 py-0.5">
                                      {t(service)}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400 italic">{t('No services')}</span>
                                )}
                              </div>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="start">
                            <div className="space-y-2">
                              <h4 className="font-semibold text-sm mb-3">{t('Select Services')}</h4>
                              {AVAILABLE_SERVICES.map((service) => {
                                const isSelected = (project.services || []).includes(service);
                                return (
                                  <label 
                                    key={service} 
                                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const currentServices = project.services || [];
                                        const newServices = e.target.checked
                                          ? [...currentServices, service]
                                          : currentServices.filter(s => s !== service);
                                        handleServicesUpdate(project.id, newServices);
                                      }}
                                      className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <span className="text-sm text-gray-700">{t(service)}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const autoStatus = calculateAutoStatus(project);
                          const { daysToShow, daysToNextStatus, nextStatus } = calculateDaysToNextStatus(project);
                          
                          // Function to abbreviate status names
                          const abbreviateStatus = (status) => {
                            if (!status) return '';
                            if (status === 'preproduction') return t('Preprod.');
                            if (status === 'next_up') return t('Next Up');
                            if (status === 'active') return t('Active');
                            if (status === 'planning') return t('Planning');
                            if (status === 'complete') return t('Complete');
                            if (status === 'closing') return t('Closing');
                            return status.charAt(0).toUpperCase() + status.slice(1);
                          };
                          
                          return (
                            <div className="space-y-1">
                              <Badge className={statusColors[autoStatus]} variant="outline">
                                {t(autoStatus === 'next_up' ? 'Next Up' : autoStatus.charAt(0).toUpperCase() + autoStatus.slice(1))}
                              </Badge>
                              {daysToShow !== null && daysToShow >= 0 && (
                                <div className="text-[10px] text-gray-500 space-y-0.5">
                                  <div>{daysToShow}d → {t('show')}</div>
                                  {daysToNextStatus !== null && nextStatus && (
                                    <div className="whitespace-nowrap">
                                      {daysToNextStatus}d → {abbreviateStatus(nextStatus)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="space-y-0.5">
                          <div className="text-[11px] text-gray-600 flex justify-between gap-2">
                            <span>{t('Standard')}:</span>
                            <span className="font-medium text-blue-600">€{profitBreakdown.standardRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className="font-medium text-green-600">€{profitBreakdown.standard.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                          <div className="text-[11px] text-gray-600 flex justify-between gap-2">
                            <span>{t('Post-Event')}:</span>
                            <span className="font-medium text-blue-600">€{profitBreakdown.postCalcRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className="font-medium text-green-600">€{profitBreakdown.postCalc.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                          {profitBreakdown.realizationCorrection !== 0 && (
                            <div className="text-[11px] text-gray-600 flex justify-between gap-2">
                              <span>{t('Realization')}:</span>
                              <span></span>
                              <span className={`font-medium ${profitBreakdown.realizationCorrection >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {profitBreakdown.realizationCorrection >= 0 ? '+' : ''}€{profitBreakdown.realizationCorrection.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          )}
                          {profitBreakdown.additionalCosts !== 0 && (
                            <div className="text-[11px] text-gray-600 flex justify-between gap-2">
                              <span>{t('Add. Costs')}:</span>
                              <span></span>
                              <span className="font-medium text-red-600">
                                -€{profitBreakdown.additionalCosts.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          )}
                          {profitBreakdown.otherRevenue !== 0 && (
                            <div className="text-[11px] text-gray-600 flex justify-between gap-2">
                              <span>{t('Other Revenue')}:</span>
                              <span></span>
                              <span className="font-medium text-green-600">
                                +€{profitBreakdown.otherRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </span>
                            </div>
                          )}
                          <div className="text-sm font-semibold flex justify-between gap-2 pt-0.5 border-t border-gray-200">
                            <span>{t('Total')}:</span>
                            <span className="text-blue-600">€{profitBreakdown.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            <span className={profitBreakdown.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>€{profitBreakdown.netProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                          </div>
                        </div>
                      </TableCell>
                      {getBudgetColumns.map(category => {
                        const offerCost = getCategoryBudget(project, category);
                        const realizationCost = offer?.realization_costs?.[category] || 0;
                        const hasRealization = (realizationCost !== 0 || (offer?.realization_costs && category in offer.realization_costs)); // Check if realization is explicitly set even if 0
                        const difference = offerCost - realizationCost;

                        return (
                          <TableCell key={category} className="text-right">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-sm hover:bg-gray-50 p-1 rounded w-full text-right">
                                  {hasRealization ? (
                                    <div className="space-y-0.5">
                                      <div className="text-[10px] text-gray-500">
                                        Offer: €{offerCost.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </div>
                                      <div className="font-medium text-blue-600">
                                        €{realizationCost.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </div>
                                      <div className={`text-[10px] flex items-center justify-end gap-1 ${difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                        {difference !== 0 && (
                                          difference > 0 ? <ArrowUp className="w-2 h-2" /> : <ArrowDown className="w-2 h-2" />
                                        )}
                                        €{Math.abs(difference).toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </div>
                                    </div>
                                  ) : (
                                    <>€{offerCost.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</>
                                  )}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3" align="end">
                                <div className="space-y-3">
                                  <h4 className="font-semibold text-sm">{t(category.replace(/_/g, ' '))}</h4>
                                  <div className="space-y-2">
                                    <div className="text-xs text-gray-600">
                                      <span className="font-medium">{t('Offer Budget')}:</span> €{offerCost.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                    </div>
                                    <div>
                                      <Label htmlFor={`realization-${project.id}-${category}`} className="text-xs">{t('Realization')}</Label>
                                      <Input
                                        id={`realization-${project.id}-${category}`}
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        defaultValue={realizationCost !== 0 ? realizationCost.toString() : ''}
                                        onBlur={(e) => handleRealizationUpdate(project.id, category, e.target.value)}
                                        className="mt-1"
                                      />
                                    </div>
                                    {hasRealization && (
                                      <div className={`text-xs font-medium ${difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                                        {t('Difference')}: €{difference.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        );
                      })}

                      {/* New manual cost columns */}
                      {[
                        { key: 'personeelskosten_intern', label: 'Personeelskosten intern' },
                        { key: 'personeelskosten_extern', label: 'Personeelskosten extern' },
                        { key: 'reiskosten', label: 'Reiskosten' },
                        { key: 'mobiliteit', label: 'Mobiliteit' },
                        { key: 'overnachtingen', label: 'Overnachtingen' },
                        { key: 'breuk_verkoop', label: 'Breuk/verkoop' },
                        { key: 'internet_techniek', label: 'Internet/techniek' },
                        { key: 'overige_kosten', label: 'Overige kosten' }
                      ].map(({ key, label }) => {
                        const value = offer?.additional_costs?.[key] || 0;
                        return (
                          <TableCell key={key} className="text-right">
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="text-sm hover:bg-gray-50 p-1 rounded w-full text-right flex items-center justify-end gap-1">
                                  {value > 0 ? (
                                    <span className="font-medium">€{value.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  ) : (
                                    <span className="text-gray-400">€0.00</span>
                                  )}
                                  <Edit className="w-3 h-3 text-gray-400" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-56 p-3" align="end">
                                <div className="space-y-2">
                                  <Label htmlFor={`additional-cost-${project.id}-${key}`} className="text-sm font-semibold">{t(label)}</Label>
                                  <Input
                                    id={`additional-cost-${project.id}-${key}`}
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    defaultValue={value !== 0 ? value.toString() : ''}
                                    onBlur={(e) => handleCostUpdate(project.id, key, e.target.value)}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        );
                      })}

                      {/* Other Revenue Column */}
                      <TableCell className="text-right">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="text-sm hover:bg-gray-50 p-1 rounded w-full text-right flex items-center justify-end gap-1">
                              {profitBreakdown.otherRevenue > 0 ? (
                                <span className="font-medium text-green-600">€{profitBreakdown.otherRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              ) : (
                                <span className="text-gray-400">€0.00</span>
                              )}
                              <Edit className="w-3 h-3 text-gray-400" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-3" align="end">
                            <div className="space-y-2">
                              <Label htmlFor={`other-revenue-${project.id}`} className="text-sm font-semibold">{t('Overige omzet')}</Label>
                              <Input
                                id={`other-revenue-${project.id}`}
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                defaultValue={profitBreakdown.otherRevenue !== 0 ? profitBreakdown.otherRevenue.toString() : ''}
                                onBlur={(e) => handleOtherRevenueUpdate(project.id, e.target.value)}
                              />
                              <p className="text-xs text-gray-500">{t('Additional revenue discovered after the event')}</p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}