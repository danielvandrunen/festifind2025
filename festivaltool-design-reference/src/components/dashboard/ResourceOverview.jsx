import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, AlertTriangle, CheckCircle } from "lucide-react";

export default function ResourceOverview({ isLoading }) {
  // Mock data for current week resources
  const weeklyResources = [
    { name: "Cash Registers", allocated: 15, total: 20 },
    { name: "Card Readers", allocated: 25, total: 30 },
    { name: "Receipt Printers", allocated: 18, total: 25 },
    { name: "Tablet POS", allocated: 8, total: 15 }
  ];

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            This Week's Resources
          </CardTitle>
          <Link to={createPageUrl("Resources")}>
            <Button variant="outline" size="sm">
              Full Calendar
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {isLoading ? (
            Array(4).fill(0).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-12" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))
          ) : (
            weeklyResources.map((resource, index) => {
              const utilization = (resource.allocated / resource.total) * 100;
              const isOverbooked = utilization > 100;
              const isNearCapacity = utilization > 80;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {resource.name}
                      </span>
                      {isOverbooked && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      {!isOverbooked && !isNearCapacity && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      isOverbooked ? 'text-red-600' : 
                      isNearCapacity ? 'text-orange-600' : 'text-gray-600'
                    }`}>
                      {resource.allocated}/{resource.total}
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(utilization, 100)} 
                    className={`h-2 ${
                      isOverbooked ? '[&>div]:bg-red-500' : 
                      isNearCapacity ? '[&>div]:bg-orange-500' : '[&>div]:bg-green-500'
                    }`}
                  />
                  {isOverbooked && (
                    <p className="text-xs text-red-600">
                      Overbooked by {resource.allocated - resource.total} units
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
        
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Week 52, 2024</span>
            <Link to={createPageUrl("Resources")} className="text-blue-600 hover:text-blue-800 font-medium">
              View Planning →
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}