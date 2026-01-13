import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Circle, Clock, Edit2, Save, X } from "lucide-react";

const statusIcons = {
  not_started: Circle,
  in_progress: Clock,
  complete: CheckCircle
};

const statusColors = {
  not_started: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  complete: "bg-green-100 text-green-800"
};

export default function TaskManagement({ project, onTaskUpdate }) {
  const [editingTask, setEditingTask] = useState(null);
  const [editNotes, setEditNotes] = useState("");

  const groupedTasks = {
    pre_event: project.tasks?.filter(t => t.section === 'pre_event') || [],
    event: project.tasks?.filter(t => t.section === 'event') || [],
    post_event: project.tasks?.filter(t => t.section === 'post_event') || []
  };

  const handleStatusChange = (taskIndex, newStatus) => {
    const task = project.tasks[taskIndex];
    onTaskUpdate(taskIndex, { ...task, status: newStatus });
  };

  const handleStartEdit = (taskIndex) => {
    setEditingTask(taskIndex);
    setEditNotes(project.tasks[taskIndex].notes || "");
  };

  const handleSaveEdit = (taskIndex) => {
    const task = project.tasks[taskIndex];
    onTaskUpdate(taskIndex, { ...task, notes: editNotes });
    setEditingTask(null);
    setEditNotes("");
  };

  const handleCancelEdit = () => {
    setEditingTask(null);
    setEditNotes("");
  };

  const TaskItem = ({ task, taskIndex, sectionTasks, localIndex }) => {
    const StatusIcon = statusIcons[task.status];
    const isEditing = editingTask === taskIndex;

    return (
      <div className="flex items-start gap-3 p-4 border rounded-lg hover:bg-gray-50 transition-colors">
        <button 
          onClick={() => {
            const newStatus = task.status === 'complete' ? 'not_started' : 
                            task.status === 'not_started' ? 'in_progress' : 'complete';
            handleStatusChange(taskIndex, newStatus);
          }}
          className="mt-1 hover:scale-110 transition-transform"
        >
          <StatusIcon className={`w-5 h-5 ${
            task.status === 'complete' ? 'text-green-600' : 
            task.status === 'in_progress' ? 'text-blue-600' : 'text-gray-400'
          }`} />
        </button>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-medium ${task.status === 'complete' ? 'line-through text-gray-500' : ''}`}>
              {task.name}
            </h4>
            <div className="flex items-center gap-2">
              <Badge className={statusColors[task.status]} variant="outline">
                {task.status.replace('_', ' ')}
              </Badge>
              {!isEditing ? (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleStartEdit(taskIndex)}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              ) : (
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => handleSaveEdit(taskIndex)}
                  >
                    <Save className="w-3 h-3" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleCancelEdit}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {isEditing ? (
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Add task notes..."
              className="text-sm"
              rows={2}
            />
          ) : (
            task.notes && (
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                {task.notes}
              </p>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Task Management
          <div className="text-sm font-normal text-gray-500">
            {project.tasks?.filter(t => t.status === 'complete').length || 0} / {project.tasks?.length || 0} completed
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pre_event" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pre_event" className="flex items-center gap-2">
              Pre-Event
              <Badge variant="secondary" className="ml-1">
                {groupedTasks.pre_event.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="event" className="flex items-center gap-2">
              Event
              <Badge variant="secondary" className="ml-1">
                {groupedTasks.event.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="post_event" className="flex items-center gap-2">
              Post-Event
              <Badge variant="secondary" className="ml-1">
                {groupedTasks.post_event.length}
              </Badge>
            </TabsTrigger>
          </TabsList>
          
          {Object.entries(groupedTasks).map(([section, tasks]) => (
            <TabsContent key={section} value={section} className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No tasks in this section
                </div>
              ) : (
                tasks.map((task, localIndex) => {
                  const taskIndex = project.tasks?.findIndex(t => t === task);
                  return (
                    <TaskItem 
                      key={`${section}-${localIndex}`}
                      task={task} 
                      taskIndex={taskIndex}
                      sectionTasks={tasks}
                      localIndex={localIndex}
                    />
                  );
                })
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}