import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit } from 'lucide-react';
import { format } from 'date-fns';

export default function ContractList({ contracts, onEdit, isLoading }) {
  if (isLoading) return <div>Loading contracts...</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {contracts.map(contract => (
        <Card key={contract.id} className="shadow-md border-0">
          <CardContent className="p-4 flex justify-between items-center">
            <div>
              <h3 className="font-semibold">{contract.name}</h3>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                <span>Version {contract.version}</span>
                <span>•</span>
                <span>Category: {contract.category}</span>
                <span>•</span>
                <Badge variant={contract.is_active ? "default" : "secondary"}>
                  {contract.is_active ? "Active" : "Archived"}
                </Badge>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={() => onEdit(contract)}>
              <Edit className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}