import * as Location from 'expo-location';

/** One GPS reading, plus whether Android flagged it as coming from a mock
 * location app (`mocked` is Android-only; iOS never sets it). */
export type GpsFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  mocked: boolean;
};

function toFix(loc: Location.LocationObject): GpsFix {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: loc.coords.accuracy ?? null,
    mocked: Boolean(loc.mocked),
  };
}

async function permitted(): Promise<boolean> {
  const perm = await Location.requestForegroundPermissionsAsync();
  return perm.status === 'granted';
}

/** The sharpest fix the phone can give within `maxWaitMs`.
 *
 * A checkpoint fence is a few metres wide, and the first fix after the
 * camera closes is often the coarsest of all - so this watches for a few
 * seconds and keeps the best one, stopping early once it is good enough.
 * `onUpdate` reports the accuracy as it improves, for the waiting UI.
 * Any mocked reading marks the result mocked: one is enough to know a
 * location-changing app is running. */
export async function bestFix(opts: {
  targetAccuracy?: number;
  maxWaitMs?: number;
  onUpdate?: (accuracy: number | null) => void;
} = {}): Promise<GpsFix | null> {
  const { targetAccuracy = 8, maxWaitMs = 12000, onUpdate } = opts;
  if (!(await permitted())) return null;

  return new Promise((resolve) => {
    let best: GpsFix | null = null;
    let anyMocked = false;
    let sub: Location.LocationSubscription | null = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      sub?.remove();
      clearTimeout(timer);
      resolve(best ? { ...best, mocked: anyMocked || best.mocked } : null);
    };
    const timer = setTimeout(finish, maxWaitMs);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
      (loc) => {
        const fix = toFix(loc);
        anyMocked = anyMocked || fix.mocked;
        if (!best || (fix.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = fix;
        onUpdate?.(best.accuracy);
        if (best.accuracy !== null && best.accuracy <= targetAccuracy) finish();
      },
    )
      .then((s) => {
        sub = s;
        if (finished) s.remove();
      })
      .catch(finish);
  });
}

/** `count` readings over up to `maxWaitMs`, for setting a checkpoint's
 * position: the server averages them, weighting sharp ones more. */
export async function collectReadings(opts: {
  count?: number;
  maxWaitMs?: number;
  onUpdate?: (readings: GpsFix[]) => void;
} = {}): Promise<{ readings: GpsFix[]; mocked: boolean } | null> {
  const { count = 10, maxWaitMs = 30000, onUpdate } = opts;
  if (!(await permitted())) return null;

  return new Promise((resolve) => {
    const readings: GpsFix[] = [];
    let sub: Location.LocationSubscription | null = null;
    let finished = false;

    const finish = () => {
      if (finished) return;
      finished = true;
      sub?.remove();
      clearTimeout(timer);
      resolve({ readings, mocked: readings.some((r) => r.mocked) });
    };
    const timer = setTimeout(finish, maxWaitMs);

    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1500, distanceInterval: 0 },
      (loc) => {
        readings.push(toFix(loc));
        onUpdate?.([...readings]);
        if (readings.length >= count) finish();
      },
    )
      .then((s) => {
        sub = s;
        if (finished) s.remove();
      })
      .catch(finish);
  });
}
