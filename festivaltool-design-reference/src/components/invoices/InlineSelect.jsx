import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const GROOTBOEK_OPTIONS = [
  "unassigned",
  "4096 – Payroll: Onbelaste reiskostenvergoeding werknemer",
  "4100 – Huur kantoor",
  "4200 – 4G/Satteliet telecom inkoop",
  "4201 – Development software",
  "4202 – Office & design software",
  "4300 – Kantoorkosten",
  "4301 – Hardware voor producties",
  "4400 – Administratie & advies",
  "4402 – Contributies & abonnementen",
  "4404 – Online marketing",
  "4450 – Drukwerk & werkkleding",
  "4500 – Verzekeringen algemeen",
  "4600 – Mobiliteit",
  "4610 – Reis- & verblijfkosten",
  "4800 – Representatie & verteer",
  "4810 – Kantinekosten",
  "7000 – Inkoop algemeen",
  "7002 – Extern personeel",
  "7003 – Inhuur netwerkapparatuur",
  "7004 – Huur apparatuur en toebehoren",
  "7005 – Intern personeel",
  "7006 – Management fees",
  "8000 – Omzet algemeen",
  "8003 – Omzet refunds",
  "8004 – Omzet Testevents",
  "9300 – Bankkosten"
];

export function GrootboekSelect({ value, onChange }) {
  const displayValue = value === 'unassigned' ? 'Unassigned' : value;
  
  return (
    <Select value={value || 'unassigned'} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs max-w-[220px]">
        <SelectValue>
          <span className="truncate block" title={displayValue}>
            {displayValue}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {GROOTBOEK_OPTIONS.map(option => (
          <SelectItem key={option} value={option} className="text-xs">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProjectSelect({ value, projects, onChange }) {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredProjects = projects.filter(project => 
    project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.client_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="No project">
          {value ? projects.find(p => p.id === value)?.project_name || 'Unknown' : 'No project'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-2 py-1 text-xs border rounded"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <SelectItem value={null}>No project</SelectItem>
        {filteredProjects.map(project => (
          <SelectItem key={project.id} value={project.id} className="text-xs">
            {project.project_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StatusSelect({ value, onChange }) {
  const statusColors = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    paid: 'bg-green-100 text-green-800 border-green-300',
    archived: 'bg-gray-100 text-gray-800 border-gray-300'
  };

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={`h-8 text-xs font-medium ${statusColors[value]}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pending">Pending</SelectItem>
        <SelectItem value="paid">Paid</SelectItem>
        <SelectItem value="archived">Archived</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function AssignedToSelect({ value, users, onChange }) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Unassigned">
          {value ? value.split('@')[0] : 'Unassigned'}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={null}>Unassigned</SelectItem>
        {users.map(user => (
          <SelectItem key={user.id} value={user.email} className="text-xs">
            {user.full_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}