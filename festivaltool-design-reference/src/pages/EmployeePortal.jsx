import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Briefcase,
  CheckCircle,
  Loader2,
  LogOut,
  Upload,
  Image as ImageIcon
} from "lucide-react";
import { format, isSameDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { createPageUrl } from "@/utils";
import ShiftDetailModal from "../components/employee/ShiftDetailModal";

export default function EmployeePortal() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState(null);
  const [myShifts, setMyShifts] = useState([]);
  const [openShifts, setOpenShifts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isAdminPreview, setIsAdminPreview] = useState(false);
  const [selectedShift, setSelectedShift] = useState(null);
  const [showShiftDetail, setShowShiftDetail] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const verifyAndLoadData = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      // Check if staff data is in sessionStorage
      const storedStaff = sessionStorage.getItem('fastlane_staff');
      const adminPreview = sessionStorage.getItem('fastlane_admin_preview') === 'true';
      setIsAdminPreview(adminPreview);
      
      if (token) {
        // Verify magic link token
        try {
          const result = await base44.functions.invoke('verifyMagicToken', { token });

          if (result.data && result.data.success) {
            sessionStorage.setItem('fastlane_staff', JSON.stringify(result.data.staff));
            setStaff(result.data.staff);
            // Clear token from URL
            window.history.replaceState({}, '', createPageUrl('EmployeePortal'));
          } else {
            console.error('Verification failed:', result);
            toast.error('Ongeldige of verlopen inloglink');
            window.location.href = '/crew';
            return;
          }
        } catch (error) {
          console.error('Token verification error:', error);
          toast.error('Er is iets misgegaan. Probeer opnieuw in te loggen.');
          window.location.href = '/crew';
          return;
        }
      } else if (storedStaff) {
        setStaff(JSON.parse(storedStaff));
      } else {
        window.location.href = '/crew';
        return;
      }

      // Load shifts and projects
      await loadData();
    };

    verifyAndLoadData();
  }, [navigate]);

  const [offers, setOffers] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const storedStaff = JSON.parse(sessionStorage.getItem('fastlane_staff'));
      
      if (!storedStaff) {
        window.location.href = '/crew';
        return;
      }

      const [shiftsData, projectsData, offersData] = await Promise.all([
        base44.entities.Shift.list(),
        base44.entities.Project.list(),
        base44.entities.Offer.list()
      ]);

      console.log('Total shifts:', shiftsData?.length);
      console.log('Staff ID:', storedStaff.id);
      console.log('Staff skills:', storedStaff.skills);

      // Filter my shifts (assigned to me)
      const myShiftsFiltered = (shiftsData || []).filter(shift => 
        shift.staff_id === storedStaff.id && 
        shift.status !== 'cancelled'
      );

      // Show all open shifts to all staff members
      const openShiftsFiltered = (shiftsData || []).filter(shift => 
        !shift.staff_id && shift.status === 'open'
      );

      console.log('My shifts:', myShiftsFiltered.length);
      console.log('Open shifts:', openShiftsFiltered.length);

      setMyShifts(myShiftsFiltered);
      setOpenShifts(openShiftsFiltered);
      setProjects(projectsData || []);
      setOffers(offersData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Fout bij laden van gegevens');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('fastlane_staff');
    sessionStorage.removeItem('fastlane_admin_preview');
    if (isAdminPreview) {
      window.location.href = '/staff';
    } else {
      window.location.href = '/crew';
    }
  };

  const handleClaimShift = async (shiftId) => {
    if (!staff) return;

    try {
      await base44.entities.Shift.update(shiftId, {
        staff_id: staff.id,
        status: 'assigned'
      });
      
      toast.success('Shift geclaimed!');
      await loadData();
    } catch (error) {
      console.error('Error claiming shift:', error);
      toast.error('Fout bij claimen van shift');
    }
  };

  const getProjectForShift = (projectId) => {
    return projects.find(p => p.id === projectId);
  };

  const getOfferForShift = (offerId) => {
    return offers.find(o => o.id === offerId);
  };

  const handleOpenShift = (shift) => {
    setSelectedShift(shift);
    setShowShiftDetail(true);
  };

  const handleCloseShiftDetail = () => {
    setShowShiftDetail(false);
    setSelectedShift(null);
  };

  const handleShiftUpdate = async () => {
    await loadData();
  };

  // Get shifts for selected date
  const shiftsForSelectedDate = selectedDate 
    ? openShifts.filter(shift => isSameDay(parseISO(shift.shift_date), selectedDate))
    : [];

  // Group shifts by confirmed vs concept
  const confirmedShifts = shiftsForSelectedDate.filter(shift => !shift.is_concept && shift.project_id);
  const conceptShifts = shiftsForSelectedDate.filter(shift => shift.is_concept || shift.offer_id);

  // Get all unique dates with open shifts
  const datesWithShifts = React.useMemo(() => {
    const dates = new Set();
    openShifts.forEach(shift => {
      dates.add(format(parseISO(shift.shift_date), 'yyyy-MM-dd'));
    });
    return Array.from(dates).map(d => parseISO(d));
  }, [openShifts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!staff) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {isAdminPreview && (
            <div className="mb-3 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <strong>Admin Preview Modus</strong> - Je bekijkt het portal als {staff.name}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Hallo, {staff.name}!</h1>
              <p className="text-sm text-gray-600">Welkom bij je Fastlane portal</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              {isAdminPreview ? 'Terug naar Admin' : 'Uitloggen'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Tabs defaultValue="mijn-rooster" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="mijn-rooster">
              Mijn Rooster ({myShifts.length})
            </TabsTrigger>
            <TabsTrigger value="marktplaats">
              Marktplaats ({openShifts.length})
            </TabsTrigger>
          </TabsList>

          {/* My Shifts */}
          <TabsContent value="mijn-rooster" className="space-y-4">
            {myShifts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Je hebt nog geen shifts ingepland</p>
                  <p className="text-sm text-gray-500 mt-2">Check de marktplaats voor beschikbare shifts!</p>
                </CardContent>
              </Card>
            ) : (
              myShifts
                .sort((a, b) => new Date(a.shift_date) - new Date(b.shift_date))
                .map(shift => {
                  const project = getProjectForShift(shift.project_id);
                  const offer = getOfferForShift(shift.offer_id);
                  const isConceptShift = shift.is_concept;
                  const isOfferArchived = offer?.status === 'archived';
                  const location = shift.location || project?.project_location || offer?.project_location;
                  
                  return (
                    <Card 
                      key={shift.id} 
                      className={`hover:shadow-lg transition-shadow cursor-pointer ${isOfferArchived ? 'border-red-400 bg-red-50' : isConceptShift ? 'border-orange-300 bg-orange-50' : ''}`}
                      onClick={() => handleOpenShift(shift)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">
                              {shift.is_office_service 
                                ? (shift.office_service_title || 'Kantoordienst')
                                : (project?.project_name || offer?.project_name || 'Project')
                              }
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge variant="outline" className={isOfferArchived ? 'bg-red-100 border-red-300' : isConceptShift ? 'bg-orange-100 border-orange-300' : 'bg-blue-50'}>
                                {shift.role}
                              </Badge>
                              {isOfferArchived ? (
                                <Badge className="bg-red-600 text-white">
                                  Evenement gaat niet door
                                </Badge>
                              ) : isConceptShift ? (
                                <Badge className="bg-orange-100 text-orange-800 border border-orange-300">
                                  Onder voorbehoud
                                </Badge>
                              ) : (
                                <Badge className={
                                  shift.status === 'completed' ? 'bg-green-100 text-green-800' :
                                  shift.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }>
                                  {shift.status === 'completed' ? 'Afgerond' :
                                   shift.status === 'in_progress' ? 'Bezig' :
                                   'Ingepland'}
                                </Badge>
                              )}
                            </div>
                            {isConceptShift && !isOfferArchived && (
                              <div className="mt-2 px-2 py-1 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800">
                                ⚠️ Let op: Deze shift is nog niet definitief en hangt af van goedkeuring van de klant
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{format(new Date(shift.shift_date), 'EEEE d MMMM yyyy', { locale: nl })}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{shift.start_time} - {shift.end_time}</span>
                        </div>
                        {location && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <MapPin className="w-4 h-4" />
                            <span>{location}</span>
                          </div>
                        )}
                        {shift.contact_person && (
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <User className="w-4 h-4" />
                            <span>{shift.contact_person}</span>
                            {shift.contact_phone && (
                              <a href={`tel:${shift.contact_phone}`} className="text-blue-600 hover:underline">
                                ({shift.contact_phone})
                              </a>
                            )}
                          </div>
                        )}
                        {shift.briefing && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
                            <p className="text-sm font-semibold text-gray-800 mb-1">Briefing:</p>
                            <p className="text-sm text-gray-700">{shift.briefing}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
            )}
          </TabsContent>

          {/* Open Shifts Marketplace */}
          <TabsContent value="marktplaats" className="space-y-4">
            {openShifts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Geen beschikbare shifts op dit moment</p>
                  <p className="text-sm text-gray-500 mt-2">Check later opnieuw voor nieuwe mogelijkheden</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Calendar Picker */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selecteer een datum</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CalendarPicker
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={nl}
                      className="rounded-md border"
                      modifiers={{
                        hasShifts: datesWithShifts
                      }}
                      modifiersStyles={{
                        hasShifts: {
                          fontWeight: 'bold',
                          backgroundColor: '#dcfce7',
                          color: '#166534'
                        }
                      }}
                    />
                    <div className="mt-4 flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-4 h-4 rounded bg-green-100 border border-green-600"></div>
                      <span>Dagen met beschikbare shifts</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Shifts for Selected Date */}
                <div className="space-y-4">
                  {!selectedDate ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Selecteer een datum om shifts te zien</p>
                      </CardContent>
                    </Card>
                  ) : shiftsForSelectedDate.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Briefcase className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Geen shifts op deze datum</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <>
                      <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm font-semibold text-blue-900">
                          {format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })}
                        </p>
                        <div className="flex items-center gap-4 mt-1 text-xs">
                          {confirmedShifts.length > 0 && (
                            <span className="text-green-700 font-medium">
                              ✓ {confirmedShifts.length} bevestigd
                            </span>
                          )}
                          {conceptShifts.length > 0 && (
                            <span className="text-orange-700 font-medium">
                              ⚠️ {conceptShifts.length} concept
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {confirmedShifts.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-green-800 px-2">Bevestigde diensten</h3>
                          {confirmedShifts.map(shift => {
                            const project = getProjectForShift(shift.project_id);
                            const location = shift.location || project?.project_location;
                            
                            return (
                              <Card 
                                key={shift.id} 
                                className="hover:shadow-lg transition-shadow border-2 border-green-200"
                              >
                                <CardHeader className="pb-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <CardTitle className="text-base">
                                        {shift.is_office_service 
                                          ? (shift.office_service_title || 'Kantoordienst')
                                          : (project?.project_name || 'Project')
                                        }
                                      </CardTitle>
                                      <Badge variant="outline" className="mt-2 bg-green-50 text-green-700 border-green-300">
                                        {shift.role}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2 pt-0">
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    <span>{shift.start_time} - {shift.end_time}</span>
                                  </div>
                                  {location && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <MapPin className="w-4 h-4" />
                                      <span>{location}</span>
                                    </div>
                                  )}
                                  <Button 
                                    onClick={() => handleClaimShift(shift.id)}
                                    className="w-full mt-3 bg-green-600 hover:bg-green-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Claimen
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                      
                      {conceptShifts.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-orange-800 px-2">Conceptdiensten (onder voorbehoud)</h3>
                          {conceptShifts.map(shift => {
                            const project = getProjectForShift(shift.project_id);
                            const offer = getOfferForShift(shift.offer_id);
                            const location = shift.location || project?.project_location || offer?.project_location;
                            
                            return (
                              <Card 
                                key={shift.id} 
                                className="hover:shadow-lg transition-shadow border-2 border-orange-300 bg-orange-50/30"
                              >
                                <CardHeader className="pb-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <CardTitle className="text-base">
                                        {shift.is_office_service 
                                          ? (shift.office_service_title || 'Kantoordienst')
                                          : (project?.project_name || offer?.project_name || 'Project')
                                        }
                                      </CardTitle>
                                      <Badge variant="outline" className="mt-2 bg-orange-50 text-orange-700 border-orange-300">
                                        {shift.role}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="mt-2 px-2 py-1 bg-orange-100 border border-orange-300 rounded text-xs text-orange-800">
                                    ⚠️ Onder voorbehoud van klantbevestiging
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-2 pt-0">
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Clock className="w-4 h-4" />
                                    <span>{shift.start_time} - {shift.end_time}</span>
                                  </div>
                                  {location && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <MapPin className="w-4 h-4" />
                                      <span>{location}</span>
                                    </div>
                                  )}
                                  <Button 
                                    onClick={() => handleClaimShift(shift.id)}
                                    className="w-full mt-3 bg-orange-600 hover:bg-orange-700"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Claimen
                                  </Button>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
        </div>

        {/* Shift Detail Modal */}
        {selectedShift && (
        <ShiftDetailModal
          shift={selectedShift}
          project={getProjectForShift(selectedShift.project_id)}
          isOpen={showShiftDetail}
          onClose={handleCloseShiftDetail}
          onUpdate={handleShiftUpdate}
        />
        )}
        </div>
        );
        }