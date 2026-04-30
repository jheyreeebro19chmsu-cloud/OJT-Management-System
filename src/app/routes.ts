import React from 'react';
import { createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import OAuthCallback from './pages/OAuthCallback';
import { EmployeeLayout } from './components/EmployeeLayout';
import { AdminLayout } from './components/AdminLayout';
import { Dashboard } from './pages/Dashboard';
import { TimeRecord } from './pages/TimeRecord';
import { Records } from './pages/Records';
import { Profile } from './pages/Profile';
import InstructorQR from './pages/InstructorQR';
import QRScanner from './pages/QRScanner';
import { Announcements } from './pages/Announcements';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminEmployees } from './pages/admin/AdminEmployees';
import { AdminGeofence } from './pages/admin/AdminGeofence';
import { AdminReports } from './pages/admin/AdminReports';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminEvaluations } from './pages/admin/AdminEvaluations';
import { AdminAnnouncements } from './pages/admin/AdminAnnouncements';
import { HostFeedback } from './pages/HostFeedback';
import { AdminHostFeedback } from './pages/admin/AdminHostFeedback';
import { HTEDashboard } from './pages/HTEDashboard';
import { HTESettings } from './pages/HTESettings';

function RouteErrorFallback() {
  const error = useRouteError();
  let message = 'Something went wrong while loading this page.';
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
  }
  return React.createElement(
    'div',
    { className: 'min-h-screen flex items-center justify-center bg-slate-50 p-6' },
    React.createElement(
      'div',
      { className: 'w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm' },
      React.createElement('h2', { className: 'text-lg font-semibold text-slate-900' }, 'Unexpected Application Error'),
      React.createElement('p', { className: 'mt-2 text-sm text-slate-600' }, message),
      React.createElement(
        'button',
        {
          type: 'button',
          onClick: () => window.location.reload(),
          className: 'mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700',
        },
        'Reload App',
      ),
    ),
  );
}

const routeErrorElement = React.createElement(RouteErrorFallback);

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Login,
    errorElement: routeErrorElement,
  },
  {
    path: '/login',
    Component: Login,
    errorElement: routeErrorElement,
  },
  {
    path: '/register',
    Component: Register,
    errorElement: routeErrorElement,
  },
  {
    path: '/oauth-callback',
    Component: OAuthCallback,
    errorElement: routeErrorElement,
  },
  {
    path: '/host/feedback',
    Component: HostFeedback,
    errorElement: routeErrorElement,
  },
  {
    path: '/app',
    Component: EmployeeLayout,
    errorElement: routeErrorElement,
    children: [
      { index: true, Component: Dashboard },
      { path: 'time-record', Component: TimeRecord },
      { path: 'records', Component: Records },
      { path: 'announcements', Component: Announcements },
      { path: 'profile', Component: Profile },
      { path: 'instructor-qr', Component: InstructorQR },
      { path: 'scan-qr', Component: QRScanner },
    ],
  },
  {
    path: '/admin',
    Component: AdminLayout,
    errorElement: routeErrorElement,
    children: [
      { index: true, Component: AdminDashboard },
      { path: 'employees', Component: AdminEmployees },
      { path: 'geofence', Component: AdminGeofence },
      { path: 'reports', Component: AdminReports },
      { path: 'evaluations', Component: AdminEvaluations },
      { path: 'host-feedback', Component: AdminHostFeedback },
      { path: 'announcements', Component: AdminAnnouncements },
      { path: 'settings', Component: AdminSettings },
    ],
  },
  {
    path: '/hte',
    errorElement: routeErrorElement,
    children: [
      { index: true, Component: HTEDashboard },
      { path: 'settings', Component: HTESettings },
    ],
  },
]);
