/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';
import Configuracoes from './pages/Configuracoes';
import Usuarios from './pages/Usuarios';
import PerfisAcesso from './pages/PerfisAcesso';
import DestinatariosEmail from './pages/DestinatariosEmail';
import ConfigAlertas from './pages/ConfigAlertas';
import LogsEmail from './pages/LogsEmail';

import Relatorios from './pages/Relatorios';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#5C2C3E]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/relatorios"
              element={
                <PrivateRoute>
                  <Relatorios />
                </PrivateRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <PrivateRoute>
                  <Configuracoes />
                </PrivateRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <PrivateRoute>
                  <Usuarios />
                </PrivateRoute>
              }
            />
            <Route
              path="/perfis"
              element={
                <PrivateRoute>
                  <PerfisAcesso />
                </PrivateRoute>
              }
            />
            <Route
              path="/destinatarios"
              element={
                <PrivateRoute>
                  <DestinatariosEmail />
                </PrivateRoute>
              }
            />
            <Route
              path="/alertas"
              element={
                <PrivateRoute>
                  <ConfigAlertas />
                </PrivateRoute>
              }
            />
            <Route
              path="/logs"
              element={
                <PrivateRoute>
                  <LogsEmail />
                </PrivateRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
