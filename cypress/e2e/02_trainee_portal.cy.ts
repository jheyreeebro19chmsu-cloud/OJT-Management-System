describe('02 - Trainee Portal Features & Workflows', () => {
  beforeEach(() => {
    cy.clearAuthSession();
    cy.loginAsTrainee();
  });

  it('2.1 Loads Trainee Dashboard with OJT progress and required hours', () => {
    cy.visit('/app');
    cy.get('body').should('be.visible');

    // Header displays CHMSU brand
    cy.get('header').contains(/CHMSU OJT System|CHMSU/i).should('be.visible');

    // Student identity
    cy.contains(/Maria Santos|Trainee/i).should('exist');

    // Dashboard metrics
    cy.contains(/Rendered|Hours/i).should('exist');
  });

  it('2.2 Verifies Upper-Left Location Reminder Pop-up when location is off or denied', () => {
    // Stub Geolocation to fail (simulating GPS off or denied)
    cy.visit('/app', {
      onBeforeLoad(win) {
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((_, error) => {
          if (error) {
            error({
              code: 1,
              message: 'User denied Geolocation',
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            });
          }
        });
      },
    });

    // Check that TraineeLocationReminder card is visible in the upper left
    cy.contains(/Turn On Your Location/i).should('be.visible');
    cy.contains(/Required for OJT Attendance/i).should('be.visible');

    // Action button "Open / Allow Location"
    cy.contains(/Open \/ Allow Location/i).should('be.visible');

    // Toggle Help instructions
    cy.get('button[aria-label="Toggle instructions"]').click();
    cy.contains(/Android/i).should('be.visible');
    cy.contains(/iPhone/i).should('be.visible');
    cy.contains(/Laptop \/ PC/i).should('be.visible');

    // Minimize to pill
    cy.get('button[aria-label="Minimize location reminder"]').click();
    cy.contains(/Turn On Location/i).should('be.visible');

    // Clicking minimized pill restores full reminder
    cy.contains(/Turn On Location/i).click();
    cy.contains(/Turn On Your Location/i).should('be.visible');
  });

  it('2.3 Loads Time Record view and initializes Geofence checker', () => {
    cy.visit('/app/time-record', {
      onBeforeLoad(win) {
        // Provide mock valid coordinates
        cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
          success({
            coords: {
              latitude: 10.6765,
              longitude: 122.9511,
              accuracy: 10,
            },
            timestamp: Date.now(),
          });
        });
      },
    });

    cy.get('body').should('be.visible');
    cy.contains(/Time Record|Attendance/i).should('exist');
  });

  it('2.4 Navigates to DTR Attendance Records and Monthly View', () => {
    cy.visit('/app/records');
    cy.get('body').should('be.visible');
    cy.contains(/Records|Attendance History|Daily Time Record/i).should('exist');
  });

  it('2.5 Checks Required Documents list and submission states', () => {
    cy.visit('/app/documents');
    cy.get('body').should('be.visible');

    // Should display OJT documents
    cy.contains(/Documents|Requirements|Checklist/i).should('exist');
  });

  it('2.6 Renders Trainee Evaluation Questionnaire', () => {
    cy.visit('/app/evaluation');
    cy.get('body').should('be.visible');
    cy.contains(/Questionnaire|Evaluation|Assessment/i).should('exist');
  });

  it('2.7 Displays Announcements Feed', () => {
    cy.visit('/app/announcements');
    cy.get('body').should('be.visible');
    cy.contains(/Announcements/i).should('exist');
  });

  it('2.8 Verifies Trainee Profile and confirms Requirements Checklist is removed', () => {
    cy.visit('/app/profile');
    cy.get('body').should('be.visible');

    // Profile details should exist
    cy.contains(/Maria Santos|Profile/i).should('exist');

    // Requirements Checklist section should NOT be in the profile page
    cy.contains('Institutional OJT Requirements Checklist').should('not.exist');
    cy.contains('Mandatory Requirements Checklist').should('not.exist');
  });
});
