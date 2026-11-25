import { describe, expect, it } from '@jest/globals';
import {
  fetchLineStatuses,
  isDisrupted,
  parseLine,
  parseLineStatuses,
} from '../tfl';

// Shape taken from a live TfL response on 25 November 2026:
// Northern line, minor delays with a reason string.
const northernMinorDelays = {
  $type: 'Tfl.Api.Presentation.Entities.Line, Tfl.Api.Presentation.Entities',
  id: 'northern',
  name: 'Northern',
  modeName: 'tube',
  disruptions: [],
  lineStatuses: [
    {
      $type: 'Tfl.Api.Presentation.Entities.LineStatus, Tfl.Api.Presentation.Entities',
      id: 0,
      statusSeverity: 9,
      statusSeverityDescription: 'Minor Delays',
      reason: 'Northern Line: Minor delays due to train cancellations.  ',
      validityPeriods: [],
    },
  ],
  routeSections: [],
  serviceTypes: [],
};

const elizabethGoodService = {
  id: 'elizabeth',
  name: 'Elizabeth line',
  modeName: 'elizabeth-line',
  disruptions: [],
  lineStatuses: [
    {
      id: 0,
      statusSeverity: 10,
      statusSeverityDescription: 'Good Service',
      validityPeriods: [],
    },
  ],
};

const withDisruption = {
  id: 'central',
  name: 'Central',
  disruptions: [
    {
      category: 'PlannedWork',
      description: 'No service between Epping and Woodford.',
    },
  ],
  lineStatuses: [
    {
      id: 0,
      statusSeverity: 6,
      statusSeverityDescription: 'Part Suspended',
      reason: 'Central Line: No service between Epping and Woodford.',
    },
  ],
};

describe('parseLine', () => {
  it('parses a good service line', () => {
    expect(parseLine(elizabethGoodService)).toEqual({
      id: 'elizabeth',
      name: 'Elizabeth line',
      severity: 10,
      severityDescription: 'Good Service',
      reason: null,
      disruptionDescriptions: [],
    });
  });

  it('parses minor delays with the disruption reason', () => {
    const parsed = parseLine(northernMinorDelays);
    expect(parsed).not.toBeNull();
    expect(parsed?.severity).toBe(9);
    expect(parsed?.severityDescription).toBe('Minor Delays');
    expect(parsed?.reason).toBe('Northern Line: Minor delays due to train cancellations.');
  });

  it('parses disruption descriptions', () => {
    const parsed = parseLine(withDisruption);
    expect(parsed?.severityDescription).toBe('Part Suspended');
    expect(parsed?.disruptionDescriptions).toEqual([
      'No service between Epping and Woodford.',
    ]);
  });

  it('returns null for entries without a line id', () => {
    expect(parseLine({ name: 'No id' })).toBeNull();
    expect(parseLine(null)).toBeNull();
    expect(parseLine('northern')).toBeNull();
  });

  it('defaults to good service when no status is present', () => {
    const parsed = parseLine({ id: 'victoria', name: 'Victoria', lineStatuses: [] });
    expect(parsed?.severity).toBe(10);
    expect(parsed?.severityDescription).toBe('Unknown');
  });
});

describe('parseLineStatuses', () => {
  it('parses a full response and skips malformed entries', () => {
    const parsed = parseLineStatuses([
      elizabethGoodService,
      northernMinorDelays,
      { name: 'missing id' },
      null,
    ]);
    expect(parsed.map((line) => line.id)).toEqual(['elizabeth', 'northern']);
  });

  it('returns an empty list for a non-array body', () => {
    expect(parseLineStatuses({ error: 'not found' })).toEqual([]);
    expect(parseLineStatuses(null)).toEqual([]);
  });
});

describe('isDisrupted', () => {
  it('treats good service as not disrupted and anything lower as disrupted', () => {
    const good = parseLine(elizabethGoodService);
    const delayed = parseLine(northernMinorDelays);
    expect(good && isDisrupted(good)).toBe(false);
    expect(delayed && isDisrupted(delayed)).toBe(true);
  });
});

describe('fetchLineStatuses', () => {
  it('fetches and parses the TfL response', async () => {
    const requestedUrls: unknown[] = [];
    const fetchImpl = (async (url: unknown) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => [elizabethGoodService, northernMinorDelays],
      };
    }) as unknown as typeof fetch;
    const result = await fetchLineStatuses(fetchImpl);
    expect(requestedUrls).toHaveLength(1);
    expect(String(requestedUrls[0])).toContain('api.tfl.gov.uk/Line/');
    expect(result.map((line) => line.id)).toEqual(['elizabeth', 'northern']);
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = (async () => ({ ok: false, status: 429 })) as unknown as typeof fetch;
    await expect(fetchLineStatuses(fetchImpl)).rejects.toThrow('HTTP 429');
  });

  it('throws when the request fails, for example when offline', async () => {
    const fetchImpl = (async () => {
      throw new Error('Network request failed');
    }) as unknown as typeof fetch;
    await expect(fetchLineStatuses(fetchImpl)).rejects.toThrow('Network request failed');
  });
});
