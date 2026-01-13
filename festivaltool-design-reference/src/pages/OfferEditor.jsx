import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Offer, Client, Product, Contract, ProductCategorySetting, Project } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Send, Eye, Link2, Building2, Clock, Copy } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { DragDropContext } from "@hello-pangea/dnd";
import { useLocalization } from "../components/Localization";
import { base44 } from "@/api/base44Client";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

import DocumentHeader from "../components/offers/editor/a4/DocumentHeader";
import DocumentSection from "../components/offers/editor/a4/DocumentSection";
import DocumentFooter from "../components/offers/editor/a4/DocumentFooter";
import ClientForm from "../components/clients/ClientForm";
import EventCockpit from "../components/offers/editor/EventCockpit";
import VersionHistory from "../components/offers/VersionHistory";

const BTW_RATE = 0.21;

// Simple debounce utility to prevent too frequent saves for optimistic updates
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
};

const groupLinesBySection = (lines, products, categorySettings) => {
    if (!Array.isArray(products)) return [];

    const productMap = new Map(products.map(p => [p.id, p]));
    const lineMap = new Map((lines || []).map(l => [l.product_id, l]));
    
    // Get category settings map
    const categorySettingsMap = new Map((categorySettings || []).map(s => [s.category, s]));

    // Separate standard and post-calculation categories
    const standardCategories = [...new Set(
        products
            .filter(p => p.is_active)
            .filter(p => {
                const setting = categorySettingsMap.get(p.category);
                return !setting || setting.calculation_type !== 'post_event';
            })
            .map(p => p.category || 'services')
    )];

    const postCalcCategories = [...new Set(
        products
            .filter(p => p.is_active)
            .filter(p => {
                const setting = categorySettingsMap.get(p.category);
                return setting && setting.calculation_type === 'post_event';
            })
            .map(p => p.category || 'services')
    )];

    const sectionsMap = new Map();
    
    // Create sections for standard categories
    standardCategories.forEach(category => {
        sectionsMap.set(category, { title: category, lines: [] });
    });

    // Create sections for post-calculation categories
    postCalcCategories.forEach(category => {
        sectionsMap.set(category, { title: category, lines: [] });
    });

    // Add products to their respective sections
    products.filter(p => p.is_active).forEach(product => {
        const category = product.category || 'services';
        const setting = categorySettingsMap.get(category);
        const isPostCalc = setting && setting.calculation_type === 'post_event';
        
        const existingLine = lineMap.get(product.id);
        const line = existingLine ? {
            ...existingLine,
            product_name: product.name,
        } : {
            product_id: product.id,
            product_name: product.name,
            description: product.description || '',
            quantity: isPostCalc ? 0 : (product.default_quantity || 0), // Post-calc products always have 0 quantity in lines
            unit_price: product.default_price,
            percentage_fee: product.percentage_fee || 0,
            percentage_cost_basis: product.percentage_cost_basis || 0,
            line_total: 0
        };
        
        if (sectionsMap.has(category)) {
            sectionsMap.get(category).lines.push(line);
        }
    });

    // Sort lines within each section
    for (const section of sectionsMap.values()) {
        section.lines.sort((a, b) => {
            const productA = productMap.get(a.product_id);
            const productB = productMap.get(b.product_id);
            return (productA?.display_order || 0) - (productB?.display_order || 0);
        });
    }

    // Sort sections by display order
    const sortedCategories = (categorySettings || [])
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(s => s.category);

    const sortedSections = [];
    sortedCategories.forEach(category => {
        if (sectionsMap.has(category)) {
            sortedSections.push(sectionsMap.get(category));
            sectionsMap.delete(category);
        }
    });

    // Add any remaining sections that weren't in categorySettings
    for (const section of sectionsMap.values()) {
        sortedSections.push(section);
    }

    return sortedSections;
};

