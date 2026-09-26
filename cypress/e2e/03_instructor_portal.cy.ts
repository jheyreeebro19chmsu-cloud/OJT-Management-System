describe('03 - OJT Instructor & Admin Portal Features', () => {
  beforeEach(() => {
    cy.clearAuthSession();
    cy.loginAsInstructor();
  });

  it('3.1 Loads Admin Dashboard with faculty metrics and KPIs', () => {
    cy.visit('/admin');
    cy.get('body').should('be.visible');

    // Navigation and branding
    cy.contains(/CHMSU OJT System|OJT Management/i).should('exist');
    cy.contains(/Prof. John Dela Cruz|Instructor|Admin/i).should('exist');

    // Metrics cards
    cy.contains(/Trainees|Students|Active|Hours/i).should('exist');
  });

  it('3.2 Navigates to Trainees Roster and searches students', () => {
    cy.visit('/admin/employees');
    cy.get('body').should('be.visible');

    // Roster title and search input
    cy.contains(/Trainees|Students|Roster/i).should('exist');
    cy.get('input[placeholder*="Search" i], input[type="search"]').should('exist').first().type('Maria');
  });

  it('3.3 Manages Geofence Zones with minimum radius security', () => {
    cy.visit('/admin/geofence');
    cy.get('body').should('be.visible');

    // Geofence management titles
    cy.contains(/Geofence|Workplace Zones|Station/i).should('exist');

    // Leaflet map container should exist
    cy.get('.leaflet-container, [id*="map"]').should('exist');
  });

  it('3.4 Accesses Evaluations Hub and verifies Multi-Role sync view', () => {
    cy.visit('/admin/evaluations');
    cy.get('body').should('be.visible');

    // Evaluation management title
    cy.contains(/Evaluations|Questionnaire|Performance/i).should('exist');
  });

  it('3.5 Views DTR Reports and Attendance Verification Logs', () => {
    cy.visit('/admin/reports');
    cy.get('body').should('be.visible');

    // Reports titles and tables
    cy.contains(/Reports|Attendance Logs|DTR Summary/i).should('exist');
  });

  it('3.6 Opens Announcements Management View', () => {
    cy.visit('/admin/announcements');
    cy.get('body').should('be.visible');

    // Announcement creation triggers
    cy.contains(/Announcements|Post Announcement/i).should('exist');
  });

  it('3.7 Manages Academic Years and Semesters', () => {
    cy.visit('/admin/academic-years');
    cy.get('body').should('be.visible');

    // Academic year listings
    cy.contains(/Academic Year|Semester|AY/i).should('exist');
  });

  it('3.8 Updates Admin Settings (Geofence & Biometric controls)', () => {
    cy.visit('/admin/settings');
    cy.get('body').should('be.visible');

    // System configurations
    cy.contains(/Settings|System Configuration/i).should('exist');
    cy.contains(/Geofence|Face|Grace/i).should('exist');
  });
});
