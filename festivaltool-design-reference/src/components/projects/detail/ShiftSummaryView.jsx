import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  User, 
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus
} from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ShiftSummaryView({ projectId, project, offers, products }) {
  const [shifts, setShifts] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Start from first showdate or today
    if (project?.showdates && project.showdates.length > 0) {
      const firstShowdate = new Date(project.showdates.sort()[0]);
      return startOfWeek(firstShowdate, { weekStartsOn: 1 });
    }
    return startOfWeek(new Date(), { weekStartsOn: 1 });
  });
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editModalDate, setEditModalDate] = useState(null);
  const [editModalShifts, setEditModalShifts] = useState([]);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftsData, staffData] = await Promise.all([
        base44.entities.Shift.filter({ project_id: projectId }),
        base44.entities.Staff.list()
      ]);

      setShifts(shiftsData || []);
      setStaff(staffData || []);
    } catch (error) {
      console.error('Error loading shifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStaffForShift = (staffId) => {
    return staff.find(s => s.id === staffId);
  };

  // Get service requirements from offer
  const getServiceRequirements = () => {
    if (!project || !offers || !products) return [];
    const offer = offers.find(o => o.id === project.offer_id);
    if (!offer || !offer.offer_lines) return [];
    
    const serviceItems = [];
    offer.offer_lines.forEach(line => {
      const product = products.find(p => p.id === line.product_id);
      if (product && product.category === 'services' && line.quantity > 0) {
        serviceItems.push({
          name: product.name,
          quantity: line.quantity,
          product_id: product.id
        });
      }
    });
    
    return serviceItems;
  };

  // Open edit modal for shifts with existing shifts
  const openEditShiftModal = (date) => {
    const existingShifts = shifts.filter(shift => 
      isSameDay(new Date(shift.shift_date), date)
    );
    
    if (existingShifts.length > 0) {
      // Load existing shifts
      setEditModalShifts(existingShifts.map(shift => ({
        id: shift.id,
        role: shift.role,
        start_time: shift.start_time,
        end_time: shift.end_time,
        briefing: shift.briefing || '',
        location: shift.location || '',
        staff_id: shift.staff_id || null,
        status: shift.status
      })));
    } else {
      // No shifts yet, add one empty row
      const serviceReqs = getServiceRequirements();
      const initialShifts = serviceReqs.length > 0 
        ? serviceReqs.map(service => ({
            role: service.name,
            start_time: '09:00',
            end_time: '17:00',
            briefing: '',
            location: ''
          }))
        : [];
      
      initialShifts.push({ role: '', start_time: '09:00', end_time: '17:00', briefing: '', location: '' });
      setEditModalShifts(initialShifts);
    }
    
    setEditModalDate(date);
    setShowShiftModal(true);
  };

  const addEmptyEditShift = () => {
    setEditModalShifts([...editModalShifts, { 
      role: '', 
      start_time: '09:00', 
      end_time: '17:00', 
      briefing: '',
      location: ''
    }]);
  };

  const updateEditModalShift = (index, field, value) => {
    const updated = [...editModalShifts];
    updated[index][field] = value;
    setEditModalShifts(updated);
  };

  const removeEditModalShift = (index) => {
    if (editModalShifts.length > 1) {
      setEditModalShifts(editModalShifts.filter((_, i) => i !== index));
    }
  };

  const handleDeleteEditShift = async (shiftId, hasStaff) => {
    if (hasStaff) {
      if (!confirm('Deze shift is al toegewezen aan iemand. Weet je zeker dat je deze wilt verwijderen?')) {
        return;
      }
    }
    
    try {
      await base44.entities.Shift.delete(shiftId);
      setShifts(prevShifts => prevShifts.filter(s => s.id !== shiftId));
      toast.success('Shift verwijderd');
    } catch (error) {
      console.error('Error deleting shift:', error);
      toast.error('Fout bij verwijderen shift');
    }
  };

  const handleSaveEditShifts = async () => {
    try {
      const shiftsToUpdate = [];
      const shiftsToCreate = [];
      
      editModalShifts.forEach(shift => {
        if (!shift.role || !shift.start_time || !shift.end_time) return;
        
        const shiftData = {
          project_id: projectId,
          shift_date: format(editModalDate, 'yyyy-MM-dd'),
          role: shift.role,
          start_time: shift.start_time,
          end_time: shift.end_time,
          briefing: shift.briefing || '',
          location: shift.location || '',
          status: shift.status || 'open'
        };
        
        if (shift.id) {
          shiftsToUpdate.push({ id: shift.id, data: shiftData });
        } else {
          shiftsToCreate.push(shiftData);
        }
      });
      
      // Update existing shifts
      const updatedShifts = [];
      for (const { id, data } of shiftsToUpdate) {
        const updated = await base44.entities.Shift.update(id, data);
        updatedShifts.push(updated);
      }
      
      // Create new shifts
      let createdShifts = [];
      if (shiftsToCreate.length > 0) {
        createdShifts = await base44.entities.Shift.bulkCreate(shiftsToCreate);
      }
      
      // Update local state without full reload
      setShifts(prevShifts => {
        // Remove old versions of updated shifts
        let newShifts = prevShifts.filter(s => !shiftsToUpdate.find(u => u.id === s.id));
        // Add updated and created shifts
        return [...newShifts, ...updatedShifts, ...createdShifts];
      });
      
      toast.success('Shifts opgeslagen');
      setShowShiftModal(false);
      setEditModalShifts([]);
      setEditModalDate(null);
    } catch (error) {
      console.error('Error saving shifts:', error);
      toast.error('Fout bij opslaan shifts');
    }
  };

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));

  // Get shifts for a specific day
  const getShiftsForDay = (day) => {
    return shifts.filter(shift => isSameDay(new Date(shift.shift_date), day));
  };

  // Navigate weeks
  const goToPreviousWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToToday = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  if (loading) {
    return <div className="p-6 text-center">Loading shifts...</div>;
  }

  if (shifts.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-500">Nog geen shifts gepland voor dit project</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Navigation */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-4">
        <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={goToToday}>
            Vandaag
          </Button>
          <h3 className="font-semibold">
            Week {format(currentWeekStart, 'w', { locale: nl })} - {format(currentWeekStart, 'MMMM yyyy', { locale: nl })}
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={goToNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Timeline Grid */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {weekDays.map((day, idx) => {
            const isToday = isSameDay(day, new Date());
            const dayShifts = getShiftsForDay(day);
            const isShowdate = project?.showdates?.some(sd => isSameDay(new Date(sd), day));
            
            return (
              <div 
                key={idx} 
                className={`p-3 text-center border-r last:border-r-0 ${isToday ? 'bg-blue-50' : ''} ${isShowdate ? 'bg-yellow-50' : ''}`}
              >
                <div className="text-xs text-gray-500 uppercase">
                  {format(day, 'EEE', { locale: nl })}
                </div>
                <div className={`text-lg font-bold mt-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                  {format(day, 'd')}
                </div>
                {isShowdate && (
                  <div className="text-xs text-yellow-700 font-medium mt-1">
                    Showdate
                  </div>
                )}
                {dayShifts.length > 0 && (
                  <Badge variant="outline" className="mt-1 text-xs">
                    {dayShifts.length} shifts
                  </Badge>
                )}
              </div>
            );
          })}
        </div>

        {/* Shifts Timeline */}
        <div className="grid grid-cols-7">
          {weekDays.map((day, dayIdx) => {
            const dayShifts = getShiftsForDay(day).sort((a, b) => {
              const timeA = a.start_time || '00:00';
              const timeB = b.start_time || '00:00';
              return timeA.localeCompare(timeB);
            });
            const isShowdate = project?.showdates?.some(sd => isSameDay(new Date(sd), day));

            return (
              <div 
                key={dayIdx} 
                className="border-r last:border-r-0 min-h-[200px] p-2 space-y-2 group relative"
                onClick={() => isShowdate && openEditShiftModal(day)}
              >
                {dayShifts.map((shift) => {
                  const staffMember = getStaffForShift(shift.staff_id);
                  const isCompleted = shift.status === 'completed';
                  
                  return (
                    <div 
                      key={shift.id}
                      className={`p-2 rounded-lg border text-xs cursor-pointer ${
                        isCompleted 
                          ? 'bg-green-50 border-green-200' 
                          : staffMember 
                            ? 'bg-blue-50 border-blue-200' 
                            : 'bg-gray-50 border-gray-200'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditShiftModal(day);
                      }}
                    >
                      <div className="font-semibold text-gray-900 mb-1">
                        {shift.role}
                      </div>
                      <div className="flex items-center gap-1 text-gray-600 mb-1">
                        <Clock className="w-3 h-3" />
                        <span>{shift.start_time} - {shift.end_time}</span>
                      </div>
                      {staffMember && (
                        <div className="flex items-center gap-1 text-gray-700 font-medium">
                          <User className="w-3 h-3" />
                          <span>{staffMember.name}</span>
                        </div>
                      )}
                      {shift.location && (
                        <div className="flex items-center gap-1 text-gray-500 mt-1">
                          <MapPin className="w-3 h-3" />
                          <span className="truncate">{shift.location}</span>
                        </div>
                      )}
                      {isCompleted && (
                        <div className="mt-1 text-green-700 font-medium">
                          ✓ Afgerond
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Add button - visible on hover for showdates */}
                {isShowdate && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditShiftModal(day);
                    }}
                    className="w-full text-[9px] p-2 rounded border border-dashed border-gray-300 text-gray-500 hover:bg-gray-100 hover:border-gray-400 hover:text-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Plus className="w-3 h-3 mx-auto" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600 mb-1">Totaal Shifts</div>
          <div className="text-2xl font-bold text-gray-900">{shifts.length}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600 mb-1">Ingepland</div>
          <div className="text-2xl font-bold text-blue-900">
            {shifts.filter(s => s.staff_id && s.status !== 'completed' && s.status !== 'cancelled').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-600 mb-1">Afgerond</div>
          <div className="text-2xl font-bold text-green-900">
            {shifts.filter(s => s.status === 'completed').length}
          </div>
        </div>
      </div>

      {/* Shift Edit Modal */}
      <Dialog open={showShiftModal} onOpenChange={(open) => {
        setShowShiftModal(open);
        if (!open) {
          setEditModalShifts([]);
          setEditModalDate(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Shifts beheren - {editModalDate && format(editModalDate, 'd MMMM yyyy', { locale: nl })}
              {project && (
                <span className="text-sm font-normal text-gray-600 ml-2">
                  ({project.project_name})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editModalShifts.map((shift, idx) => {
              const serviceReqs = getServiceRequirements();
              const availableRoles = serviceReqs.map(s => s.name);
              const assignedStaff = shift.staff_id ? staff.find(s => s.id === shift.staff_id) : null;
              
              return (
                <div key={idx} className="flex items-start gap-2 p-3 bg-gray-50 rounded border">
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <Label className="text-xs">Dienst</Label>
                        <Select value={shift.role} onValueChange={(val) => updateEditModalShift(idx, 'role', val)}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Kies dienst" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.length > 0 ? (
                              availableRoles.map(role => (
                                <SelectItem key={role} value={role}>{role}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="custom">Vrije invoer</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Start</Label>
                        <Input 
                          type="time"
                          value={shift.start_time}
                          onChange={(e) => updateEditModalShift(idx, 'start_time', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Eind</Label>
                        <Input 
                          type="time"
                          value={shift.end_time}
                          onChange={(e) => updateEditModalShift(idx, 'end_time', e.target.value)}
                          className="h-9"
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Locatie</Label>
                        <Input 
                          placeholder="Optioneel"
                          value={shift.location || ''}
                          onChange={(e) => updateEditModalShift(idx, 'location', e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Notitie</Label>
                      <Input 
                        placeholder="Optioneel"
                        value={shift.briefing}
                        onChange={(e) => updateEditModalShift(idx, 'briefing', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    {assignedStaff && (
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <p className="text-xs text-green-800">
                          ✓ Toegewezen aan: <span className="font-semibold">{assignedStaff.name}</span>
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {shift.id && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => {
                          handleDeleteEditShift(shift.id, !!shift.staff_id);
                          removeEditModalShift(idx);
                        }}
                        className="h-9 w-9 p-0 text-red-600 hover:text-red-700"
                      >
                        🗑️
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => removeEditModalShift(idx)}
                      className="h-9 w-9 p-0"
                      disabled={editModalShifts.length === 1}
                    >
                      ×
                    </Button>
                  </div>
                </div>
              );
            })}
            
            <Button 
              variant="outline"
              onClick={addEmptyEditShift}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nog een shift toevoegen
            </Button>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setShowShiftModal(false);
                setEditModalShifts([]);
                setEditModalDate(null);
              }}>
                Annuleren
              </Button>
              <Button onClick={handleSaveEditShifts}>
                Opslaan ({editModalShifts.filter(s => s.role && s.start_time && s.end_time).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}