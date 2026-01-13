import React, { useState, useEffect, useMemo } from "react";
import { Offer, ClientPortalAccess, Product, ProductCategorySetting } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Download, ChevronRight, FileText, Calendar, Users } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";

import DocumentHeader from "../components/offers/editor/a4/DocumentHeader";
import DocumentSection from "../components/offers/editor/a4/DocumentSection";
import DocumentFooter from "../components/offers/editor/a4/DocumentFooter";
import EventCockpit from "../components/offers/editor/EventCockpit";
import SignaturePad from "../components/offers/review/SignaturePad";

const groupLinesBySection = (lines, products, categorySettings) => {
  if (!Array.isArray(products) || !Array.isArray(categorySettings)) return [];
  const productMap = new Map(products.map(p => [p.id, p]));
  const lineMap = new Map((lines || []).map(l => [l.product_id, l]));
  const categorySettingsMap = new Map(categorySettings.map(s => [s.category, s]));
  const sectionsMap = new Map();
  const sortedCategories = [...categorySettings].sort((a, b) => (a.display_order || 0) - (b.display_order || 0)).map(s => s.category);
  const allCategories = [...new Set([...sortedCategories, ...products.map(p => p.category)])];
  allCategories.forEach(category => {
    if (!category) return;
    const setting = categorySettingsMap.get(category);
    if (setting?.is_archived) return;
    sectionsMap.set(category, { title: category, lines: [] });
  });
  products.forEach(product => {
    const category = product.category;
    if (product.is_active && sectionsMap.has(category)) {
      const line = lineMap.get(product.id) || { product_id: product.id, quantity: 0 };
      sectionsMap.get(category).lines.push({
        ...line,
        product_name: product.name,
        description: product.description || '',
        unit_price: line.unit_price ?? product.default_price,
      });
    }
  });
  const result = [];
  for (const category of allCategories) {
    if (sectionsMap.has(category) && sectionsMap.get(category).lines.length > 0) {
      const section = sectionsMap.get(category);
      section.lines.sort((a, b) => {
        const productA = productMap.get(a.product_id);
        const productB = productMap.get(b.product_id);
        return (productA?.display_order || 0) - (productB?.display_order || 0);
      });
      result.push(section);
    }
  }
  return result;
};

