
import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function DocumentLine({
  line,
  index,
  products,
  onLineChange,
  onRemoveLine,
  showRemoveButton,
  isStandardSection,
  isReview = false,
  staffel = 1,
  hasStaffelProducts = false
}) {
  const [isEditing, setIsEditing] = useState({
    description: false,
    quantity: false,
    unit_price: false
  });

  if (!line) return null;

  const product = products.find((p) => p.id === line.product_id);
  const isDiscountCategory = product?.category === 'discounts';
  const hasStaffel = product?.has_staffel;
  const effectiveQuantity = hasStaffel ? (line.quantity || 0) * staffel : line.quantity || 0;
  const lineTotal = effectiveQuantity * (line.unit_price || 0);
  const lineCost = effectiveQuantity * (product?.cost_basis || 0);
  const lineProfit = lineTotal - lineCost;

  const handleFieldChange = (field, value) => {
    onLineChange(field, value);
  };

  const toggleEdit = (field, state) => {
    setIsEditing((prev) => ({ ...prev, [field]: state }));
  };

  const renderEditableField = (field, value, type = "number") => {
    if (isEditing[field] && !isReview) {
      return (
        <Input
          type={type}
          value={value || ''}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          onBlur={() => toggleEdit(field, false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') toggleEdit(field, false);
          }}
          className="h-8 text-right text-sm px-2"
          autoFocus
          step={type === 'number' ? '0.01' : undefined}
        />
      );
    }
    return (
      <div className="text-right">
        <span
          onClick={() => !isReview && toggleEdit(field, true)}
          className={`w-full block text-right px-2 py-1 rounded ${!isReview ? 'cursor-pointer hover:bg-gray-100' : ''}`}
        >
          {type === 'number' 
            ? `€${(value || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}` 
            : value
          }
        </span>
        {field === 'unit_price' && hasStaffel && staffel !== 1 && (
          <span className="text-[8px] text-gray-400 px-2 whitespace-nowrap">
            €{((value || 0) * staffel).toLocaleString('nl-NL', { minimumFractionDigits: 2 })} (inc staffel)
          </span>
        )}
      </div>
    );
  };

  const renderEditableQuantity = (field, value) => {
    if (isEditing[field] && !isReview) {
      return (
        <Input
          type="number"
          value={value || ''}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          onBlur={() => toggleEdit(field, false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') toggleEdit(field, false);
          }}
          className="h-8 text-right text-sm px-2"
          autoFocus
          min={isDiscountCategory ? undefined : "0"}
        />
      );
    }
    return (
      <span
        onClick={() => !isReview && toggleEdit(field, true)}
        className={`w-full block text-right px-2 py-1 rounded ${!isReview ? 'cursor-pointer hover:bg-gray-100' : ''}`}>

                {value}
            </span>);

  };

  if (isReview) {
    return (
      <tr className="group border-b border-gray-100 hover:bg-gray-50 last:border-0 relative">
        <td className="py-2 px-3">
          <p className="font-semibold text-gray-800">{line.product_name}</p>
          {line.description && (
            <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
              {line.description}
            </p>
          )}
        </td>
        <td className="py-2 px-3 w-24 align-top text-right">
          {line.quantity}
        </td>
        {hasStaffelProducts && (
          <td className="py-2 px-3 w-20 align-top text-right">
            {hasStaffel ? (
              <span className="text-sm font-medium text-gray-600">
                {staffel.toFixed(2)}x
              </span>
            ) : (
              <span className="text-sm text-gray-400">-</span>
            )}
          </td>
        )}
        <td className="py-2 px-3 w-36 align-top text-right">
          €{(line.unit_price || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          {hasStaffel && staffel !== 1 && (
            <span className="block text-[8px] text-gray-400 whitespace-nowrap">
              €{((line.unit_price || 0) * staffel).toLocaleString('nl-NL', { minimumFractionDigits: 2 })} (inc staffel)
            </span>
          )}
        </td>
        <td className="py-2 px-3 w-32 align-top text-right font-semibold text-gray-800">
          €{lineTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
        </td>
      </tr>
    );
  }

  // rowContent is used for the editable/draggable view
  const rowContent = (
    <tr className="group border-b border-gray-100 hover:bg-gray-50 last:border-0 relative">
      <td className="py-2 px-1 text-center text-gray-400 cursor-grab">
        <GripVertical className="w-4 h-4 inline" />
      </td>
      <td className="py-2 px-3">
        <p className="font-semibold text-gray-800">{line.product_name}</p>
        {isEditing.description ? (
          <Textarea
            value={line.description || ''}
            onChange={(e) => handleFieldChange('description', e.target.value)}
            onBlur={() => toggleEdit('description', false)}
            className="text-xs text-gray-500 mt-1 h-20"
            autoFocus
          />
        ) : (
          <p 
            onClick={() => toggleEdit('description', true)}
            className="text-xs text-gray-500 mt-1 whitespace-pre-wrap cursor-pointer"
          >
            {line.description || ' '}
          </p>
        )}
      </td>
      <td className="py-2 px-3 w-24 align-top">
        {renderEditableQuantity('quantity', line.quantity)}
      </td>
      {hasStaffelProducts && (
        <td className="py-2 px-3 w-20 align-top text-right">
          {hasStaffel ? (
            <span className="text-gray-600 text-sm font-medium">
              {staffel.toFixed(2)}x
            </span>
          ) : (
            <span className="text-sm text-gray-400">-</span>
          )}
        </td>
      )}
      <td className="py-2 px-3 w-36 align-top">
        {renderEditableField('unit_price', line.unit_price)}
      </td>
      <td className="py-2 px-3 w-32 align-top text-right font-semibold text-gray-800">
        €{lineTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
      </td>
      {showRemoveButton && (
        <td className="py-2 px-2 w-12 align-top">
          <button 
            onClick={onRemoveLine} 
            className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </td>
      )}
      {isStandardSection && line.quantity > 0 && (
        <td className="absolute left-[calc(100%+100px)] top-0 h-full flex items-center py-2 text-sm">
          <div className="font-semibold text-green-700">
            €{lineProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </div>
        </td>
      )}
    </tr>
  );
  
  return (
    <Draggable draggableId={`${line.product_id}-${index}`} index={index}>
      {(provided, snapshot) => (
        <tr 
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`group border-b border-gray-100 hover:bg-gray-50 last:border-0 relative ${snapshot.isDragging ? 'bg-blue-50 shadow-lg' : ''}`}
          style={{
            ...provided.draggableProps.style,
          }}
        >
          {/* Render the content defined in rowContent within the draggable */}
          <td className="py-2 px-1 text-center text-gray-400 cursor-grab">
            <GripVertical className="w-4 h-4 inline" />
          </td>
          <td className="py-2 px-3">
            <p className="font-semibold text-gray-800">{line.product_name}</p>
            {isEditing.description ? (
              <Textarea
                value={line.description || ''}
                onChange={(e) => handleFieldChange('description', e.target.value)}
                onBlur={() => toggleEdit('description', false)}
                className="text-xs text-gray-500 mt-1 h-20"
                autoFocus
              />
            ) : (
              <p 
                onClick={() => toggleEdit('description', true)}
                className="text-xs text-gray-500 mt-1 whitespace-pre-wrap cursor-pointer"
              >
                {line.description || ' '}
              </p>
            )}
          </td>
          <td className="py-2 px-3 w-24 align-top">
            {renderEditableQuantity('quantity', line.quantity)}
          </td>
          {hasStaffelProducts && (
            <td className="py-2 px-3 w-20 align-top text-right">
              {hasStaffel ? (
                <span className="text-gray-600 text-sm font-medium">
                  {staffel.toFixed(2)}x
                </span>
              ) : (
                <span className="text-sm text-gray-400">-</span>
              )}
            </td>
          )}
          <td className="py-2 px-3 w-36 align-top">
            {renderEditableField('unit_price', line.unit_price)}
          </td>
          <td className="py-2 px-3 w-32 align-top text-right font-semibold text-gray-800">
            €{lineTotal.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
          </td>
          {showRemoveButton && (
            <td className="py-2 px-2 w-12 align-top">
              <button 
                onClick={onRemoveLine} 
                className="text-red-500 hover:text-red-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </td>
          )}
          {isStandardSection && line.quantity > 0 && (
            <td className="absolute left-[calc(100%+100px)] top-0 h-full flex items-center py-2 text-sm">
              <div className="font-semibold text-green-700">
                €{lineProfit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
              </div>
            </td>
          )}
        </tr>
      )}
    </Draggable>
  );
}
