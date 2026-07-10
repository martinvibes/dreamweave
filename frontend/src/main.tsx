import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ThemeProvider } from "./theme/ThemeProvider";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Agents from "./pages/Agents";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import NewProject from "./pages/NewProject";
import Payments from "./pages/Payments";
import NotFound from "./pages/NotFound";
import Proof from "./pages/Proof";
import { AppShell } from "./components/AppShell";
import "./styles/global.css";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/proof" element={<Proof />} />
            <Route element={<AppShell />}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/app/new" element={<NewProject />} />
              <Route path="/app/projects" element={<Projects />} />
              <Route path="/app/projects/:id" element={<ProjectDetail />} />
              <Route path="/app/agents" element={<Agents />} />
              <Route path="/app/payments" element={<Payments />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);

