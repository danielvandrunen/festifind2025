import React from 'react';
import { Droppable } from '@hello-pangea/dnd';
import DocumentLine from './DocumentLine';
import ProductAdder from './ProductAdder';
import { useLocalization } from '../../../Localization';

export default function DocumentSection({ 
    section, 
    index, 
    products = [], 
    offerLines = [], 
    onLinesChange, 
    isStandardSection = true,
    isReview = false,
    staffel = 1
}) {
    const { t } = useLocalization();

    if (!section || !Array.isArray(section.lines)) {
        return null;
    }

    const formattedTitle = t(section.title.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));
    
    const visibleLines = isReview 
        ? section.lines.filter(line => line.quantity > 0)
        : isStandardSection 
            ? section.lines
            : section.lines.filter(line => line.quantity > 0);
    
    const hiddenLines = section.lines.filter(line => line.quantity === 0);

    const handleLineChange = (lineIndex, field, value) => {
        const lineToUpdate = visibleLines[lineIndex];
        const updatedLines = [...offerLines];

        const actualLineIndex = updatedLines.findIndex(line => 
            line.product_id === lineToUpdate?.product_id
        );
        
        if (actualLineIndex !== -1) {
            let parsedValue = value;
            if (field === 'quantity' || field === 'unit_price') {
                parsedValue = parseFloat(value) || 0;
            }

            updatedLines[actualLineIndex] = {
                ...updatedLines[actualLineIndex],
                [field]: parsedValue,
            };
            onLinesChange(updatedLines);
        }
    };

    const handleRemoveLine = (lineIndex) => {
        const lineToRemove = visibleLines[lineIndex];
        const updatedLines = offerLines.map(line => 
            line.product_id === lineToRemove?.product_id ? { ...line, quantity: 0 } : line
        );
        onLinesChange(updatedLines);
    };

    const shouldShowSection = visibleLines.length > 0 || (!isReview && hiddenLines.length > 0);

    if (!shouldShowSection) {
        return null;
    }

    // Check if any product in this section has staffel enabled
    const hasStaffelProducts = visibleLines.some(line => {
        const product = products.find(p => p.id === line.product_id);
        return product?.has_staffel;
    });

    return (
        <div className="space-y-1 mt-3" style={{ pageBreakInside: 'avoid' }}>
            {(isStandardSection || (!isStandardSection && visibleLines.length > 0)) && (
                <div className="flex items-center justify-between gap-2 border-b-2 border-gray-800 pb-1 mb-1">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-gray-700">{formattedTitle}</h3>
                    {!isReview && hiddenLines.length > 0 && (
                        <ProductAdder 
                            products={products}
                            section={section.title}
                            onLinesChange={onLinesChange}
                            offerLines={offerLines}
                            hiddenLines={hiddenLines}
                        />
                    )}
                </div>
            )}
            
            {visibleLines.length > 0 && (
                <div className="overflow-visible">
                    <table className="w-full text-xs relative">
                        <thead>
                            <tr className="border-b text-[10px]">
                                {!isReview && <th className="w-8"></th>}
                                <th className="text-left font-medium py-0.5 px-2">{t('Description')}</th>
                                <th className="text-right font-medium py-0.5 px-2 w-16">{t('Quantity')}</th>
                                {hasStaffelProducts && <th className="text-right font-medium py-0.5 px-2 w-16">{t('Staffel')}</th>}
                                <th className="text-right font-medium py-0.5 px-2 w-24">{t('Unit Price')}</th>
                                <th className="text-right font-medium py-0.5 px-2 w-24">{t('Total')}</th>
                                {!isReview && <th className="w-10"></th>}
                            </tr>
                        </thead>
                        {isReview ? (
                            <tbody>
                                {visibleLines.map((line, lineIndex) => (
                                    <DocumentLine
                                        key={line.product_id || lineIndex}
                                        line={line}
                                        index={lineIndex}
                                        products={products}
                                        onLineChange={() => {}}
                                        onRemoveLine={() => {}}
                                        showRemoveButton={false}
                                        isStandardSection={isStandardSection}
                                        isReview={true}
                                        staffel={staffel}
                                        hasStaffelProducts={hasStaffelProducts}
                                    />
                                ))}
                            </tbody>
                        ) : (
                            <Droppable droppableId={section.title} type="LINE_ITEM">
                                {(provided) => (
                                    <tbody ref={provided.innerRef} {...provided.droppableProps}>
                                        {visibleLines.map((line, lineIndex) => (
                                            <DocumentLine
                                                key={line.product_id || lineIndex}
                                                line={line}
                                                index={lineIndex}
                                                products={products}
                                                onLineChange={(field, value) => handleLineChange(lineIndex, field, value)}
                                                onRemoveLine={() => handleRemoveLine(lineIndex)}
                                                showRemoveButton={true}
                                                isStandardSection={isStandardSection}
                                                isReview={false}
                                                staffel={staffel}
                                                hasStaffelProducts={hasStaffelProducts}
                                            />
                                        ))}
                                        {provided.placeholder}
                                    </tbody>
                                )}
                            </Droppable>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
}