export default function OfferEditor() {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null, error: null });
  const [offer, setOffer] = useState(null);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [hasAutoSaved, setHasAutoSaved] = useState(false);
  const [versions, setVersions] = useState([]);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const offerIdFromUrl = urlParams.get('id');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { isAuthorized, user, error } = await checkUserAuthorization();
        
        if (error === 'not_authenticated') {
          window.location.href = '/login';
          return;
        }
        
        if (error === 'network_error' || error === 'check_failed') {
          setAuthState({ checking: false, authorized: false, user: null, error });
          return;
        }
        
        setAuthState({ checking: false, authorized: isAuthorized, user, error });
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({ checking: false, authorized: false, user: null, error: 'check_failed' });
      }
    };
    checkAuth();
  }, []);

  const ensureAllProductsInLines = useCallback((existingLines = [], allProducts = [], categorySettingsList = [], offerId = null) => {
    const productMap = new Map(allProducts.map(p => [p.id, p]));
    const lineMap = new Map(existingLines.map(line => [line.product_id, line]));
    const finalLines = [];

    const sortedProducts = [...allProducts].sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    sortedProducts.forEach(product => {
      if (product.is_active) {
        const setting = categorySettingsList.find(s => s.category === product.category);
        const isPostCalc = setting?.calculation_type === 'post_event';
        
        const existingLine = lineMap.get(product.id);
        if (existingLine) {
          // Keep existing line with its saved quantity
          finalLines.push({
            ...existingLine,
            product_name: product.name,
          });
        } else {
          // For NEW offers (offerId is null): use product default_quantity
          // For EXISTING offers (offerId is not null): always use 0 for newly added products
          // This prevents active products not explicitly added to an existing offer from appearing with default quantities.
          const defaultQuantity = offerId ? 0 : (isPostCalc ? 0 : (product.default_quantity || 0));
          
          finalLines.push({
            product_id: product.id,
            product_name: product.name,
            description: product.description || '',
            quantity: defaultQuantity,
            unit_price: product.default_price,
            percentage_fee: product.percentage_fee || 0,
            percentage_cost_basis: product.percentage_cost_basis || 0,
            line_total: 0
          });
        }
      }
    });

    return finalLines;
  }, []);

  const calculateKeyFigureValue = useCallback((keyFigure, offerData) => {
    if (!keyFigure || keyFigure === 'none' || !offerData) return 0;

    const visitorsPerShowdate = offerData.expected_visitors_per_showdate || {};
    const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);

    switch (keyFigure) {
      case 'total_visitors':
        // If total_visitors_override is set and > 0, use it. Otherwise, use calculated from showdates.
        return (offerData.total_visitors_override !== null && offerData.total_visitors_override > 0)
               ? offerData.total_visitors_override
               : totalVisitorsFromShowdates;
      case 'bar_meters':
        return offerData.bar_meters || 0;
      case 'food_sales_positions':
        return offerData.food_sales_positions || 0;
      case 'euro_spend_per_person':
        return offerData.euro_spend_per_person || 0;
      case 'number_of_showdates':
        return (offerData.showdates || []).length;
      case 'expected_revenue':
        return ((offerData.total_visitors_override !== null && offerData.total_visitors_override > 0)
                ? offerData.total_visitors_override
                : totalVisitorsFromShowdates) * (offerData.euro_spend_per_person || 0);
      case 'average_transaction_value':
        return offerData.average_transaction_value || 0;
      default:
        return 0;
    }
  }, []);

  const updateQuantitiesFromCockpit = useCallback((offerData, productsList, categorySettingsList, changedField = null) => {
    console.log('🔄 updateQuantitiesFromCockpit called with field:', changedField);
    console.log('📋 Current total_visitors_override state:', offerData.total_visitors_override);
    
    if (!offerData || !productsList || !categorySettingsList) return offerData;

    // IMPORTANT: If no field changed (initial load), and this is an existing offer with an ID,
    // don't recalculate anything - trust the saved quantities.
    // This prevents existing offer lines from being reset to default/cockpit-derived values on page load.
    if (changedField === null && offerData.id) {
      console.log('⚠️ Skipping quantity recalculation for existing offer on load (ID:', offerData.id, ')');
      return offerData;
    }

    // Map changed fields to affected key figures
    const getAffectedKeyFigures = (field) => {
      switch (field) {
        case 'expected_visitors_per_showdate':
          return ['total_visitors', 'expected_revenue'];
        case 'bar_meters':
          return ['bar_meters'];
        case 'food_sales_positions':
          return ['food_sales_positions'];
        case 'euro_spend_per_person':
          return ['euro_spend_per_person', 'expected_revenue'];
        case 'showdates':
          return ['number_of_showdates', 'total_visitors', 'expected_revenue'];
        case 'total_visitors_override':
          return ['total_visitors'];
        case 'average_transaction_value':
          return ['average_transaction_value'];
        default:
          return null;
      }
    };

    const affectedKeyFigures = getAffectedKeyFigures(changedField);
    const isTotalVisitorsOverrideChange = changedField === 'total_visitors_override';
    const isFullRecalc = changedField === null;

    console.log('🎯 isTotalVisitorsOverrideChange:', isTotalVisitorsOverrideChange);

    // Calculate base values
    const visitorsPerShowdate = offerData.expected_visitors_per_showdate || {};
    const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);
    const euroSpendPerPerson = offerData.euro_spend_per_person || 0;
    
    // For transaction processing: ALWAYS use sum of showdates
    const transactionProcessingVisitors = totalVisitorsFromShowdates;
    const transactionProcessingRevenue = transactionProcessingVisitors * euroSpendPerPerson;
    
    // For ticketing: use override if set, otherwise sum of showdates
    const ticketingVisitors = (offerData.total_visitors_override !== null && offerData.total_visitors_override !== undefined && offerData.total_visitors_override > 0)
        ? offerData.total_visitors_override
        : totalVisitorsFromShowdates;

    const updatedLines = (offerData.offer_lines || []).map(line => {
      const product = productsList.find(p => p.id === line.product_id);
      if (!product) {
        console.log('⚠️ Product not found for line:', line.product_id);
        return line;
      }

      const setting = categorySettingsList.find(s => s.category === product.category);
      const isPostCalc = setting?.calculation_type === 'post_event';

      // Post-calc products should always have quantity 0 in the line
      if (isPostCalc) {
        return { ...line, quantity: 0 };
      }

      // IMPORTANT: Only recalculate if product has a key figure set.
      // Products without key figures should NEVER have their quantities auto-updated by the cockpit logic.
      if (!product.key_figure || product.key_figure === 'none') {
        console.log('⏭️ Skipping product without key figure, keeping existing quantity:', product.name, 'current qty:', line.quantity);
        return line; // Keep existing quantity
      }

      // Check which category this product belongs to
      const isTicketingProduct = product.category === 'ticketing_ecommerce_fees';
      const isTransactionProduct = product.category === 'transaction_processing';
      
      console.log('🔍 Checking product:', product.name, 'category:', product.category, 'isTicketing:', isTicketingProduct, 'isTransaction:', isTransactionProduct);

      if (isTicketingProduct) {
        console.log('🎫 Processing ticketing product:', product.name, 'current qty:', line.quantity, 'total_visitors_override:', offerData.total_visitors_override);
        
        // ALWAYS respect the total_visitors_override state
        if (offerData.total_visitors_override === null || offerData.total_visitors_override <= 0) {
          console.log('❌ Total Visitors Override OFF or 0 - setting', product.name, 'to 0');
          return { ...line, quantity: 0 };
        }
        
        // If total_visitors_override is ON (i.e., > 0)
        if (offerData.total_visitors_override > 0) {
          console.log('✅ Total Visitors Override ON for', product.name);
          
          // Recalculate if:
          // 1. It's a full recalculation (initial load) - though this is now guarded by offerData.id check at the top
          // 2. Total visitors override just changed
          // 3. A cockpit field that affects this product's key figure changed
          const shouldRecalculate = isFullRecalc || 
                                   isTotalVisitorsOverrideChange || 
                                   (product.key_figure && affectedKeyFigures && affectedKeyFigures.includes(product.key_figure));
          
          console.log('🔢 Should recalculate', product.name, '?', shouldRecalculate, 'key figure:', product.key_figure);
          
          if (shouldRecalculate && product.key_figure === 'total_visitors') {
            const calculatedQuantity = Math.round(ticketingVisitors * (product.key_figure_multiplier || 0));
            console.log('📈', product.name, 'calculated quantity:', calculatedQuantity, 'from ticketing visitors:', ticketingVisitors, 'multiplier:', product.key_figure_multiplier);
            return { ...line, quantity: calculatedQuantity };
          }
        }
        
        // Return a new object to ensure immutability
        console.log('⚠️ No changes for', product.name, 'returning current quantity:', line.quantity);
        return { ...line };
      }

      if (isTransactionProduct) {
        // Transaction processing products ALWAYS use showdate sum
        if (product.key_figure && product.key_figure !== 'none') {
          // Skip if a specific field changed and it doesn't affect this product
          if (!isFullRecalc && affectedKeyFigures && !affectedKeyFigures.includes(product.key_figure)) {
            return line;
          }

          let keyFigureValue = 0;
          switch (product.key_figure) {
            case 'total_visitors':
              keyFigureValue = transactionProcessingVisitors;
              break;
            case 'expected_revenue':
              keyFigureValue = transactionProcessingRevenue;
              break;
            case 'bar_meters':
              keyFigureValue = offerData.bar_meters || 0;
              break;
            case 'food_sales_positions':
              keyFigureValue = offerData.food_sales_positions || 0;
              break;
            case 'euro_spend_per_person':
              keyFigureValue = euroSpendPerPerson;
              break;
            case 'number_of_showdates':
              keyFigureValue = offerData.showdates?.length || 0;
              break;
            case 'average_transaction_value':
              keyFigureValue = offerData.average_transaction_value || 0;
              break;
            default:
              // For other key figures, fall back to generic calculation
              keyFigureValue = calculateKeyFigureValue(product.key_figure, offerData);
              break;
          }
          
          const calculatedQuantity = Math.round(keyFigureValue * (product.key_figure_multiplier || 0));
          if (line.quantity !== calculatedQuantity) {
            return { ...line, quantity: calculatedQuantity };
          }
        }
        return line;
      }

      // For other standard products with key figures
      if (product.key_figure && product.key_figure !== 'none') {
        // Skip if a specific field changed and it doesn't affect this product
        if (!isFullRecalc && affectedKeyFigures && !affectedKeyFigures.includes(product.key_figure)) {
          return line;
        }

        const keyFigureValue = calculateKeyFigureValue(product.key_figure, offerData);
        const calculatedQuantity = Math.round(keyFigureValue * (product.key_figure_multiplier || 0));
        if (line.quantity !== calculatedQuantity) {
          return { ...line, quantity: calculatedQuantity };
        }
      }

      return line;
    });

    const updatedForecasts = { ...(offerData.post_calc_forecasts || {}) };
    
    productsList.forEach(product => {
      const setting = categorySettingsList.find(s => s.category === product.category);
      const isPostCalc = setting?.calculation_type === 'post_event';

      if (isPostCalc) {
        if (product.key_figure && product.key_figure !== 'none') {
          // Skip if a specific field changed and it's not in the affectedKeyFigures list
          if (!isFullRecalc && affectedKeyFigures && !Array.isArray(affectedKeyFigures) && !affectedKeyFigures.includes(product.key_figure)) {
            return;
          }

          const keyFigureValue = calculateKeyFigureValue(product.key_figure, offerData);
          const calculatedQuantity = Math.round(keyFigureValue * (product.key_figure_multiplier || 0));
          if (calculatedQuantity > 0) {
            updatedForecasts[product.id] = calculatedQuantity;
          }
        } else if (product.default_quantity && product.default_quantity > 0) {
          if (updatedForecasts[product.id] === undefined) {
            updatedForecasts[product.id] = product.default_quantity;
          }
        }
      }
    });

    return {
      ...offerData,
      offer_lines: updatedLines,
      post_calc_forecasts: updatedForecasts
    };
  }, [calculateKeyFigureValue]);

  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [clientsData, productsData, categorySettingsData] = await Promise.all([
        Client.list(),
        Product.list(),
        ProductCategorySetting.list()
      ]);
      setClients(clientsData || []);
      
      const archivedCategorySet = new Set(
        (categorySettingsData || []).filter(s => s.is_archived).map(s => s.category)
      );

      const activeProducts = (productsData || [])
        .filter(p => p.is_active && !archivedCategorySet.has(p.category));

      setProducts(activeProducts);
      setCategorySettings(categorySettingsData || []);

      let initialOfferData;
      let isNewOffer = false;
      
      if (offerIdFromUrl) {
        const existingOffer = await Offer.get(offerIdFromUrl);
        initialOfferData = { 
          ...existingOffer, 
          post_calc_forecasts: existingOffer.post_calc_forecasts || {},
          staffel: existingOffer.staffel || 1,
          total_visitors_override: existingOffer.total_visitors_override ?? null,
          average_transaction_value: existingOffer.average_transaction_value ?? 13, // Default to 13 if not set
        };
      } else {
        isNewOffer = true;
        initialOfferData = {
          offer_number: `DRAFT-${Math.floor(Date.now() / 1000)}`,
          version: 1,
          status: 'draft',
          total_discount_amount: 0,
          total_discount_percentage: 0,
          post_calc_forecasts: {},
          client_id: '',
          project_name: '',
          staffel: 1,
          total_visitors_override: null,
          average_transaction_value: 13,
        };
      }
      
      // Pass offer ID to ensureAllProductsInLines so it knows if this is an existing offer
      const completeLines = ensureAllProductsInLines(
        initialOfferData.offer_lines || [], 
        activeProducts, 
        categorySettingsData,
        initialOfferData.id || null  // Pass the offer ID
      );
      initialOfferData.offer_lines = completeLines;

      // Only apply cockpit calculations for NEW offers to set initial quantities.
      // For existing offers, trust the saved quantities and don't override them upon initial load.
      // The updateQuantitiesFromCockpit now has an internal safeguard for existing offers on initial load (changedField === null).
      const finalOfferData = updateQuantitiesFromCockpit(initialOfferData, activeProducts, categorySettingsData, null);
      
      setOffer(finalOfferData);

    } catch (error) {
      console.error("Failed to load initial data:", error);
      toast.error(t("Failed to load data."));
    }
    setIsLoading(false);
  }, [offerIdFromUrl, t, ensureAllProductsInLines, updateQuantitiesFromCockpit]);

  useEffect(() => {
    if (authState.authorized) {
      loadInitialData();
    }
  }, [authState.authorized, loadInitialData]);

  useEffect(() => {
    const loadVersions = async () => {
      if (offer?.id) {
        try {
          const versionsList = await base44.entities.OfferVersion.filter({ offer_id: offer.id }, '-version_number');
          setVersions(versionsList);
        } catch (error) {
          console.error('Failed to load versions:', error);
        }
      }
    };
    loadVersions();
  }, [offer?.id]);

  const handleRestoreVersion = (versionData) => {
    setOffer(versionData);
    setShowVersionHistory(false);
    toast.success("Version restored - remember to save if you want to keep these changes");
  };

  // Auto-save function for new offers
  const autoSaveNewOffer = useCallback(async (offerData) => {
    if (hasAutoSaved || offerIdFromUrl) return;
    
    // Don't auto-save if required fields are missing
    if (!offerData.client_id || !offerData.project_name) {
      console.log('Skipping auto-save: missing required fields (client_id or project_name)');
      return;
    }
    
    try {
      const newOffer = await Offer.create({
        ...offerData,
        offer_number: `DRAFT-${Math.floor(Date.now() / 1000)}`,
        status: 'draft',
      });
      
      // Update URL without reloading the page
      const newUrl = createPageUrl(`OfferEditor?id=${newOffer.id}`);
      window.history.replaceState({}, '', newUrl);
      
      setOffer(prev => ({ ...prev, ...newOffer }));
      setHasAutoSaved(true);
      
      // Silent success - no toast to avoid interrupting user
      console.log('Offer auto-saved with ID:', newOffer.id);
    } catch (error) {
        console.error('Auto-save failed:', error);
        // Don't show error toast if you want to indicate auto-save failure to user
    }
  }, [hasAutoSaved, offerIdFromUrl]);

  // Debounced auto-save function for all changes
  const debouncedAutoSave = useMemo(
    () => debounce(async (currentOfferState) => {
      if (!currentOfferState || currentOfferState.status === 'sent' || currentOfferState.status === 'accepted') {
          return;
      }
      
      // Don't auto-save if required fields are missing
      if (!currentOfferState.client_id || !currentOfferState.project_name) {
        console.log('Skipping auto-save: missing required fields');
        return;
      }

      if (!currentOfferState.id) {
        // If no ID yet, it's a truly new offer, attempt initial auto-save
        await autoSaveNewOffer(currentOfferState);
      } else {
        // If ID exists, it's either an existing offer or an auto-saved draft
        try {
          // Prepare payload for update, filter out empty lines for auto-save if desired
          const linesToSave = currentOfferState.offer_lines.filter(line => {
            const product = products.find(p => p.id === line.product_id);
            if (!product) return false;
            
            const setting = categorySettings.find(s => s.category === product.category);
            // Always save post-event lines, but standard lines only if quantity > 0 for auto-save
            if (setting?.calculation_type === 'post_event') {
              return true; 
            }
            return line.quantity > 0;
          });

          await Offer.update(currentOfferState.id, {
            ...currentOfferState,
            offer_lines: linesToSave,
            // Version is not incremented on auto-save
            // Offer number is not changed from DRAFT- to OFF- on auto-save
          });
          // Silent success
          console.log(`Offer ${currentOfferState.id} auto-updated.`);
        } catch (error) {
          console.error('Auto-save update failed:', error);
          // Don't show error toast
        }
      }
    }, 2000), // 2-second debounce delay
    [autoSaveNewOffer, products, categorySettings]
  );

  const saveForecastsOnly = useCallback(async (forecastsToSave) => {
      if (!offer?.id) {
          // Cannot save forecasts independently if the offer is not yet created
          // If it's a new offer, debouncedAutoSave will handle the initial creation
          return;
      }
      try {
          // Send the full current offer state, but the trigger was for forecasts
          // This ensures that when the debounced save fires, it has the latest overall offer state,
          // including any other changes that might have occurred between the forecast change and the save.
          const payload = {
              ...offer, // Ensure all other current offer fields are included
              post_calc_forecasts: forecastsToSave, // Override with the latest forecasts
          };
          await Offer.update(offer.id, payload);
          // No toast message for background save to avoid user distraction
      } catch (error) {
          console.error("Failed to save post-calculation forecasts:", error);
          toast.error(t("Failed to save post-calculation forecasts."));
      }
  }, [offer, t]);

  // Debounced version of saveForecastsOnly, using useMemo to prevent re-creation
  const debouncedSaveForecasts = useMemo(
      () => debounce((forecasts) => saveForecastsOnly(forecasts), 1000), // 1-second debounce delay
      [saveForecastsOnly]
  );
  
  const handleDetailsChange = (field, value) => {
    console.log('🔧 handleDetailsChange called:', field, value);
    
    // Start with the basic update
    let updatedOffer = { ...offer, [field]: value };

    // If showdates are being changed, automatically clean up visitor data
    if (field === 'showdates') {
      const dateStrings = Array.isArray(value) ? value : [];
      const updatedVisitors = { ...(offer.expected_visitors_per_showdate || {}) };
      
      // Remove visitor counts for dates that are no longer selected
      Object.keys(updatedVisitors).forEach(date => {
        if (!dateStrings.includes(date)) {
          delete updatedVisitors[date];
        }
      });
      
      updatedOffer.expected_visitors_per_showdate = updatedVisitors;
      console.log('🗓️ Showdates updated, cleaned visitor data:', updatedVisitors);
    }

    // Check if the change is to a cockpit-related field that should trigger quantity recalculation
    const cockpitFields = ['expected_visitors_per_showdate', 'bar_meters', 'food_sales_positions', 'euro_spend_per_person', 'showdates', 'total_visitors_override', 'average_transaction_value'];
    if (cockpitFields.includes(field)) {
      console.log('📊 Cockpit field changed, recalculating quantities...');
      // Pass the changed field so only affected products are updated
      updatedOffer = updateQuantitiesFromCockpit(updatedOffer, products, categorySettings, field);
      console.log('✅ Updated offer after recalc:', updatedOffer);
    } else if (field === 'post_calc_forecasts') {
      // If post_calc_forecasts is directly changed (e.g., user manual input in DocumentFooter)
      // Trigger the dedicated forecast save, and prevent general auto-save
      debouncedSaveForecasts(value);
    }

    setOffer(updatedOffer);

    // Trigger auto-save for all changes EXCEPT when 'post_calc_forecasts' is manually changed
    if (field !== 'post_calc_forecasts') {
      debouncedAutoSave(updatedOffer);
    }
  };

  const handleLinesChange = (newLines) => {
    const updatedOffer = { ...offer, offer_lines: newLines };
    setOffer(updatedOffer);
    
    // Trigger auto-save for line changes (including description edits)
    debouncedAutoSave(updatedOffer);
  };

  const handleClientCreated = async (clientData) => {
    try {
        const newClient = await Client.create(clientData);
        toast.success(`Client "${newClient.company_name}" created!`);
        
        const updatedClients = await Client.list();
        setClients(updatedClients);
        handleDetailsChange('client_id', newClient.id);
        
        setShowClientModal(false);
    } catch (error) {
        toast.error("Failed to create client.");
        console.error(error);
    }
  };

  const calculateTotals = useCallback(() => {
    setOffer(prev => {
        if (!prev || !Array.isArray(prev.offer_lines) || !products || !categorySettings) {
            return prev;
        }

        const staffel = prev.staffel || 1;

        const subtotal = prev.offer_lines.reduce((acc, line) => {
            const product = products.find(p => p.id === line.product_id);
            const setting = product ? categorySettings.find(s => s.category === product.category) : null;
            if (!product || (setting && setting.calculation_type === 'post_event')) {
                return acc;
            }
            
            // Apply staffel multiplier if product has staffel enabled
            const effectiveQuantity = product.has_staffel ? (line.quantity || 0) * staffel : (line.quantity || 0);
            return acc + (effectiveQuantity * (line.unit_price || 0));
        }, 0);

        // Round subtotal to 2 decimal places
        const roundedSubtotal = Math.round(subtotal * 100) / 100;

        const discountAmount = prev.total_discount_percentage > 0
            ? roundedSubtotal * (prev.total_discount_percentage / 100)
            : (prev.total_discount_amount || 0);
        
        const roundedDiscountAmount = Math.round(discountAmount * 100) / 100;
        const discountedSubtotal = roundedSubtotal - roundedDiscountAmount;
        
        const finalBtwAmount = discountedSubtotal * BTW_RATE;
        const roundedBtwAmount = Math.round(finalBtwAmount * 100) / 100;
        
        const finalTotal = discountedSubtotal + roundedBtwAmount;
        const roundedFinalTotal = Math.round(finalTotal * 100) / 100;

        return {
            ...prev,
            subtotal_excl_btw: roundedSubtotal,
            btw_amount: roundedBtwAmount,
            total_incl_btw: roundedFinalTotal,
        };
    });
  }, [products, categorySettings]);

  useEffect(() => {
    calculateTotals();
  }, [calculateTotals, offer?.offer_lines, offer?.total_discount_amount, offer?.total_discount_percentage, offer?.staffel]);

  const handleDuplicate = async () => {
    if (!offer.client_id || !offer.project_name) {
      toast.error(t("Please select a client and enter a project name."));
      return;
    }

    setIsSaving(true);

    try {
      // Save current offer first if it has unsaved changes
      if (offer.id) {
        const linesToSave = offer.offer_lines.filter(line => {
          const product = products.find(p => p.id === line.product_id);
          if (!product) return false;

          const setting = categorySettings.find(s => s.category === product.category);
          if (setting?.calculation_type === 'post_event') {
            return true; 
          }

          return line.quantity > 0;
        });

        await Offer.update(offer.id, { 
          ...offer, 
          offer_lines: linesToSave,
          post_calc_forecasts: offer.post_calc_forecasts || {},
        });
      }

      // Create duplicate
      const duplicatePayload = {
        ...offer,
        offer_number: `DRAFT-${Math.floor(Date.now() / 1000)}`,
        status: 'draft',
        version: 1,
        signed_date: null,
        signed_by_name: null,
        signature_data_url: null,
        view_history: [],
        last_client_view: null,
      };

      delete duplicatePayload.id;
      delete duplicatePayload.created_date;
      delete duplicatePayload.updated_date;
      delete duplicatePayload.created_by;

      const newOffer = await Offer.create(duplicatePayload);

      // Open in new tab
      window.open(createPageUrl(`OfferEditor?id=${newOffer.id}`), '_blank');

      toast.success(t("Offer duplicated!"));
    } catch (error) {
      toast.error(t("Failed to duplicate offer."));
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async (newStatus) => {
    if (!offer.client_id || !offer.project_name) {
      toast.error(t("Please select a client and enter a project name."));
      return;
    }

    setIsSaving(true);
    
    const linesToSave = offer.offer_lines.filter(line => {
      const product = products.find(p => p.id === line.product_id);
      if (!product) return false;
      
      const setting = categorySettings.find(s => s.category === product.category);
      if (setting?.calculation_type === 'post_event') {
        return true; 
      }
      
      return line.quantity > 0;
    });
    
    const currentVersion = offer.version || 1.0;
    let newVersion = currentVersion;
    
    // Only increment version for explicit saves (not auto-saves)
    // If the offer has an ID, it means it's either an existing offer or an auto-saved draft.
    // In either case, an explicit user save action should increment the version.
    if (offer.id) { // Always increment if offer exists, it's an explicit save
      newVersion = parseFloat((currentVersion + 0.1).toFixed(1));
    }
    // If offer.id does not exist, it means this is the very first explicit explicit save before any auto-save kicked in,
    // or if auto-save failed. In this rare case, version remains 1.0 for creation.
    
    const payload = { 
      ...offer, 
      offer_lines: linesToSave,
      version: newVersion,
      post_calc_forecasts: offer.post_calc_forecasts || {},
      // Update offer number if it was a draft number upon explicit save
      offer_number: offer.offer_number?.startsWith('DRAFT-') 
        ? `OFF-${Math.floor(Date.now() / 1000)}` 
        : offer.offer_number
    };

    if (newStatus) {
        payload.status = newStatus;
    }
    
    try {
        let savedOffer;
        if(offer.id){
            // Save version history before updating
            try {
              await base44.entities.OfferVersion.create({
                offer_id: offer.id,
                version_number: currentVersion,
                offer_data: offer,
                saved_by: authState.user?.email || 'unknown'
              });
            } catch (versionError) {
              console.error('Failed to save version history:', versionError);
            }
            
            savedOffer = await Offer.update(offer.id, payload);
            toast.success(`${t('Offer')} ${newStatus === 'sent' ? t('sent!') : t('saved!')}`);
            
            // Reload versions after save
            try {
              const versionsList = await base44.entities.OfferVersion.filter({ offer_id: offer.id }, '-version_number');
              setVersions(versionsList);
            } catch (error) {
              console.error('Failed to reload versions:', error);
            }
            
            // Update project hardware summary AND showdates if project exists
            try {
              const projects = await Project.filter({ offer_id: offer.id });
              if (projects && projects.length > 0) {
                const project = projects[0]; // Assuming one project per offer for now
                
                // Recalculate hardware summary based on updated offer lines
                const hardwareSummary = {};
                linesToSave.forEach(line => {
                  const product = products.find(p => p.id === line.product_id);
                  if (product && product.hardware_group && product.hardware_group !== 'none') {
                    if (!hardwareSummary[product.hardware_group]) {
                      hardwareSummary[product.hardware_group] = 0;
                    }
                    hardwareSummary[product.hardware_group] += line.quantity || 0;
                  }
                });
                
                // Update project with new hardware summary AND showdates from offer
                await Project.update(project.id, { 
                  hardware_summary: hardwareSummary,
                  showdates: offer.showdates || [] // Sync showdates from offer to project
                });
                console.log('Project updated with hardware summary and showdates');
              }
            } catch (projectError) {
              console.error('Failed to update project:', projectError);
              // Don't show error to user, as offer was saved successfully
            }
        } else {
            savedOffer = await Offer.create(payload);
            toast.success(`${t('Offer')} created successfully!`);
            // Update URL without page reload if this was the initial save
            const newUrl = createPageUrl(`OfferEditor?id=${savedOffer.id}`);
            window.history.replaceState({}, '', newUrl);
        }
        
        // Ensure client_id and project_name persistence by explicitly taking them from the payload
        // that was just successfully sent to the backend, in case the API response 'savedOffer'
        // is missing them or is not fully comprehensive.
        const completeLines = ensureAllProductsInLines(savedOffer.offer_lines || [], products || [], categorySettings || [], savedOffer.id || null);
        setOffer(prev => ({
          ...savedOffer,
          client_id: payload.client_id, 
          project_name: payload.project_name,
          offer_lines: completeLines,
          post_calc_forecasts: savedOffer.post_calc_forecasts || prev.post_calc_forecasts || {}, 
        }));
    } catch(err) {
        toast.error(t("Failed to save offer."));
        console.error(err);
    } finally {
        setIsSaving(false);
    }
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const newOfferLines = Array.from(offer.offer_lines);
    const [reorderedItem] = newOfferLines.splice(result.source.index, 1);
    newOfferLines.splice(result.destination.index, 0, reorderedItem);

    handleLinesChange(newOfferLines);
  };
  
  if (authState.checking) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-600">
            {t('Loading...')}
        </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} error={authState.error} />;
  }

  if (isLoading || !offer) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-600">
            {t('Loading Offer Editor...')}
        </div>
    );
  }

  const sections = groupLinesBySection(offer.offer_lines, products, categorySettings);
  
  // Check if editor should be locked (client and project name required)
  const isEditorLocked = !offer.client_id || !offer.project_name || (!offer.id && !hasAutoSaved);

  return (
    <div className="min-h-screen bg-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <Toaster />
      {showClientModal && (
        <ClientForm 
            onSubmit={handleClientCreated}
            onCancel={() => setShowClientModal(false)}
        />
      )}
      {showVersionHistory && (
        <VersionHistory
          versions={versions}
          currentVersion={offer?.version || 1}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersionHistory(false)}
        />
      )}
      <div className="max-w-full mx-auto space-y-4">
        {/* Sticky header section with buttons and cockpit */}
        <div className="sticky top-0 z-40 bg-gray-100 pb-4 space-y-4">
          <div className="flex justify-between items-center pt-4">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => navigate(createPageUrl('Offers'))} className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" /> {t('Back to')} {t('Offers')}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                  <Button 
                      asChild 
                      variant="outline" 
                      size="sm" 
                      className="gap-2"
                      disabled={!offer?.id || isEditorLocked}
                  >
                      <a href={offer?.id && !isEditorLocked ? createPageUrl(`OfferReview?id=${offer.id}`) : '#'} target="_blank" rel="noopener noreferrer">
                          <Eye className="w-4 h-4"/> {t('Preview')}
                      </a>
                  </Button>
                  <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                          if (offer?.id && !isEditorLocked) {
                              const link = `${window.location.origin}${createPageUrl(`OfferReview?id=${offer.id}`)}`;
                              navigator.clipboard.writeText(link);
                              toast.success(t('Link copied to clipboard!'));
                          }
                      }}
                      disabled={!offer?.id || isEditorLocked}
                      className="gap-2"
                  >
                      <Link2 className="w-4 h-4"/>
                  </Button>
                  <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2" 
                      onClick={handleDuplicate} 
                      disabled={isSaving || isEditorLocked}
                  >
                      <Copy className="w-4 h-4"/> {t('Duplicate')}
                  </Button>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handleSave('draft')} disabled={isSaving || isEditorLocked}>
                      <Save className="w-4 h-4"/> {isSaving ? t('Saving...') : t('Save Draft')}
                  </Button>
              </div>
          </div>

          {!offerIdFromUrl && !hasAutoSaved && offer && (
            <div className="text-sm text-gray-500 text-center py-2">
              {t('Your work will be automatically saved as you type')}
            </div>
          )}

          <EventCockpit 
            offer={offer}
            products={products}
            categorySettings={categorySettings}
            clients={clients} // Passed clients to EventCockpit
            onDetailsChange={handleDetailsChange}
            onAddNewClient={() => setShowClientModal(true)}
            versions={versions}
            onShowVersionHistory={() => setShowVersionHistory(true)}
          />
        </div>
        
        <div className="flex justify-center relative">
          {isEditorLocked && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-50 z-30 flex items-center justify-center rounded-lg">
              <div className="bg-white rounded-lg p-6 shadow-xl max-w-md text-center">
                <Building2 className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {t('Client and Project Required')}
                </h3>
                <p className="text-sm text-gray-600">
                  {t('Please select a client and enter a project name in the Event Cockpit above to start editing the offer.')}
                </p>
              </div>
            </div>
          )}
          <div className={`relative ${isEditorLocked ? 'pointer-events-none opacity-50' : ''}`} style={{ width: '210mm' }}>
            <DragDropContext onDragEnd={onDragEnd}>
              <main id="a4-container" className="bg-white rounded-lg shadow-2xl p-12 overflow-visible">
                <DocumentHeader 
                  offer={offer}
                  clients={clients}
                  isReview={false} // Editor mode, client/project handled by Cockpit
                />
                
                <div className="space-y-4 mt-8">
                  <h2 className="font-bold text-xl text-gray-800 border-b-2 border-gray-200 pb-2">{t('Project Offer')}</h2>
                  <div className="space-y-8">
                    {sections.map((section, index) => {
                      const setting = categorySettings.find(s => s.category === section.title);
                      const isStandardSection = !setting || setting.calculation_type !== 'post_event';
                      
                      return (
                        <DocumentSection
                          key={section.title}
                          index={index}
                          section={section}
                          products={products || []}
                          offerLines={Array.isArray(offer.offer_lines) ? offer.offer_lines : []}
                          onLinesChange={handleLinesChange}
                          isStandardSection={isStandardSection}
                          staffel={offer.staffel || 1}
                        />
                      );
                    })}
                  </div>
                </div>
                
                <DocumentFooter
                  offer={offer}
                  products={products || []}
                  categorySettings={categorySettings || []}
                  onDetailsChange={handleDetailsChange}
                  onLinesChange={handleLinesChange}
                />
              </main>
            </DragDropContext>
          </div>
        </div>
      </div>
    </div>
  );
}