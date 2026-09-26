/// <reference types="cypress" />

export interface MockUser {
  id: string;
  employeeId?: string;
  name: string;
  email: string;
  role: 'employee' | 'admin' | 'hte' | 'host';
  position?: string;
  department?: string;
  companyName?: string;
  companyAddress?: string;
  requiredHours?: number;
  campus?: string;
  registrationLocation?: { lat: number; lng: number; radius: number };
}

export const DEFAULT_TRAINEE: MockUser = {
  id: 'trainee-demo-01',
  employeeId: '20231379',
  name: 'Maria Santos',
  email: 'maria.santos@chmsu.edu.ph',
  role: 'employee',
  position: 'BSIT OJT Student',
  department: 'College of Computer Studies',
  companyName: 'Accenture Bacolod',
  companyAddress: 'Ayala Malls Capitol Central, Gatuslao St, Bacolod, 6100',
  requiredHours: 486,
  campus: 'talisay',
  registrationLocation: {
    lat: 10.6765,
    lng: 122.9511,
    radius: 40,
  },
};

export const DEFAULT_INSTRUCTOR: MockUser = {
  id: 'instructor-demo-01',
  employeeId: 'INST-2026-01',
  name: 'Prof. John Dela Cruz',
  email: 'instructor@chmsu.edu.ph',
  role: 'admin',
  position: 'OJT Instructor',
  department: 'College of Computer Studies',
  campus: 'talisay',
};

export const DEFAULT_HTE: MockUser = {
  id: 'hte-demo-01',
  employeeId: 'HTE-2026-01',
  name: 'Engr. Roberto Gomez',
  email: 'supervisor@accenture.com',
  role: 'hte',
  position: 'Industry Supervisor',
  companyName: 'Accenture Bacolod',
  campus: 'talisay',
};

// Seed employees list into localStorage so matching works
function seedEmployeesList() {
  const employees = [
    {
      ...DEFAULT_TRAINEE,
      status: 'active',
      submittedDocuments: {
        endorsement: { name: 'endorsement.pdf', status: 'approved' },
        waiver: { name: 'waiver.pdf', status: 'approved' },
        medical: { name: 'medical.pdf', status: 'approved' },
        resume: { name: 'resume.pdf', status: 'approved' },
        moa: { name: 'moa.pdf', status: 'approved' },
      },
    },
    {
      id: 'trainee-demo-02',
      employeeId: '20231380',
      name: 'Juan Dela Cruz',
      email: 'juan.delacruz@chmsu.edu.ph',
      role: 'employee',
      position: 'BSIS OJT Student',
      department: 'College of Computer Studies',
      companyName: 'Teletech Bacolod',
      requiredHours: 486,
      campus: 'talisay',
      status: 'active',
    },
  ];
  localStorage.setItem('ojt_employees', JSON.stringify(employees));
}

Cypress.Commands.add('loginAsTrainee', (customUser?: Partial<MockUser>) => {
  const user = { ...DEFAULT_TRAINEE, ...customUser };
  cy.window().then((win) => {
    win.localStorage.setItem('ojt_current_user', JSON.stringify(user));
    seedEmployeesList();
  });
});

Cypress.Commands.add('loginAsInstructor', (customUser?: Partial<MockUser>) => {
  const user = { ...DEFAULT_INSTRUCTOR, ...customUser };
  cy.window().then((win) => {
    win.localStorage.setItem('ojt_current_user', JSON.stringify(user));
    seedEmployeesList();
  });
});

Cypress.Commands.add('loginAsHTE', (customUser?: Partial<MockUser>) => {
  const user = { ...DEFAULT_HTE, ...customUser };
  cy.window().then((win) => {
    win.localStorage.setItem('ojt_current_user', JSON.stringify(user));
    seedEmployeesList();
  });
});

Cypress.Commands.add('clearAuthSession', () => {
  cy.window().then((win) => {
    win.localStorage.removeItem('ojt_current_user');
    win.sessionStorage.clear();
  });
  cy.clearLocalStorage();
  cy.clearCookies();
});

Cypress.Commands.add('mockGeolocation', (latitude = 10.6765, longitude = 122.9511, accuracy = 15) => {
  cy.window().then((win) => {
    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((success) => {
      return success({
        coords: {
          latitude,
          longitude,
          accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });
  });
});

Cypress.Commands.add('mockGeolocationDenied', () => {
  cy.window().then((win) => {
    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((_, error) => {
      if (error) {
        error({
          code: 1,
          message: 'User denied Geolocation permission',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }
    });
  });
});

Cypress.Commands.add('mockGeolocationHardwareOff', () => {
  cy.window().then((win) => {
    cy.stub(win.navigator.geolocation, 'getCurrentPosition').callsFake((_, error) => {
      if (error) {
        error({
          code: 2,
          message: 'Position unavailable (device location is turned off)',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }
    });
  });
});

declare global {
  namespace Cypress {
    interface Chainable {
      loginAsTrainee(customUser?: Partial<MockUser>): Chainable<void>;
      loginAsInstructor(customUser?: Partial<MockUser>): Chainable<void>;
      loginAsHTE(customUser?: Partial<MockUser>): Chainable<void>;
      clearAuthSession(): Chainable<void>;
      mockGeolocation(latitude?: number, longitude?: number, accuracy?: number): Chainable<void>;
      mockGeolocationDenied(): Chainable<void>;
      mockGeolocationHardwareOff(): Chainable<void>;
    }
  }
}