export default function ClientPortal() {
  const [portalAccess, setPortalAccess] = useState(null);
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showMobileOfferPicker, setShowMobileOfferPicker] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const portalId = urlParams.get('portal');

  useEffect(() => {
    loadData();
  }, [portalId]);

  // Track view when selectedOffer changes
  useEffect(() => {
    const trackView = async () => {
      if (!selectedOffer || !selectedOffer.id) return;
      
      try {
        await base44.functions.invoke('trackOfferView', { offerId: selectedOffer.id });
        console.log('📊 Tracked offer view:', selectedOffer.project_name);
      } catch (error) {
        console.error('Failed to track offer view:', error);
      }
    };
    
    trackView();
  }, [selectedOffer?.id]);

  const loadData = async () => {
    if (!portalId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const portalAccessList = await ClientPortalAccess.filter({ portal_url_id: portalId });
      
      if (!portalAccessList || portalAccessList.length === 0) {
        setPortalAccess(null);
        setIsLoading(false);
        return;
      }

      const portalAccessData = portalAccessList[0];
      
      if (!portalAccessData.is_active) {
        setPortalAccess(null);
        setIsLoading(false);
        return;
      }

      setPortalAccess(portalAccessData);

      const [offersData, productsData, categorySettingsData] = await Promise.all([
        Offer.filter({ client_id: portalAccessData.client_id }),
        Product.list(),
        ProductCategorySetting.list()
      ]);

      const activeOffers = (offersData || [])
        .filter(o => o.status !== 'archived')
        .sort((a, b) => {
          const dateA = a.showdates?.[0] ? new Date(a.showdates[0]).getTime() : 0;
          const dateB = b.showdates?.[0] ? new Date(b.showdates[0]).getTime() : 0;
          return dateA - dateB;
        });

      setOffers(activeOffers);
      setProducts(productsData || []);
      setCategorySettings(categorySettingsData || []);

      if (activeOffers.length > 0) {
        setSelectedOffer({...activeOffers[0]});
      }
    } catch (error) {
      console.error("Failed to load client portal data:", error);
      setPortalAccess(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const element = document.getElementById('pdf-content');
      const fileName = `${selectedOffer.project_name} - ${portalAccess.company_name} - v${selectedOffer.version ? selectedOffer.version.toFixed(1) : '1.0'}.pdf`.replace(/\s+/g, '_');
      
      const opt = {
        margin: [20, 20, 20, 20],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      if (typeof window.html2pdf === 'undefined') {
        let retries = 0;
        while (typeof window.html2pdf === 'undefined' && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          retries++;
        }
        if (typeof window.html2pdf === 'undefined') {
          throw new Error('html2pdf.js is not loaded.');
        }
      }

      await window.html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Er is een fout opgetreden bij het genereren van de PDF.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Laden...</p>
        </div>
      </div>
    );
  }

  if (!portalAccess || offers.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Geen offertes gevonden</h2>
            <p className="text-gray-600">Er zijn geen actieve offertes beschikbaar voor deze klant.</p>
          </div>
        </div>
      </div>
    );
  }

  const sections = selectedOffer ? groupLinesBySection(selectedOffer.offer_lines, products, categorySettings) : [];
  const isSigned = selectedOffer?.signed_date;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      <div className="md:hidden bg-white border-b shadow-md sticky top-0 z-[60]">
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b82e06e82c328f0770844d/ac2112737_Bluenewlogologoonly.png" alt="Logo" className="w-8 h-8" />
            <div>
              <h2 className="font-bold text-gray-900 text-sm">Fastlane</h2>
              <p className="text-[10px] text-gray-500">{portalAccess.company_name}</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowMobileOfferPicker(!showMobileOfferPicker)}
            className="w-full bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between"
          >
            <div className="flex-1 text-left">
              <h3 className="font-semibold text-sm text-gray-900">{selectedOffer?.project_name}</h3>
              <p className="text-xs text-gray-500">
                {selectedOffer?.showdates && selectedOffer.showdates.length > 0 && 
                  format(new Date(selectedOffer.showdates[0]), 'dd/MM/yyyy')
                }
              </p>
            </div>
            <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showMobileOfferPicker ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {showMobileOfferPicker && (
          <>
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-[65]"
              onClick={() => setShowMobileOfferPicker(false)}
            />
            <div className="fixed top-[120px] left-0 right-0 bg-white border-b shadow-xl max-h-[60vh] overflow-y-auto z-[70]">
              <div className="p-2">
                {offers.map((offer) => {
                  const isSelected = selectedOffer?.id === offer.id;
                  return (
                    <button
                      key={offer.id}
                      onClick={() => {
                        setSelectedOffer({...offer});
                        setShowMobileOfferPicker(false);
                      }}
                      className={`w-full text-left px-3 py-3 rounded-md mb-1 flex items-center justify-between ${
                        isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200'
                      }`}
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <h3 className="font-semibold text-sm line-clamp-2">{offer.project_name}</h3>
                      </div>
                      <div className={`text-xs flex-shrink-0 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                        {offer.showdates && offer.showdates.length > 0 && (
                          <span>
                            {format(new Date(offer.showdates[0]), 'dd/MM/yyyy')}
                            {offer.showdates.length > 1 && ` +${offer.showdates.length - 1}`}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="hidden md:flex w-96 bg-white border-r shadow-lg flex-col">
        <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
          <div className="flex items-center gap-2 mb-2">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b82e06e82c328f0770844d/ac2112737_Bluenewlogologoonly.png" alt="Logo" className="w-8 h-8" />
            <div>
              <h2 className="font-bold text-white text-base">Fastlane</h2>
              <p className="text-[10px] text-white/80">Festival platform</p>
            </div>
          </div>
          <h1 className="text-lg font-bold text-white mt-2">{portalAccess.company_name}</h1>
          <p className="text-xs text-white/80 mt-1">{offers.length} actieve offertes</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-1">
            {offers.map((offer) => {
              const isSelected = selectedOffer?.id === offer.id;

              return (
                <button
                  key={offer.id}
                  onClick={() => setSelectedOffer({...offer})}
                  className={`w-full text-left px-3 py-2 rounded-md transition-all flex items-center justify-between ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="font-semibold text-sm line-clamp-2">
                      {offer.project_name}
                    </h3>
                  </div>
                  <div className={`text-xs flex-shrink-0 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                    {offer.showdates && offer.showdates.length > 0 && (
                      <span>
                        {format(new Date(offer.showdates[0]), 'dd/MM/yyyy')}
                        {offer.showdates.length > 1 && ` +${offer.showdates.length - 1}`}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSigned && (
          <div className="bg-green-600 text-white py-3 px-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-lg">✅</span>
              <span className="font-semibold text-sm">
                Ondertekend op {format(new Date(selectedOffer.signed_date), 'dd/MM/yyyy')}
              </span>
            </div>
          </div>
        )}

        <div className="hidden md:block sticky top-0 bg-white border-b shadow-md py-4 z-50">
          <div className="max-w-4xl mx-auto px-6 flex items-center justify-center gap-4">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transition-colors duration-200 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              {isGeneratingPDF ? 'Genereren...' : 'Download PDF'}
            </button>

            {!isSigned && (
              <button
                onClick={() => setShowSigningModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transition-colors duration-200"
              >
                Accepteer Offerte
              </button>
            )}
          </div>
        </div>

        <div key={selectedOffer?.id} className="md:hidden min-h-screen bg-gradient-to-br from-blue-50 to-gray-50">
          <div className="p-6 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-4">
                <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b82e06e82c328f0770844d/ac2112733_Bluenewlogologoonly.png" alt="Fastlane Logo" className="w-12 h-12" />
                <div>
                  <h2 className="font-bold text-lg text-gray-900">Fastlane</h2>
                  <p className="text-xs text-gray-500">Festival platform</p>
                </div>
              </div>
              <div className="border-t pt-4">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Offerte</h1>
                <p className="text-sm text-gray-600">Offertenr: {selectedOffer.offer_number}</p>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-8 h-8 text-blue-600" />
                <div>
                  <h2 className="font-bold text-lg text-gray-900">{selectedOffer.project_name}</h2>
                  <p className="text-sm text-gray-600">{portalAccess.company_name}</p>
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Versie:</span>
                  <span className="font-medium">v{selectedOffer.version ? selectedOffer.version.toFixed(1) : '1.0'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Totaal (incl. BTW):</span>
                  <span className="font-bold text-lg text-gray-900">
                    €{(selectedOffer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-xs text-gray-500 text-center">
                  Download de PDF om de volledige offerte te bekijken
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-4 px-6 rounded-lg text-lg shadow-lg transition-colors duration-200 flex items-center justify-center gap-2"
              >
                <Download className="w-6 h-6" />
                {isGeneratingPDF ? 'Genereren...' : 'Download PDF'}
              </button>

              {!isSigned && (
                <button
                  onClick={() => setShowSigningModal(true)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-lg text-lg shadow-lg transition-colors duration-200"
                >
                  Accepteer Offerte
                </button>
              )}
            </div>
          </div>
        </div>

        <div key={selectedOffer?.id} className="hidden md:block max-w-4xl mx-auto p-6">
          <div id="pdf-content" className="bg-white rounded-lg shadow-2xl" style={{ padding: '20px 28px' }}>
            <div style={{ pageBreakInside: 'avoid' }}>
              <DocumentHeader 
                offer={selectedOffer}
                clients={[{ id: portalAccess.client_id, company_name: portalAccess.company_name }]}
                onDetailsChange={() => {}}
                onAddNewClient={() => {}}
                isReview={true}
              />

              <EventCockpit 
                offer={selectedOffer}
                products={products}
                categorySettings={categorySettings}
                onDetailsChange={() => {}}
                isReview={true}
              />
              
              <div className="space-y-2 mt-3" style={{ pageBreakBefore: 'avoid' }}>
                <h2 className="font-bold text-lg text-gray-800 border-b-2 border-gray-200 pb-1">Project Offerte</h2>
                <div className="space-y-2">
                  {sections.map((section, index) => {
                    const setting = categorySettings.find(s => s.category === section.title);
                    const isStandardSection = !setting || setting.calculation_type !== 'post_event';
                    
                    return (
                      <DocumentSection
                        key={section.title}
                        index={index}
                        section={section}
                        products={products}
                        offerLines={selectedOffer.offer_lines || []}
                        onLinesChange={() => {}}
                        isStandardSection={isStandardSection}
                        isReview={true}
                        staffel={selectedOffer.staffel || 1}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            
            <DocumentFooter
              offer={selectedOffer}
              products={products}
              categorySettings={categorySettings}
              onDetailsChange={() => {}}
              onLinesChange={() => {}}
              isReview={true}
            />

            {isSigned && (
              <div className="mt-6 pt-6 border-t-2 border-gray-200" style={{ pageBreakInside: 'avoid' }}>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Ondertekend door</h3>
                    <p className="text-lg font-medium">{selectedOffer.signed_by_name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {format(new Date(selectedOffer.signed_date), 'dd/MM/yyyy')} om {format(new Date(selectedOffer.signed_date), 'HH:mm')}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Digitale Handtekening</h3>
                    {selectedOffer.signature_data_url && (
                      <img 
                        src={selectedOffer.signature_data_url} 
                        alt="Digitale Handtekening" 
                        className="border border-gray-200 rounded p-2 bg-white max-w-48 h-20 object-contain"
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showSigningModal && !isSigned && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[80]">
            <div className="bg-white rounded-lg shadow-2xl w-full max-h-[90vh] overflow-y-auto my-8">
              <SignaturePad 
                offer={selectedOffer} 
                onOfferSigned={() => window.location.reload()}
                onCancel={() => setShowSigningModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}