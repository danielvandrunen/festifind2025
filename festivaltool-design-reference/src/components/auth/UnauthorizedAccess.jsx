import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, RefreshCw, WifiOff, UserX } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function UnauthorizedAccess({ userEmail, error }) {
  const handleSignOut = () => {
    base44.auth.logout();
  };

  const handleRetry = () => {
    window.location.reload();
  };

  // Network error state
  if (error === 'network_error' || error === 'check_failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
                <WifiOff className="w-8 h-8 text-orange-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Network Error
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Unable to connect to the server. Please check your internet connection and try again.
            </p>
            <div className="flex flex-col gap-3 mt-6">
              <Button 
                onClick={handleRetry}
                className="w-full gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Connection
              </Button>
              <Button 
                onClick={handleSignOut}
                variant="outline"
                className="w-full"
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not a team member - the main access denied state
  if (error === 'not_team_member' || error === 'team_check_failed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <UserX className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              Your account <span className="font-semibold">({userEmail})</span> is not registered as a team member.
            </p>
            <p className="text-sm text-gray-500">
              Only registered team members can access the Fastlane platform. Please contact your administrator to be added to the team members list.
            </p>
            <Button 
              onClick={handleSignOut}
              className="w-full mt-6"
              variant="outline"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Generic access denied state (fallback)
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
      <Card className="max-w-md w-full shadow-xl">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-600" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            Access Denied
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Your account <span className="font-semibold">({userEmail})</span> does not have access to this application.
          </p>
          <p className="text-sm text-gray-500">
            Please contact your administrator to request access to the Fastlane platform.
          </p>
          <Button 
            onClick={handleSignOut}
            className="w-full mt-6"
            variant="outline"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}