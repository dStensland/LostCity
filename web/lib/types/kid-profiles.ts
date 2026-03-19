export interface KidProfile {
  id: string;
  user_id: string;
  nickname: string;
  age: number;
  color: string;
  emoji: string | null;
  school_system: 'aps' | 'dekalb' | 'cobb' | 'gwinnett' | null;
  interests: string[];
  created_at: string;
  updated_at: string;
}

export type CreateKidProfileRequest = Pick<KidProfile, 'nickname' | 'age' | 'color'> & {
  emoji?: string;
  school_system?: KidProfile['school_system'];
  interests?: string[];
};

export type UpdateKidProfileRequest = Partial<CreateKidProfileRequest>;

export const KID_COLOR_PRESETS = [
  { name: 'Denim Blue', hex: '#4A7DB5' },
  { name: 'Warm Sienna', hex: '#E07B39' },
  { name: 'Field Sage', hex: '#5E7A5E' },
  { name: 'Summer Sky', hex: '#78B7D0' },
  { name: 'Warm Amber', hex: '#C48B1D' },
  { name: 'Moss', hex: '#7A9E7A' },
  { name: 'Lavender', hex: '#8B7CB8' },
  { name: 'Coral', hex: '#E07070' },
] as const;

export const SCHOOL_SYSTEMS = [
  { value: 'aps', label: 'Atlanta Public Schools' },
  { value: 'dekalb', label: 'DeKalb County' },
  { value: 'cobb', label: 'Cobb County' },
  { value: 'gwinnett', label: 'Gwinnett County' },
] as const;

export const MAX_KIDS = 10;

/** Check if an event/program matches a kid's age. */
export function isAgeMatch(
  kidAge: number,
  ageMin: number | null,
  ageMax: number | null,
): boolean {
  if (ageMin === null && ageMax === null) return true;
  if (ageMin !== null && kidAge < ageMin) return false;
  if (ageMax !== null && kidAge > ageMax) return false;
  return true;
}

/** Return all kids whose age falls within the given range. */
export function getMatchingKids(
  kids: KidProfile[],
  ageMin: number | null,
  ageMax: number | null,
): KidProfile[] {
  return kids.filter((kid) => isAgeMatch(kid.age, ageMin, ageMax));
}
