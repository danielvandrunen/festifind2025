import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { Calendar, MapPin, Users, FileText } from "lucide-react";

const statusColors = {
  planning: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  closing: "bg-orange-100 text-orange-800",
  complete: "bg-gray-100 text-gray-800",
  archived: "bg-gray-200 text-gray-600"
};

export default function ProjectHeader({ project, client }) {
  const calculateProgress = () => {
    if (!project.tasks || project.tasks.length === 0) return 0;
    const completedTasks = project.tasks.filter(task => task.status === 'complete').length;
    return Math.round((completedTasks / project.tasks.length) * 100);
  };

  const progress = calculateProgress();

  return (
    <Card className="border-0 shadow-lg">
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{project.project_name}</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                <span>{client?.company_name || "Unknown Client"}</span>
              </div>
              {project.project_location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>{project.project_location}</span>
                </div>
              )}
              {project.start_date && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(project.start_date), "MMM d")} - {project.end_date && format(new Date(project.end_date), "MMM d, yyyy")}</span>
                </div>
              )}
              {project.expected_attendance && (
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>{project.expected_attendance.toLocaleString()} expected</span>
                </div>
              )}
            </div>
          </div>
          <Badge className={statusColors[project.status]} variant="outline">
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </Badge>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">Overall Progress</span>
            <span className="text-sm font-semibold">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          <div className="flex justify-between items-center text-xs text-gray-500">
            <span>
              {project.tasks ? project.tasks.filter(t => t.status === 'complete').length : 0} of {project.tasks?.length || 0} tasks completed
            </span>
            <span>
              Created {format(new Date(project.created_date), "MMM d, yyyy")}
            </span>
          </div>
        </div>

        {project.notes && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="font-medium text-gray-900 mb-2">Project Notes</h3>
            <p className="text-gray-600 text-sm">{project.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}