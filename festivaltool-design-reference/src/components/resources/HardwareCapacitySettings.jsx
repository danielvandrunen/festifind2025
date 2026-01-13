import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, Package } from "lucide-react";

const HARDWARE_GROUPS = [
  { key: 'workstation', label: 'Workstations', icon: '🖥️' },
  { key: 'handheld', label: 'Handhelds', icon: '📱' },
  { key: 'cashpoint', label: 'Cashpoints', icon: '💳' },
  { key: 'bonnenprinter', label: 'Bonnenprinters', icon: '🖨️' }
];

export default function HardwareCapacitySettings() {
  const [capacities, setCapacities] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCapacities();
  }, []);

  const loadCapacities = async () => {
    try {
      const data = await base44.entities.HardwareCapacity.list();
      const capacityMap = {};
      data.forEach(item => {
        capacityMap[item.hardware_group] = {
          id: item.id,
          quantity: item.quantity || 0,
          notes: item.notes || ''
        };
      });
      setCapacities(capacityMap);
    } catch (error) {
      console.error('Failed to load capacities:', error);
      toast.error('Failed to load hardware capacities');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (hardwareGroup) => {
    setSaving(true);
    try {
      const data = capacities[hardwareGroup];
      
      if (data?.id) {
        await base44.entities.HardwareCapacity.update(data.id, {
          hardware_group: hardwareGroup,
          quantity: data.quantity,
          notes: data.notes
        });
      } else {
        const newItem = await base44.entities.HardwareCapacity.create({
          hardware_group: hardwareGroup,
          quantity: data?.quantity || 0,
          notes: data?.notes || ''
        });
        setCapacities(prev => ({
          ...prev,
          [hardwareGroup]: { ...prev[hardwareGroup], id: newItem.id }
        }));
      }
      
      toast.success('Hardware capacity saved');
    } catch (error) {
      console.error('Failed to save capacity:', error);
      toast.error('Failed to save hardware capacity');
    } finally {
      setSaving(false);
    }
  };

  const updateCapacity = (hardwareGroup, field, value) => {
    setCapacities(prev => ({
      ...prev,
      [hardwareGroup]: {
        ...prev[hardwareGroup],
        [field]: field === 'quantity' ? parseInt(value) || 0 : value
      }
    }));
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Package className="w-5 h-5" />
            Hardware Inventory
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Define your total available hardware capacity for resource planning
          </p>
        </div>
        
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Hardware Type</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
              <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {HARDWARE_GROUPS.map(group => (
              <tr key={group.key} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{group.icon}</span>
                    <span className="font-medium text-gray-900">{group.label}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Input
                    type="number"
                    min="0"
                    value={capacities[group.key]?.quantity || 0}
                    onChange={(e) => updateCapacity(group.key, 'quantity', e.target.value)}
                    className="w-32"
                  />
                </td>
                <td className="px-6 py-4">
                  <Input
                    value={capacities[group.key]?.notes || ''}
                    onChange={(e) => updateCapacity(group.key, 'notes', e.target.value)}
                    placeholder="Location, condition..."
                    className="max-w-md"
                  />
                </td>
                <td className="px-6 py-4 text-center">
                  <Button
                    onClick={() => handleSave(group.key)}
                    disabled={saving}
                    size="sm"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}