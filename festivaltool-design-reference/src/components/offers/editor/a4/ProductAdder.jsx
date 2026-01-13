import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Plus, ChevronsUpDown } from 'lucide-react';
import { useLocalization } from '../../../Localization';

export default function ProductAdder({ products, section, onLinesChange, offerLines, hiddenLines }) {
    const { t } = useLocalization();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');

    const handleSelect = (productId) => {
        const productToAdd = products.find(p => p.id === productId);
        if (!productToAdd) return;
        
        const existingLineIndex = offerLines.findIndex(line => line.product_id === productId);

        if (existingLineIndex !== -1) {
            // If line exists, just update its quantity
            const updatedLines = [...offerLines];
            updatedLines[existingLineIndex] = { 
                ...updatedLines[existingLineIndex], 
                quantity: 1,
                line_total: updatedLines[existingLineIndex].unit_price
            };
            onLinesChange(updatedLines);
        } else {
            // If it doesn't exist, create a new line
            const newLine = {
                product_id: productToAdd.id,
                product_name: productToAdd.name,
                description: productToAdd.description || '',
                quantity: 1,
                unit_price: productToAdd.default_price,
                line_total: productToAdd.default_price,
                section: section
            };
            onLinesChange([...offerLines, newLine]);
        }
        
        setValue('');
        setOpen(false);
    };

    if (!hiddenLines || hiddenLines.length === 0) {
        return null;
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs h-7">
                    <Plus className="w-3 h-3" /> {t('Add Product')}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder={t('Search product...')} />
                    <CommandEmpty>{t('No product found.')}</CommandEmpty>
                    <CommandGroup>
                        {hiddenLines
                            .map(line => {
                                const product = products.find(p => p.id === line.product_id);
                                return product;
                            })
                            .filter(Boolean)
                            .map((product) => (
                            <CommandItem
                                key={product.id}
                                value={product.id}
                                onSelect={(currentValue) => {
                                    handleSelect(currentValue);
                                }}
                            >
                                <div className="flex flex-col">
                                    <span className="font-medium">{product.name}</span>
                                    {product.description && (
                                        <span className="text-xs text-gray-500">{product.description}</span>
                                    )}
                                </div>
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}