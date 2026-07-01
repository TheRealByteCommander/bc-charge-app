import { create } from 'zustand';
import { getStationById, getStationDataSource, getStations, setStationsFromOfflineCache } from '../data/stations';
import type { StationDataSource } from '../data/stationRegistry';
import { defaultChargingPlan, normalizeChargingPlan } from '../data/chargingPlan';
import { computeTier, tierThresholds } from '../data/rewards';
import {
  claimChallengeReward,
  defaultGamification,
  formatGamificationToast,
  getWeekKey,
  normalizeGamification,
  processReportGamification,
  processSessionGamification,
  syncPendingChallenges,
} from '../services/gamification';
import { defaultStationFilters, type StationFilterState } from '../types/filters';
import { applyStationFilters, searchStations } from '../utils/stationFilters';
import { loadStationsOfflineCache, saveStationsOfflineCache } from '../utils/offlineCache';
import { haversineKm } from '../utils/geo';
import { notifySessionComplete } from '../services/browserNotifications';
import { checkFavoriteAvailability } from '../services/favoriteAvailability';
import { recordStationSuccess } from '../services/stationTrust';
import {
  pollCitrineosSession,
  startCitrineosCharge,
  stopCitrineosCharge,
  syncStationsFromCitrineos,
} from '../services/citrineosSync';
import {
  chargeChargingSession,
  detachStripePaymentMethod,
  ensureStripeCustomer,
  fetchStripePaymentMethods,
  isStripeBackendReady,
  setDefaultStripePaymentMethod,
} from '../services/stripeService';
import type {
  ChargingSession,
  Connector,
  NotificationPrefs,
  PaymentMethod,
  Station,
  UserProfile,
  Vehicle,
} from '../types';
import { hashPassword, upgradePasswordHashIfLegacy, verifyPassword } from '../utils/password';
import { generateId, generateMembershipId } from '../utils/format';
import { getGeoConsent } from '../utils/geoConsent';
import { downloadUserDataExport, purgeUserLocalData } from '../utils/privacy';
import {
  deleteAccountRemote,
  downloadExportFromServer,
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
} from '../api/backend/auth';
import { fetchRedeemedRewards, patchProfile, redeemRewardRemote } from '../api/backend/profile';
import {
  completeSessionRemote,
  fetchSessions,
  saveSession,
  updateSession,
} from '../api/backend/sessions';
import { isBackendMode } from '../services/backendMode';
import {
  getCurrentUserId,
  isOnboardingDone,
  loadRedeemed,
  loadSessions,
  loadUsers,
  saveRedeemed,
  saveSessions,
  saveUsers,
  setCurrentUserId,
  setOnboardingDone,
} from '../utils/storage';

interface AppState {
  initialized: boolean;
  onboardingDone: boolean;
  user: UserProfile | null;
  sessions: ChargingSession[];
  activeSession: ChargingSession | null;
  redeemedRewardIds: string[];
  userLocation: { lat: number; lng: number } | null;
  searchQuery: string;
  stationFilters: StationFilterState;
  toast: string | null;
  citrineosConnected: boolean;
  citrineosSyncError: string | null;
  stationDataSource: StationDataSource;
  citrineosSyncing: boolean;
  /** Zeitpunkt des letzten CitrineOS-Tarif-Syncs (ISO) */
  pricingSyncedAt: string | null;
  stripeReady: boolean;

  init: () => Promise<void>;
  syncStripePayments: () => Promise<void>;
  refreshCitrineosData: () => Promise<void>;
  completeOnboarding: () => void;
  setToast: (msg: string | null) => void;
  setUserLocation: (loc: { lat: number; lng: number } | null) => void;
  requestUserLocation: () => void;
  setSearchQuery: (q: string) => void;
  setStationFilters: (patch: Partial<StationFilterState>) => void;
  resetStationFilters: () => void;

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
    acceptPrivacy: boolean;
    acceptTerms: boolean;
    marketingOptIn?: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  exportUserData: () => void;
  deleteAccount: () => void;
  logout: () => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  updateNotifications: (prefs: NotificationPrefs) => void;

  toggleFavorite: (stationId: string) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  updateVehicle: (id: string, vehicle: Omit<Vehicle, 'id'>) => void;
  removeVehicle: (id: string) => void;
  addPaymentMethod: (method: Omit<PaymentMethod, 'id'>) => void;
  removePaymentMethod: (id: string) => Promise<void>;
  setDefaultPayment: (id: string) => Promise<void>;

  startSession: (
    stationId: string,
    connectorId: string,
    vehicleId: string,
    paymentMethodId: string
  ) => Promise<{ ok: boolean; error?: string }>;
  tickSession: () => Promise<void>;
  stopSession: () => Promise<void>;

