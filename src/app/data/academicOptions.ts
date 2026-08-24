export const campusOptions = [
  'Talisay Campus',
  'Fortune Towne Campus',
  'Alijis Campus',
  'Binalbagan Campus',
] as const;

export const departmentOptions = [
  'College of Arts and Sciences',
  'College of Business Management and Accountancy',
  'College of Computer Studies',
  'College of Education',
  'College of Engineering',
  'College of Industrial Technology',
] as const;

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
  'College of Arts and Sciences': [
    'Bachelor of Arts in English Language',
    'Social Science',
    'Bachelor of Public Administration',
    'Bachelor of Science in Applied Mathematics',
    'Bachelor of Science in Psychology',
  ],
  'College of Business Management and Accountancy': ['BS Business Administration', 'BS Accountancy'],
  'College of Computer Studies': ['BS Information Technology', 'BS Computer Science'],
  'College of Education': ['Bachelor of Secondary Education', 'Bachelor of Elementary Education'],
  'College of Engineering': ['BS Computer Engineering', 'BS Civil Engineering'],
  'College of Industrial Technology': ['BS Industrial Technology'],
};

export function getCoursesForDepartment(department: string): readonly string[] {
  return departmentCourseOptions[department] || courseOptions;
}
