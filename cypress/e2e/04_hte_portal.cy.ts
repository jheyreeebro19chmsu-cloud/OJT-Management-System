describe('04 - Host Training Establishment (HTE) Portal Features', () => {
  beforeEach(() => {
    cy.clearAuthSession();
    cy.loginAsHTE();
  });

  it('4.1 Loads HTE Dashboard with company intern overview', () => {
    cy.visit('/hte');
    cy.get('body').should('be.visible');

    // Branding and role indicator
    cy.contains(/HTE|Host Training|Accenture/i).should('exist');
    cy.contains(/Engr. Roberto Gomez|Supervisor/i).should('exist');
  });

  it('4.2 Navigates to Assigned HTE Trainees list', () => {
    cy.visit('/hte/trainees');
    cy.get('body').should('be.visible');

    // Trainees listing
    cy.contains(/Trainees|Interns|Assigned/i).should('exist');
  });

  it('4.3 Reviews Trainee DTR Attendance Records and Approvals', () => {
    cy.visit('/hte/records');
    cy.get('body').should('be.visible');

    // DTR records and approval controls
    cy.contains(/Records|Attendance|Approvals/i).should('exist');
  });

  it('4.4 Opens Performance Evaluations Scoring Rubric', () => {
    cy.visit('/hte/evaluations');
    cy.get('body').should('be.visible');

    // Performance rubric & scoring
    cy.contains(/Evaluation|Ratings|Performance Rubric|Competence/i).should('exist');
  });

  it('4.5 Views HTE Company Announcements', () => {
    cy.visit('/hte/announcements');
    cy.get('body').should('be.visible');

    // Company notices
    cy.contains(/Announcements|Notices/i).should('exist');
  });

  it('4.6 Navigates to HTE Workplace Settings and Profile', () => {
    cy.visit('/hte/settings');
    cy.get('body').should('be.visible');

    // Company station coordinates and details
    cy.contains(/Settings|Workplace|Location|Address/i).should('exist');
  });
});