  redeemReward: (rewardId: string, pointsCost: number) => { ok: boolean; error?: string };
  recordCommunityReport: () => void;
  claimWeeklyChallenge: (challengeId: string) => { ok: boolean; error?: string };
  syncGamification: () => void;

  getFilteredStations: () => Station[];
  getNearbyStations: (limit?: number) => Station[];
  distanceKm: (station: Station) => number | null;
}

function seedDemoUser(): UserProfile {
  const demoId = 'user_demo_bc';
  return {
    id: demoId,
    email: 'demo@bc-charge.com',
    passwordHash: 'bc_5c7bd16f', // Legacy-Demo-Hash für demo123 (wird bei Login auf PBKDF2 aktualisiert)
    firstName: 'Anna',
    lastName: 'Schneider',
    phone: '+49 34292 43340',
    memberSince: '2024-03-15T10:00:00.000Z',
    membershipId: 'BC-DEMO2847',
    loyaltyPoints: 2180,
    loyaltyTier: 'silver',
    totalKwh: 486.4,
    totalSessions: 34,
    co2SavedKg: 312,
    favoriteStationIds: ['st-machern-markt', 'st-leipzig-plagwitz'],
    notifications: {
      sessionComplete: true,
      promotions: false,
      stationAvailability: true,
      loyaltyUpdates: true,
    },
    chargingPlan: defaultChargingPlan(),
    gamification: {
      ...defaultGamification(),
      unlockedBadgeIds: ['first_charge', 'silver_tier', 'explorer', 'community'],
      currentStreakDays: 4,
      longestStreakDays: 8,
      lastChargeDay: new Date().toISOString().slice(0, 10),
      weeklyPoints: 420,
      weekKey: getWeekKey(),
      sessionsThisWeek: 2,
      stationsThisWeek: ['st-machern-markt', 'st-leipzig-plagwitz'],
      uniqueStationsCharged: ['st-machern-markt', 'st-leipzig-plagwitz', 'st-grimma-center', 'st-borna-sued'],
      reportsSubmitted: 1,
    },
    vehicles: [
      {
        id: 'v1',
        nickname: 'Alltags-PKW',
        brand: 'VW',
        model: 'ID.4 Pro',
        batteryKwh: 77,
        maxAcKw: 11,
        maxDcKw: 135,
        preferredConnector: 'CCS',
        licensePlate: 'L-BC 404E',
      },
    ],
    paymentMethods: [
      {
        id: 'pm1',
        type: 'card',
        label: 'Visa',
        last4: '4242',
        isDefault: true,
        expiry: '09/28',
      },
    ],
  };
}

function seedDemoSessions(): ChargingSession[] {
  return [
    {
      id: 'sess_demo_1',
      stationId: 'st-machern-markt',
      stationName: 'BC Charge Machern – Schloßplatz',
      connectorId: 'c1',
      connectorType: 'CCS',
      powerKw: 150,
      vehicleId: 'v1',
      paymentMethodId: 'pm1',
      startedAt: '2026-05-28T14:22:00.000Z',
      endedAt: '2026-05-28T14:58:00.000Z',
      status: 'completed',
      energyKwh: 42.8,
      costEur: 21.96,
      pricePerKwh: 0.49,
      sessionFee: 0.99,
      pointsEarned: 54,
    },
    {
      id: 'sess_demo_2',
      stationId: 'st-leipzig-hbf',
      stationName: 'BC Charge Leipzig – Hauptbahnhof',
      connectorId: 'c1',
      connectorType: 'CCS',
      powerKw: 300,
      vehicleId: 'v1',
      paymentMethodId: 'pm1',
      startedAt: '2026-05-20T09:10:00.000Z',
      endedAt: '2026-05-20T09:41:00.000Z',
      status: 'completed',
      energyKwh: 38.2,
      costEur: 20.96,
      pricePerKwh: 0.52,
      sessionFee: 1.29,
      pointsEarned: 48,
    },
  ];
}

function notifyIfSessionComplete(user: UserProfile, session: ChargingSession): void {
  if (user.notifications.sessionComplete) {
    notifySessionComplete(session);
  }
}

function calcCost(energyKwh: number, connector: Connector, minutes: number): number {
  let cost = energyKwh * connector.pricePerKwh + (connector.sessionFee ?? 0);
  if (connector.pricePerMin) cost += minutes * connector.pricePerMin;
  return Math.round(cost * 100) / 100;
}

function calcPoints(energyKwh: number, tier: UserProfile['loyaltyTier']): number {
  return Math.round(energyKwh * 1.2 * tierThresholds[tier].multiplier);
}

