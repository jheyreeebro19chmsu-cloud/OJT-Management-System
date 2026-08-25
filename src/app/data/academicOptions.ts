export const campusOptions = [
  'Talisay Campus',
  'Fortune Towne Campus',
  'Alijis Campus',
  'Binalbagan Campus',
] as const;

export const departmentOptions = [
  'College of Fisheries',
  'College of Computer Studies',
  'College of Arts and Science',
  'College of Education',
  'College of Industrial Technology',
  'College of Criminal Justice',
  'College of Engineering',
  'College of Business Management and Accountancy',
] as const;

export const campusDepartmentOptions: Record<string, readonly string[]> = Object.fromEntries(
  campusOptions.map((campus) => [campus, departmentOptions])
);

export const courseOptions = [
  'BS Information Technology',
  'BS Computer Science',
  'BS Computer Engineering',
  'BS Business Administration',
  'BS Accountancy',
  'BS Nursing',
  'BS Psychology',
  'BS Education',
  'BS Criminology',
  'BS Civil Engineering',
  'Bachelor of Secondary Education',
  'Bachelor of Elementary Education',
  'Other',
] as const;

export const departmentCourseOptions: Record<string, readonly string[]> = {
  'College of Fisheries': ['Bachelor of Science in Fisheries'],
  'College of Computer Studies': ['BS Information Technology', 'BS Computer Science'],
  'College of Arts and Science': [
    'Bachelor of Arts in English Language',
    'Social Science',
    'Bachelor of Public Administration',
    'Bachelor of Science in Applied Mathematics',
    'Bachelor of Science in Psychology',
  ],
  'College of Education': ['Bachelor of Secondary Education', 'Bachelor of Elementary Education'],
  'College of Industrial Technology': ['BS Industrial Technology'],
  'College of Criminal Justice': ['BS Criminology'],
  'College of Engineering': ['BS Computer Engineering', 'BS Civil Engineering'],
  'College of Business Management and Accountancy': ['BS Business Administration', 'BS Accountancy'],
};

export function getCoursesForDepartment(department: string, campus?: string): readonly string[] {
  if (campus && !campusDepartmentOptions[campus]) return [];
  return departmentCourseOptions[department] || courseOptions;
}
