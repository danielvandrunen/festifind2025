import React from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export default function MediaPreviewModal({ isOpen, onClose, mediaUrl, mediaType = "image" }) {
  if (!mediaUrl) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0">
        <div className="relative bg-black">
          <div className="absolute top-3 right-3 z-10 flex gap-2">
            <a
              href={mediaUrl}
              download
              className="h-10 w-10 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <Download className="w-5 h-5" />
            </a>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10 bg-white/10 hover:bg-white/20 text-white"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {mediaType === "image" && (
            <img 
              src={mediaUrl} 
              alt="Preview"
              className="w-full max-h-[90vh] object-contain"
            />
          )}

          {mediaType === "pdf" && (
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(mediaUrl)}&embedded=true`}
              className="w-full h-[90vh] bg-white"
              title="PDF Preview"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}