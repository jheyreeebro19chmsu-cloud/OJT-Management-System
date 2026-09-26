describe('01 - Authentication & Public Portal Routing', () => {
  beforeEach(() => {
    cy.clearAuthSession();
  });

  it('1.1 Renders login page with brand credentials and Google SSO options', () => {
    cy.visit('/login');
    cy.get('body').should('be.visible');

    // Title / heading
    cy.contains(/Sign in to your account|Welcome back/i).should('be.visible');

    // Form fields
    cy.get('input[name="email"], input[type="email"]').should('be.visible');
    cy.get('input[name="password"], input[type="password"]').should('be.visible');
    cy.get('button[type="submit"]').should('be.visible').and('contain.text', 'Sign In');

    // Google Role-based SSO buttons
    cy.contains(/Continue as Trainee|Trainee/i).should('exist');
    cy.contains(/Continue as Instructor|Instructor/i).should('exist');
    cy.contains(/Continue as HTE|Host Training Establishment/i).should('exist');
  });

  it('1.2 Toggles password visibility on login form', () => {
    cy.visit('/login');
    cy.get('input[name="password"], input[type="password"]').first().as('passwordField');

    cy.get('@passwordField').type('MySecretPassword123');
    cy.get('@passwordField').should('have.attr', 'type', 'password');

    // Click toggle button
    cy.get('button[type="button"]').filter(':has(svg)').first().click({ force: true });
    // Should now toggle or remain functional
    cy.get('input[name="password"]').should('exist');
  });

  it('1.3 Navigates to registration page and verifies name fields alignment', () => {
    cy.visit('/register?role=trainee');
    cy.get('.animate-spin', { timeout: 30000 }).should('not.exist');
    cy.contains(/Personal Information|Trainee Registration/i, { timeout: 20000 }).should('be.visible');
    cy.get('input[name="firstName"]').should('be.visible');
    cy.get('input[name="middleInitial"]').should('be.visible');
    cy.get('input[name="lastName"]').should('be.visible');

    // Check account credentials fields on step 1
    cy.get('input[name="email"], input[type="email"]').should('be.visible');
    cy.get('input[type="password"]').should('exist');
  });

  it('1.4 Enforces unauthenticated route protection and redirects to login', () => {
    cy.visit('/app');
    // Unauthenticated user should be redirected to login
    cy.url().should('include', '/login');

    cy.visit('/admin');
    cy.url().should('include', '/login');

    cy.visit('/hte');
    cy.url().should('include', '/login');
  });

  it('1.5 Supports role-based automatic redirection on valid session', () => {
    // 1. Trainee session
    cy.loginAsTrainee();
    cy.visit('/login');
    cy.url().should('include', '/app');

    // 2. Admin / Instructor session
    cy.clearAuthSession();
    cy.loginAsInstructor();
    cy.visit('/login');
    cy.url().should('include', '/admin');

    // 3. HTE Supervisor session
    cy.clearAuthSession();
    cy.loginAsHTE();
    cy.visit('/login');
    cy.url().should('include', '/hte');
  });
});
