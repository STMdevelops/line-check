import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { fetchLineStatuses, isDisrupted, LINES, type LineInfo, type LineStatus } from './src/tfl';
import {
  DEFAULT_COMMUTE,
  loadCommute,
  loadFavourites,
  saveCommute,
  saveFavourites,
  WEEKDAYS,
  type CommutePreferences,
  type Weekday,
} from './src/storage';

type LoadState = 'loading' | 'ready' | 'error';

function statusColour(status: LineStatus): string {
  if (status.severity >= 10) return '#007229';
  if (status.severity >= 8) return '#b36305';
  return '#c00000';
}

function nextCommuteLabel(prefs: CommutePreferences, now: Date): string {
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][now.getDay()] as Weekday;
  const isCommuteDay = prefs.days.includes(day);
  const morning = prefs.morningTime;
  const evening = prefs.eveningTime;
  const timeNow = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const direction =
    timeNow < morning
      ? `${prefs.homeStation} to ${prefs.workStation} at ${morning}`
      : `${prefs.workStation} to ${prefs.homeStation} at ${evening}`;
  return isCommuteDay ? `Today, ${direction}` : `Next commute day: ${direction}`;
}

function LineRow({
  line,
  status,
  isFavourite,
  onToggleFavourite,
}: {
  line: LineInfo;
  status: LineStatus | undefined;
  isFavourite: boolean;
  onToggleFavourite: () => void;
}) {
  const disrupted = status ? isDisrupted(status) : false;
  return (
    <View style={styles.lineRow}>
      <View style={[styles.lineBadge, { backgroundColor: line.colour }]}>
        <Text style={styles.lineBadgeText}>{line.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.lineText}>
        <Text style={styles.lineName}>{line.name}</Text>
        {status ? (
          <>
            <Text style={[styles.lineStatus, { color: statusColour(status) }]}>
              {status.severityDescription}
            </Text>
            {status.reason ? <Text style={styles.lineReason}>{status.reason}</Text> : null}
            {status.disruptionDescriptions.map((description) => (
              <Text key={description} style={styles.lineReason}>
                {description}
              </Text>
            ))}
          </>
        ) : (
          <Text style={styles.lineReason}>Status unavailable</Text>
        )}
      </View>
      <Pressable
        onPress={onToggleFavourite}
        accessibilityLabel={`${isFavourite ? 'Remove' : 'Add'} ${line.name} ${isFavourite ? 'from' : 'to'} favourites`}
        style={styles.starButton}
      >
        <Text style={[styles.star, isFavourite && styles.starActive]}>
          {isFavourite ? '★' : '☆'}
        </Text>
      </Pressable>
      {disrupted ? <View style={styles.disruptedDot} /> : null}
    </View>
  );
}

