
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Clock, Package } from "lucide-react";
import { addDays, parseISO, isWithinInterval } from "date-fns";

// Mock resource capacity data - in a real app this would come from the database
const resourceCapacity = {
  "Cash Registers": { total: 20, allocated: 0 },
  "Card Readers": { total: 30, allocated: 0 },
  "Receipt Printers": { total: 25, allocated: 0 },
  "Tablet POS": { total: 15, allocated: 0 },
  "WiFi Equipment": { total: 10, allocated: 0 },
  "Network Switches": { total: 8, allocated: 0 }
};

export default function ResourceAllocation({ currentWeek, projects, isLoading }) {
  // Filter out archived projects and projects with archived offers
  const activeProjects = useMemo(() => {
    return projects.filter(project => {
      // Assuming a project is archived if its status is 'archived'
      // If offers also have an 'archived' status that propagates to the project,
      // this filter would implicitly handle it if the project's main status reflects it.
      // If an offer's archived status is a separate field, it would need to be checked here too.
      return project.status !== 'archived';
    });
  }, [projects]);

  const weekProjects = useMemo(() => {
    // currentWeek is expected to be a Date object representing the start of the week
    const weekEnd = addDays(currentWeek, 6); // End of the current week (Sunday)

    return activeProjects.filter(project => {
      if (!project.start_date || !project.end_date) return false;
      
      const projectStart = parseISO(project.start_date);
      const projectEnd = parseISO(project.end_date);
      
      // Check if project overlaps with the current week (currentWeek to weekEnd)
      // A project overlaps if:
      // 1. The start of the current week is within the project's duration.
      // 2. The end of the current week is within the project's duration.
      // 3. The project entirely spans the current week (project starts before or at weekStart, and ends after or at weekEnd).
      return (
        isWithinInterval(currentWeek, { start: projectStart, end: projectEnd }) ||
        isWithinInterval(weekEnd, { start: projectStart, end: projectEnd }) ||
        (projectStart <= currentWeek && projectEnd >= weekEnd)
      );
    });
  }, [currentWeek, activeProjects]);

  // Calculate resource allocation based on active projects for the week
  const calculateWeeklyAllocation = () => {
    const allocation = { ...resourceCapacity };
    
    weekProjects.forEach(project => { // Use weekProjects instead of the original projects
      // Estimate hardware needs based on expected attendance
      const attendanceEstimate = project.expected_attendance || 1000;
      const cashRegistersNeeded = Math.ceil(attendanceEstimate / 5000); // 1 per 5000 people
      const cardReadersNeeded = Math.ceil(attendanceEstimate / 3000); // 1 per 3000 people
      const printersNeeded = Math.ceil(attendanceEstimate / 5000);
      
      allocation["Cash Registers"].allocated += cashRegistersNeeded;
      allocation["Card Readers"].allocated += cardReadersNeeded;
      allocation["Receipt Printers"].allocated += printersNeeded;
      allocation["Tablet POS"].allocated += Math.ceil(cashRegistersNeeded / 2);
      allocation["WiFi Equipment"].allocated += Math.ceil(attendanceEstimate / 10000);
      allocation["Network Switches"].allocated += Math.ceil(attendanceEstimate / 15000);
    });
    
    return allocation;
  };

  const weeklyAllocation = useMemo(() => calculateWeeklyAllocation(), [weekProjects]); // Recalculate only when weekProjects changes

  if (isLoading) {
    return (
      <Card className="shadow-lg border-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            Resource Allocation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(6).fill(0).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="w-5 h-5 text-blue-600" />
          Resource Allocation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          {Object.entries(weeklyAllocation).map(([resource, data]) => {
            const utilization = (data.allocated / data.total) * 100;
            const isOverbooked = utilization > 100;
            const isNearCapacity = utilization > 80;
            
            return (
              <div key={resource} className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{resource}</span>
                    {isOverbooked && (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    )}
                    {!isOverbooked && !isNearCapacity && (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                    {isNearCapacity && !isOverbooked && (
                      <Clock className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${
                    isOverbooked ? 'text-red-600' : 
                    isNearCapacity ? 'text-yellow-600' : 'text-gray-600'
                  }`}>
                    {data.allocated}/{data.total}
                  </span>
                </div>
                
                <Progress 
                  value={Math.min(utilization, 100)} 
                  className={`h-3 ${
                    isOverbooked ? '[&>div]:bg-red-500' : 
                    isNearCapacity ? '[&>div]:bg-yellow-500' : '[&>div]:bg-green-500'
                  }`}
                />
                
                <div className="flex justify-between items-center text-xs">
                  <span className={
                    isOverbooked ? 'text-red-600' : 
                    isNearCapacity ? 'text-yellow-600' : 'text-green-600'
                  }>
                    {utilization.toFixed(0)}% capacity
                  </span>
                  {isOverbooked && (
                    <Badge variant="destructive" className="text-xs">
                      Overbooked by {data.allocated - data.total}
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t">
          <h4 className="font-medium text-gray-900 mb-2">Legend</h4>
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-green-500" />
              <span>Available capacity</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-yellow-500" />
              <span>Near capacity (&gt;80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>Overbooked</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
