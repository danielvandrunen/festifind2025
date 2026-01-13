import React, { useState } from 'react';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ContractEditor({ contract, onSave, onCancel }) {
  const [formData, setFormData] = useState(contract || {
    name: '',
    content: '',
    version: 1,
    is_active: true,
    category: 'standard'
  });

  const handleSave = () => {
    onSave(formData);
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({...prev, [field]: value}));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <CardHeader>
          <CardTitle>{contract ? 'Edit Contract Template' : 'New Contract Template'}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="name">Template Name</Label>
                <Input id="name" value={formData.name} onChange={(e) => handleChange('name', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange('category', v)}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="hardware_rental">Hardware Rental</SelectItem>
                  <SelectItem value="ticketing">Ticketing</SelectItem>
                  <SelectItem value="bi_platform">BI Platform</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <ReactQuill 
              theme="snow" 
              value={formData.content} 
              onChange={(value) => handleChange('content', value)}
              className="bg-white"
            />
          </div>
          <div className="flex items-center gap-2 pt-4">
            <Switch checked={formData.is_active} onCheckedChange={(c) => handleChange('is_active', c)} />
            <Label>Set as active template</Label>
          </div>
        </CardContent>
        <div className="p-6 border-t flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleSave}>Save Template</Button>
        </div>
      </Card>
    </div>
  );
}