import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Calendar, CheckCircle, Clock } from "lucide-react";
import { differenceInDays, parseISO, isBefore } from "date-fns";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const statusIcons = {
  not_started: Clock,
  in_progress: Clock,
  complete: CheckCircle
};

const statusColors = {
  not_started: "text-gray-400",
  in_progress: "text-blue-600",
  complete: "text-green-600"
};

export default function OperationalUrgency({ projects }) {
  const urgentTasks = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(now.getDate() + 30);
    
    const tasks = [];
    
    // Filter out archived projects
    const activeProjects = projects.filter(p => p.status !== 'archived');
    
    activeProjects.forEach(project => {
      if (!project.tasks) return;
      
      project.tasks.forEach(task => {
        if (!task.deadline_date) return;
        
        const deadlineDate = parseISO(task.deadline_date);
        
        // Include if deadline is within 30 days
        if (deadlineDate <= thirtyDaysFromNow) {
          const daysUntil = differenceInDays(deadlineDate, now);
          const isOverdue = daysUntil < 0;
          
          tasks.push({
            ...task,
            projectId: project.id,
            projectName: project.project_name,
            deadlineDate,
            daysUntil,
            isOverdue
          });
        }
      });
    });
    
    // Sort by deadline (ascending)
    return tasks.sort((a, b) => a.deadlineDate - b.deadlineDate);
  }, [projects]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-600" />
          Operational Urgency
        </CardTitle>
      </CardHeader>
      <CardContent>
        {urgentTasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
            <p>Geen urgente taken komende 30 dagen</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {urgentTasks.map((task) => {
              const StatusIcon = statusIcons[task.status];
              
              return (
                <div 
                  key={`${task.projectId}-${task.id}`}
                  className={`p-3 rounded-lg border ${
                    task.isOverdue 
                      ? 'bg-red-50 border-red-200' 
                      : task.daysUntil <= 5 
                        ? 'bg-orange-50 border-orange-200' 
                        : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <StatusIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${statusColors[task.status]}`} />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-gray-900 truncate">
                          {task.name}
                        </h4>
                        <p className="text-xs text-gray-600 mt-0.5 truncate">
                          {task.projectName}
                        </p>
                        <Badge 
                          variant="outline" 
                          className={`mt-1 text-xs ${
                            task.service === 'Cashless' 
                              ? 'bg-blue-100 text-blue-800 border-blue-300'
                              : task.service === 'Ticketing'
                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                : task.service === 'Festival App'
                                  ? 'bg-green-100 text-green-800 border-green-300'
                                  : 'bg-orange-100 text-orange-800 border-orange-300'
                          }`}
                        >
                          {task.service}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600">
                          {format(task.deadlineDate, 'dd MMM', { locale: nl })}
                        </span>
                      </div>
                      {task.isOverdue ? (
                        <Badge className="bg-red-600 text-white text-xs">
                          {Math.abs(task.daysUntil)} dagen te laat
                        </Badge>
                      ) : task.daysUntil === 0 ? (
                        <Badge className="bg-orange-600 text-white text-xs">
                          Vandaag
                        </Badge>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            task.daysUntil <= 5 
                              ? 'bg-orange-100 text-orange-800 border-orange-300'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {task.daysUntil} {task.daysUntil === 1 ? 'dag' : 'dagen'}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Show subtasks if any */}
                  {task.subtasks && task.subtasks.length > 0 && (
                    <div className="mt-2 ml-6 space-y-1">
                      {task.subtasks.map(subtask => {
                        const SubtaskIcon = statusIcons[subtask.status];
                        return (
                          <div key={subtask.id} className="flex items-center gap-2 text-xs">
                            <SubtaskIcon className={`w-3 h-3 ${statusColors[subtask.status]}`} />
                            <span className={`${subtask.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                              {subtask.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}