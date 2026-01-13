import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save } from "lucide-react";

export const defaultTasks = [
  // Pre-event tasks
  { name: "Site survey and setup planning", section: "pre_event", status: "not_started", notes: "" },
  { name: "Hardware preparation and testing", section: "pre_event", status: "not_started", notes: "" },
  { name: "Staff briefing and training", section: "pre_event", status: "not_started", notes: "" },
  { name: "Final client confirmation", section: "pre_event", status: "not_started", notes: "" },
  
  // Event tasks
  { name: "On-site setup and installation", section: "event", status: "not_started", notes: "" },
  { name: "System testing and go-live", section: "event", status: "not_started", notes: "" },
  { name: "On-site support and monitoring", section: "event", status: "not_started", notes: "" },
  { name: "Equipment breakdown and collection", section: "event", status: "not_started", notes: "" },
  
  // Post-event tasks
  { name: "Data reconciliation and reporting", section: "post_event", status: "not_started", notes: "" },
  { name: "Invoice generation and dispatch", section: "post_event", status: "not_started", notes: "" },
  { name: "Client feedback collection", section: "post_event", status: "not_started", notes: "" },
  { name: "Project closure documentation", section: "post_event", status: "not_started", notes: "" }
];

export default function ProjectForm({ project, clients, offers, onSubmit, onCancel }) {
  const [formData, setFormData] = React.useState(project || {
    client_id: "",
    project_name: "",
    project_location: "",
    start_date: "",
    end_date: "",
    expected_attendance: "",
    status: "planning",
    tasks: defaultTasks,
    notes: ""
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
    >
      <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl font-bold">
            Edit Project
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client_id">Client *</Label>
                <Select
                  value={formData.client_id}
                  onValueChange={(value) => handleChange('client_id', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planning">Planning</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_name">Project Name *</Label>
                <Input
                  id="project_name"
                  value={formData.project_name}
                  onChange={(e) => handleChange('project_name', e.target.value)}
                  placeholder="Festival Project Name"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project_location">Location</Label>
                <Input
                  id="project_location"
                  value={formData.project_location}
                  onChange={(e) => handleChange('project_location', e.target.value)}
                  placeholder="Festival Location"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_attendance">Expected Attendance</Label>
                <Input
                  id="expected_attendance"
                  type="number"
                  value={formData.expected_attendance}
                  onChange={(e) => handleChange('expected_attendance', parseInt(e.target.value))}
                  placeholder="50000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Project Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Additional project information..."
                className="h-20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                <Save className="w-4 h-4 mr-2" />
                Update Project
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}