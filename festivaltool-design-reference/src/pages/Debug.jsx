import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Settings, Send, CheckCircle, XCircle, Calendar, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

export default function DebugPage() {
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [slackStatus, setSlackStatus] = useState({ loading: false, success: null, message: '' });
  const [calendarStatus, setCalendarStatus] = useState({ loading: false, success: null, message: '', details: null, needsAuth: false });

  React.useEffect(() => {
    const checkAuth = async () => {
      const { isAuthorized, user, error } = await checkUserAuthorization();
      
      if (error === 'not_authenticated') {
        window.location.href = '/login';
        return;
      }
      
      setAuthState({ checking: false, authorized: isAuthorized, user });
    };
    checkAuth();
  }, []);

  const testSlackNotification = async () => {
    setSlackStatus({ loading: true, success: null, message: '' });
    
    try {
      console.log('🧪 Testing Slack notification...');
      
      const testPayload = {
        offerData: {
          project_name: "TEST PROJECT - Debug Page",
          project_location: "Test Location",
          offer_number: "TEST-001",
          total_incl_btw: 15000
        },
        breakdown: {
          standardRevenue: 10000,
          standardProfit: 3000,
          postEventRevenue: 5000,
          postEventProfit: 2000,
          totalRevenue: 15000,
          totalProfit: 5000
        },
        companyName: "Test Client BV",
        signerName: "Test User",
        showdatesText: "01-06-2025, 02-06-2025",
        offerReviewUrl: `${window.location.origin}/OfferReview?id=test`
      };

      console.log('🧪 Calling backend function with test payload:', testPayload);
      
      const result = await base44.functions.invoke('sendSlackNotification', testPayload);
      
      console.log('🧪 Backend function result:', result);
      
      if (result.data.success) {
        setSlackStatus({
          loading: false,
          success: true,
          message: 'Slack notification sent successfully! Check your Slack channel.'
        });
      } else {
        setSlackStatus({
          loading: false,
          success: false,
          message: `Failed: ${result.data.error || 'Unknown error'}`
        });
      }
    } catch (error) {
      console.error('🧪 ❌ Error testing Slack notification:', error);
      setSlackStatus({
        loading: false,
        success: false,
        message: `Error: ${error.message}`
      });
    }
  };

  const syncAllProjectsToCalendar = async () => {
    setCalendarStatus({ loading: true, success: null, message: '', details: null });
    
    try {
      console.log('📅 Syncing all projects to Google Calendar...');
      
      const result = await base44.functions.invoke('syncProjectsToCalendar', {});
      
      console.log('📅 Calendar sync result:', result.data);
      
      if (result.data.success) {
        setCalendarStatus({
          loading: false,
          success: true,
          message: `Successfully synced ${result.data.synced} calendar events!`,
          details: result.data
        });
      } else {
        // Check if it's an authentication error
        const isAuthError = result.data.error?.includes('Cannot access calendar') || 
                           result.data.error?.includes('403');
        
        setCalendarStatus({
          loading: false,
          success: false,
          message: isAuthError 
            ? 'Geen toegang tot de calendar. Authenticeer met een @fastlane.events email.' 
            : (result.data.error || `Sync completed with ${result.data.errors?.length || 0} errors`),
          details: result.data,
          needsAuth: isAuthError
        });
      }
    } catch (error) {
      console.error('📅 ❌ Error syncing calendar:', error);
      
      // Check if it's a 403 error
      const isAuthError = error.message?.includes('403') || error.message?.includes('Forbidden');
      
      setCalendarStatus({
        loading: false,
        success: false,
        message: isAuthError
          ? 'Geen toegang tot de calendar. Authenticeer met een @fastlane.events email.'
          : `Error: ${error.message}`,
        details: null,
        needsAuth: isAuthError
      });
    }
  };



  if (authState.checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <p className="text-gray-700">Loading...</p>
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="w-8 h-8 text-blue-600" />
            Debug & Testing
          </h1>
          <p className="text-gray-600 mt-2">Test external integrations and system connections</p>
        </div>

        {/* Slack Integration Testing */}
        <Card className="shadow-lg border-0">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Slack Integration
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-gray-600">
              Test the Slack notification system by sending a test message to your configured Slack channel.
            </p>
            
            <Button
              onClick={testSlackNotification}
              disabled={slackStatus.loading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {slackStatus.loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending Test...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Test Notification
                </>
              )}
            </Button>

            {slackStatus.success !== null && (
              <Alert className={slackStatus.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <div className="flex items-start gap-3">
                  {slackStatus.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <AlertDescription className={slackStatus.success ? 'text-green-800' : 'text-red-800'}>
                    {slackStatus.message}
                  </AlertDescription>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Google Calendar Sync */}
        <Card className="shadow-lg border-0">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Google Calendar Sync
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-red-900 font-semibold mb-2">❌ OAuth is gedaan met verkeerd Google account</p>
              <p className="text-sm text-red-800 mb-3">
                De Google Calendar OAuth is geautoriseerd, maar met een account dat geen toegang heeft tot de Fastlane Office calendar.
              </p>
              <div className="bg-white rounded p-3 text-xs space-y-2">
                <p className="font-semibold text-gray-900">Oplossing:</p>
                <ol className="list-decimal ml-4 space-y-1 text-gray-700">
                  <li>Ga naar <strong>Base44 Dashboard → Code → Connectors</strong></li>
                  <li>Revoke de huidige Google Calendar connector</li>
                  <li>Autoriseer opnieuw, maar log in met <strong>killian@fastlane.events</strong>, <strong>daniel@fastlane.events</strong>, of <strong>julie@fastlane.events</strong></li>
                  <li>Kom terug en probeer opnieuw te syncen</li>
                </ol>
              </div>
            </div>
            
            <p className="text-gray-600">
              Synchroniseer alle bestaande projecten naar de Fastlane Office Google Calendar. 
              Elk project krijgt een calendar item per showdate (dag 1, dag 2, etc.).
            </p>
            
            <Button
              onClick={syncAllProjectsToCalendar}
              disabled={calendarStatus.loading}
              className="bg-green-600 hover:bg-green-700"
            >
              {calendarStatus.loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Sync All Projects to Calendar
                </>
              )}
            </Button>

            {calendarStatus.success !== null && (
              <Alert className={calendarStatus.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <div className="flex items-start gap-3">
                  {calendarStatus.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <AlertDescription className={calendarStatus.success ? 'text-green-800' : 'text-red-800'}>
                      {calendarStatus.message}
                    </AlertDescription>
                    
                    {calendarStatus.details && (
                      <div className="mt-3 text-xs space-y-1">
                        {calendarStatus.details.results && calendarStatus.details.results.length > 0 && (
                          <div className="bg-white rounded p-2 max-h-40 overflow-y-auto">
                            <p className="font-semibold mb-1">Synced events:</p>
                            {calendarStatus.details.results.slice(0, 10).map((r, idx) => (
                              <div key={idx} className="text-gray-700">
                                ✓ {r.project} - {r.date} ({r.action})
                              </div>
                            ))}
                            {calendarStatus.details.results.length > 10 && (
                              <div className="text-gray-500 italic mt-1">
                                ... and {calendarStatus.details.results.length - 10} more
                              </div>
                            )}
                          </div>
                        )}
                        
                        {calendarStatus.details.errors && calendarStatus.details.errors.length > 0 && (
                          <div className="bg-white rounded p-2 max-h-40 overflow-y-auto">
                            <p className="font-semibold mb-1 text-red-700">Errors:</p>
                            {calendarStatus.details.errors.map((e, idx) => (
                              <div key={idx} className="text-red-600">
                                ✗ {e.project}: {e.error}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Placeholder for future debug tools */}
        <Card className="shadow-lg border-0 opacity-50">
          <CardHeader className="border-b">
            <CardTitle className="text-gray-400">Email Integration</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <p className="text-gray-400">Coming soon: Test email notifications</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}