import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { ConnectorType, Vehicle } from '../types';

const emptyForm = (): Omit<Vehicle, 'id'> => ({
  nickname: '',
  brand: '',
  model: '',
  batteryKwh: 77,
  maxAcKw: 11,
  maxDcKw: 250,
  preferredConnector: 'CCS',
  licensePlate: '',
});

function vehicleToForm(v: Vehicle): Omit<Vehicle, 'id'> {
  const { id: _id, ...rest } = v;
  return rest;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-bc-muted">{children}</label>;
}

export function VehiclesPage() {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const user = useAppStore((s) => s.user);
  const addVehicle = useAppStore((s) => s.addVehicle);
  const updateVehicle = useAppStore((s) => s.updateVehicle);
  const removeVehicle = useAppStore((s) => s.removeVehicle);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  if (!user) {
    return (
      <div className="page-shell">
        <Link to="/anmelden" className="btn-primary">
          Anmelden
        </Link>
      </div>
    );
  }

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (v: Vehicle) => {
    setEditingId(v.id);
    setForm(vehicleToForm(v));
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateVehicle(editingId, form);
    } else {
      addVehicle(form);
    }
    cancelForm();
  };

  const formOpen = showForm;

  return (
    <div className="page-shell">
      {returnTo ? (
        <Link to={returnTo} className="text-sm text-bc-accent">
          ← Zurück zur Station
        </Link>
      ) : (
        <Link to="/profil" className="text-sm text-bc-accent">
          ← Profil
        </Link>
      )}
      <h1 className={`font-display text-2xl font-bold ${returnTo ? 'mt-4' : 'mt-4'}`}>Fahrzeuge</h1>
      <p className="mt-1 text-bc-muted">Für passende Anschluss-Empfehlungen und Ladeprofil.</p>

      <div className="mt-6 space-y-3">
        {user.vehicles.map((v) => (
          <div
            key={v.id}
            className={`rounded-2xl border p-4 ${
              editingId === v.id ? 'border-bc-accent bg-bc-accent/5' : 'border-bc-border bg-bc-elevated'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-bc-text">{v.nickname}</p>
                <p className="text-sm text-bc-muted">
                  {v.brand} {v.model} · {v.licensePlate}
                </p>
                <p className="mt-2 text-xs text-bc-muted">
                  {v.batteryKwh} kWh · AC {v.maxAcKw} kW · DC {v.maxDcKw} kW · bevorzugt {v.preferredConnector}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(v)}
                  className="rounded-lg p-2 text-bc-accent hover:bg-bc-surface"
                  aria-label="Fahrzeug bearbeiten"
                >
                  <Pencil className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (editingId === v.id) cancelForm();
                    removeVehicle(v.id);
                  }}
                  className="rounded-lg p-2 text-bc-danger hover:bg-bc-surface"
                  aria-label="Fahrzeug entfernen"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {formOpen ? (
        <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-bc-accent/30 bg-bc-elevated p-4">
          <h2 className="font-display text-lg font-semibold text-bc-text">
            {editingId ? 'Fahrzeug bearbeiten' : 'Neues Fahrzeug'}
          </h2>

          <div>
            <FieldLabel>Nickname</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="z. B. Black Beauty"
              required
              value={form.nickname}
              onChange={(e) => setForm({ ...form, nickname: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Marke</FieldLabel>
              <input
                className="input-field w-full"
                placeholder="Tesla"
                required
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </div>
            <div>
              <FieldLabel>Modell</FieldLabel>
              <input
                className="input-field w-full"
                placeholder="Model S Plaid"
                required
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Kennzeichen</FieldLabel>
            <input
              className="input-field w-full"
              placeholder="MTL-SI 10E"
              required
              value={form.licensePlate}
              onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Batterie (kWh)</FieldLabel>
              <input
                type="number"
                min={10}
                max={200}
                step={1}
                className="input-field w-full"
                required
                value={form.batteryKwh}
                onChange={(e) => setForm({ ...form, batteryKwh: Number(e.target.value) })}
              />
            </div>
            <div>
              <FieldLabel>AC max. (kW)</FieldLabel>
              <input
                type="number"
                min={3}
                max={43}
                step={1}
                className="input-field w-full"
                required
                value={form.maxAcKw}
                onChange={(e) => setForm({ ...form, maxAcKw: Number(e.target.value) })}
              />
            </div>
            <div>
              <FieldLabel>DC max. (kW)</FieldLabel>
              <input
                type="number"
                min={20}
                max={400}
                step={1}
                className="input-field w-full"
                required
                value={form.maxDcKw}
                onChange={(e) => setForm({ ...form, maxDcKw: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Bevorzugter Anschluss</FieldLabel>
            <select
              className="input-field w-full"
              value={form.preferredConnector}
              onChange={(e) => setForm({ ...form, preferredConnector: e.target.value as ConnectorType })}
            >
              <option value="CCS">CCS</option>
              <option value="Type2">Type 2</option>
              <option value="CHAdeMO">CHAdeMO</option>
            </select>
          </div>

          <button type="submit" className="btn-primary w-full">
            {editingId ? 'Änderungen speichern' : 'Fahrzeug speichern'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={cancelForm}>
            Abbrechen
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="btn-secondary mt-6 flex w-full items-center justify-center gap-2"
          onClick={openAdd}
        >
          <Plus className="h-5 w-5" />
          Fahrzeug hinzufügen
        </button>
      )}
    </div>
  );
}
