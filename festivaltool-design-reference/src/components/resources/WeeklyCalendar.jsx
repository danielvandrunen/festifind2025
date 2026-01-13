
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addDays, isWithinInterval, parseISO } from "date-fns";
import { Calendar, MapPin, AlertTriangle } from "lucide-react";

export default function WeeklyCalendar({ currentWeek, projects, isLoading }) {
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeek, i));

  const getProjectsForDay = (date) => {
    return projects.filter(project => {
      // Only show non-archived projects
      if (project.status === 'archived') return false;
      
      if (!project.start_date || !project.end_date) return false;
      
      const projectStart = parseISO(project.start_date);
      const projectEnd = parseISO(project.end_date);
      
      return isWithinInterval(date, { start: projectStart, end: projectEnd });
    });
  };

  const statusColors = {
    planning: "bg-blue-100 text-blue-800 border-blue-200",
    active: "bg-green-100 text-green-800 border-green-200"
  };

  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Weekly Schedule
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, index) => {
            const dayProjects = getProjectsForDay(day);
            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
            
            return (
              <div key={index} className={`p-3 rounded-lg border ${isWeekend ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="text-center mb-3">
                  <div className="text-xs font-medium text-gray-500 uppercase">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-lg font-semibold">
                    {format(day, "d")}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {dayProjects.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">
                      No events
                    </div>
                  ) : (
                    dayProjects.map((project) => (
                      <div key={project.id} className="p-2 rounded border border-l-4 border-l-blue-500">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {project.project_name}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`text-xs ${statusColors[project.status]}`}
                          >
                            {project.status}
                          </Badge>
                        </div>
                        {project.project_location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{project.project_location}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
