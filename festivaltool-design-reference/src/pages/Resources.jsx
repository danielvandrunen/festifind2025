import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import HardwareCapacitySettings from "../components/resources/HardwareCapacitySettings";
import ProjectPlanningTimeline from "../components/resources/ProjectPlanningTimeline";

export default function ResourcesPage() {
  const { t } = useLocalization();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null, error: null });
  const [activeTab, setActiveTab] = useState("planning");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { isAuthorized, user, error } = await checkUserAuthorization();
        
        if (error === 'not_authenticated') {
          window.location.href = '/login';
          return;
        }
        
        setAuthState({ checking: false, authorized: isAuthorized, user, error });
      } catch (error) {
        console.error('Auth check failed:', error);
        setAuthState({ checking: false, authorized: false, user: null, error: 'check_failed' });
      }
    };
    checkAuth();
  }, []);

  if (authState.checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-600">
        {t('Loading...')}
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} error={authState.error} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-[1800px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Resources</h1>
          <p className="text-gray-600 mt-1">Manage hardware capacity and view project planning</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="planning">Project Planning</TabsTrigger>
            <TabsTrigger value="capacity">Hardware Capacity</TabsTrigger>
          </TabsList>

          <TabsContent value="planning">
            <ProjectPlanningTimeline />
          </TabsContent>

          <TabsContent value="capacity">
            <HardwareCapacitySettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}