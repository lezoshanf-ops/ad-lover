import { useState } from 'react';
import PanelLayout from './PanelLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EmployeeTasksView from './employee/EmployeeTasksView';
import EmployeeTimeView from './employee/EmployeeTimeView';
import EmployeeDocumentsView from './employee/EmployeeDocumentsView';
import EmployeeVacationView from './employee/EmployeeVacationView';
import { ClipboardList, Clock, FileText, Calendar } from 'lucide-react';

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState('tasks');

  return (
    <PanelLayout title="Mitarbeiter-Panel">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">Aufgaben</span>
          </TabsTrigger>
          <TabsTrigger value="time" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Zeiterfassung</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Dokumente</span>
          </TabsTrigger>
          <TabsTrigger value="vacation" className="gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Urlaub</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <EmployeeTasksView />
        </TabsContent>
        <TabsContent value="time">
          <EmployeeTimeView />
        </TabsContent>
        <TabsContent value="documents">
          <EmployeeDocumentsView />
        </TabsContent>
        <TabsContent value="vacation">
          <EmployeeVacationView />
        </TabsContent>
      </Tabs>
    </PanelLayout>
  );
}
