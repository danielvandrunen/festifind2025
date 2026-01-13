import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { 
  ArrowLeft, 
  Calendar, 
  CheckCircle, 
  Circle, 
  Clock, 
  Edit2,
  Save,
  Settings,
  Mail,
  Phone,
  FileText,
  ClipboardList,
  Users,
  DollarSign,
  Target,
  ChevronLeft,
  ChevronRight,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff
} from "lucide-react";
import { format, differenceInDays, addDays, getMonth, getYear } from "date-fns";
import { createPageUrl } from "@/utils";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import OfferA4View from "../components/offers/review/OfferA4View";
import ShiftSummaryView from "../components/projects/detail/ShiftSummaryView";
import PackingSlipTab from "../components/projects/detail/PackingSlipTab";
import MediaPreviewModal from "../components/employee/MediaPreviewModal";
import FinancialGrid from "../components/projects/detail/FinancialGrid";

const statusIcons = {
  not_started: Circle,
  in_progress: Clock,
  complete: CheckCircle
};

const statusColors = {
  not_started: "text-gray-400",
  in_progress: "text-blue-600",
  complete: "text-green-600"
};

const projectStatusColors = {
  planning: { bg: "bg-blue-500", text: "text-blue-800", badge: "bg-blue-100 text-blue-800 border-blue-300" },
  preproduction: { bg: "bg-yellow-500", text: "text-yellow-800", badge: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  next_up: { bg: "bg-orange-500", text: "text-orange-800", badge: "bg-orange-100 text-orange-800 border-orange-300" },
  active: { bg: "bg-green-500", text: "text-green-800", badge: "bg-green-100 text-green-800 border-green-300" },
  complete: { bg: "bg-gray-500", text: "text-gray-800", badge: "bg-gray-100 text-gray-800 border-gray-300" }
};

const serviceColors = {
  'Cashless': 'bg-blue-100 text-blue-800 border-blue-300',
  'Ticketing': 'bg-purple-100 text-purple-800 border-purple-300',
  'Festival App': 'bg-green-100 text-green-800 border-green-300',
  'CRM': 'bg-orange-100 text-orange-800 border-orange-300'
};

export default function ProjectDetail() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);
  const [taskTemplates, setTaskTemplates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [activeService, setActiveService] = useState(null);
  const [showThresholdSettings, setShowThresholdSettings] = useState(false);
  const [thresholds, setThresholds] = useState({ preproduction_days: 19, next_up_days: 5 });
  const [savingNotes, setSavingNotes] = useState(false);
  const [evaluationNotes, setEvaluationNotes] = useState('');
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [offer, setOffer] = useState(null);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [setupDates, setSetupDates] = useState([]);
  const [savingSetupDates, setSavingSetupDates] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [previewMedia, setPreviewMedia] = useState(null);
  const [hardwareSpares, setHardwareSpares] = useState({});
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const projectId = urlParams.get('id');

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

  const calculateAutoStatus = (proj) => {
    if (proj.status === 'archived') return 'archived';
    
    if (!proj.showdates || proj.showdates.length === 0) {
      if (proj.status === 'complete' || proj.status === 'closing') {
        return proj.status;
      }
      return 'planning';
    }
    
    const sortedShowdates = proj.showdates
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (sortedShowdates.length === 0) return 'planning';

    const firstShowdate = sortedShowdates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const daysUntilShow = differenceInDays(firstShowdate, today);
    const thresholds = proj.status_thresholds || { preproduction_days: 19, next_up_days: 5 };
    
    if (daysUntilShow < 0) {
      if (proj.status === 'closing') return 'closing';
      return 'complete';
    } else if (daysUntilShow === 0) {
      return 'active';
    }
    
    if (daysUntilShow <= thresholds.next_up_days) {
      return 'next_up';
    } else if (daysUntilShow <= thresholds.preproduction_days) {
      return 'preproduction';
    } else {
      return 'planning';
    }
  };

  const syncTasksWithTemplate = useCallback((currentTasks, templates, selectedServices, showdates) => {
    const tasksMap = new Map(currentTasks.map(t => [t.id, t]));
    const newTasks = [];

    // Get first showdate for deadline calculation
    const firstShowdate = showdates && showdates.length > 0 
      ? showdates.sort()[0] 
      : null;

    templates
      .filter(template => selectedServices.includes(template.service))
      .forEach(template => {
        (template.tasks || []).forEach(templateTask => {
          const existingTask = tasksMap.get(templateTask.id);
          
          // Calculate deadline from first showdate - offset (offset is days BEFORE showdate)
          let deadlineDate = null;
          if (firstShowdate && templateTask.deadline_offset !== undefined) {
            deadlineDate = addDays(new Date(firstShowdate), -templateTask.deadline_offset);
          }
          
          if (existingTask) {
            const existingSubtaskMap = new Map(
              (existingTask.subtasks || []).map(st => [st.id, st])
            );
            
            const mergedSubtasks = (templateTask.subtasks || []).map(templateSubtask => {
              const existing = existingSubtaskMap.get(templateSubtask.id);
              return existing || {
                id: templateSubtask.id,
                name: templateSubtask.name,
                status: 'not_started'
              };
            });
            
            newTasks.push({
              ...existingTask,
              name: templateTask.name,
              deadline_date: deadlineDate ? deadlineDate.toISOString().split('T')[0] : existingTask.deadline_date,
              subtasks: mergedSubtasks,
              display_order: templateTask.display_order
            });
          } else {
            newTasks.push({
              id: templateTask.id,
              service: template.service,
              name: templateTask.name,
              deadline_date: deadlineDate ? deadlineDate.toISOString().split('T')[0] : null,
              status: 'not_started',
              notes: '',
              subtasks: (templateTask.subtasks || []).map(st => ({
                id: st.id,
                name: st.name,
                status: 'not_started'
              })),
              display_order: templateTask.display_order,
              is_custom: false
            });
          }
        });
      });

    currentTasks.forEach(task => {
      if (task.is_custom && !selectedServices.includes(task.service)) {
        newTasks.push(task);
      }
    });

    return newTasks.sort((a, b) => {
      if (a.service !== b.service) {
        return a.service.localeCompare(b.service);
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });
  }, []);

  const loadProjectData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [projectData, templatesData, productsData, categorySettingsData, shiftsData, staffData, offersData] = await Promise.all([
        base44.entities.Project.get(projectId),
        base44.entities.TaskTemplate.list(),
        base44.entities.Product.list(),
        base44.entities.ProductCategorySetting.list(),
        base44.entities.Shift.list(),
        base44.entities.Staff.list(),
        base44.entities.Offer.list()
      ]);

      setProducts(productsData);
      setCategorySettings(categorySettingsData);
      setShifts(shiftsData?.filter(s => s.project_id === projectId) || []);
      setStaff(staffData || []);

      if (projectData.client_id) {
        const clientData = await base44.entities.Client.get(projectData.client_id);
        setClient(clientData);
      }

      if (projectData.offer_id) {
        const offerData = offersData.find(o => o.id === projectData.offer_id);
        setOffer(offerData);
      }

      setTaskTemplates(templatesData);
      setThresholds(projectData.status_thresholds || { preproduction_days: 19, next_up_days: 5 });
      setHardwareSpares(projectData.hardware_spares || {});
      
      const defaultEvaluation = "<h2>Voorbereiding</h2><p><br></p><p><br></p><h2>Show</h2><p><br></p><p><br></p><h2>Afhandeling</h2><p><br></p><p><br></p>";
      setEvaluationNotes(projectData.evaluation_notes || defaultEvaluation);
      
      // Initialize setup dates (support multiple dates)
      if (projectData.setup_date) {
        setSetupDates(Array.isArray(projectData.setup_date) ? projectData.setup_date : [projectData.setup_date]);
      } else {
        setSetupDates([]);
      }
      
      const syncedTasks = syncTasksWithTemplate(
        projectData.tasks || [],
        templatesData,
        projectData.services || [],
        projectData.showdates || []
      );
      
      const updatedProject = { ...projectData, tasks: syncedTasks };
      setProject(updatedProject);
      
      if (!activeService && updatedProject.services && updatedProject.services.length > 0) {
        setActiveService(updatedProject.services[0]);
      }
      
      if (JSON.stringify(syncedTasks) !== JSON.stringify(projectData.tasks)) {
        await base44.entities.Project.update(projectId, { tasks: syncedTasks });
      }
    } catch (error) {
      console.error("Error loading project:", error);
      toast.error("Failed to load project data");
      navigate(createPageUrl('Projects'));
    }
    setIsLoading(false);
  }, [projectId, navigate, syncTasksWithTemplate, activeService]);

  useEffect(() => {
    if (!authState.authorized) return;
    
    if (!projectId) {
      navigate(createPageUrl('Projects'));
      return;
    }
    loadProjectData();
  }, [projectId, navigate, authState.authorized, loadProjectData]);

  const notesTimeouts = useMemo(() => ({}), []);

  const debouncedSaveNotes = useCallback((taskId, notes) => {
    if (notesTimeouts[taskId]) {
      clearTimeout(notesTimeouts[taskId]);
    }

    notesTimeouts[taskId] = setTimeout(async () => {
      setSavingNotes(true);
      try {
        setProject(prevProject => {
          if (!prevProject) return prevProject;
          const updatedTasks = prevProject.tasks.map(task =>
            task.id === taskId ? { ...task, notes } : task
          );
          base44.entities.Project.update(projectId, { tasks: updatedTasks });
          return { ...prevProject, tasks: updatedTasks };
        });
      } catch (error) {
        toast.error("Failed to save notes");
      } finally {
        setSavingNotes(false);
        delete notesTimeouts[taskId];
      }
    }, 1000);
  }, [projectId, notesTimeouts]);

  const handleTaskStatusChange = async (taskId, newStatus, subtaskId = null) => {
    const updatedTasks = project.tasks.map(task => {
      if (task.id === taskId) {
        if (subtaskId) {
          return {
            ...task,
            subtasks: task.subtasks.map(st =>
              st.id === subtaskId ? { ...st, status: newStatus } : st
            )
          };
        }
        return { ...task, status: newStatus };
      }
      return task;
    });

    try {
      await base44.entities.Project.update(projectId, { tasks: updatedTasks });
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
    } catch (error) {
      toast.error("Failed to update task");
    }
  };

  const handleNotesChange = (taskId, notes) => {
    setProject(prev => ({
      ...prev,
      tasks: prev.tasks.map(task =>
        task.id === taskId ? { ...task, notes } : task
      )
    }));
    
    debouncedSaveNotes(taskId, notes);
  };

  const handleDeadlineChange = async (taskId, newDate) => {
    const deadlineString = newDate ? format(newDate, 'yyyy-MM-dd') : null;
    
    const updatedTasks = project.tasks.map(task => 
      task.id === taskId ? { ...task, deadline_date: deadlineString } : task
    );

    try {
      await base44.entities.Project.update(projectId, { tasks: updatedTasks });
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
      toast.success("Deadline updated");
    } catch (error) {
      toast.error("Failed to update deadline");
    }
  };

  const handleArchiveTask = async (taskId) => {
    const updatedTasks = project.tasks.map(task => 
      task.id === taskId ? { ...task, is_archived: true } : task
    );

    try {
      await base44.entities.Project.update(projectId, { tasks: updatedTasks });
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
      toast.success("Task archived");
    } catch (error) {
      toast.error("Failed to archive task");
    }
  };

  const handleUnarchiveTask = async (taskId) => {
    const updatedTasks = project.tasks.map(task => 
      task.id === taskId ? { ...task, is_archived: false } : task
    );

    try {
      await base44.entities.Project.update(projectId, { tasks: updatedTasks });
      setProject(prev => ({ ...prev, tasks: updatedTasks }));
      toast.success("Task unarchived");
    } catch (error) {
      toast.error("Failed to unarchive task");
    }
  };

  const handleSaveThresholds = async () => {
    try {
      await base44.entities.Project.update(projectId, { status_thresholds: thresholds });
      setProject(prev => ({ ...prev, status_thresholds: thresholds }));
      setShowThresholdSettings(false);
      toast.success("Status thresholds updated");
    } catch (error) {
      toast.error("Failed to update thresholds");
    }
  };

  const handleSaveEvaluation = async () => {
    setSavingEvaluation(true);
    try {
      await base44.entities.Project.update(projectId, { evaluation_notes: evaluationNotes });
      setProject(prev => ({ ...prev, evaluation_notes: evaluationNotes }));
      toast.success("Evaluation saved");
    } catch (error) {
      toast.error("Failed to save evaluation");
    } finally {
      setSavingEvaluation(false);
    }
  };

  const handleSaveSetupDates = async () => {
    setSavingSetupDates(true);
    try {
      // Store as single date if only one, array if multiple
      const setupDateValue = setupDates.length === 1 ? setupDates[0] : setupDates;
      await base44.entities.Project.update(projectId, { setup_date: setupDateValue });
      setProject(prev => ({ ...prev, setup_date: setupDateValue }));
      toast.success("Setup dates saved");
    } catch (error) {
      toast.error("Failed to save setup dates");
    } finally {
      setSavingSetupDates(false);
    }
  };

  const handleSpareChange = async (group, delta) => {
    const currentSpare = hardwareSpares[group] || 0;
    const newSpare = Math.max(0, currentSpare + delta);
    const updatedSpares = { ...hardwareSpares, [group]: newSpare };
    setHardwareSpares(updatedSpares);
    
    try {
      await base44.entities.Project.update(projectId, { hardware_spares: updatedSpares });
      setProject(prev => ({ ...prev, hardware_spares: updatedSpares }));
    } catch (error) {
      toast.error("Failed to update spares");
    }
  };

  const handleSetupDatesChange = (dates) => {
    const dateStrings = dates ? dates.map(date => format(date, 'yyyy-MM-dd')) : [];
    setSetupDates(dateStrings);
  };

  const calculateProgress = () => {
    if (!project?.tasks || project.tasks.length === 0) return 0;
    
    let totalItems = 0;
    let completedItems = 0;

    project.tasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        totalItems += task.subtasks.length;
        completedItems += task.subtasks.filter(st => st.status === 'complete').length;
      } else {
        totalItems += 1;
        if (task.status === 'complete') completedItems += 1;
      }
    });

    return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  };

  const calculateServiceProgress = (serviceName) => {
    const serviceTasks = project?.tasks?.filter(t => t.service === serviceName) || [];
    if (serviceTasks.length === 0) return { completed: 0, total: 0, percentage: 0 };
    
    let totalItems = 0;
    let completedItems = 0;

    serviceTasks.forEach(task => {
      if (task.subtasks && task.subtasks.length > 0) {
        totalItems += task.subtasks.length;
        completedItems += task.subtasks.filter(st => st.status === 'complete').length;
      } else {
        totalItems += 1;
        if (task.status === 'complete') completedItems += 1;
      }
    });

    return {
      completed: completedItems,
      total: totalItems,
      percentage: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
    };
  };

  const getDaysUntilShow = () => {
    if (!project?.showdates || project.showdates.length === 0) return null;
    
    const sortedShowdates = project.showdates
      .map(d => new Date(d))
      .filter(d => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    
    if (sortedShowdates.length === 0) return null;
    
    const firstShowdate = sortedShowdates[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return differenceInDays(firstShowdate, today);
  };

  const renderTimeline = () => {
    const daysUntilShow = getDaysUntilShow();
    if (daysUntilShow === null || daysUntilShow < 0) return null;

    const thresholds = project?.status_thresholds || { preproduction_days: 19, next_up_days: 5 };
    const maxDays = Math.max(daysUntilShow, thresholds.preproduction_days + 10);
    
    const planningDays = maxDays - thresholds.preproduction_days;
    const preproductionDays = thresholds.preproduction_days - thresholds.next_up_days;
    const nextUpDays = thresholds.next_up_days;
    
    const planningWidth = (planningDays / maxDays) * 100;
    const preproductionWidth = (preproductionDays / maxDays) * 100;
    const nextUpWidth = (nextUpDays / maxDays) * 100;
    
    const currentPosition = ((maxDays - daysUntilShow) / maxDays) * 100;
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span>Timeline to Show</span>
          <span>{daysUntilShow} days remaining</span>
        </div>
        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden flex">
          <div 
            className={`${projectStatusColors.planning.bg} flex items-center justify-center text-white text-xs font-semibold`}
            style={{ width: `${planningWidth}%` }}
          >
            {planningDays > 5 && `Planning (${planningDays}d)`}
          </div>
          <div 
            className={`${projectStatusColors.preproduction.bg} flex items-center justify-center text-white text-xs font-semibold`}
            style={{ width: `${preproductionWidth}%` }}
          >
            {preproductionDays > 5 && `Preproduction (${preproductionDays}d)`}
          </div>
          <div 
            className={`${projectStatusColors.next_up.bg} flex items-center justify-center text-white text-xs font-semibold`}
            style={{ width: `${nextUpWidth}%` }}
          >
            {nextUpDays > 2 && `Next Up (${nextUpDays}d)`}
          </div>
          <div 
            className="absolute top-0 bottom-0 w-1 bg-red-600 shadow-lg"
            style={{ left: `${currentPosition}%` }}
          >
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              Today
            </div>
          </div>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Now</span>
          <span>Show Day</span>
        </div>
      </div>
    );
  };

  if (authState.checking) {
    return <div className="p-6">Loading...</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  if (isLoading || !project) {
    return <div className="p-6">Loading project details...</div>;
  }

  const progress = calculateProgress();
  const daysUntilShow = getDaysUntilShow();
  const projectStatus = calculateAutoStatus(project);
  const groupedTasks = {};
  
  project.tasks.forEach(task => {
    if (!groupedTasks[task.service]) {
      groupedTasks[task.service] = [];
    }
    groupedTasks[task.service].push(task);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => navigate(createPageUrl('Projects'))}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Projects
          </Button>
          {savingNotes && (
            <span className="text-sm text-gray-500 animate-pulse">Saving notes...</span>
          )}
        </div>

        {/* Project Header Card */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.project_name}</h1>
              <div className="flex flex-col gap-2 text-sm text-gray-600">
                {client && (
                  <>
                    <div className="flex items-center gap-2">
                      <strong>Client:</strong>
                      <button
                        onClick={() => navigate(createPageUrl(`Clients?view=${client.id}`))}
                        className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                      >
                        {client.company_name}
                      </button>
                    </div>
                    <div className="flex items-center gap-4 ml-12">
                      {client.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4 text-gray-400" />
                          <a href={`mailto:${client.email}`} className="text-gray-600 hover:text-blue-600">
                            {client.email}
                          </a>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4 text-gray-400" />
                          <a href={`tel:${client.phone}`} className="text-gray-600 hover:text-blue-600">
                            {client.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {project.project_location && (
                  <div className="flex items-center gap-1">
                    <strong>Location:</strong> {project.project_location}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={`${projectStatusColors[projectStatus].badge} border-2 px-4 py-2 text-base font-semibold`}>
                {projectStatus.charAt(0).toUpperCase() + projectStatus.slice(1).replace('_', ' ')}
              </Badge>
              {daysUntilShow !== null && daysUntilShow >= 0 && project?.showdates && project.showdates.length > 0 && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <span className="text-2xl font-bold text-blue-600">{daysUntilShow}</span>
                    <span className="text-sm text-gray-600">days until show</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {format(new Date(project.showdates.sort()[0]), 'dd MMM yyyy')}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Tabs */}
        <div className="bg-white rounded-lg shadow-lg">
          <Tabs defaultValue="afspraken" className="w-full">
            <TabsList className="w-full grid grid-cols-6 bg-gray-100 p-1 rounded-t-lg">
              <TabsTrigger value="afspraken" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Afspraken
              </TabsTrigger>
              <TabsTrigger value="taken" className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4" />
                Taken
              </TabsTrigger>
              <TabsTrigger value="planning" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Planning & Crew
              </TabsTrigger>
              <TabsTrigger value="pakbon" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Pakbon
              </TabsTrigger>
              <TabsTrigger value="kosten" className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Kosten
              </TabsTrigger>
              <TabsTrigger value="evaluatie" className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                Evaluatie
              </TabsTrigger>
            </TabsList>

            {/* Tab 1: Afspraken */}
            <TabsContent value="afspraken" className="p-6">
              <div className="space-y-6">
                {/* Sales Handoff from Offer */}
                {offer?.sales_handoff_notes && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      Sales → Operations Handoff
                    </h3>
                    <div 
                      className="prose prose-sm max-w-none bg-white p-4 rounded border"
                      dangerouslySetInnerHTML={{ __html: offer.sales_handoff_notes }}
                    />
                  </div>
                )}

                {/* Hardware Summary Matrix */}
                {project.hardware_summary && Object.keys(project.hardware_summary).length > 0 && (
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Settings className="w-5 h-5 text-gray-600" />
                      Hardware Overzicht
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {Object.entries(project.hardware_summary).map(([group, quantity]) => {
                        const spareQty = hardwareSpares[group] || 0;
                        const totalQty = quantity + spareQty;
                        
                        return (
                          <div key={group} className="bg-white rounded-lg p-4 border border-gray-300">
                            <p className="text-xs text-gray-600 uppercase mb-2">{group}</p>
                            <div className="flex items-center gap-3 mb-3">
                              <p className="text-2xl font-bold text-gray-900">{quantity}</p>
                            </div>
                            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-200">
                              <span className="text-xs text-gray-600 font-medium">Spare:</span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSpareChange(group, -1)}
                                  className="h-7 w-7 p-0"
                                  disabled={spareQty === 0}
                                >
                                  -
                                </Button>
                                <span className="text-sm font-bold text-gray-900 w-8 text-center">{spareQty}</span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleSpareChange(group, 1)}
                                  className="h-7 w-7 p-0"
                                >
                                  +
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 pt-2 border-t border-gray-300">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 font-medium">Totaal:</span>
                                <span className="text-lg font-bold text-blue-900">{totalQty}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {offer && (
                  <div className="flex justify-end">
                    <Button 
                      variant="outline"
                      onClick={() => navigate(createPageUrl(`OfferEditor?id=${offer.id}`))}
                      className="gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      View Version History
                    </Button>
                  </div>
                )}

                {offer && client && (
                  <div className="flex justify-center">
                    <OfferA4View 
                      offer={offer}
                      client={client}
                      products={products}
                      categorySettings={categorySettings}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Tab 2: Taken */}
            <TabsContent value="taken" className="p-6">
              <div className="space-y-4">
                {/* Compact Dates Overview */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                      {/* Show Dates */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Show:</span>
                        {offer?.showdates && offer.showdates.length > 0 ? (
                          <div className="flex items-center gap-1">
                            {offer.showdates.length === 1 ? (
                              <Badge variant="outline" className="text-xs">
                                {format(new Date(offer.showdates[0]), 'dd MMM yyyy')}
                              </Badge>
                            ) : (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-6 text-xs">
                                    {offer.showdates.length} dates
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2">
                                  <div className="space-y-1">
                                    {offer.showdates.sort().map((date, idx) => (
                                      <div key={idx} className="text-xs text-gray-600">
                                        {format(new Date(date), 'dd MMM yyyy')}
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>

                      {/* Setup Dates */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Setup:</span>
                        {setupDates.length > 0 ? (
                          setupDates.length === 1 ? (
                            <Badge variant="outline" className="text-xs bg-blue-50">
                              {format(new Date(setupDates[0]), 'dd MMM yyyy')}
                            </Badge>
                          ) : (
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-6 text-xs">
                                  {setupDates.length} dates
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-2">
                                <div className="space-y-1">
                                  {setupDates.map((date, idx) => (
                                    <div key={idx} className="text-xs text-gray-600">
                                      {format(new Date(date), 'dd MMM yyyy')}
                                    </div>
                                  ))}
                                </div>
                              </PopoverContent>
                            </Popover>
                          )
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>

                    {/* Edit Setup Dates */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit Setup
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <div className="p-3 border-b bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCalendarMonth(new Date(getYear(calendarMonth) - 1, getMonth(calendarMonth)))}
                              className="h-7 w-7 p-0"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <span className="font-semibold text-sm">{getYear(calendarMonth)}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCalendarMonth(new Date(getYear(calendarMonth) + 1, getMonth(calendarMonth)))}
                              className="h-7 w-7 p-0"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-6 gap-1">
                            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, idx) => (
                              <Button
                                key={month}
                                variant={getMonth(calendarMonth) === idx ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setCalendarMonth(new Date(getYear(calendarMonth), idx))}
                                className="h-7 text-xs px-1"
                              >
                                {month}
                              </Button>
                            ))}
                          </div>
                        </div>
                        <div className="p-3">
                          <CalendarComponent
                            mode="multiple"
                            selected={setupDates.map(d => new Date(d))}
                            onSelect={handleSetupDatesChange}
                            month={calendarMonth}
                            onMonthChange={setCalendarMonth}
                          />
                          <Button 
                            onClick={handleSaveSetupDates}
                            disabled={savingSetupDates}
                            size="sm"
                            className="w-full mt-3"
                          >
                            {savingSetupDates ? 'Saving...' : 'Save'}
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Unscheduled Tasks */}
                {(() => {
                  const allTasks = project.tasks || [];
                  const unscheduledTasks = allTasks.filter(t => !t.deadline_date && !t.is_archived);
                  const archivedUnscheduledTasks = allTasks.filter(t => !t.deadline_date && t.is_archived);
                  
                  if (unscheduledTasks.length > 0 || archivedUnscheduledTasks.length > 0) {
                    return (
                      <div className="space-y-3 mb-6">
                        <div className="flex items-center gap-2 px-2">
                          <div className="flex-1 h-px bg-gray-300"></div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Te plannen
                          </h4>
                          <div className="flex-1 h-px bg-gray-300"></div>
                          {archivedUnscheduledTasks.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowArchivedTasks(!showArchivedTasks)}
                              className="h-7 text-xs"
                            >
                              {showArchivedTasks ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                              {showArchivedTasks ? 'Verberg' : 'Toon'} gearchiveerd ({archivedUnscheduledTasks.length})
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {unscheduledTasks.map(task => {
                            const StatusIcon = statusIcons[task.status];
                            const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                            
                            return (
                              <div key={task.id} className="bg-white border-2 border-dashed border-blue-300 rounded-lg p-3 hover:shadow-sm transition-shadow">
                                <div className="flex items-start gap-3">
                                  {!hasSubtasks && (
                                    <button 
                                      onClick={() => {
                                        const newStatus = task.status === 'complete' ? 'not_started' : 
                                                        task.status === 'not_started' ? 'in_progress' : 'complete';
                                        handleTaskStatusChange(task.id, newStatus);
                                      }}
                                      className="mt-0.5 hover:scale-110 transition-transform"
                                    >
                                      <StatusIcon className={`w-5 h-5 ${statusColors[task.status]}`} />
                                    </button>
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <h5 className={`font-semibold text-sm ${!hasSubtasks && task.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                      {task.name}
                                    </h5>
                                    <div className="flex items-center gap-3 mt-1">
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <button className="text-xs text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded transition-colors border border-dashed border-blue-300">
                                            <Calendar className="w-3 h-3" />
                                            Kies deadline
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                          <CalendarComponent
                                            mode="single"
                                            selected={undefined}
                                            onSelect={(date) => handleDeadlineChange(task.id, date)}
                                            initialFocus
                                          />
                                        </PopoverContent>
                                      </Popover>
                                      <Badge variant="outline" className={`text-xs border ${serviceColors[task.service] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                                        {task.service}
                                      </Badge>
                                      {!task.is_custom && (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleArchiveTask(task.id)}
                                          className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
                                        >
                                          <Archive className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {hasSubtasks && (
                                      <div className="mt-2 space-y-1">
                                        {task.subtasks.map((subtask) => {
                                          const SubtaskIcon = statusIcons[subtask.status];
                                          return (
                                            <div key={subtask.id} className="flex items-center gap-2">
                                              <button 
                                                onClick={() => {
                                                  const newStatus = subtask.status === 'complete' ? 'not_started' : 
                                                                  subtask.status === 'not_started' ? 'in_progress' : 'complete';
                                                  handleTaskStatusChange(task.id, newStatus, subtask.id);
                                                }}
                                                className="hover:scale-110 transition-transform"
                                              >
                                                <SubtaskIcon className={`w-4 h-4 ${statusColors[subtask.status]}`} />
                                              </button>
                                              <span className={`text-xs ${subtask.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                                                {subtask.name}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  <Textarea
                                    value={task.notes || ''}
                                    onChange={(e) => handleNotesChange(task.id, e.target.value)}
                                    placeholder="Notities..."
                                    className="text-xs flex-1 min-h-[60px]"
                                  />
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Archived Unscheduled Tasks */}
                          {showArchivedTasks && archivedUnscheduledTasks.map(task => {
                            const StatusIcon = statusIcons[task.status];
                            const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                            
                            return (
                              <div key={task.id} className="bg-gray-100 border-2 border-gray-300 rounded-lg p-3 opacity-60">
                                <div className="flex items-start gap-3">
                                  {!hasSubtasks && (
                                    <StatusIcon className={`w-5 h-5 ${statusColors[task.status]} mt-0.5`} />
                                  )}
                                  
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-semibold text-sm text-gray-500 line-through">
                                      {task.name}
                                    </h5>
                                    <div className="flex items-center gap-3 mt-1">
                                      <Badge variant="outline" className="text-xs border bg-gray-200 text-gray-600">
                                        Gearchiveerd
                                      </Badge>
                                      <Badge variant="outline" className={`text-xs border ${serviceColors[task.service] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                                        {task.service}
                                      </Badge>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnarchiveTask(task.id)}
                                        className="h-6 px-2 text-xs text-gray-500 hover:text-blue-600"
                                      >
                                        <ArchiveRestore className="w-3 h-3 mr-1" />
                                        Herstel
                                      </Button>
                                    </div>
                                  </div>

                                  <Textarea
                                    value={task.notes || ''}
                                    disabled
                                    placeholder="Notities..."
                                    className="text-xs flex-1 min-h-[60px] bg-gray-50"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Monthly Task Timeline */}
                {(() => {
                  const allTasks = project.tasks || [];
                  const tasksWithDeadlines = allTasks.filter(t => t.deadline_date && !t.is_archived);
                  const archivedScheduledTasks = allTasks.filter(t => t.deadline_date && t.is_archived);
                  
                  if (tasksWithDeadlines.length === 0 && archivedScheduledTasks.length === 0) {
                    return (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                        <p className="text-gray-500">No scheduled tasks yet</p>
                      </div>
                    );
                  }

                  const tasksByMonth = {};
                  tasksWithDeadlines.forEach(task => {
                    const monthKey = format(new Date(task.deadline_date), 'yyyy-MM');
                    if (!tasksByMonth[monthKey]) {
                      tasksByMonth[monthKey] = [];
                    }
                    tasksByMonth[monthKey].push(task);
                  });

                  const sortedMonths = Object.keys(tasksByMonth).sort();

                  return (
                    <div className="space-y-3">
                      {sortedMonths.map(monthKey => {
                        const monthTasks = tasksByMonth[monthKey];
                        const monthDate = new Date(monthKey + '-01');
                        
                        return (
                          <div key={monthKey}>
                            <div className="flex items-center gap-2 mb-2 px-2">
                              <Calendar className="w-3.5 h-3.5 text-gray-400" />
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                {format(monthDate, 'MMMM yyyy')}
                              </h4>
                              <div className="flex-1 h-px bg-gray-200"></div>
                            </div>
                            <div className="space-y-2">
                              {monthTasks.sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date)).map(task => {
                                const StatusIcon = statusIcons[task.status];
                                const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                                
                                return (
                                  <div key={task.id} className="bg-white border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow">
                                    <div className="flex items-start gap-3">
                                      {!hasSubtasks && (
                                        <button 
                                          onClick={() => {
                                            const newStatus = task.status === 'complete' ? 'not_started' : 
                                                            task.status === 'not_started' ? 'in_progress' : 'complete';
                                            handleTaskStatusChange(task.id, newStatus);
                                          }}
                                          className="mt-0.5 hover:scale-110 transition-transform"
                                        >
                                          <StatusIcon className={`w-5 h-5 ${statusColors[task.status]}`} />
                                        </button>
                                      )}
                                      
                                      <div className="flex-1 min-w-0">
                                       <h5 className={`font-semibold text-sm ${!hasSubtasks && task.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                         {task.name}
                                       </h5>
                                       <div className="flex items-center gap-3 mt-1">
                                         <Popover>
                                           <PopoverTrigger asChild>
                                             <button className="text-xs text-gray-500 flex items-center gap-1 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                                               <Calendar className="w-3 h-3" />
                                               {format(new Date(task.deadline_date), 'dd MMM yyyy')}
                                             </button>
                                           </PopoverTrigger>
                                           <PopoverContent className="w-auto p-0" align="start">
                                             <CalendarComponent
                                               mode="single"
                                               selected={task.deadline_date ? new Date(task.deadline_date) : undefined}
                                               onSelect={(date) => handleDeadlineChange(task.id, date)}
                                               initialFocus
                                             />
                                           </PopoverContent>
                                         </Popover>
                                         <Badge variant="outline" className={`text-xs border ${serviceColors[task.service] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                                           {task.service}
                                         </Badge>
                                         {!task.is_custom && (
                                           <Button
                                             variant="ghost"
                                             size="sm"
                                             onClick={() => handleArchiveTask(task.id)}
                                             className="h-6 px-2 text-xs text-gray-500 hover:text-red-600"
                                           >
                                             <Archive className="w-3 h-3" />
                                           </Button>
                                         )}
                                       </div>

                                       {hasSubtasks && (
                                         <div className="mt-2 space-y-1">
                                           {task.subtasks.map((subtask) => {
                                             const SubtaskIcon = statusIcons[subtask.status];
                                             return (
                                               <div key={subtask.id} className="flex items-center gap-2">
                                                 <button 
                                                   onClick={() => {
                                                     const newStatus = subtask.status === 'complete' ? 'not_started' : 
                                                                     subtask.status === 'not_started' ? 'in_progress' : 'complete';
                                                     handleTaskStatusChange(task.id, newStatus, subtask.id);
                                                   }}
                                                   className="hover:scale-110 transition-transform"
                                                 >
                                                   <SubtaskIcon className={`w-4 h-4 ${statusColors[subtask.status]}`} />
                                                 </button>
                                                 <span className={`text-xs ${subtask.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                                                   {subtask.name}
                                                 </span>
                                               </div>
                                             );
                                           })}
                                         </div>
                                       )}
                                      </div>

                                      <Textarea
                                       value={task.notes || ''}
                                       onChange={(e) => handleNotesChange(task.id, e.target.value)}
                                       placeholder="Notities..."
                                       className="text-xs flex-1 min-h-[60px]"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      
                      {/* Archived Scheduled Tasks */}
                      {showArchivedTasks && archivedScheduledTasks.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-2 px-2">
                            <Archive className="w-3.5 h-3.5 text-gray-400" />
                            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Gearchiveerde Taken
                            </h4>
                            <div className="flex-1 h-px bg-gray-200"></div>
                          </div>
                          <div className="space-y-2">
                            {archivedScheduledTasks.sort((a, b) => new Date(a.deadline_date) - new Date(b.deadline_date)).map(task => {
                              const StatusIcon = statusIcons[task.status];
                              const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                              
                              return (
                                <div key={task.id} className="bg-gray-100 border-2 border-gray-300 rounded-lg p-3 opacity-60">
                                  <div className="flex items-start gap-3">
                                    {!hasSubtasks && (
                                      <StatusIcon className={`w-5 h-5 ${statusColors[task.status]} mt-0.5`} />
                                    )}
                                    
                                    <div className="flex-1 min-w-0">
                                      <h5 className="font-semibold text-sm text-gray-500 line-through">
                                        {task.name}
                                      </h5>
                                      <div className="flex items-center gap-3 mt-1">
                                        <span className="text-xs text-gray-500">
                                          {format(new Date(task.deadline_date), 'dd MMM yyyy')}
                                        </span>
                                        <Badge variant="outline" className="text-xs border bg-gray-200 text-gray-600">
                                          Gearchiveerd
                                        </Badge>
                                        <Badge variant="outline" className={`text-xs border ${serviceColors[task.service] || 'bg-gray-100 text-gray-800 border-gray-300'}`}>
                                          {task.service}
                                        </Badge>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => handleUnarchiveTask(task.id)}
                                          className="h-6 px-2 text-xs text-gray-500 hover:text-blue-600"
                                        >
                                          <ArchiveRestore className="w-3 h-3 mr-1" />
                                          Herstel
                                        </Button>
                                      </div>
                                    </div>

                                    <Textarea
                                      value={task.notes || ''}
                                      disabled
                                      placeholder="Notities..."
                                      className="text-xs flex-1 min-h-[60px] bg-gray-50"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </TabsContent>

            {/* Tab 3: Planning & Crew */}
            <TabsContent value="planning" className="p-6">
              <ShiftSummaryView 
                projectId={projectId} 
                project={project}
                offers={[offer].filter(Boolean)}
                products={products}
              />
            </TabsContent>

            {/* Tab 4: Pakbon */}
            <TabsContent value="pakbon" className="p-6">
              <PackingSlipTab 
                project={project}
                offer={offer}
                products={products}
                onUpdate={loadProjectData}
              />
            </TabsContent>

            {/* Tab 5: Kosten */}
            <TabsContent value="kosten" className="p-6">
              <FinancialGrid 
                project={project} 
                offer={offer}
                products={products}
                onUpdate={loadProjectData} 
              />
            </TabsContent>

            {/* Tab 6: Evaluatie */}
            <TabsContent value="evaluatie" className="p-6">
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-900">Project Evaluatie</h3>
                  <Button 
                    onClick={handleSaveEvaluation}
                    disabled={savingEvaluation}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingEvaluation ? 'Saving...' : 'Save Evaluation'}
                  </Button>
                </div>

                {/* Shift Reports from Staff */}
                {shifts.filter(s => s.completion_notes || (s.completion_photos && s.completion_photos.length > 0)).length > 0 && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600" />
                      Shift Reports van Personeel
                    </h3>
                    <div className="space-y-4">
                      {shifts
                        .filter(s => s.completion_notes || (s.completion_photos && s.completion_photos.length > 0))
                        .sort((a, b) => new Date(b.shift_date) - new Date(a.shift_date))
                        .map(shift => {
                          const staffMember = staff.find(s => s.id === shift.staff_id);
                          return (
                            <div key={shift.id} className="bg-white rounded-lg p-4 border border-blue-300">
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="outline" className="text-xs">
                                      {shift.role}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs bg-gray-50">
                                      {format(new Date(shift.shift_date), 'dd MMM yyyy')}
                                    </Badge>
                                  </div>
                                  {staffMember && (
                                    <p className="text-sm text-gray-600">
                                      {staffMember.name}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {shift.completion_notes && (
                                <div className="mb-3">
                                  <p className="text-sm font-medium text-gray-700 mb-1">Notities:</p>
                                  <p className="text-sm text-gray-600 whitespace-pre-wrap bg-gray-50 p-3 rounded">
                                    {shift.completion_notes}
                                  </p>
                                </div>
                              )}

                              {shift.completion_photos && shift.completion_photos.length > 0 && (
                                <div>
                                  <p className="text-sm font-medium text-gray-700 mb-2">Foto's ({shift.completion_photos.length}):</p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {shift.completion_photos.map((photoUrl, idx) => (
                                      <button
                                        key={idx}
                                        onClick={() => setPreviewMedia({ url: photoUrl, type: 'image' })}
                                        className="relative group"
                                      >
                                        <img 
                                          src={photoUrl} 
                                          alt={`Photo ${idx + 1}`}
                                          className="w-full h-32 object-cover rounded-lg border border-gray-300 hover:opacity-90 transition-opacity cursor-pointer"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {shift.invoice_pdf_url && (
                                <div className="mt-3">
                                  <p className="text-sm font-medium text-gray-700 mb-2">Factuur:</p>
                                  <button
                                    onClick={() => setPreviewMedia({ url: shift.invoice_pdf_url, type: 'pdf' })}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                                  >
                                    <FileText className="w-4 h-4" />
                                    Bekijk factuur
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}

                <div className="border rounded-lg overflow-hidden" style={{ height: '500px' }}>
                  <ReactQuill
                    value={evaluationNotes}
                    onChange={setEvaluationNotes}
                    theme="snow"
                    style={{ height: 'calc(100% - 42px)' }}
                    modules={{
                      toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        ['link'],
                        ['clean']
                      ]
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {previewMedia && (
        <MediaPreviewModal
          isOpen={!!previewMedia}
          onClose={() => setPreviewMedia(null)}
          mediaUrl={previewMedia.url}
          mediaType={previewMedia.type}
        />
      )}
    </div>
  );
}