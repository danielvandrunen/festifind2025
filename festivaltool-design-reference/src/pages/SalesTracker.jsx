import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Offer, Client, Product, ProductCategorySetting } from "@/api/entities";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, RotateCcw, RefreshCw, Calendar } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { addMonths, addYears, subMonths } from "date-fns";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

import SalesLane from "../components/sales/SalesLane";
import SalesOfferCard from "../components/sales/SalesOfferCard";

const LANES = [
  { id: 'draft', title: 'Draft', color: 'bg-slate-200' },
  { id: 'sent', title: 'Sent', color: 'bg-blue-100' },
  { id: 'reminder', title: 'Reminder', color: 'bg-amber-100' },
  { id: 'conversation', title: 'Conversation', color: 'bg-orange-100' },
  { id: 'deal', title: 'Confirmed', color: 'bg-emerald-100' },
];

// Determine which lane an offer should be in
const getOfferLane = (offer) => {
  // If manually placed in reminder/conversation, respect that
  if (offer.sales_lane === 'reminder' || offer.sales_lane === 'conversation') {
    return offer.sales_lane;
  }
  
  // If explicitly marked as lost
  if (offer.sales_lane === 'lost') {
    return 'lost';
  }

  // If confirmed/signed -> deal
  const isConfirmed = offer.status === 'confirmed' || offer.status === 'accepted' || !!offer.signed_date;
  if (isConfirmed) {
    return 'deal';
  }

  // If sent -> sent lane (unless manually overridden to reminder/conversation)
  if (offer.status === 'sent' || offer.status === 'under_review') {
    return offer.sales_lane || 'sent';
  }

  // Default to draft
  return offer.sales_lane || 'draft';
};

