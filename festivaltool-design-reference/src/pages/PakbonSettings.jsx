import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, Save, Package } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const DEFAULT_ITEMS = [
  "Tyraps",
  "Gaffa tape",
  "Kniptangen",
  "Spare bag",
  "Bordjes",
  "Powercon kabels",
  "Spare powercon",
  "Schuko kabel",
  "Spare Schuko",
  "Verlengkabel",
  "Stekkerdoos",
  "Data kabels"
];

export default function PakbonSettings() {
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [settings, setSettings] = useState(null);
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState("");
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
      loadSettings();
    }
  }, [authState.authorized]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const settingsList = await base44.entities.PackingSlipSettings.list();
      
      if (settingsList && settingsList.length > 0) {
        const defaultSettings = settingsList.find(s => s.is_default) || settingsList[0];
        setSettings(defaultSettings);
        setItems(defaultSettings.items || []);
      } else {
        // Create initial settings with default items
        const newSettings = await base44.entities.PackingSlipSettings.create({
          items: DEFAULT_ITEMS,
          is_default: true
        });
        setSettings(newSettings);
        setItems(newSettings.items);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      toast.error("Instellingen laden mislukt");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddItem = () => {
    if (newItem.trim() === "") {
      toast.error("Voer een item naam in");
      return;
    }
    setItems([...items, newItem.trim()]);
    setNewItem("");
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const reorderedItems = Array.from(items);
    const [removed] = reorderedItems.splice(result.source.index, 1);
    reorderedItems.splice(result.destination.index, 0, removed);

    setItems(reorderedItems);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (settings?.id) {
        await base44.entities.PackingSlipSettings.update(settings.id, {
          items,
          is_default: true
        });
      } else {
        const newSettings = await base44.entities.PackingSlipSettings.create({
          items,
          is_default: true
        });
        setSettings(newSettings);
      }
      toast.success("Instellingen opgeslagen");
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Instellingen opslaan mislukt");
    } finally {
      setIsSaving(false);
    }
  };

  if (authState.checking) {
    return <div className="p-6">Laden...</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  if (isLoading) {
    return <div className="p-6">Laden...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Package className="w-8 h-8 text-blue-600" />
              Pakbon Instellingen
            </h1>
            <p className="text-gray-600 mt-2">Beheer de standaard paklijst items</p>
          </div>
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Standaard Paklijst</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                placeholder="Nieuw item toevoegen..."
                className="flex-1"
              />
              <Button onClick={handleAddItem} className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Toevoegen
              </Button>
            </div>

            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="packing-items">
                {(provided) => (
                  <div
                    {...provided.droppableProps}
                    ref={provided.innerRef}
                    className="space-y-2"
                  >
                    {items.map((item, index) => (
                      <Draggable key={index} draggableId={`item-${index}`} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`flex items-center gap-3 p-3 bg-white border rounded-lg ${
                              snapshot.isDragging ? 'shadow-lg border-blue-300' : 'border-gray-200'
                            }`}
                          >
                            <GripVertical className="w-5 h-5 text-gray-400 flex-shrink-0" />
                            <span className="flex-1 text-gray-900">{item}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {items.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Geen items toegevoegd. Voeg items toe aan de paklijst.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}