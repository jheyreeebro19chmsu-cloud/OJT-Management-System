import React from 'react';
import { createBrowserRouter, isRouteErrorResponse, useRouteError } from 'react-router-dom';

import { AdminLayout } from './components/AdminLayout';
import { EmployeeLayout } from './components/EmployeeLayout';
import { HTELayout } from './components/HTELayout';
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T } | any>,
  componentName: string
) {
  return React.lazy(async () => {
    const sessionKey = `retry_import_${componentName}`;
    try {
      const module = await factory();
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(sessionKey);
      }
      return module.default ? module : { default: module };
    } catch (error: any) {
      console.warn(`Dynamic chunk loading failed for ${componentName}:`, error);
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && typeof window !== 'undefined') {
        const alreadyRetried = window.sessionStorage.getItem(sessionKey);
        if (!alreadyRetried) {
          window.sessionStorage.setItem(sessionKey, 'true');
          window.location.reload();
          return new Promise<{ default: T }>(() => {});
        }
      }
      throw error;
    }
  });
}

const AdminDashboard = lazyWithRetry(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })), 'AdminDashboard');
const AdminEmployees = lazyWithRetry(() => import('./pages/admin/AdminEmployees').then(m => ({ default: m.AdminEmployees })), 'AdminEmployees');
const AdminGeofence = lazyWithRetry(() => import('./pages/admin/AdminGeofence').then(m => ({ default: m.AdminGeofence })), 'AdminGeofence');
const AdminReports = lazyWithRetry(() => import('./pages/admin/AdminReports').then(m => ({ default: m.AdminReports })), 'AdminReports');
const AdminSettings = lazyWithRetry(() => import('./pages/admin/AdminSettings').then(m => ({ default: m.AdminSettings })), 'AdminSettings');
const AcademicYearManagement = lazyWithRetry(() => import('./pages/admin/AcademicYearManagement').then(m => ({ default: m.AcademicYearManagement })), 'AcademicYearManagement');
const AccountProfile = lazyWithRetry(() => import('./pages/AccountProfile').then(m => ({ default: m.AccountProfile })), 'AccountProfile');
const AdminEvaluations = lazyWithRetry(() => import('./pages/admin/AdminEvaluations').then(m => ({ default: m.AdminEvaluations })), 'AdminEvaluations');
const AdminAnnouncements = lazyWithRetry(() => import('./pages/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })), 'AdminAnnouncements');
const HostFeedback = lazyWithRetry(() => import('./pages/HostFeedback').then(m => ({ default: m.HostFeedback })), 'HostFeedback');
const AdminHostFeedback = lazyWithRetry(() => import('./pages/admin/AdminHostFeedback').then(m => ({ default: m.AdminHostFeedback })), 'AdminHostFeedback');
const Announcements = lazyWithRetry(() => import('./pages/Announcements').then(m => ({ default: m.Announcements })), 'Announcements');
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })), 'Dashboard');
const HTEDashboard = lazyWithRetry(() => import('./pages/HTEDashboard').then(m => ({ default: m.HTEDashboard })), 'HTEDashboard');
const HTETrainees = lazyWithRetry(() => import('./pages/HTETrainees').then(m => ({ default: m.HTETrainees })), 'HTETrainees');
const HTEEvaluations = lazyWithRetry(() => import('./pages/HTEEvaluations').then(m => ({ default: m.HTEEvaluations })), 'HTEEvaluations');
const HTEAnnouncements = lazyWithRetry(() => import('./pages/HTEAnnouncements').then(m => ({ default: m.HTEAnnouncements })), 'HTEAnnouncements');
const HTERecords = lazyWithRetry(() => import('./pages/HTERecords').then(m => ({ default: m.HTERecords })), 'HTERecords');
const HTESettings = lazyWithRetry(() => import('./pages/HTESettings').then(m => ({ default: m.HTESettings })), 'HTESettings');
const InstructorQR = lazyWithRetry(() => import('./pages/InstructorQR'), 'InstructorQR');
const Login = lazyWithRetry(() => import('./pages/Login').then(m => ({ default: m.Login })), 'Login');
const OAuthCallback = lazyWithRetry(() => import('./pages/OAuthCallback'), 'OAuthCallback');
const Profile = lazyWithRetry(() => import('./pages/Profile').then(m => ({ default: m.Profile })), 'Profile');
const QRScanner = lazyWithRetry(() => import('./pages/QRScanner'), 'QRScanner');
const Records = lazyWithRetry(() => import('./pages/Records').then(m => ({ default: m.Records })), 'Records');
const Register = lazyWithRetry(() => import('./pages/Register').then(m => ({ default: m.Register })), 'Register');
const TimeRecord = lazyWithRetry(() => import('./pages/TimeRecord').then(m => ({ default: m.TimeRecord })), 'TimeRecord');

function RouteErrorFallback() {
  const error = useRouteError();
  let message = 'Something went wrong while loading this page.';
  if (isRouteErrorResponse(error)) {
    message = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    message = error.message;
    if (
      message.includes('Failed to fetch dynamically imported module') ||
      message.includes('Importing a module script failed') ||
      message.includes('error loading dynamically imported module')
    ) {
      if (typeof window !== 'undefined') {
        const reloaded = window.sessionStorage.getItem('route_error_reloaded');
        if (!reloaded) {
          window.sessionStorage.setItem('route_error_reloaded', 'true');
          window.location.reload();
          return React.createElement(
            'div',
            { className: 'min-h-screen flex items-center justify-center bg-slate-50' },
            React.createElement('div', { className: 'animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600' })
          );
        }
      }
    }
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
          onClick: () => {
            if (typeof window !== 'undefined') {
              window.sessionStorage.clear();
              window.location.reload();
            }
          },
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
    element: withSuspense(() => React.createElement(HTELayout, null, React.createElement(HTEEvaluations))),
    errorElement: routeErrorElement,
  },
  {
    path: '/app',
    element: withSuspense(EmployeeLayout),
    errorElement: routeErrorElement,
    children: [
      { index: true, element: withSuspense(Dashboard) },
      { path: 'time-record', element: withSuspense(TimeRecord) },
      { path: 'records', element: withSuspense(Records) },
      { path: 'announcements', element: withSuspense(Announcements) },
      { path: 'hte-feedback', element: withSuspense(HostFeedback) },
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
      { path: 'academic-years', element: withSuspense(AcademicYearManagement) },
      { path: 'settings', element: withSuspense(AdminSettings) },
      { path: 'profile', element: withSuspense(() => React.createElement(AccountProfile, { role: 'admin' })) },
    ],
  },
  {
    path: '/hte',
    Component: HTELayout,
    errorElement: routeErrorElement,
    children: [
      { index: true, element: withSuspense(HTEDashboard) },
      { path: 'trainees', element: withSuspense(HTETrainees) },
      { path: 'records', element: withSuspense(HTERecords) },
      { path: 'evaluations', element: withSuspense(HTEEvaluations) },
      { path: 'announcements', element: withSuspense(HTEAnnouncements) },
      { path: 'applications', element: withSuspense(HTERecords) },
      { path: 'approvals', element: withSuspense(HTERecords) },
      { path: 'registrations', element: withSuspense(HTERecords) },
      { path: 'settings', element: withSuspense(HTESettings) },
      { path: 'profile', element: withSuspense(() => React.createElement(AccountProfile, { role: 'hte' })) },
    ],
  },
]);
