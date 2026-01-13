import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { base44 } from "@/api/base44Client";

export default function crew() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("Vul je e-mailadres in");
      return;
    }

    setLoading(true);

    try {
      const response = await base44.functions.invoke('sendMagicLink', { 
        email,
        appOrigin: window.location.origin
      });
      
      setSuccess(true);
      toast.success(response.message || "Inloglink verstuurd!");
    } catch (error) {
      console.error('Error:', error);
      toast.error("Er is iets misgegaan. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Toaster />
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Fastlane Medewerkers</CardTitle>
          <p className="text-sm text-gray-600 mt-2">Inloggen met je e-mailadres</p>
        </CardHeader>
        <CardContent className="pt-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Check je e-mail!</h3>
              <p className="text-gray-600">
                Als je e-mailadres bij ons bekend is, hebben we je een inloglink gestuurd. 
                Deze is 24 uur geldig.
              </p>
              <Button 
                variant="outline" 
                onClick={() => setSuccess(false)}
                className="w-full"
              >
                Opnieuw verzenden
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="text-sm font-medium text-gray-700 block mb-2">
                  E-mailadres
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jouw@email.nl"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="h-12 text-base"
                  autoFocus
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Bezig met versturen...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Stuur inloglink
                  </>
                )}
              </Button>

              <p className="text-xs text-gray-500 text-center mt-4">
                Je ontvangt een e-mail met een link om in te loggen. Geen wachtwoord nodig!
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}