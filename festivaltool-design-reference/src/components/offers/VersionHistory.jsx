import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, RotateCcw, X } from "lucide-react";
import { format } from "date-fns";

export default function VersionHistory({ versions, currentVersion, onRestore, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Version History</h2>
            <p className="text-sm text-gray-500 mt-1">
              Current version: {currentVersion}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1 p-6">
          {versions.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No previous versions available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded-lg p-4 hover:border-blue-300 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        v{version.version_number}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {format(new Date(version.created_date), "PPP 'at' p")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRestore(version.offer_data)}
                      className="gap-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Restore
                    </Button>
                  </div>
                  
                  <div className="text-sm text-gray-700 mt-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Saved by:</span>
                      <span className="font-medium">{version.saved_by}</span>
                    </div>
                    
                    {version.change_notes && (
                      <div className="mt-2 text-gray-600 italic">
                        "{version.change_notes}"
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                    <div className="bg-gray-50 rounded p-2">
                      <span className="text-gray-500">Client:</span>
                      <div className="font-medium truncate">
                        {version.offer_data.project_name || 'N/A'}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <span className="text-gray-500">Lines:</span>
                      <div className="font-medium">
                        {version.offer_data.offer_lines?.length || 0}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded p-2">
                      <span className="text-gray-500">Total:</span>
                      <div className="font-medium">
                        €{(version.offer_data.total_incl_btw || 0).toLocaleString('nl-NL', {minimumFractionDigits: 2})}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}