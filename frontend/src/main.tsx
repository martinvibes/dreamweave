import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Marketplace from "./pages/Marketplace";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import NewProject from "./pages/NewProject";
import DeployAgent from "./pages/DeployAgent";
import Payments from "./pages/Payments";
import { AppShell } from "./components/AppShell";
import "./styles/global.css";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route element={<AppShell />}>
            <Route path="/app" element={<Dashboard />} />
            <Route path="/app/new" element={<NewProject />} />
            <Route path="/app/projects" element={<Projects />} />
            <Route path="/app/projects/:id" element={<ProjectDetail />} />
            <Route path="/app/agents" element={<Agents />} />
            <Route path="/app/agents/new" element={<DeployAgent />} />
            <Route path="/app/marketplace" element={<Marketplace />} />
            <Route path="/app/payments" element={<Payments />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