/** Aktuellen Nutzer immer frisch aus dem Storage lesen (wichtig nach Registrierung während init läuft). */
function enrichUser(profile: UserProfile): UserProfile {
  return {
    ...profile,
    chargingPlan: normalizeChargingPlan(profile.chargingPlan),
    gamification: normalizeGamification(profile.gamification),
  };
}

function resolveCurrentUser(): UserProfile | null {
  const uid = getCurrentUserId();
  if (!uid) return null;
  const found = loadUsers().find((u) => u.id === uid) ?? null;
  return found ? enrichUser(found) : null;
}

let initRun = 0;

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  onboardingDone: false,
  user: null,
  sessions: [],
  activeSession: null,
  redeemedRewardIds: [],
  userLocation: null,
  searchQuery: '',
  stationFilters: defaultStationFilters(),
  toast: null,
  citrineosConnected: false,
  citrineosSyncError: null,
  stationDataSource: 'static',
  citrineosSyncing: false,
  pricingSyncedAt: null,
  stripeReady: false,

  init: async () => {
    const runId = ++initRun;

    if (isBackendMode()) {
      const sync = await syncStationsFromCitrineos();
      if (runId !== initRun) return;

      const userRaw = await fetchCurrentUser();
      const user = userRaw ? enrichUser(userRaw) : null;
      if (user) setCurrentUserId(user.id);

      let citrineosConnected = false;
      let citrineosSyncError: string | null = null;
      let stationDataSource: StationDataSource = getStationDataSource();
      if (sync.ok) {
        citrineosConnected = true;
        stationDataSource = 'citrineos';
        void saveStationsOfflineCache(getStations(), 'citrineos');
      } else {
        if (sync.error && !sync.error.includes('nicht erreichbar')) {
          citrineosSyncError = sync.error;
        }
        const cached = await loadStationsOfflineCache();
        if (cached && cached.stations.length > 0) {
          setStationsFromOfflineCache(cached.stations);
          stationDataSource = 'offline-cache';
          console.log(`[BC Charge] ${cached.stations.length} Stationen aus Offline-Cache geladen (${cached.source}, ${cached.savedAt})`);
        }
      }

      const sessions = user ? await fetchSessions() : [];
      const redeemedRewardIds = user ? await fetchRedeemedRewards() : [];

      set({
        initialized: true,
        onboardingDone: isOnboardingDone() || get().onboardingDone,
        user,
        sessions,
        activeSession: sessions.find((s) => s.status === 'active') ?? null,
        redeemedRewardIds,
        citrineosConnected,
        citrineosSyncError,
        stationDataSource,
        pricingSyncedAt: sync.ok ? (sync.pricingSyncedAt ?? null) : null,
      });

      if (user) await get().syncStripePayments();
      return;
    }

    let users = loadUsers();
    if (!users.some((u) => u.email === 'demo@bc-charge.com')) {
      users = [...users, seedDemoUser()];
      saveUsers(users);
      const demo = users.find((u) => u.email === 'demo@bc-charge.com')!;
      if (!loadSessions(demo.id).length) saveSessions(demo.id, seedDemoSessions());
    }

    let citrineosConnected = false;
    let citrineosSyncError: string | null = null;
    let stationDataSource: StationDataSource = getStationDataSource();

    const sync = await syncStationsFromCitrineos();
    if (runId !== initRun) return;

    if (sync.ok) {
      citrineosConnected = true;
      stationDataSource = 'citrineos';
      citrineosSyncError = null;
      void saveStationsOfflineCache(getStations(), 'citrineos');
    } else {
      if (sync.error && !sync.error.includes('nicht erreichbar')) {
        citrineosSyncError = sync.error;
      }
      const cached = await loadStationsOfflineCache();
      if (cached && cached.stations.length > 0) {
        setStationsFromOfflineCache(cached.stations);
        stationDataSource = 'offline-cache';
        console.log(`[BC Charge] ${cached.stations.length} Stationen aus Offline-Cache geladen (${cached.source}, ${cached.savedAt})`);
      }
    }

    const user = resolveCurrentUser() ?? get().user;

    set({
      initialized: true,
      onboardingDone: isOnboardingDone() || get().onboardingDone,
      user,
      sessions: user ? loadSessions(user.id) : [],
      activeSession: user ? loadSessions(user.id).find((s) => s.status === 'active') ?? null : null,
      redeemedRewardIds: user ? loadRedeemed(user.id) : [],
      citrineosConnected,
      citrineosSyncError,
      stationDataSource,
      pricingSyncedAt: sync.ok ? (sync.pricingSyncedAt ?? null) : null,
    });

    if (user) {
      await get().syncStripePayments();
    }
  },

  syncStripePayments: async () => {
    const { user } = get();
    if (!user) return;

    const ready = await isStripeBackendReady();
    if (!ready) {
      set({ stripeReady: false });
      return;
    }

    try {
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        customerId = (await ensureStripeCustomer(user)) ?? undefined;
        if (customerId) get().updateProfile({ stripeCustomerId: customerId });
      }
      if (!customerId) {
        set({ stripeReady: false });
        return;
      }
      const methods = await fetchStripePaymentMethods(customerId);
      get().updateProfile({ paymentMethods: methods, stripeCustomerId: customerId });
      set({ stripeReady: true });
    } catch {
      set({ stripeReady: false });
    }
  },

  refreshCitrineosData: async () => {
    set({ citrineosSyncing: true });
    const sync = await syncStationsFromCitrineos();
    const tariffHint =
      sync.ok && sync.tariffCount != null && sync.tariffCount > 0
        ? ` · ${sync.tariffCount} Tarife`
        : '';
    set({
      citrineosSyncing: false,
      citrineosConnected: sync.ok,
      citrineosSyncError: sync.error ?? null,
      stationDataSource: sync.ok ? 'citrineos' : getStationDataSource(),
      pricingSyncedAt: sync.ok ? (sync.pricingSyncedAt ?? null) : get().pricingSyncedAt,
      toast: sync.ok
        ? `${sync.count} Stationen aktualisiert${tariffHint.replace('Tarife', 'Preise')}`
        : 'Stationen konnten nicht aktualisiert werden',
    });
    if (sync.ok) checkFavoriteAvailability(get().user);
  },

  completeOnboarding: () => {
    setOnboardingDone();
    set({ onboardingDone: true });
  },

  setToast: (msg) => set({ toast: msg }),
  setUserLocation: (loc) => set({ userLocation: loc }),

  requestUserLocation: () => {
    if (getGeoConsent() !== 'granted') {
      set({ toast: 'Bitte Standort zuerst erlauben (Banner oder Profil).' });
      return;
    }
    if (!navigator.geolocation) {
      set({ toast: 'Standort wird von diesem Gerät nicht unterstützt.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        set({
          userLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      () => set({ toast: 'Standort konnte nicht ermittelt werden.' }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    );
  },
  setSearchQuery: (q) => set({ searchQuery: q }),
  setStationFilters: (patch) =>
    set((s) => ({ stationFilters: { ...s.stationFilters, ...patch } })),
  resetStationFilters: () => set({ stationFilters: defaultStationFilters() }),

  register: async (data) => {
    if (!data.acceptPrivacy || !data.acceptTerms) {
      return { ok: false, error: 'Bitte Datenschutz und Nutzungsbedingungen bestätigen.' };
    }
    if (isBackendMode()) {
      try {
        const user = enrichUser(await registerUser(data));
        setCurrentUserId(user.id);
        setOnboardingDone();
        set({
          user,
          onboardingDone: true,
          sessions: [],
          activeSession: null,
          redeemedRewardIds: [],
        });
        void get().syncStripePayments();
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Registrierung fehlgeschlagen.',
        };
      }
    }
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: 'Diese E-Mail ist bereits registriert.' };
    }
    const now = new Date().toISOString();
    const marketing = Boolean(data.marketingOptIn);
    const user: UserProfile = {
      id: generateId('user'),
      email: data.email.toLowerCase(),
      passwordHash: await hashPassword(data.password),
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      memberSince: new Date().toISOString(),
      membershipId: generateMembershipId(),
      loyaltyPoints: 250,
      loyaltyTier: 'bronze',
      totalKwh: 0,
      totalSessions: 0,
      co2SavedKg: 0,
      vehicles: [],
      paymentMethods: [],
      favoriteStationIds: [],
      notifications: {
        sessionComplete: true,
        promotions: marketing,
        stationAvailability: false,
        loyaltyUpdates: true,
      },
      chargingPlan: defaultChargingPlan(),
      gamification: defaultGamification(),
      privacyConsentAt: now,
      termsAcceptedAt: now,
      marketingConsentAt: marketing ? now : null,
    };
    users.push(user);
    saveUsers(users);
    setCurrentUserId(user.id);
    setOnboardingDone();
    set({
      user: enrichUser(user),
      onboardingDone: true,
      sessions: [],
      activeSession: null,
      redeemedRewardIds: [],
    });
    void get().syncStripePayments();
    return { ok: true };
  },

  login: async (email, password) => {
    if (isBackendMode()) {
      try {
        const activeUser = enrichUser(await loginUser(email, password));
        const sessions = await fetchSessions();
        const redeemedRewardIds = await fetchRedeemedRewards();
        setCurrentUserId(activeUser.id);
        set({
          user: activeUser,
          sessions,
          activeSession: sessions.find((s) => s.status === 'active') ?? null,
          redeemedRewardIds,
        });
        void get().syncStripePayments();
        return { ok: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'E-Mail oder Passwort ist ungültig.',
        };
      }
    }
    const users = loadUsers();
    const user = users.find((u) => u.email === email.toLowerCase());
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { ok: false, error: 'E-Mail oder Passwort ist ungültig.' };
    }
    const upgradedHash = await upgradePasswordHashIfLegacy(password, user.passwordHash);
    const activeUser = enrichUser(
      upgradedHash !== user.passwordHash ? { ...user, passwordHash: upgradedHash } : user
    );
    if (upgradedHash !== user.passwordHash) {
      saveUsers(users.map((u) => (u.id === user.id ? activeUser : u)));
    }
    const sessions = loadSessions(activeUser.id);
    setCurrentUserId(activeUser.id);
    set({
      user: activeUser,
      sessions,
      activeSession: sessions.find((s) => s.status === 'active') ?? null,
      redeemedRewardIds: loadRedeemed(activeUser.id),
    });
    void get().syncStripePayments();
    return { ok: true };
  },

  exportUserData: () => {
    const { user } = get();
    if (!user) return;
    if (isBackendMode()) {
      void downloadExportFromServer()
        .then(() => set({ toast: 'Datenexport wurde heruntergeladen.' }))
        .catch(() => set({ toast: 'Export fehlgeschlagen.' }));
      return;
    }
    try {
      downloadUserDataExport(user.id);
      set({ toast: 'Datenexport wurde heruntergeladen.' });
    } catch {
      set({ toast: 'Export fehlgeschlagen.' });
    }
  },

  deleteAccount: () => {
    const { user } = get();
    if (!user) return;
    if (isBackendMode()) {
      void deleteAccountRemote();
    } else {
      purgeUserLocalData(user.id);
    }
    setCurrentUserId(null);
    set({
      user: null,
      sessions: [],
      activeSession: null,
      redeemedRewardIds: [],
      userLocation: null,
    });
    set({
      toast: isBackendMode()
        ? 'Ihr Konto wurde gelöscht.'
        : 'Kontodaten auf diesem Gerät wurden gelöscht.',
    });
  },

  logout: () => {
    if (isBackendMode()) void logoutUser();
    setCurrentUserId(null);
    set({ user: null, sessions: [], activeSession: null, redeemedRewardIds: [] });
  },

  updateProfile: (patch) => {
    const { user } = get();
    if (!user) return;
    if (isBackendMode()) {
      void patchProfile(patch).then((updated) => set({ user: enrichUser(updated) }));
      return;
    }
    const updated = { ...user, ...patch, loyaltyTier: computeTier(patch.loyaltyPoints ?? user.loyaltyPoints) };
    const users = loadUsers().map((u) => (u.id === user.id ? updated : u));
    saveUsers(users);
    set({ user: updated });
  },

  updateNotifications: (prefs) => {
    get().updateProfile({ notifications: prefs });
  },

  toggleFavorite: (stationId) => {
    const { user } = get();
    if (!user) return;
    const ids = user.favoriteStationIds.includes(stationId)
      ? user.favoriteStationIds.filter((id) => id !== stationId)
      : [...user.favoriteStationIds, stationId];
    get().updateProfile({ favoriteStationIds: ids });
  },

  addVehicle: (vehicle) => {
    const { user } = get();
    if (!user) return;
    const v: Vehicle = { ...vehicle, id: generateId('veh') };
    get().updateProfile({ vehicles: [...user.vehicles, v] });
  },

  updateVehicle: (id, vehicle) => {
    const { user } = get();
    if (!user) return;
    get().updateProfile({
      vehicles: user.vehicles.map((v) => (v.id === id ? { ...vehicle, id } : v)),
    });
  },

  removeVehicle: (id) => {
    const { user } = get();
    if (!user) return;
    get().updateProfile({ vehicles: user.vehicles.filter((v) => v.id !== id) });
  },

  addPaymentMethod: (method) => {
    const { user } = get();
    if (!user) return;
    const pm: PaymentMethod = { ...method, id: generateId('pm') };
    const list = method.isDefault
      ? user.paymentMethods.map((p) => ({ ...p, isDefault: false }))
      : user.paymentMethods;
    get().updateProfile({ paymentMethods: [...list, pm] });
  },

  removePaymentMethod: async (id) => {
    const { user, stripeReady } = get();
    if (!user) return;
    const pm = user.paymentMethods.find((p) => p.id === id);
    if (stripeReady && user.stripeCustomerId && pm?.stripePaymentMethodId) {
      await detachStripePaymentMethod(user.stripeCustomerId, pm.stripePaymentMethodId);
      await get().syncStripePayments();
      return;
    }
    get().updateProfile({ paymentMethods: user.paymentMethods.filter((p) => p.id !== id) });
  },

  setDefaultPayment: async (id) => {
    const { user, stripeReady } = get();
    if (!user) return;
    const pm = user.paymentMethods.find((p) => p.id === id);
    if (stripeReady && user.stripeCustomerId && pm?.stripePaymentMethodId) {
      await setDefaultStripePaymentMethod(user.stripeCustomerId, pm.stripePaymentMethodId);
      await get().syncStripePayments();
      return;
    }
    get().updateProfile({
      paymentMethods: user.paymentMethods.map((p) => ({ ...p, isDefault: p.id === id })),
    });
  },

  startSession: async (stationId, connectorId, vehicleId, paymentMethodId) => {
    const { user, activeSession, citrineosConnected } = get();
    if (!user) return { ok: false, error: 'Bitte melden Sie sich an.' };
    if (activeSession) return { ok: false, error: 'Es läuft bereits eine Ladesitzung.' };
    if (user.paymentMethods.length === 0) {
      return { ok: false, error: 'Bitte hinterlegen Sie eine Zahlungsmethode unter Profil → Zahlung.' };
    }
    const station = getStationById(stationId);
    if (!station) return { ok: false, error: 'Station nicht gefunden.' };
    const connector = station.connectors.find((c) => c.id === connectorId);
    if (!connector) return { ok: false, error: 'Anschluss nicht gefunden.' };
    if (connector.status !== 'available') {
      return { ok: false, error: 'Dieser Anschluss ist derzeit nicht verfügbar.' };
    }

    let session: ChargingSession = {
      id: generateId('sess'),
      stationId,
      stationName: station.name,
      connectorId,
      connectorType: connector.type,
      powerKw: connector.powerKw,
      vehicleId,
      paymentMethodId,
      startedAt: new Date().toISOString(),
      status: 'active',
      energyKwh: 0,
      costEur: connector.sessionFee ?? 0,
      pricePerKwh: connector.pricePerKwh,
      sessionFee: connector.sessionFee ?? 0,
      pointsEarned: 0,
      citrineosBacked: false,
      midCertified: station.hardwareFeatures?.midCertifiedMeters ?? false,
      chargePointModel: station.chargePointModel,
      evseNumber: connector.evseNumber,
    };

    if (citrineosConnected && getStationDataSource() === 'citrineos') {
      try {
        const cs = await startCitrineosCharge(station, connectorId, user.membershipId);
        if (!cs.ok) return { ok: false, error: cs.error };
        session = { ...session, ...cs.sessionPatch, citrineosBacked: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Ladevorgang konnte nicht gestartet werden',
        };
      }
    }

    const sessions = [session, ...get().sessions];
    if (isBackendMode()) {
      try {
        await saveSession(session);
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'Sitzung konnte nicht gespeichert werden.',
        };
      }
    } else {
      saveSessions(user.id, sessions);
    }
    set({ activeSession: session, sessions });
    return { ok: true };
  },

  tickSession: async () => {
    const { activeSession, user } = get();
    if (!activeSession || !user || activeSession.status !== 'active') return;
    const station = getStationById(activeSession.stationId);
    const connector = station?.connectors.find((c) => c.id === activeSession.connectorId);
    if (!connector) return;

    let updated: ChargingSession = { ...activeSession };

    if (activeSession.citrineosBacked) {
      try {
        const patch = await pollCitrineosSession(activeSession);
        if (patch) {
          updated = {
            ...updated,
            ...patch,
            pointsEarned: calcPoints(patch.energyKwh ?? updated.energyKwh, user.loyaltyTier),
          };
        }
      } catch {
        /* Fallback auf Simulation bei API-Fehler */
      }
    }

    if (!activeSession.citrineosBacked) {
      const elapsedMin = (Date.now() - new Date(activeSession.startedAt).getTime()) / 60000;
      const efficiency = 0.85;
      const maxKwh = (connector.powerKw * efficiency * elapsedMin) / 60;
      const energyKwh = Math.min(maxKwh, 80);
      const costEur = calcCost(energyKwh, connector, elapsedMin);
      updated = {
        ...updated,
        energyKwh: Math.round(energyKwh * 100) / 100,
        costEur,
        pointsEarned: calcPoints(energyKwh, user.loyaltyTier),
      };
    } else if (updated.energyKwh > 0) {
      updated.pointsEarned = calcPoints(updated.energyKwh, user.loyaltyTier);
    }

    const sessions = get().sessions.map((s) => (s.id === updated.id ? updated : s));
    if (isBackendMode()) {
      try {
        await updateSession(updated);
      } catch {
        /* lokaler Stand bleibt sichtbar */
      }
    } else {
      saveSessions(user.id, sessions);
    }
    set({ activeSession: updated, sessions });
  },

  stopSession: async () => {
    const { activeSession, user } = get();
    if (!activeSession || !user) return;

    if (activeSession.citrineosBacked && activeSession.citrineosTransactionId) {
      try {
        const stop = await stopCitrineosCharge(activeSession);
        if (!stop.ok) {
          set({ toast: stop.error ?? 'Stoppen fehlgeschlagen' });
          return;
        }
        await pollCitrineosSession(activeSession);
      } catch (e) {
        set({ toast: e instanceof Error ? e.message : 'Ladevorgang konnte nicht beendet werden' });
        return;
      }
    }

    const current = get().activeSession ?? activeSession;
    let paymentStatus: ChargingSession['paymentStatus'] = 'skipped';
    let stripePaymentIntentId: string | undefined;

    const { stripeReady } = get();
    if (stripeReady && user.stripeCustomerId && current.costEur >= 0.5) {
      try {
        const charge = await chargeChargingSession(
          user,
          current.paymentMethodId,
          current.costEur,
          current.id,
          `BC Charge – ${current.stationName}`
        );
        stripePaymentIntentId = charge.paymentIntentId;
        paymentStatus = charge.paid ? 'paid' : charge.status === 'processing' ? 'pending' : 'failed';
        if (!charge.paid) {
          set({ toast: 'Zahlung ausstehend – bitte prüfen Sie Ihre Zahlungsmethode.' });
        }
      } catch (e) {
        paymentStatus = 'failed';
        set({
          toast: e instanceof Error ? e.message : 'Zahlung fehlgeschlagen',
        });
      }
    }

    const ended: ChargingSession = {
      ...current,
      endedAt: new Date().toISOString(),
      status: 'completed',
      paymentStatus,
      stripePaymentIntentId,
    };
    const gam = processSessionGamification(user, ended);
    const updatedUser = gam.user;
    const sessions = get().sessions.map((s) => (s.id === ended.id ? ended : s));

    if (isBackendMode()) {
      try {
        const result = await completeSessionRemote(ended, updatedUser.gamification);
        const mergedUser = enrichUser({
          ...result.user,
          gamification: updatedUser.gamification,
          loyaltyPoints: updatedUser.loyaltyPoints,
          loyaltyTier: updatedUser.loyaltyTier,
        });
        await patchProfile({
          gamification: mergedUser.gamification,
          loyaltyPoints: mergedUser.loyaltyPoints,
          loyaltyTier: mergedUser.loyaltyTier,
          totalKwh: mergedUser.totalKwh,
          totalSessions: mergedUser.totalSessions,
          co2SavedKg: mergedUser.co2SavedKg,
        });
        const invoiceHint = result.invoice?.emailSent
          ? ' · Rechnung per E-Mail versendet'
          : result.invoice?.error
            ? ' · Rechnung konnte nicht per E-Mail versendet werden'
            : '';
        set({
          user: mergedUser,
          sessions: sessions.map((s) => (s.id === result.session.id ? result.session : s)),
          activeSession: null,
          toast: `Laden beendet · ${formatGamificationToast(gam, 'de')}${invoiceHint}`,
        });
        notifyIfSessionComplete(mergedUser, result.session);
        recordStationSuccess(result.session.stationId);
        return;
      } catch (e) {
        set({ toast: e instanceof Error ? e.message : 'Sitzung konnte nicht abgeschlossen werden.' });
        return;
      }
    }

    const users = loadUsers().map((u) => (u.id === user.id ? updatedUser : u));
    saveUsers(users);
    saveSessions(user.id, sessions);
    const toastMsg = `Laden beendet · ${formatGamificationToast(gam, 'de')}`;
    set({
      user: updatedUser,
      sessions,
      activeSession: null,
      toast: toastMsg,
    });
    notifyIfSessionComplete(updatedUser, ended);
    recordStationSuccess(ended.stationId);
  },

  recordCommunityReport: () => {
    const { user } = get();
    if (!user) return;
    const gam = processReportGamification(user);
    if (isBackendMode()) {
      void patchProfile({
        gamification: gam.user.gamification,
        loyaltyPoints: gam.user.loyaltyPoints,
        loyaltyTier: gam.user.loyaltyTier,
      }).then((updated) =>
        set({
          user: enrichUser(updated),
          toast: gam.newBadgeIds.length
            ? `Meldung gespeichert · ${formatGamificationToast(gam, 'de')}`
            : 'Danke für Ihre Community-Meldung!',
        })
      );
      return;
    }
    const users = loadUsers().map((u) => (u.id === user.id ? gam.user : u));
    saveUsers(users);
    set({
      user: gam.user,
      toast: gam.newBadgeIds.length
        ? `Meldung gespeichert · ${formatGamificationToast(gam, 'de')}`
        : 'Danke für Ihre Community-Meldung!',
    });
  },

  syncGamification: () => {
    const { user } = get();
    if (!user) return;
    const sync = syncPendingChallenges(user);
    if (!sync.pointsDelta) return;
    if (isBackendMode()) {
      void patchProfile({
        gamification: sync.user.gamification,
        loyaltyPoints: sync.user.loyaltyPoints,
        loyaltyTier: sync.user.loyaltyTier,
      }).then((updated) => set({ user: enrichUser(updated), toast: formatGamificationToast(sync, 'de') }));
      return;
    }
    const users = loadUsers().map((u) => (u.id === user.id ? sync.user : u));
    saveUsers(users);
    set({ user: sync.user, toast: formatGamificationToast(sync, 'de') });
  },

  claimWeeklyChallenge: (challengeId) => {
    const { user } = get();
    if (!user) return { ok: false, error: 'Bitte anmelden.' };
    const res = claimChallengeReward(user, challengeId);
    if (!res.ok || !res.user) return { ok: false, error: res.error };
    if (isBackendMode()) {
      void patchProfile({
        gamification: res.user.gamification,
        loyaltyPoints: res.user.loyaltyPoints,
        loyaltyTier: res.user.loyaltyTier,
      }).then((updated) =>
        set({
          user: enrichUser(updated),
          toast: `Challenge abgeschlossen · +${res.pointsDelta} BC Points`,
        })
      );
      return { ok: true };
    }
    const users = loadUsers().map((u) => (u.id === user.id ? res.user! : u));
    saveUsers(users);
    set({
      user: res.user,
      toast: `Challenge abgeschlossen · +${res.pointsDelta} BC Points`,
    });
    return { ok: true };
  },

  redeemReward: (rewardId, pointsCost) => {
    const { user, redeemedRewardIds } = get();
    if (!user) return { ok: false, error: 'Bitte anmelden.' };
    if (redeemedRewardIds.includes(rewardId)) {
      return { ok: false, error: 'Prämie wurde bereits eingelöst.' };
    }
    if (user.loyaltyPoints < pointsCost) {
      return { ok: false, error: 'Nicht genügend BC Points.' };
    }
    if (isBackendMode()) {
      void redeemRewardRemote(rewardId, pointsCost)
        .then((res) =>
          set({
            user: enrichUser(res.user),
            redeemedRewardIds: res.rewardIds,
            toast: 'Prämie erfolgreich eingelöst!',
          })
        )
        .catch((e) =>
          set({ toast: e instanceof Error ? e.message : 'Einlösung fehlgeschlagen.' })
        );
      return { ok: true };
    }
    const newPoints = user.loyaltyPoints - pointsCost;
    get().updateProfile({ loyaltyPoints: newPoints, loyaltyTier: computeTier(newPoints) });
    const ids = [...redeemedRewardIds, rewardId];
    saveRedeemed(user.id, ids);
    set({ redeemedRewardIds: ids, toast: 'Prämie erfolgreich eingelöst!' });
    return { ok: true };
  },

  getFilteredStations: () => {
    const { searchQuery, stationFilters } = get();
    let list = applyStationFilters(getStations(), stationFilters);
    list = searchStations(list, searchQuery);
    return list;
  },

  getNearbyStations: (limit = 5) => {
    const { userLocation } = get();
    const list = get().getFilteredStations();
    if (!userLocation) return list.slice(0, limit);
    return [...list]
      .sort((a, b) => haversineKm(userLocation.lat, userLocation.lng, a.lat, a.lng) - haversineKm(userLocation.lat, userLocation.lng, b.lat, b.lng))
      .slice(0, limit);
  },

  distanceKm: (station) => {
    const { userLocation } = get();
    if (!userLocation) return null;
    return Math.round(haversineKm(userLocation.lat, userLocation.lng, station.lat, station.lng) * 10) / 10;
  },
}));
