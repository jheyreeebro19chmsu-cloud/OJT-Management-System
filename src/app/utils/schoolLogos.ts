/**
 * School Logo Mapping
 * Maps school/university names to their logo URLs
 */

export const SCHOOL_LOGOS: Record<string, string> = {
  // Carlos Hilado Memorial State University (CHMSU)
  'Carlos Hilado Memorial State University': '/chmsu-logo.png',
  'CHMSU': '/chmsu-logo.png',
  'Carlos Hilado': '/chmsu-logo.png',

  // Popular Philippine Universities
  'Polytechnic University of the Philippines': 'https://upload.wikimedia.org/wikipedia/en/5/51/PUP_Logo_Updated.png',
  'De La Salle University': 'https://upload.wikimedia.org/wikipedia/en/7/74/DLSU_logo.svg',
  'University of Santo Tomas': 'https://upload.wikimedia.org/wikipedia/en/e/eb/UST_official_seal.png',
  'Ateneo de Manila University': 'https://upload.wikimedia.org/wikipedia/en/1/13/Ateneo_de_Manila_University_logo.svg',
  'UP Diliman': 'https://upload.wikimedia.org/wikipedia/en/5/50/University_of_the_Philippines_Diliman_seal.png',
  'Mapua University': 'https://upload.wikimedia.org/wikipedia/en/0/06/Mapua_University_Logo.png',
  'FEU': 'https://upload.wikimedia.org/wikipedia/en/2/22/Far_Eastern_University_Logo.svg',
  'Philippine Normal University': 'https://upload.wikimedia.org/wikipedia/en/a/a9/PNU_Seal.png',
  'ADMU': 'https://upload.wikimedia.org/wikipedia/en/1/13/Ateneo_de_Manila_University_logo.svg',
  'PUP': 'https://upload.wikimedia.org/wikipedia/en/5/51/PUP_Logo_Updated.png',
  'DLSU': 'https://upload.wikimedia.org/wikipedia/en/7/74/DLSU_logo.svg',
  'UST': 'https://upload.wikimedia.org/wikipedia/en/e/eb/UST_official_seal.png',
};

/**
 * Get school logo URL by school name
 * Performs case-insensitive lookup with partial matching
 */
export function getSchoolLogo(schoolName?: string): string | null {
  if (!schoolName) return null;

  // Direct match (case-insensitive)
  const directMatch = Object.entries(SCHOOL_LOGOS).find(
    ([key]) => key.toLowerCase() === schoolName.toLowerCase()
  );
  if (directMatch) return directMatch[1];

  // Partial match
  const partialMatch = Object.entries(SCHOOL_LOGOS).find(
    ([key]) =>
      schoolName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(schoolName.toLowerCase())
  );
  if (partialMatch) return partialMatch[1];

  return null;
}
