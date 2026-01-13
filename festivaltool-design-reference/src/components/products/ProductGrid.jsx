
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Package, Euro, TrendingUp, BarChart3, Wifi, Plus } from "lucide-react";

const categoryIcons = {
  hardware_rentals: Package,
  transaction_processing: Euro,
  ticketing_services: TrendingUp,
  business_intelligence: BarChart3,
  infrastructure: Wifi
};

const categoryColors = {
  hardware_rentals: "bg-blue-100 text-blue-800",
  transaction_processing: "bg-green-100 text-green-800", 
  ticketing_services: "bg-purple-100 text-purple-800",
  business_intelligence: "bg-orange-100 text-orange-800",
  infrastructure: "bg-indigo-100 text-indigo-800"
};

export default function ProductGrid({ products, isLoading, onEdit }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {products.length} Products
        </h2>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
          <p className="text-gray-500 mb-6">Start building your product catalog</p>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" />
            Add Your First Product
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => {
            const category = product.category || 'hardware_rentals'; // SAFEGUARD
            const CategoryIcon = categoryIcons[category] || Package;
            const categoryColorClass = categoryColors[category] || "bg-gray-100 text-gray-800";
            
            return (
              <Card key={product.id} className="hover:shadow-lg transition-shadow duration-200 border-0 shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${categoryColorClass} bg-opacity-20`}>
                        <CategoryIcon className={`w-5 h-5 ${categoryColorClass.replace('bg-', 'text-').replace('100', '600')}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-bold text-gray-900">
                          {product.name}
                        </CardTitle>
                        {product.subcategory && (
                          <p className="text-sm text-gray-500">{product.subcategory}</p>
                        )}
                      </div>
                    </div>
                    <Badge 
                      className={`${product.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {product.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Badge className={categoryColorClass}>
                      {category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                  </div>
                  
                  {product.description && (
                    <p className="text-sm text-gray-600 line-clamp-3">
                      {product.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Default Price</p>
                      <p className="font-semibold text-lg">€{product.default_price}</p>
                      <p className="text-xs text-gray-400">per {product.unit_type}</p>
                    </div>
                    {product.cost_basis > 0 && (
                      <div>
                        <p className="text-gray-500">Margin</p>
                        <p className="font-semibold text-green-600">
                          {Math.round(((product.default_price - product.cost_basis) / product.default_price) * 100)}%
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(product)}
                      className="flex items-center gap-2"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
