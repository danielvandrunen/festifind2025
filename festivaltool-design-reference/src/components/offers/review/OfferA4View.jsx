import React from 'react';
import DocumentHeader from '../editor/a4/DocumentHeader';
import DocumentSection from '../editor/a4/DocumentSection';
import DocumentFooter from '../editor/a4/DocumentFooter';
import { format } from 'date-fns';

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

    // Add products to their respective sections only if they are in the offer_lines
    lines.forEach(line => {
        const product = productMap.get(line.product_id);
        if (product && product.is_active) {
            const category = product.category || 'services';
            if (sectionsMap.has(category)) {
                sectionsMap.get(category).lines.push({
                    ...line,
                    product_name: product.name,
                });
            }
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
    
    // Filter out sections with no lines
    return sortedSections.filter(section => section.lines.length > 0);
};

export default function OfferA4View({ offer, client, products, categorySettings }) {
    if (!offer || !client) return null;

    const sections = groupLinesBySection(offer.offer_lines, products, categorySettings);

    const isSigned = !!offer.signed_date;

    return (
        <div className="bg-white rounded-lg shadow-2xl p-12" style={{ width: '210mm', minHeight: '297mm' }}>
            <DocumentHeader 
                offer={offer}
                clients={[client]}
                onDetailsChange={() => {}} // Read-only
                onAddNewClient={() => {}}
            />
            
            <div className="space-y-4 mt-8">
                <h2 className="font-bold text-xl text-gray-800 border-b-2 border-gray-200 pb-2">Project Offer</h2>
                <div className="space-y-8">
                    {sections.map((section, index) => (
                        <DocumentSection
                            key={section.title}
                            index={index}
                            section={section}
                            products={products}
                            offerLines={offer.offer_lines}
                            onLinesChange={() => {}} // Read-only
                            isStandardSection={!categorySettings.find(s => s.category === section.title)?.calculation_type === 'post_event'}
                            isReview={true} // For client view
                        />
                    ))}
                </div>
            </div>
            
            <DocumentFooter
                offer={offer}
                products={products}
                categorySettings={categorySettings}
                onDetailsChange={() => {}} // Read-only
                onLinesChange={() => {}}
                isReview={true}
            />

            {isSigned && (
                <div className="mt-12 pt-8 border-t-2 border-gray-300">
                    <h3 className="font-bold text-gray-800 mb-4">Signature</h3>
                    <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 flex justify-between items-end">
                        <div>
                            <p className="text-sm text-gray-600">Signed by:</p>
                            <p className="text-lg font-semibold text-gray-900">{offer.signed_by_name}</p>
                            <p className="text-sm text-gray-500">
                                {format(new Date(offer.signed_date), 'MMMM d, yyyy HH:mm')}
                            </p>
                        </div>
                        {offer.signature_data_url && (
                             <img src={offer.signature_data_url} alt="Signature" className="h-16 w-auto" />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}