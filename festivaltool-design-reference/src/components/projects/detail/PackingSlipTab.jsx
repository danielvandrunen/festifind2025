import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Printer, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export default function PackingSlipTab({ project, offer, products, onUpdate }) {
  const [packingItems, setPackingItems] = useState([]);
  const [defaultItems, setDefaultItems] = useState([]);
  const saveTimeoutRef = useRef(null);

  useEffect(() => {
    loadInitialData();
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [project, offer, products]);

  const loadInitialData = async () => {
    // Load default items from settings
    try {
      const settings = await base44.entities.PackingSlipSettings.list();
      const defaultSetting = settings.find(s => s.is_default);
      setDefaultItems(defaultSetting?.items || []);
    } catch (error) {
      console.error('Error loading packing slip settings:', error);
    }

    // If project already has packing slip items, use those
    if (project.packing_slip_items && project.packing_slip_items.length > 0) {
      setPackingItems(project.packing_slip_items);
      return;
    }

    // Otherwise, initialize from offer + default items
    const items = [];

    // Add hardware items from offer
    if (offer?.offer_lines && products) {
      offer.offer_lines.forEach(line => {
        const product = products.find(p => p.id === line.product_id);
        if (product && product.hardware_group && product.hardware_group !== 'none' && line.quantity > 0) {
          items.push({
            id: `product-${product.id}`,
            item_name: product.name,
            quantity: line.quantity,
            notes: '',
            checked: false,
            is_custom: false
          });
        }
      });
    }

    // Add default items from settings
    const loadedDefaults = defaultItems.length > 0 ? defaultItems : (await base44.entities.PackingSlipSettings.list()).find(s => s.is_default)?.items || [];
    loadedDefaults.forEach(itemName => {
      items.push({
        id: `default-${Math.random().toString(36).substr(2, 9)}`,
        item_name: itemName,
        quantity: 0,
        notes: '',
        checked: false,
        is_custom: false
      });
    });

    setPackingItems(items);
    if (items.length > 0) {
      autoSave(items);
    }
  };

  const autoSave = async (items) => {
    try {
      await base44.entities.Project.update(project.id, {
        packing_slip_items: items
      });
    } catch (error) {
      console.error('Error saving packing slip:', error);
    }
  };

  const debouncedSave = (items) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      autoSave(items);
    }, 1000);
  };

  const handleItemChange = (id, field, value) => {
    const updated = packingItems.map(item =>
      item.id === id ? { ...item, [field]: value } : item
    );
    setPackingItems(updated);
    debouncedSave(updated);
  };

  const addCustomItem = () => {
    const newItem = {
      id: `custom-${Date.now()}`,
      item_name: '',
      quantity: 0,
      notes: '',
      checked: false,
      is_custom: true
    };
    const updated = [...packingItems, newItem];
    setPackingItems(updated);
    debouncedSave(updated);
  };

  const removeCustomItem = (id) => {
    const updated = packingItems.filter(item => item.id !== id);
    setPackingItems(updated);
    debouncedSave(updated);
  };

  const openPrintView = () => {
    const url = `/pakbon?project=${project.id}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Pakbon</h3>
        <Button onClick={openPrintView} className="gap-2">
          <Printer className="w-4 h-4" />
          Open Pakbon (Print)
        </Button>
      </div>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Items</CardTitle>
            <Button variant="outline" size="sm" onClick={addCustomItem} className="gap-2">
              <Plus className="w-4 h-4" />
              Item Toevoegen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 pb-2 border-b font-semibold text-sm text-gray-700">
              <div className="col-span-1 text-center">✓</div>
              <div className="col-span-5">Item</div>
              <div className="col-span-2 text-center">Aantal</div>
              <div className="col-span-3">Notities</div>
              <div className="col-span-1"></div>
            </div>

            {/* Items */}
            {packingItems.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 py-2 border-b items-center">
                <div className="col-span-1 flex justify-center">
                  <Checkbox
                    checked={item.checked}
                    onCheckedChange={(checked) => handleItemChange(item.id, 'checked', checked)}
                  />
                </div>
                <div className="col-span-5">
                  {item.is_custom ? (
                    <Input
                      placeholder="Item naam"
                      value={item.item_name}
                      onChange={(e) => handleItemChange(item.id, 'item_name', e.target.value)}
                      className="h-8"
                    />
                  ) : (
                    <span className="text-sm text-gray-900">{item.item_name}</span>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min="0"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                    className="h-8 text-center"
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    placeholder="Bijv. rode kist"
                    value={item.notes}
                    onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {item.is_custom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomItem(item.id)}
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {packingItems.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-8">
                Geen items gevonden. Klik op "Item Toevoegen" om te beginnen.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}