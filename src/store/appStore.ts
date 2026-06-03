import { create } from 'zustand';
import { getStationById, getStationDataSource, getStations } from '../data/stations';
import type { StationDataSource } from '../data/stationRegistry';
import { defaultChargingPlan, normalizeChargingPlan } from '../data/chargingPlan';
import { computeTier, tierThresholds } from '../data/rewards';
import { haversineKm } from '../utils/geo';
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
  filterAvailableOnly: boolean;
  filterConnector: 'all' | 'CCS' | 'Type2';
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
  setFilterAvailableOnly: (v: boolean) => void;
  setFilterConnector: (v: 'all' | 'CCS' | 'Type2') => void;

  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
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
      promotions: true,
      stationAvailability: true,
      loyaltyUpdates: true,
    },
    chargingPlan: defaultChargingPlan(),
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
  return { ...profile, chargingPlan: normalizeChargingPlan(profile.chargingPlan) };
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
  userLocation: { lat: 51.35, lng: 12.63 },
  searchQuery: '',
  filterAvailableOnly: false,
  filterConnector: 'all',
  toast: null,
  citrineosConnected: false,
  citrineosSyncError: null,
  stationDataSource: 'static',
  citrineosSyncing: false,
  pricingSyncedAt: null,
  stripeReady: false,

  init: async () => {
    const runId = ++initRun;

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
    } else if (sync.error && !sync.error.includes('nicht erreichbar')) {
      citrineosSyncError = sync.error;
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
        ? `${sync.count} Stationen von CitrineOS geladen${tariffHint}`
        : sync.error ?? 'Sync fehlgeschlagen',
    });
  },

  completeOnboarding: () => {
    setOnboardingDone();
    set({ onboardingDone: true });
  },

  setToast: (msg) => set({ toast: msg }),
  setUserLocation: (loc) => set({ userLocation: loc }),

  requestUserLocation: () => {
    const fallback = { lat: 51.35, lng: 12.63 };
    if (!navigator.geolocation) {
      set({ userLocation: fallback });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        set({
          userLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }),
      () => set({ userLocation: fallback }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600_000 }
    );
  },
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilterAvailableOnly: (v) => set({ filterAvailableOnly: v }),
  setFilterConnector: (v) => set({ filterConnector: v }),

  register: async (data) => {
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { ok: false, error: 'Diese E-Mail ist bereits registriert.' };
    }
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
        promotions: true,
        stationAvailability: false,
        loyaltyUpdates: true,
      },
      chargingPlan: defaultChargingPlan(),
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

  deleteAccount: () => {
    const { user } = get();
    if (!user) return;
    const users = loadUsers().filter((u) => u.id !== user.id);
    saveUsers(users);
    setCurrentUserId(null);
    set({ user: null, sessions: [], activeSession: null, redeemedRewardIds: [] });
    set({ toast: 'Lokale Kontodaten wurden gelöscht.' });
  },

  logout: () => {
    setCurrentUserId(null);
    set({ user: null, sessions: [], activeSession: null, redeemedRewardIds: [] });
  },

  updateProfile: (patch) => {
    const { user } = get();
    if (!user) return;
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
    const { user, activeSession, citrineosConnected, stripeReady } = get();
    if (!user) return { ok: false, error: 'Bitte melden Sie sich an.' };
    if (activeSession) return { ok: false, error: 'Es läuft bereits eine Ladesitzung.' };
    if (stripeReady && user.paymentMethods.length === 0) {
      return { ok: false, error: 'Bitte hinterlegen Sie eine Zahlungsmethode bei Stripe.' };
    }
    if (!stripeReady && user.paymentMethods.length === 0) {
      return { ok: false, error: 'Bitte hinterlegen Sie eine Zahlungsmethode.' };
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
    };

    if (citrineosConnected && getStationDataSource() === 'citrineos') {
      try {
        const cs = await startCitrineosCharge(station, connectorId, user.membershipId);
        if (!cs.ok) return { ok: false, error: cs.error };
        session = { ...session, ...cs.sessionPatch, citrineosBacked: true };
      } catch (e) {
        return {
          ok: false,
          error: e instanceof Error ? e.message : 'CitrineOS Ladestart fehlgeschlagen',
        };
      }
    }

    const sessions = [session, ...get().sessions];
    saveSessions(user.id, sessions);
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
    saveSessions(user.id, sessions);
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
        set({ toast: e instanceof Error ? e.message : 'CitrineOS Stop fehlgeschlagen' });
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
          toast: e instanceof Error ? e.message : 'Stripe-Zahlung fehlgeschlagen',
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
    const co2 = ended.energyKwh * 0.64;
    const points = ended.pointsEarned;
    const updatedUser: UserProfile = {
      ...user,
      totalKwh: user.totalKwh + ended.energyKwh,
      totalSessions: user.totalSessions + 1,
      co2SavedKg: Math.round(user.co2SavedKg + co2),
      loyaltyPoints: user.loyaltyPoints + points,
      loyaltyTier: computeTier(user.loyaltyPoints + points),
    };
    const users = loadUsers().map((u) => (u.id === user.id ? updatedUser : u));
    saveUsers(users);
    const sessions = get().sessions.map((s) => (s.id === ended.id ? ended : s));
    saveSessions(user.id, sessions);
    set({
      user: updatedUser,
      sessions,
      activeSession: null,
      toast: `Laden beendet · +${points} BC Points`,
    });
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
    const newPoints = user.loyaltyPoints - pointsCost;
    get().updateProfile({ loyaltyPoints: newPoints, loyaltyTier: computeTier(newPoints) });
    const ids = [...redeemedRewardIds, rewardId];
    saveRedeemed(user.id, ids);
    set({ redeemedRewardIds: ids, toast: 'Prämie erfolgreich eingelöst!' });
    return { ok: true };
  },

  getFilteredStations: () => {
    const { searchQuery, filterAvailableOnly, filterConnector } = get();
    let list = [...getStations()];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.address.toLowerCase().includes(q) ||
          s.evseCode.toLowerCase().includes(q)
      );
    }
    if (filterAvailableOnly) {
      list = list.filter((s) => s.connectors.some((c) => c.status === 'available'));
    }
    if (filterConnector !== 'all') {
      list = list.filter((s) => s.connectors.some((c) => c.type === filterConnector));
    }
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
