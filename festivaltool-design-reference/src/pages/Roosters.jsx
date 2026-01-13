import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Plus, Info, MapPin, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, startOfWeek, addDays, addWeeks, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import { createPageUrl } from "@/utils";

export default function RoostersPage() {
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [projects, setProjects] = useState([]);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [modalShifts, setModalShifts] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showOfficeShiftModal, setShowOfficeShiftModal] = useState(false);
  const [officeModalShifts, setOfficeModalShifts] = useState([]);
  const [officeModalDate, setOfficeModalDate] = useState(null);
  const [editModalDate, setEditModalDate] = useState(null);
  const [editModalProject, setEditModalProject] = useState(null);
  const [editModalShifts, setEditModalShifts] = useState([]);
  const scrollContainerRef = React.useRef(null);
  const [activeMonthIndex, setActiveMonthIndex] = useState(6); // Start at current month (6 months offset)

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

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shiftsData, staffData, projectsData, offersData, productsData, clientsData] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.Staff.list(),
        base44.entities.Project.list(),
        base44.entities.Offer.list(),
        base44.entities.Product.list(),
        base44.entities.Client.list()
      ]);

      // Filter out archived projects but keep all offers including archived (for concept shifts display)
      const activeProjects = (projectsData || []).filter(p => p.status !== 'archived');

      setShifts(shiftsData || []);
      setStaff(staffData || []);
      setProjects(activeProjects);
      setOffers(offersData || []);
      setProducts(productsData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Fout bij laden van gegevens');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (authState.authorized) {
      loadData();
    }
  }, [authState.authorized]);

  // Generate extended timeline (6 months back, then 3 years forward)
  const timelineDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    
    // Start from 6 months ago, first Monday of that week
    const startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    const firstMonday = startOfWeek(startDate, { weekStartsOn: 1 });
    
    // Generate 1460 days (4 years) of consecutive dates for unlimited scrolling
    for (let i = 0; i < 1460; i++) {
      dates.push(addDays(firstMonday, i));
    }
    
    return dates;
  }, []);
  
  // Generate month headers for navigation
  const monthHeaders = useMemo(() => {
    const months = [];
    const today = new Date();
    
    // Get unique months from timelineDates
    const uniqueMonths = new Set();
    timelineDates.forEach(date => {
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      if (!uniqueMonths.has(key)) {
        uniqueMonths.add(key);
        months.push(new Date(date.getFullYear(), date.getMonth(), 1));
      }
    });
    
    return months;
  }, [timelineDates]);
  
  const scrollToMonth = (monthDate, monthIndex) => {
    if (!scrollContainerRef.current) return;
    
    // Find first date of this month in timeline
    const firstDateOfMonth = timelineDates.findIndex(date => 
      date.getMonth() === monthDate.getMonth() && 
      date.getFullYear() === monthDate.getFullYear()
    );
    
    if (firstDateOfMonth >= 0) {
      const scrollPosition = firstDateOfMonth * 80; // 80px per day
      scrollContainerRef.current.scrollTo({ left: scrollPosition, behavior: 'smooth' });
      setActiveMonthIndex(monthIndex);
    }
  };
  
  // Initial scroll to current month
  useEffect(() => {
    if (!scrollContainerRef.current || timelineDates.length === 0) return;
    
    const today = new Date();
    const currentMonthIndex = monthHeaders.findIndex(m => 
      m.getMonth() === today.getMonth() && 
      m.getFullYear() === today.getFullYear()
    );
    
    if (currentMonthIndex >= 0) {
      scrollToMonth(monthHeaders[currentMonthIndex], currentMonthIndex);
    }
  }, [timelineDates.length]); // Run once when timeline is ready
  
  // Track scroll position to highlight active month (real-time, no throttle)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    
    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const currentDayIndex = Math.floor(scrollLeft / 80);
      
      if (currentDayIndex >= 0 && currentDayIndex < timelineDates.length) {
        const currentDate = timelineDates[currentDayIndex];
        
        const monthIdx = monthHeaders.findIndex(m => 
          m.getMonth() === currentDate.getMonth() && 
          m.getFullYear() === currentDate.getFullYear()
        );
        
        if (monthIdx >= 0) {
          setActiveMonthIndex(monthIdx);
        }
      }
    };
    
    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [timelineDates, monthHeaders]);

  // Get all events (projects + offers) and assign to rows for compact view
  const timelineEvents = useMemo(() => {
    const startDate = timelineDates[0];
    const endDate = timelineDates[timelineDates.length - 1];
    
    // Collect all projects
    const projectEvents = projects
      .filter(project => {
        if (!project.showdates || project.showdates.length === 0) return false;
        if (project.status === 'archived') return false;
        
        const projectDates = project.showdates.map(d => parseISO(d));
        const minDate = new Date(Math.min(...projectDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...projectDates.map(d => d.getTime())));
        
        return maxDate >= startDate && minDate <= endDate;
      })
      .map(project => ({
        id: project.id,
        type: 'project',
        data: project,
        dates: (project.showdates || []).map(d => parseISO(d)),
        setupDates: project.setup_date 
          ? (Array.isArray(project.setup_date) ? project.setup_date : [project.setup_date]).map(d => parseISO(d))
          : [],
        minDate: new Date(Math.min(...(project.showdates || []).map(d => new Date(d).getTime())))
      }));
    
    // Collect all offers (only active concept offers without projects)
    const offerIdsWithProjects = new Set(projects.map(p => p.offer_id).filter(Boolean));
    const offerEvents = offers
      .filter(offer => {
        if (!offer.showdates || offer.showdates.length === 0) return false;
        // Explicitly exclude archived, rejected, expired, and accepted offers
        if (['archived', 'rejected', 'expired', 'accepted'].includes(offer.status)) return false;
        // Only show draft, sent, under_review
        if (!['draft', 'sent', 'under_review'].includes(offer.status)) return false;
        // Skip offers that already have projects
        if (offerIdsWithProjects.has(offer.id)) return false;
        
        const offerDates = offer.showdates.map(d => parseISO(d));
        const minDate = new Date(Math.min(...offerDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...offerDates.map(d => d.getTime())));
        
        return maxDate >= startDate && minDate <= endDate;
      })
      .map(offer => ({
        id: offer.id,
        type: 'offer',
        data: offer,
        dates: (offer.showdates || []).map(d => parseISO(d)),
        setupDates: [],
        minDate: new Date(Math.min(...(offer.showdates || []).map(d => new Date(d).getTime())))
      }));
    
    // Combine and sort by start date
    const allEvents = [...projectEvents, ...offerEvents].sort((a, b) => 
      a.minDate.getTime() - b.minDate.getTime()
    );
    
    // Assign events to rows (greedy algorithm for compact layout)
    // Now considering label width to prevent overlaps
    const rowAssignments = [];
    const LABEL_WIDTH_DAYS = 3; // Label is ~180px = ~2-3 days width
    
    allEvents.forEach(event => {
      const allDates = [...event.dates, ...event.setupDates];
      const eventStartDate = new Date(Math.min(...allDates.map(d => d.getTime())));
      const eventEndDate = new Date(Math.max(...allDates.map(d => d.getTime())));
      
      // Find first available row
      let assignedRow = -1;
      for (let rowIdx = 0; rowIdx < 50; rowIdx++) {
        const rowOccupied = rowAssignments.some(assignment => {
          if (assignment.row !== rowIdx) return false;
          
          // Check if date ranges overlap (including label space)
          const assignmentStart = new Date(Math.min(...assignment.allDates.map(d => d.getTime())));
          const assignmentEnd = new Date(Math.max(...assignment.allDates.map(d => d.getTime())));
          
          // Extend start by label width to check for label overlap
          const eventStartWithLabel = new Date(eventStartDate);
          eventStartWithLabel.setDate(eventStartWithLabel.getDate() - LABEL_WIDTH_DAYS);
          
          const assignmentStartWithLabel = new Date(assignmentStart);
          assignmentStartWithLabel.setDate(assignmentStartWithLabel.getDate() - LABEL_WIDTH_DAYS);
          
          return !(eventEndDate < assignmentStartWithLabel || eventStartWithLabel > assignmentEnd);
        });
        
        if (!rowOccupied) {
          assignedRow = rowIdx;
          break;
        }
      }
      
      if (assignedRow >= 0) {
        rowAssignments.push({
          event,
          row: assignedRow,
          allDates
        });
      }
    });
    
    return rowAssignments;
  }, [projects, offers, timelineDates]);

  // Get office service shifts within timeline
  const timelineOfficeShifts = useMemo(() => {
    const startDate = timelineDates[0];
    const endDate = timelineDates[timelineDates.length - 1];
    
    return shifts.filter(shift => {
      if (!shift.is_office_service) return false;
      const shiftDate = parseISO(shift.shift_date);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  }, [shifts, timelineDates]);

  // Calculate max rows needed
  const maxRows = useMemo(() => {
    if (timelineEvents.length === 0) return 0;
    return Math.max(...timelineEvents.map(a => a.row)) + 1;
  }, [timelineEvents]);
  
  // Calculate dynamic row height based on max shifts in that row
  const getRowHeight = (rowIdx) => {
    // Find all events in this row
    const rowEvents = timelineEvents.filter(a => a.row === rowIdx);
    if (rowEvents.length === 0) return 80;
    
    // Find max shifts on any day for events in this row
    let maxShiftsInRow = 0;
    rowEvents.forEach(assignment => {
      assignment.allDates.forEach(date => {
        const dayShifts = shifts.filter(shift => {
          if (assignment.event.type === 'project') {
            return shift.project_id === assignment.event.id && isSameDay(parseISO(shift.shift_date), date);
          } else {
            return shift.offer_id === assignment.event.id && isSameDay(parseISO(shift.shift_date), date);
          }
        });
        maxShiftsInRow = Math.max(maxShiftsInRow, dayShifts.length);
      });
    });
    
    // Base height for label + margin + shift count * shift height
    const baseHeight = 100; // Enough for label
    const shiftHeight = 26; // Each shift takes ~26px
    return baseHeight + (maxShiftsInRow * shiftHeight);
  };

  // Calculate hardware summary for a specific date (projects only)
  const getHardwareSummaryForDateProjects = (date) => {
    const summary = {};
    
    timelineEvents.forEach(assignment => {
      if (assignment.event.type !== 'project') return;
      
      const isActiveDate = assignment.allDates.some(d => isSameDay(d, date));
      const project = assignment.event.data;
      
      if (isActiveDate && project.hardware_summary) {
        Object.entries(project.hardware_summary).forEach(([group, count]) => {
          const spareCount = (project.hardware_spares && project.hardware_spares[group]) || 0;
          const totalCount = count + spareCount;
          if (!summary[group]) summary[group] = 0;
          summary[group] += totalCount;
        });
      }
    });
    
    return summary;
  };

  // Calculate hardware summary for a specific date (offers only)
  const getHardwareSummaryForDateOffers = (date) => {
    const summary = {};
    
    timelineEvents.forEach(assignment => {
      if (assignment.event.type !== 'offer') return;
      
      const isShowDate = assignment.event.dates.some(d => isSameDay(d, date));
      const offer = assignment.event.data;
      
      if (isShowDate) {
        // Calculate hardware from offer lines
        (offer.offer_lines || []).forEach(line => {
          const product = products.find(p => p.id === line.product_id);
          if (product && product.hardware_group && product.hardware_group !== 'none' && line.quantity > 0) {
            if (!summary[product.hardware_group]) summary[product.hardware_group] = 0;
            summary[product.hardware_group] += line.quantity;
          }
        });
      }
    });
    
    return summary;
  };

  // Get service requirements from offer (for projects)
  const getServiceRequirements = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return [];
    
    const offer = offers.find(o => o.id === project.offer_id);
    if (!offer || !offer.offer_lines) return [];
    
    const serviceItems = [];
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.category === 'services' && line.quantity > 0) {
        serviceItems.push({
          name: product.name,
          quantity: line.quantity,
          product_id: product.id
        });
      }
    });
    
    return serviceItems;
  };

  // Get service requirements directly from offer
  const getServiceRequirementsFromOffer = (offer) => {
    if (!offer || !offer.offer_lines) return [];
    
    const serviceItems = [];
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.category === 'services' && line.quantity > 0) {
        serviceItems.push({
          name: product.name,
          quantity: line.quantity,
          product_id: product.id
        });
      }
    });
    
    return serviceItems;
  };

  // Get hardware summary from offer
  const getHardwareSummaryFromOffer = (offer) => {
    const summary = {};
    if (!offer || !offer.offer_lines) return summary;
    
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.hardware_group && product.hardware_group !== 'none' && line.quantity > 0) {
        if (!summary[product.hardware_group]) summary[product.hardware_group] = 0;
        summary[product.hardware_group] += line.quantity;
      }
    });
    
    return summary;
  };

  // Get shifts for a project and date
  const getShiftsForProjectDate = (projectId, date) => {
    return shifts.filter(shift => 
      shift.project_id === projectId && 
      isSameDay(parseISO(shift.shift_date), date)
    );
  };

  // Calculate weeks in current view
  const weeksInView = useMemo(() => {
    const weeks = [];
    const monthStart = timelineDates[0];
    const numWeeks = Math.ceil(timelineDates.length / 7);
    
    for (let i = 0; i < numWeeks; i++) {
      const weekStart = addWeeks(monthStart, i);
      const weekEnd = addDays(weekStart, 6);
      weeks.push({ start: weekStart, end: weekEnd });
    }
    return weeks;
  }, [timelineDates]);

  // Calculate weekly hardware summary (projects + offers)
  const getWeeklyHardwareSummary = (weekStart, weekEnd) => {
    const projectSummary = {};
    const offerSummary = {};
    
    // Loop through all days in the week
    for (let date = new Date(weekStart); date <= weekEnd; date = addDays(date, 1)) {
      // Projects
      const projectHardware = getHardwareSummaryForDateProjects(date);
      Object.entries(projectHardware).forEach(([group, count]) => {
        if (!projectSummary[group]) projectSummary[group] = 0;
        projectSummary[group] = Math.max(projectSummary[group], count); // Max per day in week
      });
      
      // Offers
      const offerHardware = getHardwareSummaryForDateOffers(date);
      Object.entries(offerHardware).forEach(([group, count]) => {
        if (!offerSummary[group]) offerSummary[group] = 0;
        offerSummary[group] = Math.max(offerSummary[group], count); // Max per day in week
      });
    }
    
    // Combine all unique groups
    const allGroups = new Set([...Object.keys(projectSummary), ...Object.keys(offerSummary)]);
    const combined = {};
    
    allGroups.forEach(group => {
      combined[group] = {
        projects: projectSummary[group] || 0,
        offers: offerSummary[group] || 0,
        total: (projectSummary[group] || 0) + (offerSummary[group] || 0)
      };
    });
    
    return combined;
  };

  // Open modal for concept shifts (for offers)
  const openConceptShiftModal = (offerId, date) => {
    const offer = offers.find(o => o.id === offerId);
    const serviceReqs = getServiceRequirementsFromOffer(offer);
    
    // Create initial shifts based on service requirements from offer
    const initialShifts = serviceReqs.length > 0 
      ? serviceReqs.map(service => ({
          role: service.name,
          start_time: '09:00',
          end_time: '17:00',
          briefing: '',
          is_concept: true,
          offer_id: offerId
        }))
      : [];
    
    // Always add one empty row
    initialShifts.push({ role: '', start_time: '09:00', end_time: '17:00', briefing: '', is_concept: true, offer_id: offerId });
    
    setEditModalDate(date);
    setEditModalShifts(initialShifts);
    setShowShiftModal(true);
  };

  // Get shifts for an offer and date
  const getShiftsForOfferDate = (offerId, date) => {
    return shifts.filter(shift => 
      shift.offer_id === offerId && 
      isSameDay(parseISO(shift.shift_date), date)
    );
  };

  // Open modal with pre-filled shifts based on service requirements (legacy - for add button)
  const openShiftModal = (projectId, date) => {
    const serviceReqs = getServiceRequirements(projectId);
    
    // Create initial shifts based on service requirements from offer
    const initialShifts = serviceReqs.length > 0 
      ? serviceReqs.map(service => ({
          role: service.name,
          start_time: '09:00',
          end_time: '17:00',
          briefing: ''
        }))
      : [];
    
    // Always add one empty row
    initialShifts.push({ role: '', start_time: '09:00', end_time: '17:00', briefing: '' });
    
    setSelectedProject(projectId);
    setSelectedDate(date);
    setModalShifts(initialShifts);
    setShowShiftModal(true);
  };

  // Open edit modal for project shifts with existing shifts
  const openEditShiftModal = (projectId, date) => {
    const existingShifts = shifts.filter(shift => 
      shift.project_id === projectId && 
      isSameDay(parseISO(shift.shift_date), date)
    );
    
    if (existingShifts.length > 0) {
      // Load existing shifts
      setEditModalShifts(existingShifts.map(shift => ({
        id: shift.id,
        role: shift.role,
        start_time: shift.start_time,
        end_time: shift.end_time,
        briefing: shift.briefing || '',
        location: shift.location || '',
        staff_id: shift.staff_id || null,
        status: shift.status
      })));
    } else {
      // No shifts yet, add one empty row
      const serviceReqs = getServiceRequirements(projectId);
      const initialShifts = serviceReqs.length > 0 
        ? serviceReqs.map(service => ({
            role: service.name,
            start_time: '09:00',
            end_time: '17:00',
            briefing: '',
            location: ''
          }))
        : [];
      
      initialShifts.push({ role: '', start_time: '09:00', end_time: '17:00', briefing: '', location: '' });
      setEditModalShifts(initialShifts);
    }
    
    setEditModalProject(projectId);
    setEditModalDate(date);
    setShowShiftModal(true);
  };

  const addEmptyEditShift = () => {
    setEditModalShifts([...editModalShifts, { 
      role: '', 
      start_time: '09:00', 
      end_time: '17:00', 
      briefing: '',
      location: ''
    }]);
  };

  const updateEditModalShift = (index, field, value) => {
    const updated = [...editModalShifts];
    updated[index][field] = value;
    setEditModalShifts(updated);
  };

  const removeEditModalShift = (index) => {
    if (editModalShifts.length > 1) {
      setEditModalShifts(editModalShifts.filter((_, i) => i !== index));
    }
  };

  const handleDeleteEditShift = async (shiftId, hasStaff) => {
    if (hasStaff) {
      if (!confirm('Deze shift is al toegewezen aan iemand. Weet je zeker dat je deze wilt verwijderen?')) {
        return;
      }
    }
    
    try {
      await base44.entities.Shift.delete(shiftId);
      setShifts(prevShifts => prevShifts.filter(s => s.id !== shiftId));
      toast.success('Shift verwijderd');
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Fout bij verwijderen shift');
    }
  };

  const handleSaveEditShifts = async () => {
    try {
      const shiftsToUpdate = [];
      const shiftsToCreate = [];
      
      editModalShifts.forEach(shift => {
        if (!shift.role || !shift.start_time || !shift.end_time) return;
        
        const shiftData = {
          project_id: editModalProject || null,
          offer_id: shift.offer_id || null,
          is_concept: shift.is_concept || false,
          shift_date: format(editModalDate, 'yyyy-MM-dd'),
          role: shift.role,
          start_time: shift.start_time,
          end_time: shift.end_time,
          briefing: shift.briefing || '',
          location: shift.location || '',
          status: shift.status || 'open'
        };
        
        if (shift.id) {
          shiftsToUpdate.push({ id: shift.id, data: shiftData });
        } else {
          shiftsToCreate.push(shiftData);
        }
      });
      
      // Update existing shifts
      const updatedShifts = [];
      for (const { id, data } of shiftsToUpdate) {
        const updated = await base44.entities.Shift.update(id, data);
        updatedShifts.push(updated);
      }
      
      // Create new shifts
      let createdShifts = [];
      if (shiftsToCreate.length > 0) {
        createdShifts = await base44.entities.Shift.bulkCreate(shiftsToCreate);
      }
      
      // Update local state without full reload
      setShifts(prevShifts => {
        // Remove old versions of updated shifts
        let newShifts = prevShifts.filter(s => !shiftsToUpdate.find(u => u.id === s.id));
        // Add updated and created shifts
        return [...newShifts, ...updatedShifts, ...createdShifts];
      });
      
      toast.success('Shifts opgeslagen');
      setShowShiftModal(false);
      setEditModalShifts([]);
      setEditModalDate(null);
      setEditModalProject(null);
    } catch (error) {
      console.error('Error saving shifts:', error);
      toast.error('Fout bij opslaan shifts');
    }
  };

  const addEmptyShift = () => {
    setModalShifts([...modalShifts, { role: '', start_time: '09:00', end_time: '17:00', briefing: '' }]);
  };

  const updateModalShift = (index, field, value) => {
    const updated = [...modalShifts];
    updated[index][field] = value;
    setModalShifts(updated);
  };

  const removeModalShift = (index) => {
    if (modalShifts.length > 1) {
      setModalShifts(modalShifts.filter((_, i) => i !== index));
    }
  };

  const handleSaveModalShifts = async () => {
    try {
      // Filter out empty shifts
      const shiftsToCreate = modalShifts
        .filter(shift => shift.role && shift.start_time && shift.end_time)
        .map(shift => ({
          project_id: selectedProject,
          shift_date: format(selectedDate, 'yyyy-MM-dd'),
          role: shift.role,
          start_time: shift.start_time,
          end_time: shift.end_time,
          briefing: shift.briefing || '',
          status: 'open'
        }));
      
      if (shiftsToCreate.length === 0) {
        toast.error('Geen shifts om toe te voegen');
        return;
      }
      
      const createdShifts = await base44.entities.Shift.bulkCreate(shiftsToCreate);
      
      // Update local state instead of reloading
      setShifts(prevShifts => [...prevShifts, ...createdShifts]);
      
      toast.success(`${shiftsToCreate.length} shift(s) toegevoegd`);
      setShowShiftModal(false);
      setModalShifts([]);
      setSelectedDate(null);
      setSelectedProject(null);
    } catch (error) {
      console.error('Error adding shifts:', error);
      toast.error('Fout bij toevoegen shifts');
    }
  };

  // Office shift modal handlers
  const openOfficeShiftModal = (date, existingShifts = []) => {
    setOfficeModalDate(date);
    
    if (existingShifts.length > 0) {
      // Edit existing shifts
      setOfficeModalShifts(existingShifts.map(shift => ({
        id: shift.id,
        office_service_title: shift.office_service_title || '',
        role: shift.role || '',
        start_time: shift.start_time,
        end_time: shift.end_time,
        location: shift.location || '',
        briefing: shift.briefing || '',
        staff_id: shift.staff_id || null
      })));
    } else {
      // Add new shift
      setOfficeModalShifts([{ 
        office_service_title: '', 
        role: '', 
        start_time: '09:00', 
        end_time: '17:00', 
        location: '',
        briefing: ''
      }]);
    }
    
    setShowOfficeShiftModal(true);
  };

  const addEmptyOfficeShift = () => {
    setOfficeModalShifts([...officeModalShifts, { 
      office_service_title: '', 
      role: '', 
      start_time: '09:00', 
      end_time: '17:00',
      location: '',
      briefing: ''
    }]);
  };

  const updateOfficeModalShift = (index, field, value) => {
    const updated = [...officeModalShifts];
    updated[index][field] = value;
    setOfficeModalShifts(updated);
  };

  const removeOfficeModalShift = (index) => {
    if (officeModalShifts.length > 1) {
      setOfficeModalShifts(officeModalShifts.filter((_, i) => i !== index));
    }
  };

  const handleDeleteOfficeShift = async (shiftId) => {
    try {
      await base44.entities.Shift.delete(shiftId);
      setShifts(prevShifts => prevShifts.filter(s => s.id !== shiftId));
      toast.success('Shift verwijderd');
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Fout bij verwijderen shift');
    }
  };

  const handleSaveOfficeShifts = async () => {
    try {
      const shiftsToUpdate = [];
      const shiftsToCreate = [];
      
      officeModalShifts.forEach(shift => {
        if (!shift.office_service_title && !shift.role) return;
        if (!shift.start_time || !shift.end_time) return;
        
        const shiftData = {
          is_office_service: true,
          office_service_title: shift.office_service_title,
          role: shift.role || shift.office_service_title,
          shift_date: format(officeModalDate, 'yyyy-MM-dd'),
          start_time: shift.start_time,
          end_time: shift.end_time,
          location: shift.location || '',
          briefing: shift.briefing || '',
          status: 'open'
        };
        
        if (shift.id) {
          shiftsToUpdate.push({ id: shift.id, data: shiftData });
        } else {
          shiftsToCreate.push(shiftData);
        }
      });
      
      // Update existing shifts
      const updatedShifts = [];
      for (const { id, data } of shiftsToUpdate) {
        const updated = await base44.entities.Shift.update(id, data);
        updatedShifts.push(updated);
      }
      
      // Create new shifts
      let createdShifts = [];
      if (shiftsToCreate.length > 0) {
        createdShifts = await base44.entities.Shift.bulkCreate(shiftsToCreate);
      }
      
      // Update local state without full reload
      setShifts(prevShifts => {
        // Remove old versions of updated shifts
        let newShifts = prevShifts.filter(s => !shiftsToUpdate.find(u => u.id === s.id));
        // Add updated and created shifts
        return [...newShifts, ...updatedShifts, ...createdShifts];
      });
      
      toast.success('Kantoordiensten opgeslagen');
      setShowOfficeShiftModal(false);
      setOfficeModalShifts([]);
      setOfficeModalDate(null);
    } catch (error) {
      console.error('Error saving office shifts:', error);
      toast.error('Fout bij opslaan kantoordiensten');
    }
  };



  if (authState.checking) {
    return <div className="p-6">Loading...</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  if (isLoading) {
    return <div className="p-6">Loading roosters...</div>;
  }

  return (
    <div className="fixed inset-0 bg-white flex flex-col">
      <Toaster />
      
      {/* Month Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white border-b-2 border-gray-300 shadow-sm">
        <div className="flex items-center gap-2 p-3 overflow-x-auto">
          {monthHeaders.map((monthDate, idx) => {
            const isActiveMonth = idx === activeMonthIndex;
            return (
              <button
                key={idx}
                onClick={() => scrollToMonth(monthDate, idx)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  isActiveMonth 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {format(monthDate, 'MMM yyyy', { locale: nl })}
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Timeline Grid - Horizontal Scroll */}
      <div className="flex-1 overflow-auto" ref={scrollContainerRef}>
        <div className="inline-block min-w-full">
          {/* Timeline Header */}
          <div className="sticky top-0 z-30 bg-gray-50 border-b">
            <div className="flex">
                {timelineDates.map((date, idx) => {
                  const isToday = isSameDay(date, new Date());
                  const isMonday = date.getDay() === 1;

                  return (
                    <div 
                      key={idx} 
                      className={`flex-shrink-0 p-2 text-center border-r ${isMonday ? 'border-l-2 border-l-gray-400' : ''} ${isToday ? 'bg-blue-100' : ''}`}
                      style={{ width: '80px' }}
                    >
                      <div className="text-xs font-semibold text-gray-700">
                        {format(date, 'EEE', { locale: nl })}
                      </div>
                      <div className="text-xs text-gray-600">
                        {format(date, 'd MMM', { locale: nl })}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Weekly Hardware Summary */}
          <div className="flex bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-indigo-200 sticky top-[41px] z-20">
              {weeksInView.map((week, weekIdx) => {
                const weekSummary = getWeeklyHardwareSummary(week.start, week.end);
                const hasHardware = Object.keys(weekSummary).length > 0;
                
                return (
                  <div 
                    key={weekIdx}
                    className="flex-shrink-0 border-r-2 border-indigo-300 p-2"
                    style={{ width: '560px' }}
                  >
                    {hasHardware ? (
                      <div className="space-y-1">
                        <div className="grid grid-cols-4 gap-1 text-[8px] font-semibold text-gray-600 mb-1 pb-1 border-b border-gray-300">
                          <div>Type</div>
                          <div className="text-center">Offerte</div>
                          <div className="text-center">Bevestigd</div>
                          <div className="text-center">Totaal</div>
                        </div>
                        {Object.entries(weekSummary).map(([group, counts]) => (
                          <div key={group} className="grid grid-cols-4 gap-1 text-[9px]">
                            <div className="capitalize font-medium text-gray-800">{group}</div>
                            <div className="text-center text-yellow-700">{counts.offers}</div>
                            <div className="text-center text-green-700">{counts.projects}</div>
                            <div className="text-center font-bold text-indigo-900">{counts.total}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[9px] text-gray-400 text-center py-2">Geen hardware</div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Event Grid Rows */}
          <div className="divide-y">
            {timelineEvents.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Geen projecten of offertes in deze periode</p>
              </div>
            ) : (
              <>
                {/* Office Services Lane - Always visible and sticky */}
                <div className="flex hover:bg-gray-50 bg-gray-100 sticky top-[134px] z-10">
                  <div className="flex flex-1">
                      {timelineDates.map((date, idx) => {
                            const isMonday = date.getDay() === 1;
                            const dayShifts = timelineOfficeShifts.filter(shift => 
                              isSameDay(parseISO(shift.shift_date), date)
                            );

                            return (
                              <TooltipProvider key={idx}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div 
                                      className={`flex-shrink-0 border-r p-1 ${isMonday ? 'border-l-2 border-l-gray-400' : ''} group relative`}
                                      style={{ width: '80px' }}
                                      onClick={() => dayShifts.length > 0 && openOfficeShiftModal(date, dayShifts)}
                                    >
                            {/* Shifts for this day */}
                            <div className="space-y-1">
                              {dayShifts.map(shift => {
                                const assignedStaff = staff.find(s => s.id === shift.staff_id);
                                
                                return (
                                  <div 
                                    key={shift.id}
                                    className={`text-[9px] p-1 rounded cursor-pointer ${
                                      shift.staff_id 
                                        ? 'bg-green-100 border border-green-300 text-green-900' 
                                        : 'bg-yellow-100 border border-yellow-300 text-yellow-900'
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openOfficeShiftModal(date, dayShifts);
                                    }}
                                  >
                                    <div className="font-semibold truncate">{shift.office_service_title || shift.role}</div>
                                    <div className="text-[8px] opacity-75">{shift.start_time}-{shift.end_time}</div>
                                    {shift.location && (
                                      <div className="text-[8px] truncate opacity-75">{shift.location}</div>
                                    )}
                                    {assignedStaff && (
                                      <div className="text-[8px] truncate">{assignedStaff.name}</div>
                                    )}
                                  </div>
                                );
                              })}
                              
                              {/* Add button - visible on hover */}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openOfficeShiftModal(date, []);
                                }}
                                className="w-full text-[9px] p-1 rounded border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Plus className="w-3 h-3 mx-auto" />
                              </button>
                            </div>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1">
                                      <h4 className="font-semibold text-sm">Kantoordiensten</h4>
                                      <p className="text-xs text-gray-500">{format(date, 'd MMMM yyyy', { locale: nl })}</p>
                                      {dayShifts.length > 0 && (
                                        <div className="text-xs mt-1">
                                          {dayShifts.map(shift => (
                                            <div key={shift.id} className="text-gray-600">
                                              • {shift.office_service_title || shift.role}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                      })}
                  </div>
                </div>

                {/* Event Rows - Compact Grid */}
                {Array.from({ length: maxRows }).map((_, rowIdx) => {
                  const rowHeight = getRowHeight(rowIdx);
                  return (
                    <div key={rowIdx} className="flex hover:bg-gray-50 relative" style={{ minHeight: `${rowHeight}px` }}>
                      <div className="flex flex-1">
                        {timelineDates.map((date, dateIdx) => {
                          // Find event for this row and date
                          const assignment = timelineEvents.find(a => {
                            if (a.row !== rowIdx) return false;
                            return a.allDates.some(d => isSameDay(d, date));
                          });
                          
                          if (!assignment) {
                            // Empty cell
                            const isMonday = date.getDay() === 1;
                            return (
                              <div 
                                key={dateIdx}
                                className={`flex-shrink-0 border-r p-1 ${isMonday ? 'border-l-2 border-l-gray-400' : ''}`}
                                style={{ width: '80px' }}
                              />
                            );
                          }
                          
                          const event = assignment.event;
                          const isProject = event.type === 'project';
                          const eventData = event.data;

                          const isShowdate = event.dates.some(pd => isSameDay(pd, date));
                          const isSetupDate = event.setupDates.some(sd => isSameDay(sd, date));
                          const isMonday = date.getDay() === 1;

                          // Show label on first showdate OR after a gap of 3+ days
                          const visibleShowDates = event.dates
                            .filter(showDate => timelineDates.some(td => isSameDay(td, showDate)))
                            .sort((a, b) => a.getTime() - b.getTime());

                          let shouldShowLabel = false;
                          if (visibleShowDates.length > 0 && isSameDay(date, visibleShowDates[0])) {
                            shouldShowLabel = true; // First showdate
                          } else if (isShowdate) {
                            // Check if there's a 3+ day gap from previous showdate
                            const currentIndex = visibleShowDates.findIndex(d => isSameDay(d, date));
                            if (currentIndex > 0) {
                              const prevShowDate = visibleShowDates[currentIndex - 1];
                              const daysDiff = Math.floor((date.getTime() - prevShowDate.getTime()) / (1000 * 60 * 60 * 24));
                              if (daysDiff >= 3) {
                                shouldShowLabel = true; // Gap detected
                              }
                            }
                          }
                          const isFirstShowDate = shouldShowLabel;
                          
                          // Get shifts for this event and date
                          const dayShifts = shifts.filter(shift => {
                            if (isProject) {
                              return shift.project_id === event.id && isSameDay(parseISO(shift.shift_date), date);
                            } else {
                              return shift.offer_id === event.id && isSameDay(parseISO(shift.shift_date), date);
                            }
                          });
                          
                          // Get hardware and service info
                          const hardwareSummary = isProject 
                            ? (eventData.hardware_summary || {})
                            : getHardwareSummaryFromOffer(eventData);
                          
                          const serviceRequirements = isProject
                            ? getServiceRequirements(event.id)
                            : getServiceRequirementsFromOffer(eventData);
                          
                          return (
                            <TooltipProvider key={dateIdx}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div 
                                    className={`flex-shrink-0 border-r p-1 group relative ${isMonday ? 'border-l-2 border-l-gray-400' : ''} ${
                                      isProject 
                                        ? (isShowdate ? 'bg-blue-50' : isSetupDate ? 'bg-purple-50' : '')
                                        : (isShowdate ? 'bg-yellow-100' : '')
                                    }`}
                                    style={{ width: '80px' }}
                                    onClick={() => {
                                      if (isProject && (isShowdate || isSetupDate)) {
                                        openEditShiftModal(event.id, date);
                                      } else if (!isProject && isShowdate && dayShifts.length > 0) {
                                        openConceptShiftModal(event.id, date);
                                      }
                                    }}
                                  >
                                    {/* Event label on first show date */}
                                    {isFirstShowDate && (
                                      <div className="absolute left-0 top-2 flex items-start" style={{ transform: 'translateX(-100%)' }}>
                                        <div 
                                          className={`border rounded-l px-2 py-1.5 mr-0.5 shadow-sm ${
                                            isProject 
                                              ? 'bg-blue-50 border-blue-300'
                                              : 'bg-yellow-50 border-yellow-400'
                                          }`}
                                          style={{ minWidth: '200px', maxWidth: '200px' }}
                                        >
                                          <div className="flex items-center gap-1 mb-0.5">
                                            <Badge 
                                              variant="outline" 
                                              className={`text-[8px] ${
                                                isProject
                                                  ? 'bg-blue-100 text-blue-900 border-blue-300'
                                                  : 'bg-yellow-200 text-yellow-900 border-yellow-400'
                                              }`}
                                            >
                                              {isProject ? 'PROJECT' : 'OFFERTE'}
                                            </Badge>
                                          </div>
                                          <div className="flex items-center gap-1 group/link">
                                            <h4 className="font-semibold text-[10px] text-gray-900 truncate flex-1">
                                              {eventData.project_name}
                                            </h4>
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                const url = isProject 
                                                  ? createPageUrl(`ProjectDetail?id=${event.id}`)
                                                  : createPageUrl(`OfferEditor?id=${event.id}`);
                                                window.open(url, '_blank');
                                              }}
                                              className="opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0"
                                            >
                                              <ExternalLink className="w-3 h-3 text-blue-600 hover:text-blue-800" />
                                            </button>
                                          </div>
                                          {eventData.project_location && (
                                            <div className="flex items-center gap-1 text-[9px] text-gray-600 truncate">
                                              <MapPin className="w-2.5 h-2.5 flex-shrink-0" />
                                              <span className="truncate">{eventData.project_location}</span>
                                            </div>
                                          )}
                                          {Object.keys(hardwareSummary).length > 0 && (
                                            <div className="text-[8px] text-gray-600 mt-0.5">
                                              {Object.entries(hardwareSummary).slice(0, 2).map(([group, count]) => {
                                                if (isProject) {
                                                  const spareCount = (eventData.hardware_spares && eventData.hardware_spares[group]) || 0;
                                                  const totalCount = count + spareCount;
                                                  return (
                                                    <div key={group} className="flex justify-between">
                                                      <span className="capitalize">{group}</span>
                                                      <span className="font-semibold">{totalCount}</span>
                                                    </div>
                                                  );
                                                } else {
                                                  return (
                                                    <div key={group} className="flex justify-between">
                                                      <span className="capitalize">{group}</span>
                                                      <span className="font-semibold">{count}</span>
                                                    </div>
                                                  );
                                                }
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {isShowdate && (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-[9px] mb-1 w-full justify-center ${
                                          isProject
                                            ? 'bg-blue-200 text-blue-900 border-blue-400'
                                            : 'bg-yellow-200 text-yellow-900 border-yellow-400'
                                        }`}
                                      >
                                        SHOW
                                      </Badge>
                                    )}
                                    {isSetupDate && !isShowdate && (
                                      <Badge variant="outline" className="text-[9px] bg-purple-200 text-purple-900 border-purple-400 mb-1 w-full justify-center">
                                        SETUP
                                      </Badge>
                                    )}
                                    
                                    {/* Shifts for this day */}
                                    <div className="space-y-1">
                                      {dayShifts.map(shift => {
                                        const assignedStaff = staff.find(s => s.id === shift.staff_id);
                                        
                                        return (
                                          <div 
                                            key={shift.id}
                                            className={`text-[9px] p-1 rounded cursor-pointer ${
                                              shift.staff_id 
                                                ? (isProject ? 'bg-green-100 border border-green-300 text-green-900' : 'bg-orange-100 border border-orange-300 text-orange-900')
                                                : (isProject ? 'bg-yellow-100 border border-yellow-300 text-yellow-900' : 'bg-yellow-200 border border-yellow-400 text-yellow-900')
                                            }`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isProject) {
                                                openEditShiftModal(event.id, date);
                                              } else {
                                                openConceptShiftModal(event.id, date);
                                              }
                                            }}
                                          >
                                            <div className="font-semibold truncate">{shift.role}</div>
                                            <div className="text-[8px] opacity-75">{shift.start_time}-{shift.end_time}</div>
                                            {assignedStaff && (
                                              <div className="text-[8px] truncate">{assignedStaff.name}</div>
                                            )}
                                          </div>
                                        );
                                      })}
                                      
                                      {/* Add shift button - visible on hover */}
                                      {((isProject && (isShowdate || isSetupDate)) || (!isProject && isShowdate)) && (
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (isProject) {
                                              openEditShiftModal(event.id, date);
                                            } else {
                                              openConceptShiftModal(event.id, date);
                                            }
                                          }}
                                          className={`w-full text-[9px] p-1 rounded border border-dashed text-gray-500 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100 ${
                                            isProject ? 'border-gray-300' : 'border-yellow-400 text-yellow-700 hover:bg-yellow-100 hover:border-yellow-500'
                                          }`}
                                        >
                                          <Plus className="w-3 h-3 mx-auto" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-sm">
                                  <div className="space-y-1">
                                    <h4 className="font-semibold text-sm">{eventData.project_name}</h4>
                                    {(isShowdate || isSetupDate) && (
                                      <p className="text-xs text-gray-500">{format(date, 'd MMMM yyyy', { locale: nl })}</p>
                                    )}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Office Shift Modal */}
      <Dialog open={showOfficeShiftModal} onOpenChange={setShowOfficeShiftModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Kantoordiensten - {officeModalDate && format(officeModalDate, 'd MMMM yyyy', { locale: nl })}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {officeModalShifts.map((shift, idx) => (
                <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded border">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Titel</Label>
                        <Input 
                          placeholder="Bijv. Administratie"
                          value={shift.office_service_title}
                          onChange={(e) => updateOfficeModalShift(idx, 'office_service_title', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Locatie</Label>
                        <Input 
                          placeholder="Bijv. Kantoor Utrecht"
                          value={shift.location}
                          onChange={(e) => updateOfficeModalShift(idx, 'location', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input 
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => updateOfficeModalShift(idx, 'start_time', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Eind</Label>
                        <Input 
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => updateOfficeModalShift(idx, 'end_time', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Rol (optioneel)</Label>
                        <Input 
                          placeholder="Bijv. Manager"
                          value={shift.role}
                          onChange={(e) => updateOfficeModalShift(idx, 'role', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Notitie</Label>
                      <Input 
                        placeholder="Optioneel"
                        value={shift.briefing}
                        onChange={(e) => updateOfficeModalShift(idx, 'briefing', e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {shift.id && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          if (confirm('Weet je zeker dat je deze shift wilt verwijderen?')) {
                            handleDeleteOfficeShift(shift.id);
                            removeOfficeModalShift(idx);
                          }
                        }}
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700"
                      >
                        🗑️
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => removeOfficeModalShift(idx)}
                      className="h-9 w-9 p-0"
                      disabled={officeModalShifts.length === 1}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              ))}
              
              <Button 
                variant="outline"
                onClick={addEmptyOfficeShift}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nog een kantoordienst toevoegen
              </Button>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowOfficeShiftModal(false)}>
                  Annuleren
                </Button>
                <Button onClick={handleSaveOfficeShifts}>
                  Opslaan ({officeModalShifts.filter(s => (s.office_service_title || s.role) && s.start_time && s.end_time).length})
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Shift Edit Modal */}
      <Dialog open={showShiftModal} onOpenChange={(open) => {
          setShowShiftModal(open);
          if (!open) {
            setEditModalShifts([]);
            setEditModalDate(null);
            setEditModalProject(null);
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Shifts beheren - {editModalDate && format(editModalDate, 'd MMMM yyyy', { locale: nl })}
                {editModalProject && (
                  <span className="text-sm font-normal text-gray-600 ml-2">
                    ({projects.find(p => p.id === editModalProject)?.project_name})
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {editModalShifts.map((shift, idx) => {
                const serviceReqs = editModalProject ? getServiceRequirements(editModalProject) : [];
                const availableRoles = serviceReqs.map(s => s.name);
                const assignedStaff = shift.staff_id ? staff.find(s => s.id === shift.staff_id) : null;
                
                return (
                  <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded border">
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-5 gap-2">
                        <div>
                          <Label className="text-xs">Dienst</Label>
                          <Select value={shift.role} onValueChange={(val) => updateEditModalShift(idx, 'role', val)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Kies dienst" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.length > 0 ? (
                                availableRoles.map(role => (
                                  <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))
                              ) : (
                                <SelectItem value="custom">Vrije invoer</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Start</Label>
                          <Input 
                            type="time"
                            value={shift.start_time}
                            onChange={(e) => updateEditModalShift(idx, 'start_time', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Eind</Label>
                          <Input 
                            type="time"
                            value={shift.end_time}
                            onChange={(e) => updateEditModalShift(idx, 'end_time', e.target.value)}
                            className="h-9"
                          />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs">Locatie</Label>
                          <Input 
                            placeholder="Optioneel"
                            value={shift.location || ''}
                            onChange={(e) => updateEditModalShift(idx, 'location', e.target.value)}
                            className="h-9"
                          />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Notitie</Label>
                        <Input 
                          placeholder="Optioneel"
                          value={shift.briefing}
                          onChange={(e) => updateEditModalShift(idx, 'briefing', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      {assignedStaff && (
                        <div className="bg-green-50 border border-green-200 rounded p-2">
                          <p className="text-xs text-green-800">
                            ✓ Toegewezen aan: <span className="font-semibold">{assignedStaff.name}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {shift.id && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => {
                            handleDeleteEditShift(shift.id, !!shift.staff_id);
                            removeEditModalShift(idx);
                          }}
                          className="h-9 w-9 p-0 text-red-600 hover:text-red-700"
                        >
                          🗑️
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => removeEditModalShift(idx)}
                        className="h-9 w-9 p-0"
                        disabled={editModalShifts.length === 1}
                      >
                        ×
                      </Button>
                    </div>
                  </div>
                );
              })}
              
              <Button 
                variant="outline"
                onClick={addEmptyEditShift}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nog een shift toevoegen
              </Button>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowShiftModal(false);
                  setEditModalShifts([]);
                  setEditModalDate(null);
                  setEditModalProject(null);
                }}>
                  Annuleren
                </Button>
                <Button onClick={handleSaveEditShifts}>
                  Opslaan ({editModalShifts.filter(s => s.role && s.start_time && s.end_time).length})
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}