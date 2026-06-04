/**
 * School logo mapping for the mobile app.
 * Kept local to Expo so Metro doesn't need to resolve files outside `ojt-mobile`.
 */

export const SCHOOL_LOGOS: Record<string, string> = {
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

export function getSchoolLogo(schoolName?: string): string | null {
  if (!schoolName) return null;

  const normalizedSchoolName = schoolName.toLowerCase();

  const directMatch = Object.entries(SCHOOL_LOGOS).find(([key]) => key.toLowerCase() === normalizedSchoolName);
  if (directMatch) return directMatch[1];

  const partialMatch = Object.entries(SCHOOL_LOGOS).find(
    ([key]) => normalizedSchoolName.includes(key.toLowerCase()) || key.toLowerCase().includes(normalizedSchoolName)
  );

  return partialMatch ? partialMatch[1] : null;
}
