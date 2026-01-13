
import React, { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Edit, Eye, Mail, Phone, TrendingUp, Euro, Calendar } from "lucide-react";
import { format } from "date-fns";
import { useLocalization } from "../Localization";

const statusColors = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-yellow-100 text-yellow-800",
  archived: "bg-gray-100 text-gray-800",
};

export default function ClientTable({ clients, projects, offers, products, isLoading, onEdit, onViewDetails }) {
  const { t } = useLocalization();

  // Calculate metrics for each client
  const clientMetrics = useMemo(() => {
    const metrics = new Map();
    
    // Helper function to calculate offer profit
    const calculateOfferProfit = (offer) => {
      if (!offer.offer_lines || !Array.isArray(offer.offer_lines)) return 0;
      
      let totalProfit = 0;
      offer.offer_lines.forEach(line => {
        const product = products.find(p => p.id === line.product_id);
        if (!product) return; // Skip if product not found
        
        const quantity = parseFloat(line.quantity || 0);
        const unit_price = parseFloat(line.unit_price || 0);
        const cost_basis = parseFloat(product.cost_basis || 0);

        const revenue = quantity * unit_price;
        const cost = quantity * cost_basis;
        totalProfit += (revenue - cost);
      });
      
      return totalProfit;
    };
    
    clients.forEach(client => {
      const clientProjects = projects.filter(p => p.client_id === client.id);
      const clientOffers = offers.filter(o => o.client_id === client.id && o.status !== 'archived');
      
      // Separate into open and signed offers
      const openOffers = clientOffers.filter(o => ['draft', 'sent', 'under_review'].includes(o.status));
      // An offer is considered signed if its status is 'confirmed' OR it has a 'signed_date'
      const signedOffers = clientOffers.filter(o => o.status === 'confirmed' || o.signed_date);
      
      // Calculate profit for open offers
      const openOffersProfit = openOffers.reduce((sum, offer) => sum + calculateOfferProfit(offer), 0);
      
      // Calculate profit for signed offers
      const signedOffersProfit = signedOffers.reduce((sum, offer) => sum + calculateOfferProfit(offer), 0);
      
      const totalRevenue = clientProjects.reduce((sum, p) => sum + (p.confirmed_revenue || 0), 0);
      const totalProfit = clientProjects.reduce((sum, p) => sum + (p.estimated_profit || 0), 0);
      const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const lastProject = clientProjects.length > 0 
        ? clientProjects.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0]
        : null;
      
      metrics.set(client.id, {
        totalProjects: clientProjects.length,
        activeProjects: clientProjects.filter(p => ['planning', 'active'].includes(p.status)).length,
        totalRevenue,
        totalProfit,
        avgMargin,
        pendingOffers: openOffers.length,
        pendingOffersProfit: openOffersProfit,
        signedOffers: signedOffers.length,
        signedOffersProfit: signedOffersProfit,
        lastProjectDate: lastProject?.start_date
      });
    });
    
    return metrics;
  }, [clients, projects, offers, products]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="p-4 border-b">
            <Skeleton className="h-6 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border p-12 text-center">
        <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{t('No clients found.')}</h3>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            <TableHead className="font-semibold">{t('Company')}</TableHead>
            <TableHead className="font-semibold">{t('Primary Contact')}</TableHead>
            <TableHead className="font-semibold">{t('Contact Info')}</TableHead>
            <TableHead className="font-semibold text-center">{t('Projects')}</TableHead>
            <TableHead className="font-semibold text-center">{t('Active')}</TableHead>
            <TableHead className="font-semibold text-center">{t('Pending Offers')}</TableHead>
            <TableHead className="font-semibold text-center">{t('Signed Offers')}</TableHead>
            <TableHead className="font-semibold text-right">{t('Total Revenue')}</TableHead>
            <TableHead className="font-semibold text-right">{t('Total Profit')}</TableHead>
            <TableHead className="font-semibold text-right">{t('Avg Margin')}</TableHead>
            <TableHead className="font-semibold">{t('Last Project')}</TableHead>
            <TableHead className="font-semibold text-center">{t('Status')}</TableHead>
            <TableHead className="font-semibold text-center">{t('Actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => {
            const metrics = clientMetrics.get(client.id) || {
              totalProjects: 0,
              activeProjects: 0,
              totalRevenue: 0,
              totalProfit: 0,
              avgMargin: 0,
              pendingOffers: 0,
              pendingOffersProfit: 0,
              signedOffers: 0,
              signedOffersProfit: 0,
              lastProjectDate: null
            };

            return (
              <TableRow key={client.id} className="hover:bg-gray-50">
                <TableCell>
                  <button
                    onClick={() => onViewDetails(client)}
                    className="font-semibold text-blue-600 hover:text-blue-800 text-left"
                  >
                    {client.company_name}
                  </button>
                  {client.vat_number && (
                    <div className="text-xs text-gray-500 mt-1">BTW: {client.vat_number}</div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm font-medium text-gray-900">{client.contact_person}</div>
                  {client.additional_contacts && client.additional_contacts.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      +{client.additional_contacts.length} {t('more')}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Mail className="w-3 h-3" />
                      <span>{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Phone className="w-3 h-3" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <span className="font-semibold text-gray-900">{metrics.totalProjects}</span>
                </TableCell>
                <TableCell className="text-center">
                  {metrics.activeProjects > 0 ? (
                    <Badge className="bg-green-100 text-green-800">{metrics.activeProjects}</Badge>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {metrics.pendingOffers > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Badge className="bg-orange-100 text-orange-800">{metrics.pendingOffers}</Badge>
                      <span className="text-[10px] font-semibold text-orange-600">
                        €{metrics.pendingOffersProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {metrics.signedOffers > 0 ? (
                    <div className="flex flex-col items-center gap-0.5">
                      <Badge className="bg-green-100 text-green-800">{metrics.signedOffers}</Badge>
                      <span className="text-[10px] font-semibold text-green-600">
                        €{metrics.signedOffersProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 font-semibold text-gray-900">
                    <Euro className="w-3 h-3" />
                    <span>{metrics.totalRevenue.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 font-semibold text-green-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>€{metrics.totalProfit.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <span className={`font-semibold ${metrics.avgMargin >= 20 ? 'text-green-600' : metrics.avgMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {metrics.avgMargin.toFixed(1)}%
                  </span>
                </TableCell>
                <TableCell>
                  {metrics.lastProjectDate ? (
                    <div className="flex items-center gap-1 text-xs text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(metrics.lastProjectDate), 'dd/MM/yyyy')}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge className={statusColors[client.status]} variant="outline">
                    {client.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0"
                      onClick={() => onViewDetails(client)}
                    >
                      <Eye className="w-3 h-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-7 w-7 p-0"
                      onClick={() => onEdit(client)}
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
