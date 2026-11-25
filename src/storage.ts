// Local persistence for favourites and commute preferences.
// Everything is stored on-device with AsyncStorage. There are no
// accounts and nothing is sent to a server.

import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVOURITES_KEY = 'line-check:favourites:v1';
const COMMUTE_KEY = 'line-check:commute:v1';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface CommutePreferences {
  morningTime: string;
  eveningTime: string;
  days: Weekday[];
  homeStation: string;
  workStation: string;
}

export const DEFAULT_COMMUTE: CommutePreferences = {
  morningTime: '07:30',
  eveningTime: '17:30',
  days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  homeStation: 'Abbey Wood',
  workStation: 'Liverpool Street',
};

export const DEFAULT_FAVOURITES: string[] = ['elizabeth'];

export async function loadFavourites(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
    if (!raw) return DEFAULT_FAVOURITES;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_FAVOURITES;
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    return DEFAULT_FAVOURITES;
  }
}

export async function saveFavourites(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(ids));
}

export async function loadCommute(): Promise<CommutePreferences> {
  try {
    const raw = await AsyncStorage.getItem(COMMUTE_KEY);
    if (!raw) return DEFAULT_COMMUTE;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return DEFAULT_COMMUTE;
    const p = parsed as Partial<CommutePreferences>;
    return {
      morningTime: typeof p.morningTime === 'string' ? p.morningTime : DEFAULT_COMMUTE.morningTime,
      eveningTime: typeof p.eveningTime === 'string' ? p.eveningTime : DEFAULT_COMMUTE.eveningTime,
      days: Array.isArray(p.days)
        ? p.days.filter((d): d is Weekday => (WEEKDAYS as readonly string[]).includes(d))
        : DEFAULT_COMMUTE.days,
      homeStation: typeof p.homeStation === 'string' ? p.homeStation : DEFAULT_COMMUTE.homeStation,
      workStation: typeof p.workStation === 'string' ? p.workStation : DEFAULT_COMMUTE.workStation,
    };
  } catch {
    return DEFAULT_COMMUTE;
  }
}

export async function saveCommute(prefs: CommutePreferences): Promise<void> {
  await AsyncStorage.setItem(COMMUTE_KEY, JSON.stringify(prefs));
}