export default function SalesTracker() {
  const { t } = useLocalization();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null, error: null });
  const [offers, setOffers] = useState([]);
  const [allOffers, setAllOffers] = useState([]); // Unfiltered offers for drag operations
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lostOffers, setLostOffers] = useState([]);
  const [allLostOffers, setAllLostOffers] = useState([]); // Unfiltered lost offers
  const [dateFilter, setDateFilter] = useState('all');

  const getDateFilterRange = useCallback(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    
    switch(dateFilter) {
      case '3months':
        return { start: todayStart, end: addMonths(todayStart, 3) };
      case '6months':
        return { start: todayStart, end: addMonths(todayStart, 6) };
      case 'year':
        return { start: todayStart, end: addYears(todayStart, 1) };
      case 'past_6months':
        return { start: subMonths(todayStart, 6), end: todayStart };
      case 'past_12months':
        return { start: subMonths(todayStart, 12), end: todayStart };
      case '2025':
        return { start: new Date(2025, 0, 1), end: new Date(2025, 11, 31, 23, 59, 59) };
      case '2026':
        return { start: new Date(2026, 0, 1), end: new Date(2026, 11, 31, 23, 59, 59) };
      case '2027':
        return { start: new Date(2027, 0, 1), end: new Date(2027, 11, 31, 23, 59, 59) };
      case 'all':
      default:
        return null;
    }
  }, [dateFilter]);

  const filterOffersByDate = useCallback((offersToFilter) => {
    const range = getDateFilterRange();
    if (!range) return offersToFilter;

    return offersToFilter.filter(offer => {
      if (offer.showdates && offer.showdates.length > 0) {
        return offer.showdates.some(showdate => {
          const offerDate = new Date(showdate);
          const offerDateStart = new Date(offerDate.getFullYear(), offerDate.getMonth(), offerDate.getDate(), 0, 0, 0, 0);
          return offerDateStart >= range.start && offerDateStart <= range.end;
        });
      }
      return false;
    });
  }, [getDateFilterRange]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { isAuthorized, user, error } = await checkUserAuthorization();
        if (error === 'not_authenticated') {
          window.location.href = '/login';
          return;
        }
        setAuthState({ checking: false, authorized: isAuthorized, user, error });
      } catch (error) {
        setAuthState({ checking: false, authorized: false, user: null, error: 'check_failed' });
      }
    };
    checkAuth();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [offersData, clientsData, productsData, categorySettingsData] = await Promise.all([
        Offer.list('-updated_date'),
        Client.list(),
        Product.list(),
        ProductCategorySetting.list()
      ]);

      // Filter out archived and rejected offers, separate lost offers
      const activeOffers = [];
      const lost = [];
      
      (offersData || []).forEach(offer => {
        if (offer.status === 'archived') return;
        
        if (offer.sales_lane === 'lost' || offer.status === 'rejected') {
          lost.push(offer);
        } else {
          activeOffers.push(offer);
        }
      });

      // Store unfiltered versions for drag operations
      setAllOffers(activeOffers);
      setAllLostOffers(lost);
      
      // Apply date filter for display
      setOffers(filterOffersByDate(activeOffers));
      setLostOffers(filterOffersByDate(lost));
      setClients(clientsData || []);
      setProducts(productsData || []);
      setCategorySettings(categorySettingsData || []);
    } catch (error) {
      console.error("Failed to load data", error);
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [filterOffersByDate]);

  // Re-filter when date filter changes
  useEffect(() => {
    if (allOffers.length > 0 || allLostOffers.length > 0) {
      setOffers(filterOffersByDate(allOffers));
      setLostOffers(filterOffersByDate(allLostOffers));
    }
  }, [dateFilter, allOffers, allLostOffers, filterOffersByDate]);

  useEffect(() => {
    if (authState.authorized) {
      loadData();
    }
  }, [authState.authorized, loadData]);

  // Group offers by lane
  const offersByLane = useMemo(() => {
    const grouped = {
      draft: [],
      sent: [],
      reminder: [],
      conversation: [],
      deal: []
    };

    offers.forEach(offer => {
      const lane = getOfferLane(offer);
      if (grouped[lane]) {
        grouped[lane].push(offer);
      }
    });

    return grouped;
  }, [offers]);

  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const targetLane = destination.droppableId;
    const offer = allOffers.find(o => o.id === draggableId) || allLostOffers.find(o => o.id === draggableId);
    
    if (!offer) return;

    // Optimistically update both filtered and unfiltered state
    if (targetLane === 'lost') {
      const updatedOffer = { ...offer, sales_lane: 'lost' };
      setAllOffers(prev => prev.filter(o => o.id !== draggableId));
      setAllLostOffers(prev => [...prev, updatedOffer]);
    } else if (source.droppableId === 'lost') {
      const updatedOffer = { ...offer, sales_lane: targetLane };
      setAllLostOffers(prev => prev.filter(o => o.id !== draggableId));
      setAllOffers(prev => [...prev, updatedOffer]);
    } else {
      setAllOffers(prev => prev.map(o => 
        o.id === draggableId ? { ...o, sales_lane: targetLane } : o
      ));
    }

    // Persist to database
    try {
      await Offer.update(draggableId, { sales_lane: targetLane });
    } catch (error) {
      toast.error("Failed to update offer");
      loadData(); // Reload on error
    }
  };

  const handleRestoreFromLost = async (offerId) => {
    const offer = lostOffers.find(o => o.id === offerId);
    if (!offer) return;

    try {
      await Offer.update(offerId, { sales_lane: 'draft', status: 'draft' });
      toast.success("Offer restored");
      loadData();
    } catch (error) {
      toast.error("Failed to restore offer");
    }
  };

  if (authState.checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        {t('Loading...')}
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} error={authState.error} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster />
      
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Sales Tracker</h1>
            <p className="text-sm text-gray-500">Track and manage your sales pipeline</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-48">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue placeholder={t('Filter by date')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('All Time')}</SelectItem>
                <SelectItem value="past_6months">{t('Past 6 Months')}</SelectItem>
                <SelectItem value="past_12months">{t('Past 12 Months')}</SelectItem>
                <SelectItem value="3months">{t('Next 3 Months')}</SelectItem>
                <SelectItem value="6months">{t('Next 6 Months')}</SelectItem>
                <SelectItem value="year">{t('Next 12 Months')}</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2027">2027</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={loadData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-6 flex gap-4">
          {LANES.map(lane => (
            <div key={lane.id} className="w-72 space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="p-6">
            {/* Main Lanes */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {LANES.map(lane => (
                <SalesLane
                  key={lane.id}
                  id={lane.id}
                  title={lane.title}
                  color={lane.color}
                  offers={offersByLane[lane.id] || []}
                  clients={clients}
                  products={products}
                  categorySettings={categorySettings}
                  onUpdate={loadData}
                />
              ))}
            </div>

            {/* Lost/Archive Drop Zone */}
            <div className="mt-6 border-t pt-4">
              <Droppable droppableId="lost">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`border-2 border-dashed rounded-lg p-4 transition-colors ${
                      snapshot.isDraggingOver 
                        ? 'border-red-400 bg-red-50' 
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Trash2 className="w-5 h-5 text-gray-500" />
                      <h3 className="font-semibold text-gray-700">Lost Deals</h3>
                      <Badge variant="outline" className="ml-2">
                        {lostOffers.length}
                      </Badge>
                      <span className="text-sm text-gray-500 ml-2">
                        Drag offers here to mark as lost
                      </span>
                    </div>

                    {lostOffers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {lostOffers.map((offer, index) => {
                          const client = clients.find(c => c.id === offer.client_id);
                          return (
                            <Draggable key={offer.id} draggableId={offer.id} index={index}>
                              {(provided) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className="bg-white border rounded-lg p-2 flex items-center gap-2 text-sm shadow-sm"
                                >
                                  <span className="font-medium text-gray-700">{offer.project_name}</span>
                                  <span className="text-gray-400">•</span>
                                  <span className="text-gray-500">{client?.company_name}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 ml-2"
                                    onClick={() => handleRestoreFromLost(offer.id)}
                                    title="Restore to Draft"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5 text-green-600" />
                                  </Button>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      </div>
                    )}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
        </DragDropContext>
      )}
    </div>
  );
}