import React, { useState, useEffect, useCallback } from "react";
import { Offer, Client, Product, ProductCategorySetting } from "@/api/entities";
import { useLocalization } from "../components/Localization";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";
import { base44 } from "@/api/base44Client";

import DocumentHeader from "../components/offers/editor/a4/DocumentHeader";
import DocumentSection from "../components/offers/editor/a4/DocumentSection";
import DocumentFooter from "../components/offers/editor/a4/DocumentFooter";
import SignaturePad from "../components/offers/review/SignaturePad";
import EventCockpit from "../components/offers/editor/EventCockpit"; // This component is now being re-added for client view, but in review mode

const groupLinesBySection = (lines, products, categorySettings) => {
    if (!Array.isArray(products) || !Array.isArray(categorySettings)) return [];

    const productMap = new Map(products.map(p => [p.id, p]));
    const lineMap = new Map((lines || []).map(l => [l.product_id, l]));
    const categorySettingsMap = new Map(categorySettings.map(s => [s.category, s]));

    const sectionsMap = new Map();

    const sortedCategories = [...categorySettings]
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
        .map(s => s.category);
    
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
            const line = lineMap.get(product.id) || {
                product_id: product.id,
                quantity: 0,
            };
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

export default function OfferReview() {
  const { t } = useLocalization();
  const [offer, setOffer] = useState(null);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSigningModal, setShowSigningModal] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Parse offer ID from URL, stripping any UTM parameters that might be appended
  const urlParams = new URLSearchParams(window.location.search);
  let offerIdFromUrl = urlParams.get('id');
  
  // Clean up the offer ID - remove any UTM tracking params that may have been accidentally concatenated
  if (offerIdFromUrl && offerIdFromUrl.includes('?')) {
    offerIdFromUrl = offerIdFromUrl.split('?')[0];
  }
  if (offerIdFromUrl && offerIdFromUrl.includes('&')) {
    offerIdFromUrl = offerIdFromUrl.split('&')[0];
  }

  // Track offer view when page loads (skip if preview mode for internal users)
  useEffect(() => {
    const isPreview = urlParams.get('preview') === 'true';
    
    const trackView = async () => {
      if (!offerIdFromUrl || isPreview) return;
      
      try {
        await base44.functions.invoke('trackOfferView', { offerId: offerIdFromUrl });
      } catch (error) {
        console.error('Failed to track offer view:', error);
        // Don't show error to user - tracking should be silent
      }
    };
    
    trackView();
  }, [offerIdFromUrl]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const loadOfferData = useCallback(async () => {
    if (!offerIdFromUrl) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [offerData, clientsData, productsData, categorySettingsData] = await Promise.all([
        Offer.get(offerIdFromUrl),
        Client.list(),
        Product.list(),
        ProductCategorySetting.list()
      ]);

      setOffer(offerData);
      setClients(clientsData || []);
      setProducts(productsData || []);
      setCategorySettings(categorySettingsData || []);
    } catch (error) {
      console.error("Failed to load offer data:", error);
      setOffer(null);
    } finally {
      setIsLoading(false);
    }
  }, [offerIdFromUrl]);

  useEffect(() => {
    loadOfferData();
  }, [loadOfferData]);

  useEffect(() => {
    // Load html2pdf library
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const handleDownloadPDF = async () => {
    setIsGeneratingPDF(true);
    
    try {
      const element = document.getElementById('pdf-content');
      const client = clients.find(c => c.id === offer.client_id);
      
      // Format: ProjectName - ClientName - v1.5
      const projectName = offer.project_name || 'Project';
      const clientName = client?.company_name || 'Client';
      const version = `v${offer.version ? offer.version.toFixed(1) : '1.0'}`;
      const fileName = `${projectName} - ${clientName} - ${version}.pdf`.replace(/\s+/g, '_');
      
      const opt = {
        margin: [20, 20, 20, 20], // Top, Right, Bottom, Left in mm - standard printing margins
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };

      // Wait for html2pdf to be loaded
      if (typeof window.html2pdf === 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // For mobile: generate blob and open in new tab
      // For desktop: direct download
      if (isMobile) {
        const pdfBlob = await window.html2pdf().set(opt).from(element).output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);
        window.open(blobUrl, '_blank');
        
        // Clean up the blob URL after a delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      } else {
        await window.html2pdf().set(opt).from(element).save();
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Er is een fout opgetreden bij het genereren van de PDF. Probeer het opnieuw.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t('Loading...')}</p>
        </div>
      </div>
    );
  }

  if (!offer) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="mb-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('Offer Not Found')}</h2>
            <p className="text-gray-600 mb-4">{t('The requested offer could not be found or may have been removed.')}</p>
            <p className="text-sm text-gray-500">{t('Please check your link and try again')}</p>
          </div>
        </div>
      </div>
    );
  }

  const sections = groupLinesBySection(offer.offer_lines, products, categorySettings);
  const isSigned = !!offer.signed_date;
  const client = clients.find(c => c.id === offer.client_id);

  // Mobile view - simplified
  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white shadow-md p-6">
          <div className="flex items-center gap-3 mb-4">
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b82e06e82c328f0770844d/ac2112737_Bluenewlogologoonly.png" alt="Fastlane Logo" className="w-12 h-12" />
            <div>
              <h2 className="font-bold text-gray-900 text-lg">Fastlane</h2>
              <p className="text-xs text-gray-500">Festival platform</p>
            </div>
          </div>
          <div className="border-t pt-4">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Offerte</h1>
            <p className="text-sm text-gray-600">Offertenr: {offer.offer_number}</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 space-y-6">
          {/* Signed status */}
          {isSigned && (
            <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">✅</span>
                <h3 className="font-bold text-green-900">Ondertekend</h3>
              </div>
              <p className="text-sm text-green-800">
                Deze offerte is ondertekend op {new Date(offer.signed_date).toLocaleDateString('nl-NL')} om {new Date(offer.signed_date).toLocaleTimeString('nl-NL')}
              </p>
            </div>
          )}

          {/* Offer details card */}
          <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <h2 className="font-bold text-lg text-gray-900">{offer.project_name}</h2>
                <p className="text-sm text-gray-600">{client?.company_name}</p>
              </div>
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Versie:</span>
                <span className="font-medium">v{offer.version ? offer.version.toFixed(1) : '1.0'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Totaal (incl. BTW):</span>
                <span className="font-bold text-lg text-gray-900">
                  €{(offer.total_incl_btw || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 text-center">
                Download de PDF om de volledige offerte te bekijken
              </p>
            </div>
          </div>

          {/* Action buttons */}
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

        {/* Hidden PDF content for generation */}
        <div className="hidden">
          <div id="pdf-content" className="bg-white" style={{ padding: '20px 28px' }}>
            {/* Combined header and content section - forced to stay together */}
            <div style={{ pageBreakInside: 'avoid' }}>
              <DocumentHeader 
                offer={offer}
                clients={clients}
                isReview={true}
              />
              
              {/* NO EVENT COCKPIT IN PDF EXPORT */}
              
              <div className="space-y-1 mt-3" style={{ pageBreakBefore: 'avoid' }}>
                <h2 className="font-bold text-lg text-gray-800 border-b-2 border-gray-200 pb-1">{t('Project Offer')}</h2>
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
                        offerLines={offer.offer_lines || []}
                        isStandardSection={isStandardSection}
                        isReview={true}
                        staffel={offer.staffel || 1}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
            
            <DocumentFooter
              offer={offer}
              products={products}
              categorySettings={categorySettings}
              isReview={true}
            />

            {isSigned && (
              <div className="mt-6 pt-6 border-t-2 border-gray-200" style={{ pageBreakInside: 'avoid' }}>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Ondertekend door</h3>
                    <p className="text-lg font-medium">{offer.signed_by_name}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(offer.signed_date).toLocaleDateString('nl-NL')} om {new Date(offer.signed_date).toLocaleTimeString('nl-NL')}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-600 mb-2">Digitale Handtekening</h3>
                    {offer.signature_data_url && (
                      <img 
                        src={offer.signature_data_url} 
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

        {/* Signing modal */}
        {showSigningModal && !isSigned && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-2xl w-full max-h-[90vh] overflow-y-auto my-8">
              <SignaturePad 
                offer={offer} 
                onOfferSigned={() => window.location.reload()}
                onCancel={() => setShowSigningModal(false)}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop view - full document
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Green success banner for signed offers */}
      {isSigned && (
        <div className="bg-green-600 text-white py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg">✅</span>
            <span className="font-semibold">
              Deze offerte is ondertekend op {new Date(offer.signed_date).toLocaleDateString('nl-NL')} om {new Date(offer.signed_date).toLocaleTimeString('nl-NL')}
            </span>
          </div>
        </div>
      )}

      {/* Accept offer button for unsigned offers - sticky at top */}
      {!isSigned && (
        <div className="sticky top-0 bg-white border-b shadow-md py-4 z-50">
          <div className="max-w-4xl mx-auto px-6 flex items-center justify-center gap-4">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transition-colors duration-200 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              {isGeneratingPDF ? 'Genereren...' : 'Download PDF'}
            </button>
            <button
              onClick={() => setShowSigningModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transition-colors duration-200"
            >
              Accepteer Offerte
            </button>
          </div>
        </div>
      )}

      {/* Signed offers - show download button */}
      {isSigned && (
        <div className="sticky top-0 bg-white border-b shadow-md py-4 z-50">
          <div className="max-w-4xl mx-auto px-6 flex items-center justify-center">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPDF}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-8 rounded-lg text-lg shadow-lg transition-colors duration-200 flex items-center gap-2"
            >
              <Download className="w-5 h-5" />
              {isGeneratingPDF ? 'Genereren...' : 'Download PDF'}
            </button>
          </div>
        </div>
      )}

      {/* Main content container */}
      <div className="max-w-4xl mx-auto p-6">
        <div id="pdf-content" className="bg-white rounded-lg shadow-2xl" style={{ padding: '20px 28px' }}>
          {/* Combined header and content section - forced to stay together */}
          <div style={{ pageBreakInside: 'avoid' }}>
            <DocumentHeader 
              offer={offer}
              clients={clients}
              isReview={true}
            />
            
            {/* EXCLUDE FROM PDF - Event Cockpit only shows on screen */}
            <div className="no-print">
              <EventCockpit 
                offer={offer}
                products={products}
                categorySettings={categorySettings}
                onDetailsChange={() => {}}
                isReview={true}
              />
            </div>
            
            <div className="space-y-1 mt-3" style={{ pageBreakBefore: 'avoid' }}>
              <h2 className="font-bold text-lg text-gray-800 border-b-2 border-gray-200 pb-1">{t('Project Offer')}</h2>
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
                      offerLines={offer.offer_lines || []}
                      isStandardSection={isStandardSection}
                      isReview={true}
                      staffel={offer.staffel || 1}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          
          <DocumentFooter
            offer={offer}
            products={products}
            categorySettings={categorySettings}
            isReview={true}
          />

          {/* Signature section for signed offers */}
          {isSigned && (
            <div className="mt-6 pt-6 border-t-2 border-gray-200" style={{ pageBreakInside: 'avoid' }}>
              <div className="grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Ondertekend door</h3>
                  <p className="text-lg font-medium">{offer.signed_by_name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(offer.signed_date).toLocaleDateString('nl-NL')} om {new Date(offer.signed_date).toLocaleTimeString('nl-NL')}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-600 mb-2">Digitale Handtekening</h3>
                  {offer.signature_data_url && (
                    <img 
                      src={offer.signature_data_url} 
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

      {/* Signing modal */}
      {showSigningModal && !isSigned && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <SignaturePad 
              offer={offer} 
              onOfferSigned={() => window.location.reload()}
              onCancel={() => setShowSigningModal(false)}
            />
          </div>
        </div>
      )}
      <style jsx>{`
        @media print {
          .no-print {
            display: none !important;
          }
        }
        
        /* ... keep existing print styles */
      `}</style>
    </div>
  );
}