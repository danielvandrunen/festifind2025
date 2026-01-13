import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  FileText, 
  CheckCircle, 
  TrendingUp,
  DollarSign
} from "lucide-react";
import { useLocalization } from "../../components/Localization";

export default function DashboardStats({ stats, isLoading }) {
  const { t } = useLocalization();
  
  const statCards = [
    {
      title: t("Open Offers"),
      value: stats.pendingOffers,
      icon: FileText,
      subtitle: t("Awaiting response"),
      color: "blue"
    },
    {
      title: t("Confirmed Projects"),
      value: stats.activeProjects,
      icon: CheckCircle,
      subtitle: t("Active projects"),
      color: "green"
    },
    {
      title: t("Confirmed Profit"),
      icon: DollarSign,
      subtitle: t("From signed offers"),
      color: "green",
      breakdown: {
        standard: stats.confirmedStandard,
        postCalc: stats.confirmedPostCalc,
        total: stats.confirmedTotal
      }
    },
    {
      title: t("Total Profit Pipeline"),
      icon: TrendingUp,
      subtitle: t("All open + confirmed offers"),
      color: "purple",
      breakdown: {
        standard: stats.potentialStandard,
        postCalc: stats.potentialPostCalc,
        total: stats.potentialTotal
      }
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {statCards.map((stat, index) => (
        <Card key={index} className="border border-gray-200 shadow-sm bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <stat.icon className={`w-4 h-4 ${
                stat.color === 'blue' ? 'text-blue-400' :
                stat.color === 'green' ? 'text-green-400' :
                stat.color === 'purple' ? 'text-purple-400' :
                'text-gray-400'
              }`} />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-4 w-32" />
              </>
            ) : stat.breakdown ? (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{t('Standard')}</span>
                    <span className="font-semibold text-gray-900">
                      €{stat.breakdown.standard.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">{t('Post-Event')}</span>
                    <span className="font-semibold text-gray-900">
                      €{stat.breakdown.postCalc.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="pt-2 mt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-700">{t('Total')}</span>
                      <span className={`text-xl font-bold ${
                        stat.color === 'green' ? 'text-green-600' :
                        stat.color === 'purple' ? 'text-purple-600' :
                        'text-gray-900'
                      }`}>
                        €{stat.breakdown.total.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">{stat.subtitle}</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-semibold text-gray-900 mb-1">
                  {stat.value}
                </div>
                <p className="text-xs text-gray-500">{stat.subtitle}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}