import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { FileText, Users, Package } from "lucide-react";
import { useLocalization } from "../../components/Localization";

export default function QuickActions() {
  const { t } = useLocalization();

  const actions = [
    {
      title: t("New Offer"),
      url: createPageUrl("Offers?action=create"),
      icon: FileText,
      variant: "default",
      className: "bg-blue-600 hover:bg-blue-700"
    },
    {
      title: t("Add Client"),
      url: createPageUrl("Clients?action=create"),
      icon: Users,
      variant: "outline"
    },
    {
      title: t("Add Product"),
      url: createPageUrl("Products?action=create"),
      icon: Package,
      variant: "outline"
    }
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link key={action.title} to={action.url}>
          <Button 
            variant={action.variant}
            className={`flex items-center gap-2 ${action.className || ''}`}
          >
            <action.icon className="w-4 h-4" />
            {action.title}
          </Button>
        </Link>
      ))}
    </div>
  );
}