// TfL Unified API client and response parsing.
//
// Data source: Transport for London Unified API, https://api.tfl.gov.uk
// No API key is used. Anonymous requests are rate limited by TfL
// (50 requests/minute at the time of writing); the app fetches all
// tracked lines in a single request and refreshes at most once a minute.

export const TFL_STATUS_URL =
  'https://api.tfl.gov.uk/Line/bakerloo,central,circle,district,dlr,elizabeth,hammersmith-city,jubilee,liberty,lioness,metropolitan,mildmay,northern,piccadilly,suffragette,victoria,waterloo-city,weaver,windrush/Status';

export interface LineInfo {
  /** TfL line id, as used in the API URL. */
  id: string;
  /** Display name. */
  name: string;
  /** TfL brand colour, used for the line badge. */
  colour: string;
}

/** Lines tracked by the app, in the order they are shown. */
export const LINES: LineInfo[] = [
  { id: 'elizabeth', name: 'Elizabeth line', colour: '#6950a1' },
  { id: 'central', name: 'Central', colour: '#dc241f' },
  { id: 'jubilee', name: 'Jubilee', colour: '#868f98' },
  { id: 'northern', name: 'Northern', colour: '#000000' },
  { id: 'piccadilly', name: 'Piccadilly', colour: '#0019a8' },
  { id: 'victoria', name: 'Victoria', colour: '#00a0e2' },
  { id: 'district', name: 'District', colour: '#007229' },
  { id: 'circle', name: 'Circle', colour: '#ffce00' },
  { id: 'metropolitan', name: 'Metropolitan', colour: '#751056' },
  { id: 'hammersmith-city', name: 'Hammersmith & City', colour: '#d799af' },
  { id: 'waterloo-city', name: 'Waterloo & City', colour: '#76d0bd' },
  { id: 'bakerloo', name: 'Bakerloo', colour: '#b36305' },
  { id: 'dlr', name: 'DLR', colour: '#00afad' },
  // London Overground is split into named lines by TfL.
  { id: 'lioness', name: 'Lioness (Overground)', colour: '#e87722' },
  { id: 'mildmay', name: 'Mildmay (Overground)', colour: '#ec6488' },
  { id: 'suffragette', name: 'Suffragette (Overground)', colour: '#9b6cbf' },
  { id: 'weaver', name: 'Weaver (Overground)', colour: '#8a5a00' },
  { id: 'windrush', name: 'Windrush (Overground)', colour: '#dc241f' },
  { id: 'liberty', name: 'Liberty (Overground)', colour: '#b26300' },
];

export interface LineStatus {
  id: string;
  name: string;
  /** e.g. "Good Service", "Minor Delays", "Severe Delays". */
  severityDescription: string;
  /** Numeric severity from TfL; 10 is Good Service, lower is worse. */
  severity: number;
  /** Disruption reason, when TfL supplies one. */
  reason: string | null;
  /** Short disruption descriptions, when TfL supplies them. */
  disruptionDescriptions: string[];
}

/** True when the line is not running a good service. */
export function isDisrupted(status: LineStatus): boolean {
  return status.severity < 10;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Parse one TfL line object into a LineStatus.
 * Returns null for entries that do not carry a usable line id.
 */
export function parseLine(raw: unknown): LineStatus | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id);
  if (!id) return null;
  const name = asString(raw.name) ?? id;

  const statuses = Array.isArray(raw.lineStatuses) ? raw.lineStatuses : [];
  const first = statuses.length > 0 && isRecord(statuses[0]) ? statuses[0] : null;
  const severity =
    typeof first?.statusSeverity === 'number' ? first.statusSeverity : 10;
  const severityDescription =
    asString(first?.statusSeverityDescription) ?? 'Unknown';
  const reason = asString(first?.reason)?.trim() || null;

  const disruptions = Array.isArray(raw.disruptions) ? raw.disruptions : [];
  const disruptionDescriptions = disruptions
    .filter(isRecord)
    .map((d) => asString(d.description))
    .filter((d): d is string => d !== null);

  return { id, name, severity, severityDescription, reason, disruptionDescriptions };
}

/**
 * Parse a TfL /Line/.../Status response body into statuses keyed by line id.
 * Unknown or malformed entries are skipped; a non-array body yields no lines.
 */
export function parseLineStatuses(data: unknown): LineStatus[] {
  if (!Array.isArray(data)) return [];
  const parsed: LineStatus[] = [];
  for (const raw of data) {
    const status = parseLine(raw);
    if (status) parsed.push(status);
  }
  return parsed;
}

/**
 * Fetch live status for every tracked line in a single TfL request.
 * Throws on network failure, timeout or a non-2xx response, so the
 * caller can show the offline / API failure state.
 */
export async function fetchLineStatuses(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<LineStatus[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(TFL_STATUS_URL, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`TfL API returned HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    return parseLineStatuses(data);
  } finally {
    clearTimeout(timer);
  }
}
