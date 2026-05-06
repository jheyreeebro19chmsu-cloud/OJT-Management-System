import React from 'react';
import { createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { AdminLayout } from './components/AdminLayout';
import { EmployeeLayout } from './components/EmployeeLayout';
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const AdminEmployees = React.lazy(() => import('./pages/admin/AdminEmployees').then(m => ({ default: m.AdminEmployees })));
const AdminGeofence = React.lazy(() => import('./pages/admin/AdminGeofence').then(m => ({ default: m.AdminGeofence })));
const AdminReports = React.lazy(() => import('./pages/admin/AdminReports').then(m => ({ default: m.AdminReports })));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })));
const AdminEvaluations = React.lazy(() => import('./pages/admin/AdminEvaluations').then(m => ({ default: m.AdminEvaluations })));
const AdminAnnouncements = React.lazy(() => import('./pages/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })));
const HostFeedback = React.lazy(() => import('./pages/HostFeedback').then(m => ({ default: m.HostFeedback })));
const AdminHostFeedback = React.lazy(() => import('./pages/admin/AdminHostFeedback').then(m => ({ default: m.AdminHostFeedback })));
const Announcements = React.lazy(() => import('./pages/Announcements').then(m => ({ default: m.Announcements })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const HTEDashboard = React.lazy(() => import('./pages/HTEDashboard').then(m => ({ default: m.HTEDashboard })));
const HTESettings = React.lazy(() => import('./pages/HTESettings').then(m => ({ default: m.HTESettings })));
const InstructorQR = React.lazy(() => import('./pages/InstructorQR'));
const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const OAuthCallback = React.lazy(() => import('./pages/OAuthCallback'));
const Profile = React.lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const QRScanner = React.lazy(() => import('./pages/QRScanner'));
const Records = React.lazy(() => import('./pages/Records').then(m => ({ default: m.Records })));
const Register = React.lazy(() => import('./pages/Register').then(m => ({ default: m.Register })));
const TimeRecord = React.lazy(() => import('./pages/TimeRecord').then(m => ({ default: m.TimeRecord })));

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
          className:
            'mt-4 inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700',
        },
        'Reload App'
      )
    )
  );
}

const routeErrorElement = React.createElement(RouteErrorFallback);

function SuspenseLayout({ children }: { children: React.ReactNode }) {
  return React.createElement(
    React.Suspense,
    {
      fallback: React.createElement(
        'div',
        { className: 'flex items-center justify-center min-h-screen bg-slate-50' },
        React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' })
      )
    },
    children
  );
}

function withSuspense(Component: React.ComponentType) {
  return React.createElement(SuspenseLayout, null, React.createElement(Component));
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: withSuspense(Login),
    errorElement: routeErrorElement,
  },
  {
    path: '/login',
    element: withSuspense(Login),
    errorElement: routeErrorElement,
  },
  {
    path: '/register',
    element: withSuspense(Register),
    errorElement: routeErrorElement,
  },
  {
    path: '/oauth-callback',
    element: withSuspense(OAuthCallback),
    errorElement: routeErrorElement,
  },
  {
    path: '/host/feedback',
    element: withSuspense(HostFeedback),
    errorElement: routeErrorElement,
  },
  {
    path: '/app',
    Component: EmployeeLayout,
    errorElement: routeErrorElement,
    children: [
      { index: true, element: withSuspense(Dashboard) },
      { path: 'time-record', element: withSuspense(TimeRecord) },
      { path: 'records', element: withSuspense(Records) },
      { path: 'announcements', element: withSuspense(Announcements) },
      { path: 'profile', element: withSuspense(Profile) },
      { path: 'instructor-qr', element: withSuspense(InstructorQR) },
      { path: 'scan-qr', element: withSuspense(QRScanner) },
    ],
  },
  {
    path: '/admin',
    Component: AdminLayout,
    errorElement: routeErrorElement,
    children: [
      { index: true, element: withSuspense(AdminDashboard) },
      { path: 'employees', element: withSuspense(AdminEmployees) },
      { path: 'geofence', element: withSuspense(AdminGeofence) },
      { path: 'reports', element: withSuspense(AdminReports) },
      { path: 'evaluations', element: withSuspense(AdminEvaluations) },
      { path: 'host-feedback', element: withSuspense(AdminHostFeedback) },
      { path: 'announcements', element: withSuspense(AdminAnnouncements) },
      { path: 'settings', element: withSuspense(AdminSettings) },
    ],
  },
  {
    path: '/hte',
    errorElement: routeErrorElement,
    children: [
      { index: true, element: withSuspense(HTEDashboard) },
      { path: 'settings', element: withSuspense(HTESettings) },
    ],
  },
]);
