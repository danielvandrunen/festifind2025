import React, { useState, useEffect } from "react";
import { Client, Project, Offer, Product, ProductCategorySetting } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Users, Building2 } from "lucide-react";
import { useLocalization } from "../components/Localization";
import { checkUserAuthorization } from "../components/auth/checkUserAuthorization";
import UnauthorizedAccess from "../components/auth/UnauthorizedAccess";

import ClientTable from "../components/clients/ClientTable";
import ClientForm from "../components/clients/ClientForm";
import ClientDetailModal from "../components/clients/ClientDetailModal";

export default function ClientsPage() {
  const { t } = useLocalization();
  const [authState, setAuthState] = useState({ checking: true, authorized: false, user: null });
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [offers, setOffers] = useState([]);
  const [products, setProducts] = useState([]);
  const [categorySettings, setCategorySettings] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

  useEffect(() => {
    if (authState.authorized) {
      loadData();
    }
  }, [authState.authorized]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter(client =>
        client.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (client.vat_number && client.vat_number.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [clients, searchTerm]);

  // Check for view parameter in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewClientId = urlParams.get('view');
    
    if (viewClientId && clients.length > 0) {
      const client = clients.find(c => c.id === viewClientId);
      if (client) {
        setSelectedClient(client);
      }
    }
  }, [clients]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [clientsData, projectsData, offersData, productsData, categorySettingsData] = await Promise.all([
        Client.list('-created_date'),
        Project.list(),
        Offer.list(),
        Product.list(),
        ProductCategorySetting.list()
      ]);
      setClients(clientsData);
      setProjects(projectsData);
      setOffers(offersData);
      setProducts(productsData);
      setCategorySettings(categorySettingsData);
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (clientData) => {
    setIsLoading(true);
    try {
      if (editingClient) {
        await Client.update(editingClient.id, clientData);
      } else {
        await Client.create(clientData);
      }
      setShowForm(false);
      setEditingClient(null);
      loadData();
    } catch (error) {
      console.error("Failed to submit client data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setShowForm(true);
  };

  const handleViewDetails = (client) => {
    setSelectedClient(client);
    // Update URL without reloading page
    window.history.pushState({}, '', `${window.location.pathname}?view=${client.id}`);
  };

  const handleCloseModal = () => {
    setSelectedClient(null);
    // Remove query parameter from URL
    window.history.pushState({}, '', window.location.pathname);
  };

  const urlParams = new URLSearchParams(window.location.search);
  const shouldShowForm = urlParams.get('action') === 'create' || showForm;

  if (authState.checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <p className="text-gray-700 text-lg">{t('Loading...')}</p>
      </div>
    );
  }

  if (!authState.authorized) {
    return <UnauthorizedAccess userEmail={authState.user?.email} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-blue-600" />
              {t('Client Management')}
            </h1>
            <p className="text-gray-600 mt-2">{t('Comprehensive client relationship management')}</p>
          </div>
          <div className="flex gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:flex-none lg:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder={t('Search clients...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              {t('Add Client')}
            </Button>
          </div>
        </div>

        <ClientTable
          clients={filteredClients}
          projects={projects}
          offers={offers}
          products={products}
          isLoading={isLoading}
          onEdit={handleEdit}
          onViewDetails={handleViewDetails}
        />

        {shouldShowForm && (
          <ClientForm
            client={editingClient}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingClient(null);
            }}
          />
        )}

        {selectedClient && (
          <ClientDetailModal
            client={selectedClient}
            projects={projects}
            offers={offers}
            products={products}
            categorySettings={categorySettings}
            onClose={handleCloseModal}
            onUpdate={loadData}
          />
        )}
      </div>
    </div>
  );
}