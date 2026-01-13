import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, GripVertical, Save } from "lucide-react";
import { useLocalization } from "../components/Localization";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

const SERVICES = ["Cashless", "Ticketing", "Festival App", "CRM"];

export default function TaskTemplatesPage() {
  const { t } = useLocalization();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [templates, setTemplates] = useState([]);
  const [activeService, setActiveService] = useState("Cashless");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
      loadTemplates();
    }
  }, [authState.authorized]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const templatesData = await base44.entities.TaskTemplate.list();
      
      // Ensure all services have a template
      const serviceTemplateMap = {};
      templatesData.forEach(template => {
        serviceTemplateMap[template.service] = template;
      });

      const allTemplates = SERVICES.map(service => {
        if (serviceTemplateMap[service]) {
          return serviceTemplateMap[service];
        }
        return {
          service,
          tasks: [],
          is_active: true
        };
      });

      setTemplates(allTemplates);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error(t("Failed to load templates"));
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentTemplate = () => {
    return templates.find(t => t.service === activeService) || { service: activeService, tasks: [] };
  };

  const updateCurrentTemplate = (updatedTasks) => {
    setTemplates(prevTemplates => 
      prevTemplates.map(template => 
        template.service === activeService 
          ? { ...template, tasks: updatedTasks }
          : template
      )
    );
  };

  const handleAddTask = () => {
    const currentTemplate = getCurrentTemplate();
    const newTask = {
      id: `task_${Date.now()}`,
      name: "",
      deadline_offset: 0,
      subtasks: [],
      display_order: currentTemplate.tasks.length
    };
    updateCurrentTemplate([...currentTemplate.tasks, newTask]);
  };

  const handleUpdateTaskName = (taskId, newName) => {
    const currentTemplate = getCurrentTemplate();
    const updatedTasks = currentTemplate.tasks.map(task =>
      task.id === taskId ? { ...task, name: newName } : task
    );
    updateCurrentTemplate(updatedTasks);
  };

  const handleUpdateDeadlineOffset = (taskId, offset) => {
    const currentTemplate = getCurrentTemplate();
    const updatedTasks = currentTemplate.tasks.map(task =>
      task.id === taskId ? { ...task, deadline_offset: offset === '' ? null : parseInt(offset) } : task
    );
    updateCurrentTemplate(updatedTasks);
  };

  const handleDeleteTask = (taskId) => {
    const currentTemplate = getCurrentTemplate();
    const updatedTasks = currentTemplate.tasks.filter(task => task.id !== taskId);
    updateCurrentTemplate(updatedTasks);
  };

  const handleAddSubtask = (taskId) => {
    const currentTemplate = getCurrentTemplate();
    const updatedTasks = currentTemplate.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: [...task.subtasks, {
            id: `subtask_${Date.now()}`,
            name: ""
          }]
        };
      }
      return task;
    });
    updateCurrentTemplate(updatedTasks);
  };

  const handleUpdateSubtaskName = (taskId, subtaskId, newName) => {
    const currentTemplate = getCurrentTemplate();
    const updatedTasks = currentTemplate.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.map(subtask =>
            subtask.id === subtaskId ? { ...subtask, name: newName } : subtask
          )
        };
      }
      return task;
    });
    updateCurrentTemplate(updatedTasks);
  };

  const handleDeleteSubtask = (taskId, subtaskId) => {
    const currentTemplate = getCurrentTemplate();
    const updatedTasks = currentTemplate.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          subtasks: task.subtasks.filter(subtask => subtask.id !== subtaskId)
        };
      }
      return task;
    });
    updateCurrentTemplate(updatedTasks);
  };

  const handleSaveTemplate = async () => {
    setIsSaving(true);
    try {
      const currentTemplate = getCurrentTemplate();
      
      // Filter out empty tasks
      const validTasks = currentTemplate.tasks.filter(task => task.name.trim() !== '');
      
      const templateData = {
        service: activeService,
        tasks: validTasks,
        is_active: true
      };

      if (currentTemplate.id) {
        await base44.entities.TaskTemplate.update(currentTemplate.id, templateData);
      } else {
        await base44.entities.TaskTemplate.create(templateData);
      }

      toast.success(t("Template saved successfully"));
      loadTemplates();
    } catch (error) {
      console.error("Failed to save template:", error);
      toast.error(t("Failed to save template"));
    } finally {
      setIsSaving(false);
    }
  };

  if (authState.checking) {
    return <div className="p-6">{t('Loading...')}</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  if (isLoading) {
    return <div className="p-6">{t('Loading...')}</div>;
  }

  const currentTemplate = getCurrentTemplate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('Task Templates')}</h1>
            <p className="text-gray-600 mt-2">{t('Manage task templates for each service')}</p>
          </div>
          <Button 
            onClick={handleSaveTemplate} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? t('Saving...') : t('Save Template')}
          </Button>
        </div>

        <Card>
          <CardContent className="p-6">
            <Tabs value={activeService} onValueChange={setActiveService}>
              <TabsList className="w-full grid grid-cols-4 mb-6">
                {SERVICES.map(service => (
                  <TabsTrigger key={service} value={service}>
                    {service}
                  </TabsTrigger>
                ))}
              </TabsList>

              {SERVICES.map(service => (
                <TabsContent key={service} value={service}>
                  <div className="space-y-4">
                    {currentTemplate.tasks.map((task, taskIndex) => (
                      <Card key={task.id} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-3">
                            <GripVertical className="w-5 h-5 text-gray-400" />
                            <Input
                              value={task.name}
                              onChange={(e) => handleUpdateTaskName(task.id, e.target.value)}
                              placeholder={t('Task Name')}
                              className="flex-1"
                            />
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                value={task.deadline_offset ?? ''}
                                onChange={(e) => handleUpdateDeadlineOffset(task.id, e.target.value)}
                                placeholder="Leeg = handmatig"
                                className="w-32 text-center"
                              />
                              <span className="text-xs text-gray-500 whitespace-nowrap">dagen</span>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteTask(task.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {task.subtasks.map((subtask) => (
                            <div key={subtask.id} className="flex items-center gap-3 ml-8">
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              <Input
                                value={subtask.name}
                                onChange={(e) => handleUpdateSubtaskName(task.id, subtask.id, e.target.value)}
                                placeholder={t('Subtask Name')}
                                className="flex-1"
                                size="sm"
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteSubtask(task.id, subtask.id)}
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAddSubtask(task.id)}
                            className="ml-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            {t('Add Subtask')}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}

                    <Button
                      variant="outline"
                      onClick={handleAddTask}
                      className="w-full border-dashed border-2 hover:bg-blue-50 hover:border-blue-300"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {t('Add Task')}
                    </Button>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}