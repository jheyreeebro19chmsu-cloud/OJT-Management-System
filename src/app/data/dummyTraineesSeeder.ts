import { Employee, TimeRecord, Evaluation, GeofenceZone, HostSupervisor } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const DEMO_TAG_PREFIX = 'OJT-2024-D';
export const DEMO_EMAIL_DOMAIN = 'demo.chmsu.edu.ph';

// HTE 3: Printing Services (Yzel Norte)
export const HTE_3_PRINTING_SERVICES = {
  id: 'b3171b8e-5912-4b09-8468-e1084ca97ccd',
  employeeId: 'HTE-DEMO-003',
  name: 'Printing Services',
  contactPerson: 'Yzel Norte',
  email: 'norteyzel@gmail.com',
  position: 'HTE Representative',
  department: 'Printing & Media Services',
  address: 'Printing Services, Negros Occidental',
  phone: '0918-420-1192',
  lat: 10.822655,
  lng: 123.033082,
  radius: 100,
  academicYear: '2026-2027',
};

const FIRST_NAMES_MALE = [
  'Joshua', 'Christian', 'John Paul', 'Mark Vincent', 'Angelo', 'Gabriel', 'Rafael', 'Daniel', 'Michael',
  'Kevin', 'Carl', 'Anthony', 'Adrian', 'Kenneth', 'Francis', 'Justin', 'Jerome', 'Dominic', 'Patrick',
  'Bryan', 'Paolo', 'Renz', 'Kyle', 'Ian', 'Neil', 'Matthew', 'Nathaniel', 'Sean', 'Leo', 'Alvin'
];

const FIRST_NAMES_FEMALE = [
  'Mary Grace', 'Bea Nicole', 'Angelica', 'Alyssa', 'Christine', 'Hannah', 'Patricia', 'Camille',
  'Kathleen', 'Rochelle', 'Danielle', 'Erika', 'Sophia', 'Jasmine', 'Mariel', 'Kyla', 'Andrea',
  'Princess', 'Chloe', 'Bianca', 'Janelle', 'Maureen', 'Althea', 'Clarisse', 'Trisha', 'Rhea',
  'Samantha', 'Denise', 'Kristine', 'Joy'
];

const LAST_NAMES = [
  'Montelibano', 'Guanzon', 'Javellana', 'Lacson', 'Cuenca', 'Alcantara', 'Gatuslao', 'De la Rama',
  'Torres', 'Yanson', 'Gonzaga', 'Ledesma', 'Bautista', 'Villanueva', 'Fernandez', 'Santos', 'Reyes',
  'Cruz', 'Tan', 'Lim', 'Castillo', 'Mendoza', 'Aquino', 'Delgado', 'Sarmiento', 'Ebro', 'Lopez',
  'Medina', 'Ramos', 'Navarro', 'Mercado', 'Valdez', 'Salazar', 'Chua', 'Sy', 'Garcia', 'Perez',
  'Flores', 'Tolentino', 'Morales'
];

const COURSES = [
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Information Systems',
];

const TALISAY_CAMPUS = 'Talisay (Main Campus)';
const TALISAY_COLLEGE = 'College of Computer Studies';

export interface GeneratedDemoData {
  trainees: Employee[];
  geofenceZones: GeofenceZone[];
  timeRecords: TimeRecord[];
  evaluations: Evaluation[];
  hostSupervisors: HostSupervisor[];
}

