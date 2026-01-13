import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Save, X, TrendingUp, DollarSign, Percent } from "lucide-react";

export default function FinancialSummary({ project, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    actual_revenue: project.actual_revenue || 0,
    actual_costs: project.actual_costs || 0
  });

  const handleSave = () => {
    const marginPercentage = editData.actual_revenue > 0 
      ? ((editData.actual_revenue - editData.actual_costs) / editData.actual_revenue) * 100 
      : 0;
    
    onUpdate({
      actual_revenue: editData.actual_revenue,
      actual_costs: editData.actual_costs,
      margin_percentage: marginPercentage
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({
      actual_revenue: project.actual_revenue || 0,
      actual_costs: project.actual_costs || 0
    });
    setIsEditing(false);
  };

  const netProfit = (editData.actual_revenue || 0) - (editData.actual_costs || 0);
  const marginPercentage = editData.actual_revenue > 0 
    ? ((editData.actual_revenue - editData.actual_costs) / editData.actual_revenue) * 100 
    : 0;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Financial Summary
          </span>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4" />
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSave}>
                <Save className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              <Label>Revenue</Label>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={editData.actual_revenue}
                onChange={(e) => setEditData(prev => ({...prev, actual_revenue: parseFloat(e.target.value) || 0}))}
                className="w-32 text-right"
              />
            ) : (
              <span className="font-semibold text-lg">
                €{(project.actual_revenue || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-red-600" />
              <Label>Costs</Label>
            </div>
            {isEditing ? (
              <Input
                type="number"
                step="0.01"
                value={editData.actual_costs}
                onChange={(e) => setEditData(prev => ({...prev, actual_costs: parseFloat(e.target.value) || 0}))}
                className="w-32 text-right"
              />
            ) : (
              <span className="font-semibold text-lg text-red-600">
                €{(project.actual_costs || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>

          <hr />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <Label>Net Profit</Label>
            </div>
            <span className={`font-bold text-xl ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              €{netProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Percent className="w-4 h-4 text-purple-600" />
              <Label>Margin</Label>
            </div>
            <span className={`font-bold text-xl ${marginPercentage >= 20 ? 'text-green-600' : marginPercentage >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
              {marginPercentage.toFixed(1)}%
            </span>
          </div>
        </div>

        {!isEditing && (project.actual_revenue || 0) === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Add financial data to track project profitability and margins.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}