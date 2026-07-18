/** @typedef {'energy'|'time'|'session'|'idle'|'reservation'} TariffComponentKind */

/**
 * @typedef {object} TariffComponent
 * @property {TariffComponentKind} kind
 * @property {string} rate – EUR-Dezimal pro Einheit (kWh, Minute, Pauschal)
 * @property {number} [priority] – niedrigere Zahl = früher in Aufschlüsselung
 * @property {number} [idleGraceSeconds] – nur bei kind=idle
 * @property {string} [validFromLocal] – HH:mm innerhalb Gültigkeit (optional)
 * @property {string} [validToLocal]
 * @property {number[]} [weekdays] – 1=Mo … 7=So
 */

/**
 * @typedef {object} TariffVersion
 * @property {string} id
 * @property {string} tariffId
 * @property {number} version
 * @property {'draft'|'active'|'archived'} status
 * @property {string} validFrom – ISO UTC
 * @property {string|null} validTo
 * @property {string} timezone – IANA, z.B. Europe/Berlin
 * @property {string} currency – ISO 4217
 * @property {number} taxRateBp – Steuersatz in Basispunkten (1900 = 19 %)
 * @property {TariffComponent[]} components
 * @property {string|null} minPrice – EUR Dezimal
 * @property {string|null} maxPrice
 * @property {'sum_components'} combinationRule
 * @property {string} hash
 * @property {string|null} citrineosTariffId
 * @property {string} name
 */

/**
 * @typedef {object} TariffSnapshot
 * @property {string} id
 * @property {string} sessionId
 * @property {string} tariffVersionId
 * @property {string} hash
 * @property {'bc-engine'|'citrineos-import'|'manual'} source
 * @property {string} frozenAt – ISO
 * @property {TariffVersion} tariff
 * @property {boolean} midCertified
 * @property {object[]} [meterProofs] – unveränderte Eichrecht-Rohnachweise
 */

/**
 * @typedef {object} SessionPricingEvent
 * @property {string} at – ISO UTC
 * @property {'session_start'|'session_stop'|'authorization'|'charging_state'|'meter_value'|'reconnect'|'reservation_start'|'reservation_end'} type
 * @property {string} [chargingState] – OCPP 2.0.1 / vereinheitlicht
 * @property {number} [energyWh] – kumulativ, signiert wenn midCertified
 * @property {boolean} [midCertified]
 * @property {object} [rawProof] – Originalnachweis unverändert
 */

/**
 * @typedef {object} CostLineItem
 * @property {string} code
 * @property {TariffComponentKind} kind
 * @property {string} label
 * @property {string} netEur
 * @property {string} taxEur
 * @property {string} grossEur
 * @property {object} [meta]
 */

/**
 * @typedef {object} CostResult
 * @property {string} netEur
 * @property {string} taxEur
 * @property {string} grossEur
 * @property {number} energyWh
 * @property {number} chargingSeconds
 * @property {number} idleSeconds
 * @property {CostLineItem[]} lines
 * @property {string} snapshotHash
 */

/**
 * @typedef {object} LedgerEntry
 * @property {string} id
 * @property {string} sessionId
 * @property {string} snapshotId
 * @property {'charge'|'adjustment'|'storno'} entryType
 * @property {string} netEur
 * @property {string} taxEur
 * @property {string} grossEur
 * @property {string|null} reversesEntryId
 * @property {string} reason
 * @property {string} createdAt
 */

export const OCPP_IDLE_STATES = new Set(['SuspendedEV', 'SuspendedEVSE', 'Idle']);
export const OCPP_CHARGING_STATES = new Set(['Charging', 'EVConnected']);