export function generate120DemoTrainees(): GeneratedDemoData {
  const trainees: Employee[] = [];
  const geofenceZones: GeofenceZone[] = [];
  const timeRecords: TimeRecord[] = [];
  const evaluations: Evaluation[] = [];
  const hostSupervisors: HostSupervisor[] = [];

  const hte = HTE_3_PRINTING_SERVICES;
  const hteId = hte.id;

  // 1. Setup Host Supervisor & Geofence Zone for HTE 3 Printing Services
  hostSupervisors.push({
    id: hte.id,
    employeeId: hte.employeeId,
    name: hte.contactPerson,
    email: hte.email,
    companyName: hte.name,
    companyAddress: hte.address,
    contactPerson: hte.contactPerson,
    phone: hte.phone,
    academicYear: '2026-2027',
    isApproved: true,
    active: true,
  });

  geofenceZones.push({
    id: `zone-demo-printing-services`,
    name: `${hte.name} - Geofence Zone`,
    address: hte.address,
    lat: hte.lat,
    lng: hte.lng,
    radius: hte.radius,
    active: true,
    academicYear: '2026-2027',
    hteId: hte.id,
  });

  // 2. Generate 120 Trainees with realistic bell-curve distribution
  // 120 total:
  // - Stage 1 (Newly Started / 20-80h): 24 trainees (20%)
  // - Stage 2 (Mid-OJT / 200-380h): 54 trainees (45%)
  // - Stage 3 (Advanced / 480-570h): 30 trainees (25%)
  // - Stage 4 (Completed / 600h): 6 trainees (5%)
  // - Stage 5 (Irregular / At-Risk / 40-120h): 6 trainees (5%)

  const stages: { stage: number; targetHours: number; daysCount: number; category: string }[] = [];

  // Stage 1: 24 trainees
  for (let i = 0; i < 24; i++) {
    const targetHours = 20 + Math.floor(Math.random() * 60); // 20 - 79 hrs
    stages.push({
      stage: 1,
      targetHours,
      daysCount: Math.ceil(targetHours / 8),
      category: 'Newly Started (Onboarding)',
    });
  }

  // Stage 2: 54 trainees
  for (let i = 0; i < 54; i++) {
    const targetHours = 200 + Math.floor(Math.random() * 180); // 200 - 379 hrs
    stages.push({
      stage: 2,
      targetHours,
      daysCount: Math.ceil(targetHours / 8),
      category: 'Mid-OJT (Actively Progressing)',
    });
  }

  // Stage 3: 30 trainees
  for (let i = 0; i < 30; i++) {
    const targetHours = 480 + Math.floor(Math.random() * 95); // 480 - 574 hrs
    stages.push({
      stage: 3,
      targetHours,
      daysCount: Math.ceil(targetHours / 8),
      category: 'Advanced (Near Completion)',
    });
  }

  // Stage 4: 6 trainees
  for (let i = 0; i < 6; i++) {
    const targetHours = 600 + Math.floor(Math.random() * 12); // 600 - 611 hrs
    stages.push({
      stage: 4,
      targetHours,
      daysCount: 75,
      category: 'Completed (OJT Finished)',
    });
  }

  // Stage 5: 6 trainees (At-Risk / Sporadic)
  for (let i = 0; i < 6; i++) {
    const targetHours = 40 + Math.floor(Math.random() * 70); // 40 - 109 hrs (falling behind)
    stages.push({
      stage: 5,
      targetHours,
      daysCount: Math.ceil(targetHours / 6), // irregular/fewer hours per day
      category: 'At-Risk (Irregular / Falling Behind)',
    });
  }

  // Shuffle stages slightly so list has realistic variety
  for (let i = stages.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [stages[i], stages[j]] = [stages[j], stages[i]];
  }

  // Start date for the current semester OJT: 2026-06-15
  const baseStartDate = new Date('2026-06-15T08:00:00Z');
  const baseEndDate = new Date('2026-11-20T17:00:00Z');

  for (let index = 0; index < 120; index++) {
    const num = index + 1;
    const isMale = index % 2 === 0;
    const firstName = isMale
      ? FIRST_NAMES_MALE[index % FIRST_NAMES_MALE.length]
      : FIRST_NAMES_FEMALE[index % FIRST_NAMES_FEMALE.length];
    const lastName = LAST_NAMES[index % LAST_NAMES.length];
    const middleInitial = String.fromCharCode(65 + (index % 26)) + '.';
    const fullName = `${firstName} ${middleInitial} ${lastName}`;

    const studentNumStr = String(num).padStart(3, '0');
    const employeeId = `${DEMO_TAG_PREFIX}${studentNumStr}`;
    const studentUuid = `00000000-0000-4000-a000-${String(num).padStart(12, '0')}`;
    const email = `trainee.demo${studentNumStr}@${DEMO_EMAIL_DOMAIN}`;

    const hte = HTE_3_PRINTING_SERVICES;
    const hteId = hte.id;
    const course = COURSES[index % COURSES.length];
    const campus = TALISAY_CAMPUS;

    const stageConfig = stages[index];

    // Trainee Object
    const trainee: Employee = {
      id: studentUuid,
      name: fullName,
      employeeId: employeeId,
      username: `demo${studentNumStr}`,
      email: email,
      phone: `09${Math.floor(100000000 + Math.random() * 899999999)}`,
      role: 'employee',
      department: hte.department,
      position: 'OJT Intern',
      companyName: hte.name,
      supervisorName: hte.contactPerson,
      schoolName: 'Carlos Hilado Memorial State University',
      campus: campus,
      course: course,
      address: 'Talisay City, Negros Occidental',
      city: 'Talisay City',
      province: 'Negros Occidental',
      region: 'Region VI (Western Visayas)',
      startDate: '2026-06-15',
      endDate: '2026-11-20',
      requiredHours: 600,
      photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${firstName}-${lastName}&gender=${isMale ? 'male' : 'female'}`,
      schoolLogo: '/chmsu-logo.png',
      faceRegistered: true,
      active: true,
      hteId: hteId,
      academicYear: '2026-2027',
      approvalStatus: 'approved',
      applicationStatus: 'approved',
      createdAt: '2026-06-10T09:00:00Z',
      registrationLocation: {
        lat: hte.lat,
        lng: hte.lng,
        radius: hte.radius,
      },
      registrationAddress: hte.address,
      registrationRadius: hte.radius,
      documentsStatus: stageConfig.stage >= 3 ? 'passed' : stageConfig.stage === 2 ? 'partial' : 'pending',
      documentsPassed: stageConfig.stage >= 3,
    };

    trainees.push(trainee);

    // 3. Generate Realistic DTR Time Records for this Trainee
    let accumulatedHours = 0;
    const currentDate = new Date(baseStartDate);

    for (let day = 0; day < stageConfig.daysCount && accumulatedHours < stageConfig.targetHours; day++) {
      // Advance to next business day (skip Sat/Sun)
      currentDate.setDate(currentDate.getDate() + 1);
      if (currentDate.getDay() === 0) currentDate.setDate(currentDate.getDate() + 1); // skip Sun
      if (currentDate.getDay() === 6) currentDate.setDate(currentDate.getDate() + 2); // skip Sat

      const dateStr = currentDate.toISOString().split('T')[0];

      // Realistic random jitter on arrival and departure times
      const arrivalMin = Math.floor(Math.random() * 20); // 07:45 - 08:05
      const departureMin = Math.floor(Math.random() * 30); // 17:00 - 17:30

      const checkInHour = 7 + (arrivalMin > 10 ? 1 : 0);
      const checkInMinute = (arrivalMin % 60).toString().padStart(2, '0');

      const checkOutHour = 17;
      const checkOutMinute = departureMin.toString().padStart(2, '0');

      const checkInTime = `${checkInHour.toString().padStart(2, '0')}:${checkInMinute}:00`;
      const checkOutTime = `${checkOutHour.toString().padStart(2, '0')}:${checkOutMinute}:00`;

      // 8 hours standard work day (minus 1 hour lunch)
      const dayHours = stageConfig.stage === 5 && day % 3 === 0 ? 5.5 : 8.0;
      accumulatedHours += dayHours;

      timeRecords.push({
        id: `dtr-demo-${studentNumStr}-${day + 1}`,
        employeeId: employeeId,
        date: dateStr,
        timeIn: checkInTime,
        timeOut: checkOutTime,
        hours: dayHours,
        status: 'present',
        notes: `Duty rendered at ${hte.department}`,
        timeInLocation: {
          lat: hte.lat + (Math.random() - 0.5) * 0.0001,
          lng: hte.lng + (Math.random() - 0.5) * 0.0001,
          address: hte.address,
        },
        timeOutLocation: {
          lat: hte.lat + (Math.random() - 0.5) * 0.0001,
          lng: hte.lng + (Math.random() - 0.5) * 0.0001,
          address: hte.address,
        },
        faceVerified: true,
        verifiedByFace: true,
        academicYear: '2026-2027',
      });
    }

    // 4. Generate Supervisor Evaluation if trainee has reached midterm/final stages
    if (stageConfig.stage >= 2) {
      // Base score realistic by stage
      const baseScore = stageConfig.stage === 4 ? 94 : stageConfig.stage === 3 ? 90 : stageConfig.stage === 5 ? 74 : 86;
      const jitter = (index % 7) - 3;
      const totalScore = Math.min(100, Math.max(70, baseScore + jitter));

      evaluations.push({
        id: `eval-demo-${studentNumStr}-mid`,
        employeeId: employeeId,
        supervisorName: hte.contactPerson,
        evaluatorPosition: hte.position,
        companyName: hte.name,
        evaluationDate: '2026-08-30',
        academicYear: '2026-2027',
        type: 'midterm',
        totalScore: totalScore,
        categories: {
          attendance: Math.round(totalScore + (Math.random() * 4 - 2)),
          qualityOfWork: Math.round(totalScore + (Math.random() * 4 - 2)),
          dependability: Math.round(totalScore + (Math.random() * 4 - 2)),
          initiative: Math.round(totalScore + (Math.random() * 4 - 2)),
          interpersonalSkills: Math.round(totalScore + (Math.random() * 4 - 2)),
        },
        remarks:
          stageConfig.stage === 5
            ? 'Needs to improve attendance consistency and communicate schedule adjustments promptly.'
            : stageConfig.stage === 4
            ? 'Exceptional performance. Demonstrated professional maturity and high technical competence.'
            : 'Good progress and enthusiastic learning attitude. Keep up the consistent effort.',
      } as any);
    }

    // Final evaluation for completed trainees (Stage 4)
    if (stageConfig.stage === 4) {
      evaluations.push({
        id: `eval-demo-${studentNumStr}-fin`,
        employeeId: employeeId,
        supervisorName: hte.contactPerson,
        evaluatorPosition: hte.position,
        companyName: hte.name,
        evaluationDate: '2026-10-01',
        academicYear: '2026-2027',
        type: 'final',
        totalScore: 96,
        categories: {
          attendance: 98,
          qualityOfWork: 96,
          dependability: 95,
          initiative: 96,
          interpersonalSkills: 97,
        },
        remarks: 'Outstanding intern! Completed all 600 required training hours ahead of time with zero disciplinary infractions.',
      } as any);
    }
  }

  return {
    trainees,
    geofenceZones,
    timeRecords,
    evaluations,
    hostSupervisors,
  };
}

// ── Batch Database Insertion Handler ──────────────────────────────────────────
export async function seedDemoTraineesToDatabase(
  onProgress?: (step: string, percent: number) => void
): Promise<{ success: boolean; count: number; message: string }> {
  try {
    onProgress?.('Generating 120 realistic trainee profiles & records...', 10);
    const data = generate120DemoTrainees();

    if (!isSupabaseConfigured()) {
      // LocalStorage mode
      onProgress?.('Persisting 120 demo trainees to local storage...', 50);
      const existingEmps = JSON.parse(localStorage.getItem('ojt_employees') || '[]');
      const filteredEmps = existingEmps.filter((e: any) => !e.employeeId?.startsWith(DEMO_TAG_PREFIX));
      localStorage.setItem('ojt_employees', JSON.stringify([...data.trainees, ...filteredEmps]));

      const existingRecords = JSON.parse(localStorage.getItem('ojt_time_records') || '[]');
      const filteredRecords = existingRecords.filter((r: any) => !r.employeeId?.startsWith(DEMO_TAG_PREFIX));
      localStorage.setItem('ojt_time_records', JSON.stringify([...data.timeRecords, ...filteredRecords]));

      const existingEvals = JSON.parse(localStorage.getItem('ojt_evaluations') || '[]');
      const filteredEvals = existingEvals.filter((v: any) => !v.employeeId?.startsWith(DEMO_TAG_PREFIX));
      localStorage.setItem('ojt_evaluations', JSON.stringify([...data.evaluations, ...filteredEvals]));

      onProgress?.('Completed! 120 demo trainees loaded.', 100);
      return {
        success: true,
        count: 120,
        message: 'Successfully seeded 120 demo trainees into local storage.',
      };
    }

    // 1. Insert Host Supervisors
    onProgress?.('Synchronizing 10 partner HTE establishments...', 20);
    const supabaseHosts = data.hostSupervisors.map((h) => ({
      id: h.id,
      employee_id: h.employeeId,
      name: h.name,
      email: h.email,
      company_name: h.companyName,
      company_address: h.companyAddress,
      contact_person: h.contactPerson,
      phone: h.phone,
      academic_year: h.academicYear,
      is_approved: true,
      active: true,
    }));
    await supabase.from('host_supervisors').upsert(supabaseHosts, { onConflict: 'id' });

    // 2. Insert Trainees in batches of 30
    onProgress?.('Inserting 120 trainees into Supabase database...', 40);
    const supabaseTrainees = data.trainees.map((t) => ({
      id: t.id,
      name: t.name,
      employee_id: t.employeeId,
      username: t.username,
      email: t.email,
      phone: t.phone,
      role: 'employee',
      department: t.department,
      position: t.position,
      company_name: t.companyName,
      supervisor_name: t.supervisorName,
      school_name: t.schoolName,
      campus: t.campus,
      course: t.course,
      start_date: t.startDate,
      end_date: t.endDate,
      required_hours: t.requiredHours,
      photo: t.photo,
      face_registered: true,
      active: true,
      hte_id: t.hteId,
      academic_year: t.academicYear,
      approval_status: t.approvalStatus,
      application_status: t.applicationStatus,
      registration_lat: t.registrationLocation?.lat,
      registration_lng: t.registrationLocation?.lng,
      registration_address: t.registrationAddress,
    }));

    const batchSize = 30;
    for (let i = 0; i < supabaseTrainees.length; i += batchSize) {
      const chunk = supabaseTrainees.slice(i, i + batchSize);
      await supabase.from('employees').upsert(chunk, { onConflict: 'id' });
    }

    // 3. Insert Time Records in batches of 100
    onProgress?.('Inserting Daily Time Records (DTR)...', 70);
    const supabaseDtr = data.timeRecords.map((r) => ({
      id: r.id,
      employee_id: r.employeeId,
      date: r.date,
      time_in: r.timeIn,
      time_out: r.timeOut,
      total_hours: r.hours,
      status: r.status,
      notes: r.notes,
      time_in_lat: r.timeInLocation?.lat,
      time_in_lng: r.timeInLocation?.lng,
      time_out_lat: r.timeOutLocation?.lat,
      time_out_lng: r.timeOutLocation?.lng,
      time_in_geofenced: true,
      time_out_geofenced: true,
      time_in_face_verified: true,
      time_out_face_verified: true,
    }));

    for (let i = 0; i < supabaseDtr.length; i += 100) {
      const chunk = supabaseDtr.slice(i, i + 100);
      await supabase.from('time_records').upsert(chunk, { onConflict: 'id' });
    }

    // 4. Insert Evaluations
    onProgress?.('Inserting Supervisor evaluations...', 90);
    const supabaseEvals = data.evaluations.map((v: any) => ({
      id: v.id,
      employee_id: v.employeeId,
      supervisor_name: v.supervisorName,
      evaluator_position: v.evaluatorPosition,
      company_name: v.companyName,
      evaluation_date: v.evaluationDate,
      academic_year: v.academicYear,
      total_score: v.totalScore,
      remarks: v.remarks,
    }));
    await supabase.from('evaluations').upsert(supabaseEvals, { onConflict: 'id' });

    onProgress?.('Complete! 120 demo trainees seeded successfully.', 100);
    return {
      success: true,
      count: 120,
      message: 'Successfully seeded 120 demo accounts with authentic DTRs, HTEs, and evaluations.',
    };
  } catch (err: any) {
    console.error('seedDemoTraineesToDatabase error:', err);
    return {
      success: false,
      count: 0,
      message: err.message || 'Failed to seed demo accounts.',
    };
  }
}

// ── Batch Demo Cleanup / Rollback Handler ──────────────────────────────────────
export async function removeDemoTraineesFromDatabase(
  onProgress?: (step: string, percent: number) => void
): Promise<{ success: boolean; message: string }> {
  try {
    onProgress?.('Removing demo time records...', 20);
    if (isSupabaseConfigured()) {
      await supabase.from('time_records').delete().ilike('employee_id', `${DEMO_TAG_PREFIX}%`);
      onProgress?.('Removing demo evaluations...', 50);
      await supabase.from('evaluations').delete().ilike('employee_id', `${DEMO_TAG_PREFIX}%`);
      onProgress?.('Removing demo trainee accounts...', 80);
      await supabase.from('employees').delete().ilike('employee_id', `${DEMO_TAG_PREFIX}%`);
    }

    // Clear local storage demo copies
    const cleanStorage = (key: string, idField: string) => {
      try {
        const items = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = items.filter((item: any) => !item[idField]?.startsWith(DEMO_TAG_PREFIX));
        localStorage.setItem(key, JSON.stringify(filtered));
      } catch {}
    };

    cleanStorage('ojt_employees', 'employeeId');
    cleanStorage('ojt_time_records', 'employeeId');
    cleanStorage('ojt_evaluations', 'employeeId');

    onProgress?.('Demo accounts removed completely.', 100);
    return {
      success: true,
      message: 'Successfully removed all 120 demo trainees, records, and evaluations.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || 'Failed to remove demo accounts.',
    };
  }
}
