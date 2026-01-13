
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Client, Offer, Product, ProductCategorySetting } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarIcon, Plus, EyeOff, Edit, Loader2, Tags, X, Check } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import ClientForm from "../components/clients/ClientForm";

// Generate consistent colors for tags (same as OfferList)
const getTagColor = (tag) => {
  const colors = [
    "bg-blue-100 text-blue-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-orange-100 text-orange-800",
    "bg-green-100 text-green-800",
    "bg-teal-100 text-teal-800",
    "bg-indigo-100 text-indigo-800",
    "bg-rose-100 text-rose-800",
    "bg-cyan-100 text-cyan-800",
    "bg-amber-100 text-amber-800"
  ];
  
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

export default function BatchOfferCreator() {
  const { t } = useLocalization();
  const navigate = useNavigate();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingRows, setSavingRows] = useState(new Set());
  const [showClientForm, setShowClientForm] = useState(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState({});
  const [tagInputValue, setTagInputValue] = useState({});
  
  // Debounce timers for each row
  const [autoSaveTimers, setAutoSaveTimers] = useState({});

  // Get all unique tags from all rows
  const allTags = React.useMemo(() => {
    const tagSet = new Set();
    rows.forEach(row => {
      (row.tags || []).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [rows]);

  // Sort clients alphabetically by company name
  const sortedClients = React.useMemo(() => {
    return [...clients].sort((a, b) => 
      (a.company_name || '').localeCompare(b.company_name || '')
    );
  }, [clients]);

  // EXACT COPY from OfferEditor: Ensure all active products are in offer lines
  const ensureAllProductsInLines = useCallback((existingLines = [], allProducts = [], categorySettingsList = []) => {
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
          // For multi-offer (NEW offers): use product default_quantity
          // Post-calc products always have 0 in lines
          const defaultQuantity = isPostCalc ? 0 : (product.default_quantity || 0);
          
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

  // Helper function to calculate key figure value
  const calculateKeyFigureValue = useCallback((keyFigure, offerData) => {
    if (!keyFigure || keyFigure === 'none' || !offerData) return 0;

    const visitorsPerShowdate = offerData.expected_visitors_per_showdate || {};
    const totalVisitorsFromShowdates = Object.values(visitorsPerShowdate).reduce((sum, val) => sum + (val || 0), 0);

    switch (keyFigure) {
      case 'total_visitors':
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

  // EXACT COPY from OfferEditor: Calculate quantities based on cockpit data
  const updateQuantitiesFromCockpit = useCallback((offerData, productsList, categorySettingsList) => {
    if (!offerData || !productsList || !categorySettingsList) return offerData;

    console.log('🔄 Multi-offer updateQuantitiesFromCockpit called');

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
      if (!product) return line;

      const setting = categorySettingsList.find(s => s.category === product.category);
      const isPostCalc = setting?.calculation_type === 'post_event';

      // Post-calc products should always have quantity 0 in the line
      if (isPostCalc) {
        return { ...line, quantity: 0 };
      }

      // IMPORTANT: Only recalculate if product has a key figure set
      // Products without key figures keep their default_quantity
      if (!product.key_figure || product.key_figure === 'none') {
        return line; // Keep existing quantity (default_quantity)
      }

      const isTicketingProduct = product.category === 'ticketing_ecommerce_fees';
      const isTransactionProduct = product.category === 'transaction_processing';

      if (isTicketingProduct) {
        // ALWAYS respect the total_visitors_override state
        if (offerData.total_visitors_override === null || offerData.total_visitors_override <= 0) {
          return { ...line, quantity: 0 };
        }
        
        if (product.key_figure === 'total_visitors') {
          const calculatedQuantity = Math.round(ticketingVisitors * (product.key_figure_multiplier || 0));
          return { ...line, quantity: calculatedQuantity };
        }
        return line;
      }

      if (isTransactionProduct) {
        if (product.key_figure && product.key_figure !== 'none') {
          let keyFigureValue = 0;
          switch (product.key_figure) {
            case 'total_visitors':
              keyFigureValue = transactionProcessingVisitors;
              break;
            case 'expected_revenue':
              keyFigureValue = transactionProcessingRevenue;
              break;
            default:
              keyFigureValue = calculateKeyFigureValue(product.key_figure, offerData);
              break;
          }
          
          const calculatedQuantity = Math.round(keyFigureValue * (product.key_figure_multiplier || 0));
          return { ...line, quantity: calculatedQuantity };
        }
        return line;
      }

      // For other standard products with key figures
      if (product.key_figure && product.key_figure !== 'none') {
        const keyFigureValue = calculateKeyFigureValue(product.key_figure, offerData);
        const calculatedQuantity = Math.round(keyFigureValue * (product.key_figure_multiplier || 0));
        return { ...line, quantity: calculatedQuantity };
      }

      return line;
    });

    // Calculate post-calc forecasts
    const updatedForecasts = { ...(offerData.post_calc_forecasts || {}) };
    
    productsList.forEach(product => {
      const setting = categorySettingsList.find(s => s.category === product.category);
      const isPostCalc = setting?.calculation_type === 'post_event';

      if (isPostCalc) {
        if (product.key_figure && product.key_figure !== 'none') {
          const keyFigureValue = calculateKeyFigureValue(product.key_figure, offerData);
          const calculatedQuantity = Math.round(keyFigureValue * (product.key_figure_multiplier || 0));
          if (calculatedQuantity > 0) {
            updatedForecasts[product.id] = calculatedQuantity;
          }
        } else if (product.default_quantity && product.default_quantity > 0) {
          // For post-calc products WITHOUT key_figure, use default_quantity if not already set
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
      loadInitialData();
    }
  }, [authState.authorized]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load all necessary data at startup
      const [clientsData, productsData, categorySettingsData] = await Promise.all([
        Client.list(),
        Product.list(),
        ProductCategorySetting.list()
      ]);
      
      setClients(clientsData || []);
      
      // EXACT COPY from OfferEditor: Filter active products and non-archived categories
      const archivedCategorySet = new Set(
        (categorySettingsData || []).filter(s => s.is_archived).map(s => s.category)
      );
      const activeProducts = (productsData || [])
        .filter(p => p.is_active && !archivedCategorySet.has(p.category));
      
      setProducts(activeProducts);
      setCategorySettings(categorySettingsData || []);
      
      // Initialize 25 empty rows
      const initialRows = Array.from({ length: 25 }, (_, i) => ({
        id: `temp-${i}`,
        client_id: '',
        project_name: '',
        project_location: '',
        showdates: [],
        expected_visitors_per_showdate: {},
        bar_meters: 0,
        food_sales_positions: 0,
        euro_spend_per_person: 0,
        staffel: 1,
        total_visitors_override: null,
        average_transaction_value: 13,
        tags: [],
        isTemp: true,
        isHidden: false,
        isSaving: false,
      }));
      
      setRows(initialRows);
    } catch (error) {
      console.error("Failed to load data:", error);
      toast.error(t("Failed to load data."));
    }
    setIsLoading(false);
  };

  const autoSaveRow = useCallback(async (rowIndex, rowData) => {
    // Only save if client_id and project_name are filled
    if (!rowData.client_id || !rowData.project_name) {
      return;
    }

    // Don't save if already saving
    if (savingRows.has(rowIndex)) {
      return;
    }

    console.log('💾 Auto-saving row', rowIndex, 'isTemp:', rowData.isTemp);

    setSavingRows(prev => new Set(prev).add(rowIndex));

    try {
      let savedOffer;
      
      // Prepare offer lines with calculated quantities
      let offerLines = [];
      let postCalcForecasts = {};
      
      if (products.length > 0 && categorySettings.length > 0) {
        // Step 1: Ensure all products are in lines with default quantities
        offerLines = ensureAllProductsInLines(
          rowData.offer_lines || [], 
          products, 
          categorySettings
        );
        
        console.log('📝 Lines after ensureAllProducts (first 3):', offerLines.slice(0, 3));
        
        // Step 2: Create temporary offer data for calculation
        const tempOfferData = {
          ...rowData,
          offer_lines: offerLines,
          post_calc_forecasts: rowData.post_calc_forecasts || {}
        };
        
        // Step 3: Calculate quantities based on cockpit data
        const updatedOfferData = updateQuantitiesFromCockpit(tempOfferData, products, categorySettings);
        offerLines = updatedOfferData.offer_lines;
        postCalcForecasts = updatedOfferData.post_calc_forecasts;
        
        console.log('🔢 Lines after updateQuantities (first 3):', offerLines.slice(0, 3));
        console.log('📊 Post-calc forecasts:', Object.keys(postCalcForecasts).length, 'products');
      }
      
      const payload = {
        client_id: rowData.client_id,
        project_name: rowData.project_name,
        project_location: rowData.project_location || '',
        showdates: rowData.showdates || [],
        expected_visitors_per_showdate: rowData.expected_visitors_per_showdate || {},
        bar_meters: rowData.bar_meters || 0,
        food_sales_positions: rowData.food_sales_positions || 0,
        euro_spend_per_person: rowData.euro_spend_per_person || 0,
        staffel: rowData.staffel || 1,
        total_visitors_override: rowData.total_visitors_override,
        average_transaction_value: rowData.average_transaction_value || 13,
        tags: rowData.tags || [],
        status: 'draft',
        offer_lines: offerLines,
        post_calc_forecasts: postCalcForecasts,
        version: rowData.version || 1,
      };

      if (rowData.isTemp) {
        // Create new offer
        payload.offer_number = `DRAFT-${Math.floor(Date.now() / 1000)}-${rowIndex}`;
        savedOffer = await Offer.create(payload);
        console.log('✅ Created new offer:', savedOffer.id);
        
        // Update row with saved offer ID
        setRows(prev => {
          const updated = [...prev];
          updated[rowIndex] = {
            ...updated[rowIndex],
            ...savedOffer,
            isTemp: false,
          };
          return updated;
        });
      } else {
        // Update existing offer
        savedOffer = await Offer.update(rowData.id, payload);
        console.log('✅ Updated existing offer:', savedOffer.id);
        
        setRows(prev => {
          const updated = [...prev];
          updated[rowIndex] = {
            ...updated[rowIndex],
            ...savedOffer,
          };
          return updated;
        });
      }
    } catch (error) {
      console.error("Auto-save failed for row", rowIndex, error);
      toast.error(`Row ${rowIndex + 1}: ${error.message || 'Save failed'}`);
    } finally {
      setSavingRows(prev => {
        const updated = new Set(prev);
        updated.delete(rowIndex);
        return updated;
      });
    }
  }, [savingRows, products, categorySettings, ensureAllProductsInLines, updateQuantitiesFromCockpit]);

  const handleFieldChange = (rowIndex, field, value) => {
    // Update the row immediately for responsive UI
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        [field]: value,
      };
      return updated;
    });
    
    // Clear existing timer for this row
    if (autoSaveTimers[rowIndex]) {
      clearTimeout(autoSaveTimers[rowIndex]);
    }
    
    // Set new timer with 2 second delay
    const newTimer = setTimeout(() => {
      setRows(currentRows => {
        autoSaveRow(rowIndex, currentRows[rowIndex]);
        return currentRows;
      });
    }, 2000);
    
    setAutoSaveTimers(prev => ({
      ...prev,
      [rowIndex]: newTimer
    }));
  };

  const handleShowdatesChange = (rowIndex, dates) => {
    const dateStrings = dates ? dates.map(date => format(date, 'yyyy-MM-dd')) : [];
    handleFieldChange(rowIndex, 'showdates', dateStrings);
  };

  const handleVisitorChange = (rowIndex, date, value) => {
    const numValue = parseInt(value, 10) || 0;
    
    // Update the row immediately
    setRows(prev => {
      const updated = [...prev];
      const currentVisitors = updated[rowIndex].expected_visitors_per_showdate || {};
      updated[rowIndex] = {
        ...updated[rowIndex],
        expected_visitors_per_showdate: {
          ...currentVisitors,
          [date]: numValue,
        },
      };
      return updated;
    });
    
    // Clear existing timer for this row
    if (autoSaveTimers[rowIndex]) {
      clearTimeout(autoSaveTimers[rowIndex]);
    }
    
    // Set new timer
    const newTimer = setTimeout(() => {
      setRows(currentRows => {
        autoSaveRow(rowIndex, currentRows[rowIndex]);
        return currentRows;
      });
    }, 2000);
    
    setAutoSaveTimers(prev => ({
      ...prev,
      [rowIndex]: newTimer
    }));
  };

  const handleAddTag = (rowIndex, newTag) => {
    if (!newTag || !newTag.trim()) return;
    
    const trimmedTag = newTag.trim();
    const row = rows[rowIndex];
    const currentTags = row.tags || [];
    
    if (currentTags.includes(trimmedTag)) {
      toast.error("Tag already exists");
      return;
    }
    
    const updatedTags = [...currentTags, trimmedTag];
    
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        tags: updatedTags,
      };
      
      // Trigger auto-save with delay
      if (autoSaveTimers[rowIndex]) {
        clearTimeout(autoSaveTimers[rowIndex]);
      }
      
      const newTimer = setTimeout(() => {
        autoSaveRow(rowIndex, updated[rowIndex]);
      }, 2000);
      
      setAutoSaveTimers(prevTimers => ({
        ...prevTimers,
        [rowIndex]: newTimer
      }));
      
      return updated;
    });
    
    setTagInputValue(prev => ({ ...prev, [rowIndex]: '' }));
    setTagPopoverOpen(prev => ({ ...prev, [rowIndex]: false }));
  };

  const handleRemoveTag = (rowIndex, tagToRemove) => {
    const row = rows[rowIndex];
    const currentTags = row.tags || [];
    const updatedTags = currentTags.filter(tag => tag !== tagToRemove);
    
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        tags: updatedTags,
      };
      
      // Trigger auto-save with delay
      if (autoSaveTimers[rowIndex]) {
        clearTimeout(autoSaveTimers[rowIndex]);
      }
      
      const newTimer = setTimeout(() => {
        autoSaveRow(rowIndex, updated[rowIndex]);
      }, 2000);
      
      setAutoSaveTimers(prevTimers => ({
        ...prevTimers,
        [rowIndex]: newTimer
      }));
      
      return updated;
    });
  };

  const handleHideRow = (rowIndex) => {
    setRows(prev => {
      const updated = [...prev];
      updated[rowIndex] = {
        ...updated[rowIndex],
        isHidden: true,
      };
      return updated;
    });
  };

  const handleAddRows = (count = 5) => {
    setRows(prev => {
      const newRows = Array.from({ length: count }, (_, i) => ({
        id: `temp-${Date.now()}-${i}`,
        client_id: '',
        project_name: '',
        project_location: '',
        showdates: [],
        expected_visitors_per_showdate: {},
        bar_meters: 0,
        food_sales_positions: 0,
        euro_spend_per_person: 0,
        staffel: 1,
        total_visitors_override: null,
        average_transaction_value: 13,
        tags: [],
        isTemp: true,
        isHidden: false,
      }));
      return [...prev, ...newRows];
    });
  };

  const handleOpenInEditor = (row) => {
    if (!row.isTemp && row.id) {
      navigate(createPageUrl(`OfferEditor?id=${row.id}`));
    }
  };

  const handleClientSubmit = async (clientData) => {
    try {
      const newClient = await Client.create(clientData);
      setClients(prev => [...prev, newClient]);
      setShowClientForm(false);
      toast.success(t("Client created successfully!"));
    } catch (error) {
      console.error("Failed to create client:", error);
      toast.error(t("Failed to create client."));
    }
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(autoSaveTimers).forEach(timer => clearTimeout(timer));
    };
  }, [autoSaveTimers]);

  if (authState.checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <p className="text-gray-700 text-lg">{t('Loading...')}</p>
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <p className="text-gray-700 text-lg">{t('Loading...')}</p>
      </div>
    );
  }

  const visibleRows = rows.filter(r => !r.isHidden);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-[98%] mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Multi-offerte Tool</h1>
            <p className="text-gray-600 mt-2">Maak snel meerdere offertes aan in één keer</p>
            <p className="text-sm text-gray-500 mt-1">💡 Auto-save gebeurt 2 seconden na het typen</p>
            <p className="text-xs text-blue-600 mt-1">🔢 Quantities: default values + auto-calculation from cockpit data</p>
          </div>
          <Button 
            onClick={() => handleAddRows(5)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add 5 Rows
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead className="min-w-[200px]">Client *</TableHead>
                <TableHead className="min-w-[200px]">Project Name *</TableHead>
                <TableHead className="min-w-[150px]">Location</TableHead>
                <TableHead className="min-w-[200px]">Showdates</TableHead>
                <TableHead className="min-w-[200px]">Visitors per Date</TableHead>
                <TableHead className="min-w-[120px]">Bar Meters</TableHead>
                <TableHead className="min-w-[120px]">Food Sales</TableHead>
                <TableHead className="min-w-[120px]">€/Person</TableHead>
                <TableHead className="min-w-[100px]">Staffel</TableHead>
                <TableHead className="min-w-[120px]">Total Visitors</TableHead>
                <TableHead className="min-w-[200px]">Tags</TableHead>
                <TableHead className="w-[100px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, index) => {
                const selectedDates = row.showdates?.map(d => new Date(d)) || [];
                const totalVisitors = Object.values(row.expected_visitors_per_showdate || {}).reduce((sum, v) => sum + v, 0);
                const isSaving = savingRows.has(index);
                const rowTags = row.tags || [];
                
                // Disable cockpit fields until offer is created (client + project name filled and not temp)
                const isCockpitDisabled = !row.client_id || !row.project_name || row.isTemp;

                return (
                  <TableRow key={row.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-600">
                      {index + 1}
                      {isSaving && <Loader2 className="w-3 h-3 animate-spin inline ml-1" />}
                    </TableCell>
                    
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={row.client_id || ""}
                          onValueChange={(val) => handleFieldChange(index, 'client_id', val)}
                        >
                          <SelectTrigger className="h-9 text-sm flex-1">
                            <SelectValue placeholder="Select..." />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedClients.map(c => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.company_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setShowClientForm(true)}
                          className="h-9 w-9 flex-shrink-0"
                          title={t('Add Client')}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Input
                        value={row.project_name || ''}
                        onChange={(e) => handleFieldChange(index, 'project_name', e.target.value)}
                        placeholder="Enter name..."
                        className="h-9 text-sm"
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        value={row.project_location || ''}
                        onChange={(e) => handleFieldChange(index, 'project_location', e.target.value)}
                        placeholder="Location..."
                        className="h-9 text-sm"
                        disabled={isCockpitDisabled}
                      />
                    </TableCell>

                    <TableCell>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button 
                            variant="outline" 
                            className="h-9 text-sm justify-start"
                            disabled={isCockpitDisabled}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedDates.length > 0 ? `${selectedDates.length} dates` : 'Select...'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="multiple"
                            selected={selectedDates}
                            onSelect={(dates) => handleShowdatesChange(index, dates)}
                          />
                        </PopoverContent>
                      </Popover>
                    </TableCell>

                    <TableCell>
                      {row.showdates?.length > 0 ? (
                        <div className="space-y-1">
                          {row.showdates.map(date => (
                            <div key={date} className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 w-20">
                                {format(new Date(date), 'dd-MM')}
                              </span>
                              <Input
                                type="number"
                                value={row.expected_visitors_per_showdate?.[date] || ''}
                                onChange={(e) => handleVisitorChange(index, date, e.target.value)}
                                placeholder="0"
                                className="h-7 text-sm w-20"
                                min="0"
                                disabled={isCockpitDisabled}
                              />
                            </div>
                          ))}
                          <div className="text-xs font-semibold text-gray-700 pt-1 border-t">
                            Total: {totalVisitors.toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Select dates first</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        value={row.bar_meters || ''}
                        onChange={(e) => handleFieldChange(index, 'bar_meters', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-9 text-sm w-24"
                        min="0"
                        disabled={isCockpitDisabled}
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        value={row.food_sales_positions || ''}
                        onChange={(e) => handleFieldChange(index, 'food_sales_positions', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-9 text-sm w-24"
                        min="0"
                        disabled={isCockpitDisabled}
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        value={row.euro_spend_per_person || ''}
                        onChange={(e) => handleFieldChange(index, 'euro_spend_per_person', parseFloat(e.target.value) || 0)}
                        placeholder="0.00"
                        className="h-9 text-sm w-24"
                        min="0"
                        step="0.01"
                        disabled={isCockpitDisabled}
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        value={row.staffel || 1}
                        onChange={(e) => handleFieldChange(index, 'staffel', parseFloat(e.target.value) || 1)}
                        placeholder="1.00"
                        className="h-9 text-sm w-20"
                        min="0"
                        step="0.01"
                        disabled={isCockpitDisabled}
                      />
                    </TableCell>

                    <TableCell>
                      <Input
                        type="number"
                        value={row.total_visitors_override !== null && row.total_visitors_override !== undefined ? row.total_visitors_override : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : parseFloat(e.target.value);
                          handleFieldChange(index, 'total_visitors_override', val);
                        }}
                        placeholder={totalVisitors.toString()}
                        className="h-9 text-sm w-24"
                        min="0"
                        disabled={isCockpitDisabled}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1 items-center">
                        {rowTags.map(tag => (
                          <Badge 
                            key={tag} 
                            className={`${getTagColor(tag)} text-xs gap-1 pr-1 border border-transparent`}
                            variant="outline"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(index, tag)}
                              className="hover:bg-black/10 rounded-full p-0.5"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        <Popover 
                          open={tagPopoverOpen[index]} 
                          onOpenChange={(open) => setTagPopoverOpen({ ...tagPopoverOpen, [index]: open })}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 w-6 p-0 hover:bg-blue-50"
                            >
                              <Tags className="w-3 h-3 text-gray-400" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3" align="start">
                            <div className="space-y-2">
                              <div className="text-sm font-semibold mb-2">Add Tag</div>
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Enter tag name..."
                                  value={tagInputValue[index] || ''}
                                  onChange={(e) => setTagInputValue({ ...tagInputValue, [index]: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleAddTag(index, tagInputValue[index]);
                                    }
                                  }}
                                  className="h-8 text-sm"
                                />
                                <Button 
                                  size="sm" 
                                  onClick={() => handleAddTag(index, tagInputValue[index])}
                                  className="h-8 px-2"
                                >
                                  <Check className="w-4 h-4" />
                                </Button>
                              </div>
                              
                              {allTags.length > 0 && (
                                <>
                                  <div className="text-xs text-gray-500 mt-3 mb-1">Existing tags:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {allTags
                                      .filter(tag => !rowTags.includes(tag))
                                      .map(tag => (
                                        <Badge
                                          key={tag}
                                          className={`${getTagColor(tag)} text-xs cursor-pointer hover:opacity-80 border border-transparent`}
                                          variant="outline"
                                          onClick={() => handleAddTag(index, tag)}
                                        >
                                          {tag}
                                        </Badge>
                                      ))}
                                  </div>
                                </>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenInEditor(row)}
                          disabled={row.isTemp}
                          className="h-8 w-8"
                          title="Open in editor"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleHideRow(index)}
                          className="h-8 w-8"
                          title="Hide row"
                        >
                          <EyeOff className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="text-center">
          <Button 
            onClick={() => handleAddRows(10)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add 10 More Rows
          </Button>
        </div>
      </div>

      {showClientForm && (
        <ClientForm
          client={null}
          onSubmit={handleClientSubmit}
          onCancel={() => setShowClientForm(false)}
        />
      )}
    </div>
  );
}
