import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ComprehensiveTestSuite } from "@/components/ComprehensiveTestSuite";
import { useSystemReliability } from "@/hooks/useSystemReliability";
import { GlobalErrorHandler } from "@/components/GlobalErrorHandler";
import { AuthProvider } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import Home from "./pages/Home";
import Join from "./pages/Join";
import Table from "./pages/Table";
import Summary from "./pages/Summary";
import QAPage from "./pages/QA";
import AdminPage from "./pages/Admin";
import AuthPage from "./pages/Auth";
import { FeatureTest } from "./pages/FeatureTest";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppWithReliability() {
  useSystemReliability();
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GlobalErrorHandler />
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/test" element={<ComprehensiveTestSuite />} />
              <Route path="/qa" element={<QAPage />} />
              <Route path="/admin" element={
                <AuthGuard requireAdmin={true}>
                  <AdminPage />
                </AuthGuard>
              } />
              <Route path="/feature-test" element={<FeatureTest />} />
              <Route path="/t/:code/join" element={<Join />} />
              <Route path="/t/:code/summary" element={<Summary />} />
              <Route path="/t/:code" element={<Table />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <AppWithReliability />
  </ErrorBoundary>
);

export default App;
