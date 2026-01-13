
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, X, Plus, Trash2, AlertTriangle, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Label } from "@/components/ui/label";
import { useLocalization } from "../Localization";

const EditableCell = ({ value, onSave, onCancel, type = "text", options = null, isActive = false, isPercentage = false, isMultiplier = false, isWholeNumber = false, t }) => {
  const [editValue, setEditValue] = useState(value || '');
  
  // For boolean type, ensure editValue is a boolean
  React.useEffect(() => {
    if (type === "boolean") {
      setEditValue(!!value);
    } else {
      setEditValue(value || '');
    }
  }, [value, type]);


  const handleSave = () => {
    onSave(editValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    }
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isActive) {
    return (
      <div className="min-h-[36px] flex items-center px-2 py-1 rounded hover:bg-gray-50 cursor-pointer text-sm">
        {type === "select" && options ? 
          options.find(opt => opt.value === value)?.label || value :
          type === "boolean" ? (value ? t('Yes') : t('No')) :
          isPercentage ? `${parseFloat(value || 0).toFixed(2)}%` :
          isMultiplier ? (value !== null && value !== undefined && value !== '' ? parseFloat(value).toString() : '-') :
          isWholeNumber ? (value !== null && value !== undefined && value !== '' ? Math.round(value).toString() : '-') :
          type === "number" ? (value !== null && value !== undefined && value !== '') ? `€${parseFloat(value).toFixed(2)}` : '-' : 
          (value || '-')
        }
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 min-h-[36px]">
      {type === "select" ? (
        <Select value={editValue} onValueChange={setEditValue}>
          <SelectTrigger className="h-8 w-32 text-sm">
            <SelectValue placeholder={t("Select a unit type")} />
          </SelectTrigger>
          <SelectContent>
            {options?.map(option => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : type === "boolean" ? (
        <Switch checked={!!editValue} onCheckedChange={setEditValue} />
      ) : (
        <Input
          type={type === "number" ? "number" : "text"}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
          autoFocus
          onBlur={handleSave}
          step={isWholeNumber ? "1" : (isMultiplier ? "0.01" : "0.01")}
        />
      )}
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-green-500 hover:text-green-600" onClick={handleSave}>
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

const ProductRow = ({ product, onUpdate, onArchive, isNew = false, category, onMove, isFirst, isLast, t }) => {
  const [editingCell, setEditingCell] = useState(null);

  const unitTypes = [
    { value: "piece", label: t("Per Piece") },
    { value: "day", label: t("Per Day") },
    { value: "week", label: t("Per Week") },
    { value: "month", label: t("Per Month") },
    { value: "hour", label: t("Per Hour") },
    { value: "percentage", label: t("Percentage") },
    { value: "transaction", label: t("Transaction") },
    { value: "per_transaction", label: t("Per Transaction") },
    { value: "euro_amount", label: t("Euro Amount") },
    { value: "percentage_of_revenue", label: t("Percentage of Revenue") }
  ];

  const keyFigureOptions = [
    { value: "none", label: t("None") },
    { value: "total_visitors", label: t("Total Visitors") },
    { value: "bar_meters", label: t("Bar Meters") },
    { value: "food_sales_positions", label: t("Food Sales Positions") },
    { value: "euro_spend_per_person", label: t("Euro Spend per Person") },
    { value: "number_of_showdates", label: t("Number of Showdates") },
    { value: "expected_revenue", label: t("Expected Revenue") }
  ];

  const hardwareGroupOptions = [
    { value: "none", label: t("None") },
    { value: "workstation", label: t("Workstation") },
    { value: "handheld", label: t("Handheld") },
    { value: "cashpoint", label: t("Cashpoint") },
    { value: "bonnenprinter", label: t("Bonnenprinter") }
  ];

  const handleSave = (field, value) => {
    const updatedProduct = { ...product, [field]: value };
    onUpdate(product.id, updatedProduct);
    setEditingCell(null);
  };

  const showPercentageFee = ['transaction_processing', 'ticketing_ecommerce_fees', 'visitor_fees'].includes(category);

  return (
    <tr className={`border-b group ${isNew ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
      <td className="w-[40px] px-1 align-middle">
        {isNew ? null : (
          <div className="flex flex-col items-center justify-center">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove('up')} disabled={isFirst}>
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onMove('down')} disabled={isLast}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.name}
          onSave={(val) => handleSave('name', val)}
          onCancel={() => setEditingCell(null)}
          isActive={editingCell === 'name'}
          t={t}
        />
        {editingCell !== 'name' && (
          <button onClick={() => setEditingCell('name')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.description}
          onSave={(val) => handleSave('description', val)}
          onCancel={() => setEditingCell(null)}
          isActive={editingCell === 'description'}
          t={t}
        />
        {editingCell !== 'description' && (
          <button onClick={() => setEditingCell('description')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.hardware_group || 'none'}
          onSave={(val) => handleSave('hardware_group', val)}
          onCancel={() => setEditingCell(null)}
          type="select"
          options={hardwareGroupOptions}
          isActive={editingCell === 'hardware_group'}
          t={t}
        />
        {editingCell !== 'hardware_group' && (
          <button onClick={() => setEditingCell('hardware_group')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.default_price}
          onSave={(val) => handleSave('default_price', parseFloat(val))}
          onCancel={() => setEditingCell(null)}
          type="number"
          isActive={editingCell === 'default_price'}
          t={t}
        />
        {editingCell !== 'default_price' && (
          <button onClick={() => setEditingCell('default_price')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.unit_type}
          onSave={(val) => handleSave('unit_type', val)}
          onCancel={() => setEditingCell(null)}
          type="select"
          options={unitTypes}
          isActive={editingCell === 'unit_type'}
          t={t}
        />
        {editingCell !== 'unit_type' && (
          <button onClick={() => setEditingCell('unit_type')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      {showPercentageFee && (
        <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
          <EditableCell
            value={product.percentage_fee}
            onSave={(val) => handleSave('percentage_fee', parseFloat(val))}
            onCancel={() => setEditingCell(null)}
            type="number"
            isPercentage={true}
            isActive={editingCell === 'percentage_fee'}
            t={t}
          />
          {editingCell !== 'percentage_fee' && (
            <button onClick={() => setEditingCell('percentage_fee')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
          )}
        </td>
      )}
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.cost_basis}
          onSave={(val) => handleSave('cost_basis', parseFloat(val))}
          onCancel={() => setEditingCell(null)}
          type="number"
          isActive={editingCell === 'cost_basis'}
          t={t}
        />
        {editingCell !== 'cost_basis' && (
          <button onClick={() => setEditingCell('cost_basis')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      {showPercentageFee && (
        <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
          <EditableCell
            value={product.percentage_cost_basis}
            onSave={(val) => handleSave('percentage_cost_basis', parseFloat(val))}
            onCancel={() => setEditingCell(null)}
            type="number"
            isPercentage={true}
            isActive={editingCell === 'percentage_cost_basis'}
            t={t}
          />
          {editingCell !== 'percentage_cost_basis' && (
            <button onClick={() => setEditingCell('percentage_cost_basis')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
          )}
        </td>
      )}
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.key_figure || 'none'}
          onSave={(val) => handleSave('key_figure', val)}
          onCancel={() => setEditingCell(null)}
          type="select"
          options={keyFigureOptions}
          isActive={editingCell === 'key_figure'}
          t={t}
        />
        {editingCell !== 'key_figure' && (
          <button onClick={() => setEditingCell('key_figure')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.key_figure_multiplier}
          onSave={(val) => handleSave('key_figure_multiplier', parseFloat(val))}
          onCancel={() => setEditingCell(null)}
          type="number"
          isMultiplier={true}
          isActive={editingCell === 'key_figure_multiplier'}
          t={t}
        />
        {editingCell !== 'key_figure_multiplier' && (
          <button onClick={() => setEditingCell('key_figure_multiplier')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.default_quantity}
          onSave={(val) => handleSave('default_quantity', parseInt(val) || 0)}
          onCancel={() => setEditingCell(null)}
          type="number"
          isWholeNumber={true}
          isActive={editingCell === 'default_quantity'}
          t={t}
        />
        {editingCell !== 'default_quantity' && (
          <button onClick={() => setEditingCell('default_quantity')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      {/* New Staffel Checkbox Column */}
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.has_staffel}
          onSave={(val) => handleSave('has_staffel', val)}
          onCancel={() => setEditingCell(null)}
          type="boolean"
          isActive={editingCell === 'has_staffel'}
          t={t}
        />
        {editingCell !== 'has_staffel' && (
          <button onClick={() => setEditingCell('has_staffel')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      {/* End New Staffel Checkbox Column */}
      <td className="py-2 px-3 align-top" style={{position: 'relative'}}>
        <EditableCell
          value={product.is_active}
          onSave={(val) => handleSave('is_active', val)}
          onCancel={() => setEditingCell(null)}
          type="boolean"
          isActive={editingCell === 'is_active'}
          t={t}
        />
        {editingCell !== 'is_active' && (
          <button onClick={() => setEditingCell('is_active')} className="absolute inset-0 w-full h-full text-left p-0 m-0 opacity-0 cursor-pointer"></button>
        )}
      </td>
      <td className="py-2 px-3 align-top">
        {!isNew && (
          <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-500 hover:text-red-500" onClick={() => onArchive(product)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </td>
    </tr>
  );
};

const CategorySection = React.forwardRef(({ category, products, onProductUpdate, onProductCreate, onCategorySettingChange, calculationType, onMoveProduct, dragHandleProps, draggableProps, innerRef, isDragging, t, onArchive }, ref) => {
  const [showNewRow, setShowNewRow] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    category: category.value,
    hardware_group: 'none', // New field
    default_price: 0,
    unit_type: ['ticketing_ecommerce_fees', 'visitor_fees'].includes(category.value) ? 'transaction' : 'piece', // Adjusted unit_type logic
    cost_basis: 0,
    percentage_fee: 0,
    percentage_cost_basis: 0,
    key_figure: 'none', // New field
    key_figure_multiplier: 0, // New field
    default_quantity: 0, // Added default_quantity
    has_staffel: false, // Added has_staffel
    is_active: true,
    display_order: 0
  });
  const [archivingProduct, setArchivingProduct] = useState(null);

  const showPercentageFee = ['transaction_processing', 'ticketing_ecommerce_fees', 'visitor_fees'].includes(category.value); // Adjusted showPercentageFee logic
  const activeProducts = products.filter(product => product && product.is_active !== false).sort((a,b) => (a?.display_order || 0) - (b?.display_order || 0));

  const handleAddNew = () => {
    setShowNewRow(true);
    setNewProduct(prev => ({ 
      ...prev, 
      category: category.value, 
      display_order: activeProducts.length,
      hardware_group: 'none', // Ensure new product has default hardware_group
      unit_type: ['ticketing_ecommerce_fees', 'visitor_fees'].includes(category.value) ? 'transaction' : 'piece', // Adjusted unit_type logic
      percentage_cost_basis: 0,
      key_figure: 'none', // Ensure new product has default key_figure
      key_figure_multiplier: 0, // Ensure new product has default key_figure_multiplier
      default_quantity: 0, // Ensure new product has default_quantity
      has_staffel: false // Ensure new product has default has_staffel
    }));
  };

  const handleCreateProduct = async (_, productData) => {
    if (!productData.name) return;
    await onProductCreate(productData);
    setShowNewRow(false);
    setNewProduct({
      name: '',
      description: '',
      category: category.value,
      hardware_group: 'none', // Reset new product hardware_group
      default_price: 0,
      unit_type: ['ticketing_ecommerce_fees', 'visitor_fees'].includes(category.value) ? 'transaction' : 'piece', // Adjusted unit_type logic
      cost_basis: 0,
      percentage_fee: 0,
      percentage_cost_basis: 0,
      key_figure: 'none', // Reset new product key_figure
      key_figure_multiplier: 0, // Reset new product key_figure_multiplier
      default_quantity: 0, // Reset new product default_quantity
      has_staffel: false, // Reset new product has_staffel
      is_active: true,
      display_order: 0
    });
  };
  
  const handleConfirmArchive = async () => {
    if (!archivingProduct) return;
    await onProductUpdate(archivingProduct.id, { is_active: false });
    setArchivingProduct(null);
  };
  
  const handleToggle = (isChecked) => {
    const newCalcType = isChecked ? 'post_event' : 'standard';
    onCategorySettingChange(category.value, newCalcType);
  }

  return (
    <div ref={innerRef} {...draggableProps}>
      <Card className={`shadow-md border-0 mb-6 transition-all duration-200 ${isDragging ? 'shadow-xl bg-blue-50 scale-105' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div {...dragHandleProps} className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-gray-100 transition-colors">
                <GripVertical className={`w-5 h-5 transition-colors ${isDragging ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} />
              </div>
              <CardTitle className="text-lg font-semibold text-gray-800">{category.label}</CardTitle>
            </div>
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Label htmlFor={`calc-toggle-${category.value}`} className="text-sm font-normal text-gray-600">
                        {t('Post-Event Calculation')}
                    </Label>
                    <Switch
                        id={`calc-toggle-${category.value}`}
                        checked={calculationType === 'post_event'}
                        onCheckedChange={handleToggle}
                    />
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => onArchive(category)}>
                    <Trash2 className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-500">{activeProducts.length} {t('products')}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-[40px]"></th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Product Name')}</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Description')}</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Hardware Group')}</th> {/* Added Hardware Group Header */}
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Default Price')}</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Unit Type')}</th>
                  {showPercentageFee && (
                    <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('% Fee')}</th>
                  )}
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Cost Basis')}</th>
                  {showPercentageFee && (
                    <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('% Cost Basis')}</th>
                  )}
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Key Figure')}</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Multiplier')}</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Default Value')}</th>
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Staffel')}</th> {/* New Staffel Header */}
                  <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm">{t('Active')}</th>
                  <th className="w-[60px]"></th>
                </tr>
              </thead>
                <tbody>
                    {activeProducts.map((product, index) => (
                        <ProductRow 
                            key={product.id}
                            product={product}
                            onUpdate={onProductUpdate}
                            onArchive={setArchivingProduct}
                            category={category.value}
                            t={t}
                            onMove={(direction) => onMoveProduct(index, direction)}
                            isFirst={index === 0}
                            isLast={index === activeProducts.length - 1}
                        />
                    ))}
                    {showNewRow && (
                        <ProductRow 
                            product={newProduct}
                            onUpdate={handleCreateProduct}
                            onArchive={() => {}}
                            isNew={true}
                            category={category.value}
                            t={t}
                        />
                    )}
                </tbody>
            </table>
          </div>
          
          <div className="border-t bg-gray-50 p-3">
            <Button 
              onClick={handleAddNew}
              variant="outline"
              className="flex items-center gap-2 text-sm h-8"
              disabled={showNewRow}
            >
              <Plus className="w-4 h-4" />
              {t('Add')} {category.label} {t('Product')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AnimatePresence>
        {archivingProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setArchivingProduct(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-0 text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      {t('Archive Product')}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        {t('Are you sure you want to archive')} "{archivingProduct.name}"? {t('This will make it inactive and it cannot be added to new offers.')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleConfirmArchive}
                >
                  {t('Confirm Archive')}
                </Button>
                <Button
                  variant="outline"
                  className="mr-3"
                  onClick={() => setArchivingProduct(null)}
                >
                  {t('Cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default function ProductTable({ products = [], categorySettings = [], isLoading, onProductUpdate, onProductCreate, onOrderChange, onCategorySettingChange, onCategoryOrderChange, onCategoryArchive }) {
  const { t } = useLocalization();
  
  const unitTypes = [
    { value: "piece", label: t("Per Piece") },
    { value: "day", label: t("Per Day") },
    { value: "week", label: t("Per Week") },
    { value: "month", label: t("Per Month") },
    { value: "hour", label: t("Per Hour") },
    { value: "percentage", label: t("Percentage") },
    { value: "transaction", label: t("Transaction") },
    { value: "per_transaction", label: t("Per Transaction") },
    { value: "euro_amount", label: t("Euro Amount") },
    { value: "percentage_of_revenue", label: t("Percentage of Revenue") }
  ];

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [archivingCategory, setArchivingCategory] = useState(null);

  const handleMoveProduct = (categoryValue, currentIndex, direction) => {
    const categoryProducts = products
      .filter(p => {
        if (!p) return false;
        // This logic seems overly complex, let's simplify to match the entity definition
        return p.category === categoryValue && p.is_active !== false;
      })
      .sort((a, b) => (a?.display_order || 0) - (b?.display_order || 0));

    if ((direction === 'up' && currentIndex === 0) || (direction === 'down' && currentIndex === categoryProducts.length - 1)) {
      return;
    }

    const productToMove = categoryProducts[currentIndex];
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const targetProduct = categoryProducts[targetIndex];

    // Swap the display_order values of only the two affected products.
    // This prevents sending updates for the entire list.
    const updates = [
      { id: productToMove.id, display_order: targetProduct.display_order },
      { id: targetProduct.id, display_order: productToMove.display_order }
    ];
    
    onOrderChange(updates);
  };

  const handleDragEnd = (result) => {
    const { destination, source, type } = result;

    if (!destination || (destination.droppableId === source.droppableId && destination.index === source.index)) {
      return;
    }

    if (type === "CATEGORY") {
      const newOrder = Array.from(orderedCategories);
      const [movedCategory] = newOrder.splice(source.index, 1);
      newOrder.splice(destination.index, 0, movedCategory);
      
      const updatedCategoryOrders = newOrder.map((cat, index) => ({
        category: cat.value,
        display_order: index,
        calculation_type: categorySettings.find(s => s.category === cat.value)?.calculation_type || 'standard'
      }));
      onCategoryOrderChange(updatedCategoryOrders);
    }
  };
  
  const handleConfirmCategoryArchive = async () => {
    if (!archivingCategory) return;
    await onCategoryArchive(archivingCategory.value);
    setArchivingCategory(null);
  };

  const getOrderedCategories = () => {
    if (!products || products.length === 0) return [];
    
    // Get list of archived categories
    const archivedCategorySet = new Set(
      (categorySettings || []).filter(s => s.is_archived).map(s => s.category)
    );

    // Dynamically generate categories from products, excluding archived ones
    const existingCategories = [...new Set(
        products
            .map(p => p.category)
            .filter(cat => cat && !archivedCategorySet.has(cat))
    )];
    
    const categoryMap = new Map(
      existingCategories.map(cat => [cat, {
        value: cat,
        label: t(cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())),
        display_order: Infinity,
      }])
    );
    
    // Use categorySettings for ordering (non-archived settings)
    if (categorySettings && categorySettings.length > 0) {
      categorySettings.forEach(setting => {
        if (categoryMap.has(setting.category) && !setting.is_archived) {
          categoryMap.get(setting.category).display_order = setting.display_order;
        }
      });
    }

    const sortedCategories = Array.from(categoryMap.values()).sort((a, b) => a.display_order - b.display_order);
    
    return sortedCategories;
  };

  const orderedCategories = getOrderedCategories() || [];

  const productsByCategory = orderedCategories.map(category => ({
    ...category,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="shadow-md border-0 mb-6">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-6 h-6 rounded-md" />
                  <Skeleton className="w-48 h-6 rounded-md" />
                </div>
                <div className="flex items-center gap-4">
                  <Skeleton className="w-40 h-6 rounded-md" />
                  <Skeleton className="w-24 h-6 rounded-md" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="w-[40px]"></th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th> {/* Hardware Group Skeleton */}
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th>
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th> {/* % Cost Basis or similar */}
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th> {/* Key Figure */}
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th> {/* Multiplier */}
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th> {/* Default Value */}
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th> {/* Staffel Skeleton */}
                      <th className="text-left py-3 px-3 font-medium text-gray-600 text-sm"><Skeleton className="w-24 h-4" /></th>
                      <th className="w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...Array(2)].map((_, j) => (
                      <tr key={j} className="border-b">
                        <td className="py-2 px-3"><Skeleton className="w-4 h-4" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-32 h-6" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-48 h-6" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-24 h-6" /></td> {/* Hardware Group Skeleton */}
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-24 h-6" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td> {/* % Cost Basis or similar */}
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td> {/* Key Figure */}
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td> {/* Multiplier */}
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td> {/* Default Value */}
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td> {/* Staffel Skeleton */}
                        <td className="py-2 px-3"><Skeleton className="w-20 h-6" /></td>
                        <td className="py-2 px-3"><Skeleton className="w-8 h-8" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t bg-gray-50 p-3">
                <Skeleton className="w-32 h-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories" type="CATEGORY">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-6">
                {(Array.isArray(productsByCategory) ? productsByCategory : []).map((category, index) => {
                  if (!category) return null;
                  
                  const setting = (Array.isArray(categorySettings) ? categorySettings : []).find(s => s?.category === category.value);
                  const calculationType = setting ? setting.calculation_type : 'standard';
                  
                  const currentCategoryProducts = (Array.isArray(products) ? products : []).filter(p => {
                    if (!p) return false;
                    return p.category === category.value;
                  });
                  
                  return (
                    <Draggable key={category.value} draggableId={category.value} index={index}>
                      {(provided, snapshot) => (
                        <CategorySection
                          category={category}
                          products={currentCategoryProducts}
                          onProductUpdate={onProductUpdate}
                          onProductCreate={onProductCreate}
                          onCategorySettingChange={onCategorySettingChange}
                          onMoveProduct={(idx, dir) => handleMoveProduct(category.value, idx, dir)}
                          calculationType={calculationType}
                          dragHandleProps={provided.dragHandleProps}
                          draggableProps={provided.draggableProps}
                          innerRef={provided.innerRef}
                          isDragging={snapshot.isDragging}
                          t={t}
                          onArchive={setArchivingCategory}
                        />
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
      </DragDropContext>

      <AnimatePresence>
        {archivingCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={() => setArchivingCategory(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: -20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-lg shadow-xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-0 text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Archive Category
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to archive "{archivingCategory.label}"? All products in this category will also be archived.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse rounded-b-lg">
                <Button
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleConfirmCategoryArchive}
                >
                  {t('Confirm Archive')}
                </Button>
                <Button
                  variant="outline"
                  className="mr-3"
                  onClick={() => setArchivingCategory(null)}
                >
                  {t('Cancel')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
