describe('White-box: Admin authentication alpha cases', () => {
  const adminEmail = 'admin@ojt.com';
  const adminPassword = 'admin123';

  beforeEach(() => {
    cy.intercept('GET', '**/rest/v1/**', { statusCode: 200, body: [] });
    cy.intercept('POST', '**/auth/v1/token*', {
      statusCode: 400,
      body: { error: 'invalid_grant', error_description: 'Invalid login credentials' },
    });
    cy.intercept('POST', '**/auth/login/', {
      statusCode: 401,
      body: { detail: 'Invalid credentials' },
    });
    cy.visit('/login');
    cy.window().its('__APP_STATE__.login').should('be.a', 'function');
  });

  function callLogin(identifier, password) {
    return cy.window().then((win) => win.__APP_STATE__.login(identifier, password));
  }

  it('TC-AdminAuth001: authenticates valid admin credentials', () => {
    callLogin(adminEmail, adminPassword).then((user) => {
      expect(user).to.include({ email: adminEmail, role: 'admin' });
    });
  });

  it('TC-AdminAuth002: rejects an incorrect password', () => {
    callLogin(adminEmail, 'wrongpass').should('be.null');
  });

  it('TC-AdminAuth003: rejects an empty username', () => {
    callLogin('', 'test123').should('be.null');
  });

  it('TC-AdminAuth004: rejects an empty password', () => {
    callLogin(adminEmail, '').should('be.null');
  });

  it('TC-AdminAuth005: rejects SQL-injection-shaped identifiers', () => {
    callLogin("' OR 1=1 --", 'none').should('be.null');
  });

  it('TC-AdminAuth006: denies an unknown or deactivated admin account', () => {
    callLogin('disabled.admin@example.com', 'valid123').should('be.null');
  });

  it('TC-AdminAuth007: locks the account after five failed attempts', () => {
    cy.window().then(async (win) => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await win.__APP_STATE__.login(adminEmail, `wrong-${attempt}`);
      }
      return win.__APP_STATE__.login(adminEmail, adminPassword);
    }).should('be.null');
  });

  it('TC-AdminAuth008: normalizes username case before authentication', () => {
    callLogin('ADMIN@OJT.COM', adminPassword).then((user) => {
      expect(user).to.include({ email: adminEmail, role: 'admin' });
    });
  });

  it('TC-AdminAuth009: trims surrounding whitespace from credentials', () => {
    callLogin(` ${adminEmail} `, ` ${adminPassword} `).then((user) => {
      expect(user).to.include({ email: adminEmail, role: 'admin' });
    });
  });

  it('TC-AdminAuth010: handles special characters without throwing', () => {
    callLogin('admin!@#', 'test!@#').should('be.null');
  });
});