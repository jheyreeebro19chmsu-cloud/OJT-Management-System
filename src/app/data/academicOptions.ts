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
  'Bachelor of Science in Information Systems',
  'Bachelor of Science in Information Technology',
  'Bachelor of Science in Accountancy',
  'Bachelor of Science in Business Administration major in Financial Management',
  'Bachelor of Science in Entrepreneurship',
  'Bachelor of Science in Hospitality Management',
  'Bachelor of Science in Management Accounting',
  'Bachelor of Science in Office Administration',
  'BS Accountancy',
  'Bachelor of Science in Criminology',
  'Bachelor of Science in Civil Engineering',
  'Bachelor of Science in Computer Engineering',
  'Bachelor of Science in Electronics Engineering',
  'Bachelor of Science in Fisheries',
  'Bachelor of Arts in English Language',
  'Social Science',
  'Bachelor of Public Administration',
  'Bachelor of Science in Applied Mathematics',
  'Bachelor of Science in Psychology',
  'Bachelor of Early Childhood Education',
  'Bachelor of Elementary Education',
  'Bachelor of Physical Education',
  'Bachelor of Special Needs Education',
  'Bachelor of Secondary Education',
  'Bachelor of Technology and Livelihood Education major in Home Economics',
  'Bachelor of Technology and Livelihood Education major in Industrial Arts',
  'Bachelor of Technical Vocational Teacher Education major in Electrical Technology',
  'Bachelor of Technical Vocational Teacher Education major in Electronics Technology',
  'Bachelor of Industrial Technology major in Architectural Drafting Technology',
  'Bachelor of Industrial Technology major in Automotive Technology',
  'Bachelor of Industrial Technology major in Computer Technology',
  'Bachelor of Industrial Technology major in Electrical Technology',
  'Bachelor of Industrial Technology major in Electronics Technology',
  'Bachelor of Industrial Technology major in Apparel and Fashion Technology',
  'Bachelor of Industrial Technology major in Culinary Technology',
  'Bachelor of Industrial Technology major in Mechanical Technology',
  'Bachelor of Industrial Technology major in HVACR Technology',
] as const;

const talisayCourses: Record<string, readonly string[]> = {
  'College of Fisheries': ['Bachelor of Science in Fisheries'],
  'College of Computer Studies': [
    'Bachelor of Science in Information Systems',
    'Bachelor of Science in Information Technology',
  ],
  'College of Arts and Science': [
    'Bachelor of Arts in English Language',
    'Social Science',
    'Bachelor of Public Administration',
    'Bachelor of Science in Applied Mathematics',
    'Bachelor of Science in Psychology',
  ],
  'College of Education': [
    'Bachelor of Early Childhood Education',
    'Bachelor of Elementary Education',
    'Bachelor of Physical Education',
    'Bachelor of Secondary Education',
    'Bachelor of Special Needs Education',
    'Bachelor of Technology and Livelihood Education major in Home Economics',
    'Bachelor of Technology and Livelihood Education major in Industrial Arts',
  ],
  'College of Industrial Technology': [
    'Bachelor of Industrial Technology major in Architectural Drafting Technology',
    'Bachelor of Industrial Technology major in Automotive Technology',
    'Bachelor of Industrial Technology major in Electrical Technology',
    'Bachelor of Industrial Technology major in Electronics Technology',
    'Bachelor of Industrial Technology major in Apparel and Fashion Technology',
    'Bachelor of Industrial Technology major in Culinary Technology',
    'Bachelor of Industrial Technology major in Mechanical Technology',
    'Bachelor of Industrial Technology major in HVACR Technology',
  ],
  'College of Criminal Justice': ['Bachelor of Science in Criminology'],
  'College of Engineering': ['Bachelor of Science in Civil Engineering'],
  'College of Business Management and Accountancy': [
    'Bachelor of Science in Accountancy',
    'Bachelor of Science in Business Administration major in Financial Management',
    'Bachelor of Science in Entrepreneurship',
    'Bachelor of Science in Hospitality Management',
    'Bachelor of Science in Management Accounting',
    'Bachelor of Science in Office Administration',
  ],
};

export const campusCourseOptions: Record<string, Record<string, readonly string[]>> = {
  'Talisay Campus': talisayCourses,
  'Fortune Towne Campus': {
    'College of Computer Studies': ['Bachelor of Science in Information Systems'],
    'College of Business Management and Accountancy': [
      'Bachelor of Science in Entrepreneurship',
      'Bachelor of Science in Management Accounting',
    ],
  },
  'Alijis Campus': {
    'College of Computer Studies': ['Bachelor of Science in Information Technology'],
    'College of Education': [
      'Bachelor of Technical Vocational Teacher Education major in Electrical Technology',
      'Bachelor of Technical Vocational Teacher Education major in Electronics Technology',
    ],
    'College of Industrial Technology': [
      'Bachelor of Industrial Technology major in Architectural Drafting Technology',
      'Bachelor of Industrial Technology major in Automotive Technology',
      'Bachelor of Industrial Technology major in Computer Technology',
      'Bachelor of Industrial Technology major in Electrical Technology',
      'Bachelor of Industrial Technology major in Electronics Technology',
      'Bachelor of Industrial Technology major in Culinary Technology',
      'Bachelor of Industrial Technology major in Mechanical Technology',
    ],
    'College of Engineering': [
      'Bachelor of Science in Computer Engineering',
      'Bachelor of Science in Electronics Engineering',
    ],
  },
  'Binalbagan Campus': {
    'College of Computer Studies': ['Bachelor of Science in Information Technology'],
    'College of Business Management and Accountancy': [
      'Bachelor of Science in Business Administration major in Financial Management',
    ],
    'College of Education': [
      'Bachelor of Elementary Education',
      'Bachelor of Secondary Education',
      'Bachelor of Technology and Livelihood Education major in Home Economics',
    ],
  },
};

export function getCoursesForDepartment(department: string, campus?: string): readonly string[] {
  if (campus && campusCourseOptions[campus] && department && campusCourseOptions[campus][department]?.length) {
    return campusCourseOptions[campus][department];
  }
  if (department && talisayCourses[department]?.length) {
    return talisayCourses[department];
  }
  return courseOptions;
}
