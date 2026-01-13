import React, { useState, useEffect } from "react";
import { Contract } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Plus, FileSignature } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

import ContractList from "../components/contracts/ContractList";
import ContractEditor from "../components/contracts/ContractEditor";

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingContract, setEditingContract] = useState(null);

  useEffect(() => {
    loadContracts();
  }, []);

  const loadContracts = async () => {
    setIsLoading(true);
    const data = await Contract.list('-created_date');
    setContracts(data);
    setIsLoading(false);
  };

  const handleEdit = (contract) => {
    setEditingContract(contract);
    setShowEditor(true);
  };

  const handleSave = async (contractData) => {
    try {
      if (editingContract) {
        await Contract.update(editingContract.id, { ...contractData, version: (editingContract.version || 1) + 1 });
        toast.success("Contract updated successfully.");
      } else {
        await Contract.create(contractData);
        toast.success("Contract created successfully.");
      }
      setShowEditor(false);
      setEditingContract(null);
      loadContracts();
    } catch (error) {
      toast.error("Failed to save contract.");
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <Toaster />
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileSignature className="w-8 h-8 text-blue-600" />
              Contract Templates
            </h1>
            <p className="text-gray-600 mt-2">Manage your standard terms and conditions</p>
          </div>
          <Button onClick={() => setShowEditor(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-4 h-4 mr-2" /> New Template
          </Button>
        </div>

        <ContractList contracts={contracts} onEdit={handleEdit} isLoading={isLoading} />
        
        {showEditor && (
          <ContractEditor 
            contract={editingContract} 
            onSave={handleSave}
            onCancel={() => { setShowEditor(false); setEditingContract(null); }}
          />
        )}
      </div>
    </div>
  );
}