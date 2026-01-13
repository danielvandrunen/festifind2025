import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Wrench, Play, CheckCircle, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { addDays, format } from "date-fns";
import { nl } from "date-fns/locale";
import { Input } from "@/components/ui/input";

export default function RepairProjects() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoadingProjects(true);
    try {
      const [projectsData, templatesData] = await Promise.all([
        base44.entities.Project.list(),
        base44.entities.TaskTemplate.list()
      ]);
      
      // Filter confirmed projects (not archived)
      const confirmedProjects = projectsData.filter(p => 
        p.status !== 'archived' && (p.status === 'active' || p.status === 'planning' || p.status === 'closing' || p.status === 'complete')
      );
      
      setProjects(confirmedProjects);
      setTemplates(templatesData);
    } catch (error) {
      toast.error("Fout bij laden projecten");
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const syncTasksWithTemplate = (currentTasks, templates, selectedServices, firstShowdate) => {
    // Archive old tasks that are not from template anymore
    const templateTaskIds = new Set();
    templates
      .filter(template => selectedServices.includes(template.service))
      .forEach(template => {
        (template.tasks || []).forEach(templateTask => {
          templateTaskIds.add(templateTask.id);
        });
      });
    
    // Mark old non-custom tasks as archived if they're not in current template
    const archivedTasks = currentTasks
      .filter(task => !task.is_custom && !templateTaskIds.has(task.id))
      .map(task => ({ ...task, is_archived: true }));
    
    const newTasks = [];

    templates
      .filter(template => selectedServices.includes(template.service))
      .forEach(template => {
        (template.tasks || []).forEach(templateTask => {
          const existingTask = currentTasks.find(t => t.id === templateTask.id && !t.is_archived);
          
          // Calculate deadline from first showdate - offset (offset is days BEFORE showdate)
          // Only calculate if deadline_offset is set (not null/undefined)
          let deadlineDate = null;
          if (firstShowdate && templateTask.deadline_offset !== null && templateTask.deadline_offset !== undefined) {
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
              display_order: templateTask.display_order,
              is_archived: false
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
              is_custom: false,
              is_archived: false
            });
          }
        });
      });

    // Keep custom tasks
    currentTasks.forEach(task => {
      if (task.is_custom) {
        newTasks.push(task);
      }
    });

    // Add archived tasks at the end
    newTasks.push(...archivedTasks);

    return newTasks.sort((a, b) => {
      // Archived tasks go to bottom
      if (a.is_archived !== b.is_archived) {
        return a.is_archived ? 1 : -1;
      }
      if (a.service !== b.service) {
        return a.service.localeCompare(b.service);
      }
      return (a.display_order || 0) - (b.display_order || 0);
    });
  };

  const repairSingleProject = async (project) => {
    try {
      const firstShowdate = project.showdates && project.showdates.length > 0 
        ? project.showdates.sort()[0] 
        : null;

      const syncedTasks = syncTasksWithTemplate(
        project.tasks || [],
        templates,
        project.services || [],
        firstShowdate
      );

      await base44.entities.Project.update(project.id, { tasks: syncedTasks });
      
      // Reload projects
      await loadProjects();
      
      toast.success(`${project.project_name} succesvol gerepareerd`);
      return { success: true };
    } catch (error) {
      toast.error(`Fout bij ${project.project_name}: ${error.message}`);
      return { success: false, error: error.message };
    }
  };

  const handleRepairAll = async () => {
    setIsRunning(true);
    setResults([]);
    setProgress(0);

    try {
      setTotalProjects(projects.length);
      const repairResults = [];

      for (let i = 0; i < projects.length; i++) {
        const project = projects[i];
        
        try {
          const firstShowdate = project.showdates && project.showdates.length > 0 
            ? project.showdates.sort()[0] 
            : null;

          const syncedTasks = syncTasksWithTemplate(
            project.tasks || [],
            templates,
            project.services || [],
            firstShowdate
          );

          const needsUpdate = JSON.stringify(syncedTasks) !== JSON.stringify(project.tasks);

          if (needsUpdate) {
            await base44.entities.Project.update(project.id, { tasks: syncedTasks });
            repairResults.push({
              project: project.project_name,
              status: 'success',
              message: `Updated ${syncedTasks.length} tasks`
            });
          } else {
            repairResults.push({
              project: project.project_name,
              status: 'skipped',
              message: 'Already up to date'
            });
          }
        } catch (error) {
          repairResults.push({
            project: project.project_name,
            status: 'error',
            message: error.message
          });
        }

        setProgress(Math.round(((i + 1) / projects.length) * 100));
        setResults([...repairResults]);
      }

      await loadProjects();
      toast.success(`Repair complete! ${repairResults.filter(r => r.status === 'success').length} projects updated.`);
    } catch (error) {
      toast.error("Repair failed: " + error.message);
    } finally {
      setIsRunning(false);
    }
  };

  const filteredProjects = projects.filter(p => 
    p.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.project_location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Bulk Repair Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-6 h-6 text-blue-600" />
              Bulk Project Task Repair
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Wat doet dit:</h3>
              <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                <li>Synchroniseert alle projecten met de laatste taak templates</li>
                <li>Berekent deadline datums op basis van eerste showdate + template offset</li>
                <li>Behoudt bestaande taak statussen en notities</li>
                <li>Voegt missende taken toe voor geselecteerde diensten</li>
                <li>Archiveert oude taken die niet meer in de template zitten</li>
              </ul>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  {projects.length} bevestigde projecten
                </p>
              </div>
              <Button 
                onClick={handleRepairAll}
                disabled={isRunning}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Play className="w-4 h-4 mr-2" />
                {isRunning ? 'Bezig...' : 'Start Bulk Repair'}
              </Button>
            </div>

            {isRunning && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Voortgang</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <h3 className="font-semibold text-gray-900">Resultaten:</h3>
                {results.map((result, idx) => (
                  <div 
                    key={idx} 
                    className={`flex items-start gap-3 p-3 rounded-lg border ${
                      result.status === 'success' ? 'bg-green-50 border-green-200' :
                      result.status === 'error' ? 'bg-red-50 border-red-200' :
                      'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {result.status === 'success' && <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />}
                    {result.status === 'error' && <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />}
                    {result.status === 'skipped' && <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />}
                    
                    <div className="flex-1">
                      <p className="font-medium text-sm text-gray-900">{result.project}</p>
                      <p className="text-xs text-gray-600">{result.message}</p>
                    </div>
                    <Badge variant={result.status === 'success' ? 'default' : result.status === 'error' ? 'destructive' : 'secondary'}>
                      {result.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Selective Repair Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-6 h-6 text-green-600" />
              Selectieve Project Repair
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                Kies specifieke projecten om te repareren zonder alle projecten te beïnvloeden.
              </p>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input 
                placeholder="Zoek projecten..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Projects List */}
            {isLoadingProjects ? (
              <div className="text-center py-8 text-gray-500">Laden...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">Geen projecten gevonden</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredProjects.map((project) => (
                  <div 
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{project.project_name}</h4>
                      <div className="flex items-center gap-3 mt-1">
                        {project.project_location && (
                          <span className="text-xs text-gray-600">{project.project_location}</span>
                        )}
                        {project.showdates && project.showdates.length > 0 && (
                          <span className="text-xs text-gray-600">
                            {format(new Date(project.showdates.sort()[0]), 'd MMM yyyy', { locale: nl })}
                          </span>
                        )}
                        {project.services && project.services.length > 0 && (
                          <div className="flex gap-1">
                            {project.services.map(service => (
                              <Badge key={service} variant="outline" className="text-[10px]">
                                {service}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button 
                      size="sm"
                      onClick={() => repairSingleProject(project)}
                      disabled={isRunning}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Wrench className="w-3 h-3 mr-1" />
                      Repair
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}