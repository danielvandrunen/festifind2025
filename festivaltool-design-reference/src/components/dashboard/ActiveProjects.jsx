import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, getISOWeek } from "date-fns";
import { FolderOpen, ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocalization } from "../../components/Localization";

const statusColors = {
  planning: "bg-blue-100 text-blue-800",
  active: "bg-green-100 text-green-800",
  closing: "bg-orange-100 text-orange-800",
  complete: "bg-gray-100 text-gray-800"
};

export default function ActiveProjects({ projects, clients, isLoading, title }) {
  const { t } = useLocalization();
  const displayTitle = title || t('Active Projects');
  const [sortBy, setSortBy] = useState('showdate');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const sortedProjects = useMemo(() => {
    let sorted = [...projects];

    sorted.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
        case 'project_name':
          aValue = a.project_name?.toLowerCase() || '';
          bValue = b.project_name?.toLowerCase() || '';
          break;
        case 'client':
          const clientA = clients.find(c => c.id === a.client_id)?.company_name?.toLowerCase() || '';
          const clientB = clients.find(c => c.id === b.client_id)?.company_name?.toLowerCase() || '';
          aValue = clientA;
          bValue = clientB;
          break;
        case 'location':
          aValue = a.project_location?.toLowerCase() || '';
          bValue = b.project_location?.toLowerCase() || '';
          break;
        case 'status':
          aValue = a.status || '';
          bValue = b.status || '';
          break;
        case 'showdate':
        default:
          const getEarliestShowdate = (project) => {
            if (project.showdates && project.showdates.length > 0) {
              return new Date(Math.min(...project.showdates.map(d => new Date(d).getTime())));
            }
            return new Date(0);
          };
          aValue = getEarliestShowdate(a).getTime();
          bValue = getEarliestShowdate(b).getTime();
          break;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [projects, clients, sortBy, sortOrder]);

  const getClientName = (clientId) => {
    return clients.find(c => c.id === clientId)?.company_name || t('N/A');
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-blue-600" />
            {displayTitle}
          </CardTitle>
          <Link to={createPageUrl("Projects")}>
            <Button variant="outline" size="sm">
              {t('View All')}
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sortedProjects.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FolderOpen className="w-8 h-8 mx-auto mb-3 text-gray-300" />
            <p>{t('No projects found')}</p>
            <Link to={createPageUrl("Projects")}>
              <Button className="mt-3" size="sm">
                {t('View Projects')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-32">
                    <Button variant="ghost" size="sm" onClick={() => handleSort('showdate')} className="font-semibold h-8 px-2">
                      {t('Showdates')}
                      <SortIcon column="showdate" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('project_name')} className="font-semibold h-8 px-2">
                      {t('Project')}
                      <SortIcon column="project_name" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('client')} className="font-semibold h-8 px-2">
                      {t('Client')}
                      <SortIcon column="client" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('location')} className="font-semibold h-8 px-2">
                      {t('Location')}
                      <SortIcon column="location" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => handleSort('status')} className="font-semibold h-8 px-2">
                      {t('Status')}
                      <SortIcon column="status" />
                    </Button>
                  </TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProjects.map((project) => {
                  const showdates = project.showdates || [];
                  const firstShowdate = showdates.length > 0 
                    ? new Date(Math.min(...showdates.map(d => new Date(d).getTime())))
                    : null;
                  const lastShowdate = showdates.length > 1 
                    ? new Date(Math.max(...showdates.map(d => new Date(d).getTime())))
                    : null;
                  const weekNumber = firstShowdate ? getISOWeek(firstShowdate) : null;

                  return (
                    <TableRow key={project.id} className="hover:bg-gray-50">
                      <TableCell>
                        {firstShowdate && (
                          <div className="flex flex-col text-xs">
                            <span className="font-semibold text-gray-900">
                              {format(firstShowdate, 'dd/MM/yy')}
                              {lastShowdate && lastShowdate.getTime() !== firstShowdate.getTime() && 
                                ` - ${format(lastShowdate, 'dd/MM/yy')}`
                              }
                            </span>
                            <span className="text-[10px] text-gray-500">W{weekNumber}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        {project.project_name}
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {getClientName(project.client_id)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {project.project_location || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[project.status]} variant="outline">
                          {project.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`ProjectDetail?id=${project.id}`)}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}