import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Offer, Client, Project, Product, ProductCategorySetting, OfferFolder } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, FileText, Search, Archive, Filter, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

import OfferListWithFolders from "../components/offers/OfferListWithFolders";

export default function OffersPage() {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [offers, setOffers] = useState([]);
  const [folders, setFolders] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [filteredOffers, setFilteredOffers] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTags, setSelectedTags] = useState([]); // New: for tag filtering
  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showRejected, setShowRejected] = useState(false);

  // Get unique tags from all offers
  const allTags = useMemo(() => {
    const tagSet = new Set();
    offers.forEach(offer => {
      (offer.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [offers]);

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

  const applyFilters = useCallback(() => {
    let filtered = offers;

    if (searchTerm) {
        const lowercasedTerm = searchTerm.toLowerCase();
        const clientNameMap = new Map(clients.map(c => [c.id, c.company_name.toLowerCase()]));
        filtered = filtered.filter(o => 
            o.project_name?.toLowerCase().includes(lowercasedTerm) ||
            clientNameMap.get(o.client_id)?.includes(lowercasedTerm) ||
            (o.offer_number || '').toString().toLowerCase().includes(lowercasedTerm)
        );
    }

    // Apply tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(o => {
        const offerTags = o.tags || [];
        return selectedTags.some(tag => offerTags.includes(tag));
      });
    }
    
    setFilteredOffers(filtered);
    
    // Also filter folders to only show those with matching offers when searching
  }, [offers, searchTerm, clients, selectedTags]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
        const [offersData, foldersData, clientsData, projectsData, productsData, categorySettingsData] = await Promise.all([
            Offer.list('-created_date'),
            OfferFolder.list(),
            Client.list(),
            Project.list(),
            Product.list(),
            ProductCategorySetting.list()
        ]);
        
        let filteredOffers;
        if (showArchived) {
          filteredOffers = (offersData || []).filter(o => o.status === 'archived');
        } else {
          // Hide rejected unless showRejected is true
          filteredOffers = (offersData || []).filter(o => {
            if (o.status === 'archived') return false;
            if (o.status === 'rejected' && !showRejected) return false;
            return true;
          });
        }
        
        setOffers(filteredOffers);
        setFolders(foldersData || []);
        setClients(clientsData || []);
        setProjects(projectsData || []);
        setProducts(productsData || []);
        setCategorySettings(categorySettingsData || []);
    } catch (error) {
        console.error("Failed to load data", error);
    } finally {
        setIsLoading(false);
    }
  }, [showArchived, showRejected]);

  // New function to update a single offer in state
  const updateOfferInState = useCallback((offerId, updates) => {
    setOffers(prevOffers => 
      prevOffers.map(offer => 
        offer.id === offerId ? { ...offer, ...updates } : offer
      )
    );
  }, []);

  // New function to remove an offer from state (for archiving)
  const removeOfferFromState = useCallback((offerId) => {
    setOffers(prevOffers => prevOffers.filter(offer => offer.id !== offerId));
  }, []);

  useEffect(() => {
    if (authState.authorized) {
      loadData();
    }
  }, [authState.authorized, loadData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const offerId = urlParams.get('id');

  useEffect(() => {
    if(action === 'create' || offerId) {
        let path = offerId ? `OfferEditor?id=${offerId}` : `OfferEditor`;
        navigate(createPageUrl(path));
    }
  }, [action, offerId, navigate]);

  if (authState.checking) {
    return <div className="flex justify-center items-center h-screen text-lg">{t('Loading...')}</div>;
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              {showArchived ? t('Archived Offers') : t('Offers')}
            </h1>
            <p className="text-gray-600 mt-2">{t('Create, manage, and track festival service offers')}</p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto flex-wrap">
             <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder={t('Search offers...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Tag Filter */}
            {allTags.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="w-4 h-4" />
                    Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-semibold">Filter by Tags</span>
                      {selectedTags.length > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => setSelectedTags([])}
                          className="h-6 text-xs"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                    {allTags.map(tag => (
                      <label key={tag} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTags([...selectedTags, tag]);
                            } else {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{tag}</span>
                      </label>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            
            {!showArchived && (
              <Button 
                onClick={() => setShowRejected(!showRejected)}
                variant="outline"
                className={showRejected ? 'bg-red-50 border-red-200 text-red-700' : ''}
              >
                <XCircle className="w-5 h-5 mr-2" />
                {showRejected ? t('Hide Lost') : t('Show Lost')}
              </Button>
            )}
            <Button 
              onClick={() => setShowArchived(!showArchived)}
              variant="outline"
              className={showArchived ? 'bg-gray-100' : ''}
            >
              <Archive className="w-5 h-5 mr-2" />
              {showArchived ? t('Show Active') : t('Show Archived')}
            </Button>
            {!showArchived && (
              <Button 
                onClick={() => navigate(createPageUrl("OfferEditor"))}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-5 h-5 mr-2" />
                {t('New Offer')}
              </Button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-lg border">
            <OfferListWithFolders
              offers={filteredOffers}
              folders={folders}
              clients={clients}
              projects={projects}
              products={products}
              categorySettings={categorySettings}
              isLoading={isLoading}
              onDataChange={loadData}
              onUpdateOffer={updateOfferInState}
              onRemoveOffer={removeOfferFromState}
              showArchived={showArchived}
              allTags={allTags}
            />
        </div>
      </div>
    </div>
  );
}