export default function App() {
  const [statuses, setStatuses] = useState<LineStatus[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [commute, setCommute] = useState<CommutePreferences>(DEFAULT_COMMUTE);
  const [showSettings, setShowSettings] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoadState('loading');
    setErrorMessage(null);
    try {
      const fresh = await fetchLineStatuses();
      if (!mounted.current) return;
      setStatuses(fresh);
      setLastUpdated(new Date());
      setLoadState('ready');
    } catch (error) {
      if (!mounted.current) return;
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load TfL status.',
      );
      setLoadState(statuses.length > 0 ? 'ready' : 'error');
    }
  }, [statuses.length]);

  useEffect(() => {
    mounted.current = true;
    void loadFavourites().then((ids) => {
      if (mounted.current) setFavourites(ids);
    });
    void loadCommute().then((prefs) => {
      if (mounted.current) setCommute(prefs);
    });
    void load();
    const timer = setInterval(() => void load(true), 60_000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const toggleFavourite = useCallback((id: string) => {
    setFavourites((current) => {
      const next = current.includes(id)
        ? current.filter((favourite) => favourite !== id)
        : [...current, id];
      void saveFavourites(next);
      return next;
    });
  }, []);

  const updateCommute = useCallback((patch: Partial<CommutePreferences>) => {
    setCommute((current) => {
      const next = { ...current, ...patch };
      void saveCommute(next);
      return next;
    });
  }, []);

  const statusById = useMemo(
    () => new Map(statuses.map((status) => [status.id, status])),
    [statuses],
  );

  const favouriteLines = LINES.filter((line) => favourites.includes(line.id));
  const favouriteDisrupted = favouriteLines.some((line) => {
    const status = statusById.get(line.id);
    return status ? isDisrupted(status) : false;
  });
  const disruptedCount = statuses.filter(isDisrupted).length;

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.title}>line-check</Text>
        <Text style={styles.subtitle}>Know before you go.</Text>

        <View style={styles.commuteCard}>
          <Text style={styles.sectionTitle}>Your commute</Text>
          <Text style={styles.commuteText}>{nextCommuteLabel(commute, new Date())}</Text>
          <Text style={styles.commuteText}>
            {commute.days.join(', ')} at {commute.morningTime} and {commute.eveningTime}
          </Text>
          {favouriteDisrupted ? (
            <Text style={styles.alertText}>
              Disruption on one of your favourite lines. Check below before you leave.
            </Text>
          ) : (
            <Text style={styles.okText}>Your favourite lines are running normally.</Text>
          )}
        </View>

        {loadState === 'loading' && statuses.length === 0 ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.stateText}>Checking TfL status…</Text>
          </View>
        ) : null}

        {loadState === 'error' ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>Could not load TfL status</Text>
            <Text style={styles.stateText}>
              {errorMessage?.includes('Network')
                ? 'You appear to be offline. Check your connection and try again.'
                : 'TfL did not return live status. Try again in a moment.'}
            </Text>
            {errorMessage ? <Text style={styles.stateDetail}>{errorMessage}</Text> : null}
            <Pressable style={styles.retryButton} onPress={() => void load()}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {loadState === 'ready' && errorMessage ? (
          <View style={styles.warningBox}>
            <Text style={styles.stateText}>
              Showing the last loaded status. Refresh failed: {errorMessage}
            </Text>
          </View>
        ) : null}

        {statuses.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Favourites</Text>
            {favouriteLines.length === 0 ? (
              <Text style={styles.stateText}>
                No favourites yet. Tap the star on a line below to add it.
              </Text>
            ) : (
              favouriteLines.map((line) => (
                <LineRow
                  key={line.id}
                  line={line}
                  status={statusById.get(line.id)}
                  isFavourite
                  onToggleFavourite={() => toggleFavourite(line.id)}
                />
              ))
            )}

            <Text style={styles.sectionTitle}>
              All lines {disruptedCount > 0 ? `(${disruptedCount} disrupted)` : ''}
            </Text>
            {LINES.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                status={statusById.get(line.id)}
                isFavourite={favourites.includes(line.id)}
                onToggleFavourite={() => toggleFavourite(line.id)}
              />
            ))}

            {lastUpdated ? (
              <Text style={styles.updatedText}>
                Last updated {lastUpdated.toLocaleTimeString()} · Data: Transport for London
              </Text>
            ) : null}
          </>
        ) : null}

        <Pressable style={styles.settingsToggle} onPress={() => setShowSettings((v) => !v)}>
          <Text style={styles.settingsToggleText}>
            {showSettings ? 'Hide commute settings' : 'Commute settings'}
          </Text>
        </Pressable>

        {showSettings ? (
          <View style={styles.settingsBox}>
            <Text style={styles.fieldLabel}>Home station</Text>
            <TextInput
              style={styles.input}
              value={commute.homeStation}
              onChangeText={(value) => updateCommute({ homeStation: value })}
              placeholder="Abbey Wood"
            />
            <Text style={styles.fieldLabel}>Work station</Text>
            <TextInput
              style={styles.input}
              value={commute.workStation}
              onChangeText={(value) => updateCommute({ workStation: value })}
              placeholder="Liverpool Street"
            />
            <Text style={styles.fieldLabel}>Morning departure (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={commute.morningTime}
              onChangeText={(value) => updateCommute({ morningTime: value })}
              placeholder="07:30"
            />
            <Text style={styles.fieldLabel}>Evening departure (HH:MM)</Text>
            <TextInput
              style={styles.input}
              value={commute.eveningTime}
              onChangeText={(value) => updateCommute({ eveningTime: value })}
              placeholder="17:30"
            />
            <Text style={styles.fieldLabel}>Commute days</Text>
            <View style={styles.daysRow}>
              {WEEKDAYS.map((day) => {
                const active = commute.days.includes(day);
                return (
                  <Pressable
                    key={day}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() =>
                      updateCommute({
                        days: active
                          ? commute.days.filter((d) => d !== day)
                          : [...commute.days, day],
                      })
                    }
                  >
                    <Text style={[styles.dayText, active && styles.dayTextActive]}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.stateText}>
              Push notifications are not in this MVP. The app refreshes while open and
              once a minute in the foreground.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f2' },
  scroll: { padding: 20, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: '800', color: '#111111' },
  subtitle: { fontSize: 16, color: '#555555', marginTop: 2, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8, color: '#111111' },
  commuteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0da',
  },
  commuteText: { fontSize: 15, color: '#333333', marginTop: 4 },
  alertText: { fontSize: 15, fontWeight: '700', color: '#c00000', marginTop: 10 },
  okText: { fontSize: 15, fontWeight: '600', color: '#007229', marginTop: 10 },
  stateBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0da',
  },
  warningBox: {
    backgroundColor: '#fff8e1',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e6c87a',
  },
  stateTitle: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  stateText: { fontSize: 14, color: '#555555', textAlign: 'center', marginTop: 8 },
  stateDetail: { fontSize: 12, color: '#888888', marginTop: 8, textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: '#ffffff', fontWeight: '700' },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0da',
  },
  lineBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lineBadgeText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  lineText: { flex: 1 },
  lineName: { fontSize: 16, fontWeight: '700', color: '#111111' },
  lineStatus: { fontSize: 14, fontWeight: '600', marginTop: 2 },
  lineReason: { fontSize: 13, color: '#555555', marginTop: 2 },
  starButton: { padding: 4 },
  star: { fontSize: 24, color: '#bbbbbb' },
  starActive: { color: '#e6a817' },
  disruptedDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#c00000',
    marginTop: 6,
    marginLeft: 6,
  },
  updatedText: { fontSize: 12, color: '#888888', marginTop: 12, textAlign: 'center' },
  settingsToggle: { marginTop: 20, paddingVertical: 10 },
  settingsToggleText: { fontSize: 15, fontWeight: '700', color: '#111111' },
  settingsBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0da',
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#333333', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
    fontSize: 15,
    backgroundColor: '#ffffff',
  },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  dayChip: {
    borderWidth: 1,
    borderColor: '#cccccc',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  dayChipActive: { backgroundColor: '#111111', borderColor: '#111111' },
  dayText: { fontSize: 13, color: '#333333' },
  dayTextActive: { color: '#ffffff' },
});
