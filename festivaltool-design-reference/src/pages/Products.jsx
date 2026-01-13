
import React, { useState, useEffect, useCallback } from "react";
import { Product, ProductCategorySetting } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Package } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization"; // Updated import path
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

import ProductTable from "../components/products/ProductTable";

export default function ProductsPage() {
  const { t } = useLocalization();
  // Updated state for authentication
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Use the new checkUserAuthorization utility
      const { isAuthorized, user, error } = await checkUserAuthorization();
      
      if (error === 'not_authenticated') {
        // Redirect to login page if not authenticated
        window.location.href = '/login';
        return;
      }
      
      // Update authState with the result
      setAuthState({ checking: false, authorized: isAuthorized, user });
    };
    checkAuth();
  }, []);

  const seedInitialData = async (existingProducts) => {
    const paymentMethodCategory = 'ticketing_ecommerce_fees';
    const transactionProcessingCategory = 'transaction_processing';
    const visitorFeesCategory = 'visitor_fees';
    const discountsCategory = 'discounts';
    
    const newTicketingProducts = [
        { name: "Fee per betaald ticket", category: "ticketing_ecommerce_fees", default_price: 0.35, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 0 },
        { name: "Fee per ander product", category: "ticketing_ecommerce_fees", default_price: 0.09, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 1 },
        { name: "Fee per gratis product", category: "ticketing_ecommerce_fees", default_price: 0.00, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 2 },
        { name: "Fee per zakelijke aankoop", category: "ticketing_ecommerce_fees", default_price: 2.49, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 3 },
        { name: "Fee per ticket van organisator op tweedehands platform", category: "ticketing_ecommerce_fees", default_price: 0.49, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 4 },
        { name: "Refund per ticket", category: "ticketing_ecommerce_fees", default_price: 0.99, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 5 },
        { name: "Refund kosten bulk (>500)", category: "ticketing_ecommerce_fees", default_price: 0.49, unit_type: "piece", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 6 },
        { name: "Scan device", category: "ticketing_ecommerce_fees", default_price: 9.99, unit_type: "piece", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 7 },
        { name: "Entreemanager", category: "ticketing_ecommerce_fees", default_price: 45.00, unit_type: "piece", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 8 },
        { name: "Verzendkosten scanners", category: "ticketing_ecommerce_fees", default_price: 49.00, unit_type: "piece", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 9 }
    ];
    const newTicketingProductsExist = existingProducts.some(p => p.name === "Fee per betaald ticket" && p.category === paymentMethodCategory);

    const paymentMethodsToAdd = [
        { name: "iDEAL", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.09, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 10 },
        { name: "Bancontact Online", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.15, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 11 },
        { name: "Visa / Mastercard Consumer EU", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.10, percentage_fee: 0, percentage_cost_basis: 1.20, is_active: true, display_order: 12 },
        { name: "Visa / Mastercard Non EU – Business", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.10, percentage_fee: 0, percentage_cost_basis: 2.50, is_active: true, display_order: 13 },
        { name: "American Express", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.10, percentage_fee: 0, percentage_cost_basis: 2.45, is_active: true, display_order: 14 },
        { name: "Payconiq", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.15, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 15 },
        { name: "EPS", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "transaction", cost_basis: 0.10, percentage_fee: 0, percentage_cost_basis: 1.00, is_active: true, display_order: 16 }
    ];
    const paymentMethodsExist = existingProducts.some(p => p.name === "iDEAL" && p.category === paymentMethodCategory);
    
    const transactionProcessingToAdd = [
        { name: "Domestic debit (NL/BE) <€50", category: "transaction_processing", default_price: 0, unit_type: "transaction", cost_basis: 0.07, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 0 },
        { name: "Domestic debit (NL/BE) >€50", category: "transaction_processing", default_price: 0, unit_type: "transaction", cost_basis: 0.06, percentage_fee: 0, percentage_cost_basis: 0.15, is_active: true, display_order: 1 },
        { name: "Domestic debit (EU)", category: "transaction_processing", default_price: 0, unit_type: "transaction", cost_basis: 0.06, percentage_fee: 0, percentage_cost_basis: 0.40, is_active: true, display_order: 2 },
        { name: "Visa / Mastercard – Overige kaarten", category: "transaction_processing", default_price: 0, unit_type: "transaction", cost_basis: 0.25, percentage_fee: 0, percentage_cost_basis: 2.50, is_active: true, display_order: 3 },
        { name: "American Express", category: "transaction_processing", default_price: 0, unit_type: "transaction", cost_basis: 0.10, percentage_fee: 0, percentage_cost_basis: 2.25, is_active: true, display_order: 4 }
    ];
    const transactionProcessingExist = existingProducts.some(p => p.name === "Domestic debit (NL/BE) <€50" && p.category === transactionProcessingCategory);

    const originalTicketingProducts = [
        { name: "Service fee ticket verkopen", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "percentage", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 3.0, is_active: true, display_order: 17 },
        { name: "Service fee ticket aankopen tweedehands", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "percentage", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 4.0, is_active: true, display_order: 18 },
        { name: "Kickback van service fees aan organisator", category: "ticketing_ecommerce_fees", default_price: 0, unit_type: "percentage", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 19 }
    ];
    const originalTicketingProductsExist = existingProducts.some(p => p.category === paymentMethodCategory && p.name === 'Service fee ticket verkopen');

    const visitorFeesToAdd = [
        { name: "Ticket Transfer Fee", category: "visitor_fees", default_price: 0.99, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 0 },
        { name: "Opwaarderen cashcard via iDeal", category: "visitor_fees", default_price: 0.99, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 1 },
        { name: "Tweedehands verkoop", category: "visitor_fees", default_price: 0, unit_type: "percentage", cost_basis: 0, percentage_fee: 5, percentage_cost_basis: 0, is_active: true, display_order: 2 },
        { name: "Fee per bestelling", category: "visitor_fees", default_price: 0, unit_type: "percentage", cost_basis: 0, percentage_fee: 6, percentage_cost_basis: 0, is_active: true, display_order: 3 },
        { name: "Ticketswap purchase", category: "visitor_fees", default_price: 0.49, unit_type: "transaction", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 4 }
    ];
    const visitorFeesExist = existingProducts.some(p => p.name === "Ticket Transfer Fee" && p.category === visitorFeesCategory);

    const discountsToAdd = [
        { name: "Projectkorting", category: "discounts", default_price: -1.00, unit_type: "euro_amount", cost_basis: 0, percentage_fee: 0, percentage_cost_basis: 0, is_active: true, display_order: 0 }
    ];
    const discountsExist = existingProducts.some(p => p.name === "Projectkorting" && p.category === discountsCategory);

    const productsToCreate = [];

    if (!newTicketingProductsExist) {
        productsToCreate.push(...newTicketingProducts);
    }
    if (!paymentMethodsExist) {
        productsToCreate.push(...paymentMethodsToAdd);
    }
    if (!transactionProcessingExist) {
        productsToCreate.push(...transactionProcessingToAdd);
    }
    if (!originalTicketingProductsExist) {
        productsToCreate.push(...originalTicketingProducts);
    }
    if (!visitorFeesExist) {
        productsToCreate.push(...visitorFeesToAdd);
    }
    if (!discountsExist) {
        productsToCreate.push(...discountsToAdd);
    }

    if (productsToCreate.length > 0) {
        try {
            await Product.bulkCreate(productsToCreate);
            return true; // Data was seeded
        } catch (error) {
            console.error("Failed to seed products:", error);
        }
    }
    
    return false; // No changes made
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let [productData, settingData] = await Promise.all([
          Product.list('display_order'),
          ProductCategorySetting.list()
      ]);

      const dataWasSeeded = await seedInitialData(productData || []);

      if (dataWasSeeded) {
          // If we added data, we need to refetch it to display it correctly
          [productData, settingData] = await Promise.all([
              Product.list('display_order'),
              ProductCategorySetting.list()
          ]);
      }

      setProducts(productData || []);
      setCategorySettings(settingData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      setProducts([]);
      setCategorySettings([]);
    } finally {
      setIsLoading(false);
    }
  }, []); 

  useEffect(() => {
    // Only load data if the user is authorized
    if (!authState.checking && authState.authorized) {
      loadData();
    }
  }, [authState.checking, authState.authorized, loadData]); 

  const handleProductUpdate = async (productId, updatedData) => {
    const originalProducts = [...products];
    const productIndex = originalProducts.findIndex(p => p.id === productId);
    if (productIndex === -1) return;

    const updatedProducts = [...originalProducts];
    updatedProducts[productIndex] = { ...updatedProducts[productIndex], ...updatedData };
    
    setProducts(updatedProducts); // Optimistic update

    try {
      await Product.update(productId, updatedData);
    } catch (error) {
      console.error('Error updating product:', error);
      setProducts(originalProducts); // Revert on error
      toast.error("Failed to update product. Please try again.");
    }
  };

  const handleProductCreate = async (productData) => {
    try {
      const newProduct = await Product.create(productData);
      setProducts(prevProducts => [...prevProducts, newProduct]); // Optimistic add
      toast.success("Product created successfully.");
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error("Failed to create product.");
    }
  };

  const handleProductOrderChange = async (updates) => {
    // updates is an array of objects like [{id: '...', display_order: ...}]
    const originalProducts = [...products];

    // Create a map for efficient lookups
    const updateMap = new Map(updates.map(u => [u.id, u.display_order]));

    // Optimistically update the local state
    const newProductsState = products.map(p => 
        updateMap.has(p.id) ? { ...p, display_order: updateMap.get(p.id) } : p
    );
    setProducts(newProductsState);

    try {
        await Promise.all(
            updates.map(update => Product.update(update.id, { display_order: update.display_order }))
        );
    } catch (error) {
        console.error('Error updating product order:', error);
        setProducts(originalProducts); // Revert on error
        toast.error("Failed to reorder products.");
    }
  };

  const handleCategorySettingChange = async (category, calculationType) => {
    const originalSettings = [...categorySettings];
    const existingSetting = originalSettings.find(s => s.category === category);

    if (existingSetting) {
        const newSettings = originalSettings.map(s => 
            s.category === category ? { ...s, calculation_type: calculationType } : s
        );
        setCategorySettings(newSettings); // Optimistic update

        try {
            await ProductCategorySetting.update(existingSetting.id, { calculation_type: calculationType });
        } catch (error) {
            console.error('Error updating category setting:', error);
            setCategorySettings(originalSettings); // Revert on error
            toast.error("Failed to update category setting.");
        }
    } else {
        try {
            const newSetting = await ProductCategorySetting.create({
                category: category,
                calculation_type: calculationType,
                display_order: originalSettings.length
            });
            setCategorySettings(prev => [...prev, newSetting]); // Optimistic add
        } catch (error) {
            console.error('Error creating category setting:', error);
            toast.error("Failed to create category setting.");
        }
    }
  };

  const handleCategoryOrderChange = async (updatedSettingsWithOrder) => {
    const originalSettings = [...categorySettings];
    const settingsMap = new Map(originalSettings.map(s => [s.category, s]));
    
    // Merge updated order with existing setting data (like id and created_date)
    const newSettingsState = updatedSettingsWithOrder.map(s => ({
        ...s,
        id: settingsMap.get(s.category)?.id,
        created_date: settingsMap.get(s.category)?.created_date,
    }));
    setCategorySettings(newSettingsState); // Optimistic update

    try {
      await Promise.all(updatedSettingsWithOrder.map(setting => {
        const existing = settingsMap.get(setting.category);
        if (existing) {
            return ProductCategorySetting.update(existing.id, setting);
        }
        return ProductCategorySetting.create(setting); // In case a category was moved and didn't have a setting yet
      }));
    } catch (error) {
      console.error('Error updating category order:', error);
      setCategorySettings(originalSettings); // Revert on error
      toast.error("Failed to reorder categories.");
    }
  };

  const handleCategoryArchive = async (categoryValue) => {
    try {
        // Find the setting for the category.
        const setting = categorySettings.find(s => s.category === categoryValue);
        
        // Update setting or create a new archived one if it doesn't exist.
        if (setting) {
            await ProductCategorySetting.update(setting.id, { is_archived: true });
        } else {
            // This case is unlikely if the category is displayed, but good to have.
            await ProductCategorySetting.create({ category: categoryValue, is_archived: true, display_order: 999 });
        }

        // Find all products in the category and archive them.
        const productsToArchive = products.filter(p => p.category === categoryValue);
        const productUpdatePromises = productsToArchive.map(p => 
            Product.update(p.id, { is_active: false })
        );
        
        await Promise.all(productUpdatePromises);
        
        toast.success(`Category "${t(categoryValue.replace(/_/g, ' '))}" has been archived.`);
        
        // Refresh all data from the server.
        loadData();
    } catch (error) {
        console.error('Error archiving category:', error);
        toast.error("Failed to archive category.");
    }
  };

  // Conditional rendering based on authentication state
  if (authState.checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{t('Loading...')}</p>
      </div>
    );
  }

  // If not authorized, display UnauthorizedAccess component
  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <Toaster />
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Package className="w-8 h-8 text-indigo-600" />
          <h1 className="text-3xl font-bold text-gray-900">{t('Products')}</h1>
        </div>
      </div>

      <ProductTable
        products={products}
        categorySettings={categorySettings}
        isLoading={isLoading}
        onProductUpdate={handleProductUpdate}
        onProductCreate={handleProductCreate}
        onOrderChange={handleProductOrderChange}
        onCategorySettingChange={handleCategorySettingChange}
        onCategoryOrderChange={handleCategoryOrderChange}
        onCategoryArchive={handleCategoryArchive}
      />
    </div>
  );
}
