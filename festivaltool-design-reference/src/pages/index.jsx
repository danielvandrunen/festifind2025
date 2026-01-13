import Layout from "./Layout.jsx";

import BatchOfferCreator from "./BatchOfferCreator";

import ClientPortal from "./ClientPortal";

import Clients from "./Clients";

import Contracts from "./Contracts";

import Dashboard from "./Dashboard";

import Debug from "./Debug";

import EmployeePortal from "./EmployeePortal";

import Home from "./Home";

import InvoiceInbox from "./InvoiceInbox";

import OfferEditor from "./OfferEditor";

import OfferReview from "./OfferReview";

import Offers from "./Offers";

import Pakbon from "./Pakbon";

import PakbonSettings from "./PakbonSettings";

import Products from "./Products";

import ProjectDetail from "./ProjectDetail";

import Projects from "./Projects";

import RepairProjects from "./RepairProjects";

import Resources from "./Resources";

import Roosters from "./Roosters";

import SalesTracker from "./SalesTracker";

import Staff from "./Staff";

import TaskTemplates from "./TaskTemplates";

import TeamMembers from "./TeamMembers";

import crew from "./crew";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    BatchOfferCreator: BatchOfferCreator,
    
    ClientPortal: ClientPortal,
    
    Clients: Clients,
    
    Contracts: Contracts,
    
    Dashboard: Dashboard,
    
    Debug: Debug,
    
    EmployeePortal: EmployeePortal,
    
    Home: Home,
    
    InvoiceInbox: InvoiceInbox,
    
    OfferEditor: OfferEditor,
    
    OfferReview: OfferReview,
    
    Offers: Offers,
    
    Pakbon: Pakbon,
    
    PakbonSettings: PakbonSettings,
    
    Products: Products,
    
    ProjectDetail: ProjectDetail,
    
    Projects: Projects,
    
    RepairProjects: RepairProjects,
    
    Resources: Resources,
    
    Roosters: Roosters,
    
    SalesTracker: SalesTracker,
    
    Staff: Staff,
    
    TaskTemplates: TaskTemplates,
    
    TeamMembers: TeamMembers,
    
    crew: crew,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<BatchOfferCreator />} />
                
                
                <Route path="/BatchOfferCreator" element={<BatchOfferCreator />} />
                
                <Route path="/ClientPortal" element={<ClientPortal />} />
                
                <Route path="/Clients" element={<Clients />} />
                
                <Route path="/Contracts" element={<Contracts />} />
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Debug" element={<Debug />} />
                
                <Route path="/EmployeePortal" element={<EmployeePortal />} />
                
                <Route path="/Home" element={<Home />} />
                
                <Route path="/InvoiceInbox" element={<InvoiceInbox />} />
                
                <Route path="/OfferEditor" element={<OfferEditor />} />
                
                <Route path="/OfferReview" element={<OfferReview />} />
                
                <Route path="/Offers" element={<Offers />} />
                
                <Route path="/Pakbon" element={<Pakbon />} />
                
                <Route path="/PakbonSettings" element={<PakbonSettings />} />
                
                <Route path="/Products" element={<Products />} />
                
                <Route path="/ProjectDetail" element={<ProjectDetail />} />
                
                <Route path="/Projects" element={<Projects />} />
                
                <Route path="/RepairProjects" element={<RepairProjects />} />
                
                <Route path="/Resources" element={<Resources />} />
                
                <Route path="/Roosters" element={<Roosters />} />
                
                <Route path="/SalesTracker" element={<SalesTracker />} />
                
                <Route path="/Staff" element={<Staff />} />
                
                <Route path="/TaskTemplates" element={<TaskTemplates />} />
                
                <Route path="/TeamMembers" element={<TeamMembers />} />
                
                <Route path="/crew" element={<crew />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}