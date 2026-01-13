import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { Checkbox } from "@/components/ui/checkbox";

export default function PakbonPage() {
  const [project, setProject] = useState(null);
  const [client, setClient] = useState(null);
  const [offer, setOffer] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');

    if (!projectId) {
      setLoading(false);
      return;
    }

    try {
      const projectData = await base44.entities.Project.get(projectId);
      setProject(projectData);

      if (projectData.client_id) {
        const clientData = await base44.entities.Client.get(projectData.client_id);
        setClient(clientData);
      }

      if (projectData.offer_id) {
        const offerData = await base44.entities.Offer.get(projectData.offer_id);
        setOffer(offerData);
      }
    } catch (error) {
      console.error('Error loading pakbon data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600">Pakbon laden...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-600">Pakbon niet gevonden</p>
      </div>
    );
  }

  const packingItems = project.packing_slip_items || [];

  return (
    <div className="min-h-screen bg-white">
      {/* Print Button - Hidden when printing */}
      <div className="no-print fixed top-4 right-4 z-50">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg shadow-lg font-semibold"
        >
          🖨️ Afdrukken
        </button>
      </div>

      {/* A4 Container */}
      <div className="max-w-[210mm] mx-auto p-8 bg-white">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">PAKBON</h1>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="font-semibold text-gray-700">Project:</p>
              <p className="text-gray-900 text-lg">{project.project_name}</p>
              
              {client && (
                <>
                  <p className="font-semibold text-gray-700 mt-3">Klant:</p>
                  <p className="text-gray-900">{client.company_name}</p>
                  {client.contact_person && (
                    <p className="text-gray-600">{client.contact_person}</p>
                  )}
                </>
              )}
              
              {project.project_location && (
                <>
                  <p className="font-semibold text-gray-700 mt-3">Locatie:</p>
                  <p className="text-gray-900">{project.project_location}</p>
                </>
              )}
            </div>
            
            <div>
              {project.showdates && project.showdates.length > 0 && (
                <>
                  <p className="font-semibold text-gray-700">Showdates:</p>
                  {project.showdates.map((date, idx) => (
                    <p key={idx} className="text-gray-900">
                      {format(new Date(date), 'EEEE d MMMM yyyy', { locale: nl })}
                    </p>
                  ))}
                </>
              )}
              
              {project.setup_date && (
                <>
                  <p className="font-semibold text-gray-700 mt-3">Opbouw:</p>
                  <p className="text-gray-900">
                    {Array.isArray(project.setup_date)
                      ? project.setup_date.map(d => format(new Date(d), 'd MMMM yyyy', { locale: nl })).join(', ')
                      : format(new Date(project.setup_date), 'd MMMM yyyy', { locale: nl })}
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse mb-8">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-3 px-2 font-semibold text-gray-900 w-12">✓</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-900">Item</th>
              <th className="text-center py-3 px-2 font-semibold text-gray-900 w-24">Aantal</th>
              <th className="text-left py-3 px-2 font-semibold text-gray-900">Notities</th>
            </tr>
          </thead>
          <tbody>
            {packingItems.filter(item => (item.quantity || 0) > 0).map((item, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="py-3 px-2 text-center">
                  <div className="w-5 h-5 border-2 border-gray-800 rounded inline-block"></div>
                </td>
                <td className="py-3 px-2 text-gray-900">{item.item_name || '-'}</td>
                <td className="py-3 px-2 text-center font-semibold text-gray-900">{item.quantity || 0}</td>
                <td className="py-3 px-2 text-gray-600 text-sm">{item.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer - Signature Section */}
        <div className="mt-12 pt-8 border-t-2 border-gray-300">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Datum:</p>
              <div className="border-b-2 border-gray-400 h-10"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Naam:</p>
              <div className="border-b-2 border-gray-400 h-10"></div>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Handtekening:</p>
              <div className="border-b-2 border-gray-400 h-10"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `}</style>
    </div>
  );
}