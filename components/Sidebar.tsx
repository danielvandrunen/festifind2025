'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, 
  Home, 
  BarChart, 
  Code, 
  Puzzle, 
  LogOut, 
  User,
  ChevronDown,
  ChevronRight,
  Settings,
  Wrench
} from 'lucide-react';
import { useAuth } from '../app/contexts/AuthContext';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface NavigationGroup {
  name: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: {
    title: string;
    url: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const AppSidebar = () => {
  const pathname = usePathname();
  const { user, signOut } = useAuth();

  // Load collapsed state from localStorage
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sidebar-collapsed-groups');
        return stored ? JSON.parse(stored) : { main: false, tools: false };
      } catch {
        return { main: false, tools: false };
      }
    }
    return { main: false, tools: false };
  });

  // Save collapsed state to localStorage
  const toggleGroup = (groupName: string) => {
    setCollapsedGroups(prev => {
      const updated = { ...prev, [groupName]: !prev[groupName] };
      if (typeof window !== 'undefined') {
        localStorage.setItem('sidebar-collapsed-groups', JSON.stringify(updated));
      }
      return updated;
    });
  };

  const navigationGroups: NavigationGroup[] = [
    {
      name: 'main',
      label: 'Festivals',
      icon: Calendar,
      items: [
        { title: 'Home', url: '/home', icon: Home },
        { title: 'Festivals', url: '/festivals', icon: Calendar },
        { title: 'Sales Monitor', url: '/sales-monitor', icon: BarChart },
      ]
    },
    {
      name: 'tools',
      label: 'Tools',
      icon: Wrench,
      items: [
        { title: 'Extension Feed', url: '/extension-feed', icon: Puzzle },
        { title: 'Dev Tools', url: '/dev-tools', icon: Code },
        { title: 'Settings', url: '/settings', icon: Settings },
      ]
    }
  ];

  const handleSignOut = () => {
    signOut();
  };

  return (
    <Sidebar className="border-r border-gray-200">
      <SidebarHeader className="border-b border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <img 
            src="/logo-new.png" 
            alt="FestiFind Logo" 
            className="w-10 h-10"
          />
          <div>
            <h2 className="font-bold text-gray-900 text-lg">FestiFind</h2>
            <p className="text-xs text-gray-500">Festival Discovery</p>
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
                    pathname === '/home' ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                  }`}
                >
                  <Link href="/home" className="flex items-center gap-3 px-3 py-3">
                    <Home className="w-5 h-5" />
                    <span className="font-medium">Home</span>
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
                          pathname === item.url ? 'bg-blue-50 text-blue-700 font-semibold' : ''
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-3 px-3 py-2">
                          <item.icon className="w-4 h-4" />
                          <span className="font-medium text-sm">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
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
                        {user.email}
                      </p>
                      <p className="text-xs text-gray-500 truncate">User Account</p>
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="end">
                  <div className="space-y-1">
                    <div className="px-3 py-2">
                      <p className="text-sm font-medium text-gray-900">Account</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Separator />
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-gray-700"
                      onClick={() => { /* Navigate to settings */ }}
                    >
                      <Settings className="w-4 h-4" />
                      <span>Settings</span>
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={handleSignOut}
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}
        
        {!user && (
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleSignOut}
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
