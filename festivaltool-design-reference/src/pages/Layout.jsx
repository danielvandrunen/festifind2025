
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  LayoutDashboard,
  Package,
  FileText,
  FolderOpen,
  Calendar,
  Users,
  BarChart3,
  Languages,
  User,
  LogOut,
  Settings,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Briefcase,
  DollarSign,
  ClipboardList,
  Wrench,
  ExternalLink
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { LocalizationProvider, useLocalization } from "./components/Localization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { base44 } from "@/api/base44Client";

const AppLayout = ({ children, currentPageName }) => {
const { t, setAppLanguage, language } = useLocalization();
const location = useLocation();
const [user, setUser] = React.useState(null);
const [recentOffers, setRecentOffers] = React.useState([]);
const [recentProjects, setRecentProjects] = React.useState([]);

// Load collapsed state from localStorage
const [collapsedGroups, setCollapsedGroups] = React.useState(() => {
  try {
    const stored = localStorage.getItem('sidebar-collapsed-groups');
    return stored ? JSON.parse(stored) : { sales: false, operations: false, finance: false };
  } catch {
    return { sales: false, operations: false, finance: false };
  }
});

  // Save collapsed state to localStorage
  const toggleGroup = (groupName) => {
    setCollapsedGroups(prev => {
      const updated = { ...prev, [groupName]: !prev[groupName] };
      localStorage.setItem('sidebar-collapsed-groups', JSON.stringify(updated));
      return updated;
    });
  };

  React.useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Failed to load user:", error);
      }
    };
    
    const loadRecentData = async () => {
      try {
        const [offersData, projectsData] = await Promise.all([
          base44.entities.Offer.list('-updated_date', 3),
          base44.entities.Project.list('-updated_date', 3)
        ]);
        setRecentOffers(offersData || []);
        setRecentProjects(projectsData?.filter(p => p.status !== 'archived') || []);
      } catch (error) {
        console.error("Failed to load recent data:", error);
      }
    };
    
    // Only load user for authenticated pages
    if (currentPageName !== "OfferReview" && currentPageName !== "ClientPortal" && currentPageName !== "crew" && currentPageName !== "EmployeePortal") {
      loadUser();
      loadRecentData();
    }
  }, [currentPageName]);

  const navigationGroups = [
    {
      name: 'sales',
      label: 'Sales',
      icon: TrendingUp,
      items: [
        { title: t("Offers"), url: createPageUrl("Offers"), icon: FileText },
        { title: t("Clients"), url: createPageUrl("Clients"), icon: Users },
        { title: t("Products"), url: createPageUrl("Products"), icon: Package },
        { title: "Multi-offerte", url: createPageUrl("BatchOfferCreator"), icon: FileText },
        { title: "Sales Tracker", url: createPageUrl("SalesTracker"), icon: BarChart3 },
      ]
    },
    {
      name: 'operations',
      label: 'Operations',
      icon: Briefcase,
      items: [
        { title: t("Projects"), url: createPageUrl("Projects"), icon: FolderOpen },
        { title: t("Resources"), url: createPageUrl("Resources"), icon: Calendar },
        { title: "Roosters", url: createPageUrl("Roosters"), icon: ClipboardList },
        { title: "Personeel", url: createPageUrl("Staff"), icon: Users },
        { title: t("Taken"), url: createPageUrl("TaskTemplates"), icon: Calendar },
        { title: "Pakbon Instellingen", url: createPageUrl("PakbonSettings"), icon: Settings },
      ]
    },
    {
      name: 'finance',
      label: 'Finance',
      icon: DollarSign,
      items: [
        { title: "Invoice Inbox", url: createPageUrl("InvoiceInbox"), icon: FileText },
        { title: "Team", url: createPageUrl("TeamMembers"), icon: User },
        { title: "Repair Projects", url: createPageUrl("RepairProjects"), icon: Wrench },
        { title: "Debug", url: createPageUrl("Debug"), icon: Settings },
      ]
    }
  ];

  const handleSignOut = () => {
    base44.auth.logout();
  };

  if (currentPageName === "OfferReview" || currentPageName === "ClientPortal" || currentPageName === "crew" || currentPageName === "EmployeePortal") {
    return children;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gray-50">
        <Sidebar className="border-r border-gray-200">
          <SidebarHeader className="border-b border-gray-200 p-6">
            <div className="flex items-center gap-3">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68b82e06e82c328f0770844d/ac2112737_Bluenewlogologoonly.png" alt="Fastlane Logo" className="w-10 h-10" />
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Fastlane</h2>
                <p className="text-xs text-gray-500">{t('Management Platform')}</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            {/* Dashboard - Always visible at top */}
            <SidebarGroup className="mb-2">
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      asChild 
                      className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                        location.pathname === createPageUrl("Dashboard") ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                      }`}
                    >
                      <Link to={createPageUrl("Dashboard")} className="flex items-center gap-3 px-3 py-3">
                        <LayoutDashboard className="w-5 h-5" />
                        <span className="font-medium">{t("Dashboard")}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Grouped Navigation */}
            {navigationGroups.map((group) => (
              <SidebarGroup key={group.name} className="mb-2">
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <group.icon className="w-4 h-4" />
                    <span>{group.label}</span>
                  </div>
                  {collapsedGroups[group.name] ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {!collapsedGroups[group.name] && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton 
                            asChild 
                            className={`hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 rounded-lg mb-1 ${
                              location.pathname === item.url ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                            }`}
                          >
                            <Link to={item.url} className="flex items-center gap-3 px-3 py-2">
                              <item.icon className="w-4 h-4" />
                              <span className="font-medium text-sm">{item.title}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
                
                {/* Recent items for specific groups */}
                {group.name === 'sales' && !collapsedGroups[group.name] && recentOffers.length > 0 && (
                  <div className="px-3 mt-2 pt-2 border-t border-gray-200">
                    <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Recent</h5>
                    {recentOffers.map((offer) => (
                      <a
                        key={offer.id}
                        href={createPageUrl(`OfferEditor?id=${offer.id}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors group mb-1"
                      >
                        <span className="flex-1 truncate">{offer.project_name}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
                
                {group.name === 'operations' && !collapsedGroups[group.name] && recentProjects.length > 0 && (
                  <div className="px-3 mt-2 pt-2 border-t border-gray-200">
                    <h5 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Recent</h5>
                    {recentProjects.map((project) => (
                      <a
                        key={project.id}
                        href={createPageUrl(`ProjectDetail?id=${project.id}`)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors group mb-1"
                      >
                        <span className="flex-1 truncate">{project.project_name}</span>
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t border-gray-200 p-4">
            {user && (
              <>
                <div className="mb-3">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" className="w-full justify-start gap-3 hover:bg-gray-100">
                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 text-left overflow-hidden">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {user.full_name || user.email}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="space-y-1">
                        <div className="px-3 py-2">
                          <p className="text-sm font-medium text-gray-900">{user.full_name || 'User'}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                          {user.role && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {user.role}
                            </Badge>
                          )}
                        </div>
                        <Separator />
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 text-gray-700"
                          onClick={() => {/* TODO: Navigate to account settings */}}
                        >
                          <Settings className="w-4 h-4" />
                          <span>{t('Account Settings')}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={handleSignOut}
                        >
                          <LogOut className="w-4 h-4" />
                          <span>{t('Sign Out')}</span>
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <Separator className="my-2" />
              </>
            )}
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Languages className="w-4 h-4"/>
                  <span>{t('Language')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1">
                <Button
                  variant={language === 'nl' ? 'secondary' : 'ghost'}
                  onClick={() => setAppLanguage('nl')}
                  className="w-full justify-start mb-1"
                >
                  {t('Dutch')}
                </Button>
                <Button
                  variant={language === 'en' ? 'secondary' : 'ghost'}
                  onClick={() => setAppLanguage('en')}
                  className="w-full justify-start"
                >
                  {t('English')}
                </Button>
              </PopoverContent>
            </Popover>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-gray-100 p-2 rounded-lg transition-colors duration-200" />
              <h1 className="text-xl font-semibold">Fastlane</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <LocalizationProvider>
      <AppLayout currentPageName={currentPageName}>
        {children}
      </AppLayout>
    </LocalizationProvider>
  );
}
