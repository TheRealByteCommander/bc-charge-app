// OCPI Hub Adapter mock logic


export interface OCPILocation {
  id: string;
  name: string;
  address: {
    street: string;
    city: string;
  };
  evses: OCPIEvse[];
}

export interface OCPIEvse {
  id: string;
  connectorType: string;
  powerKw: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'INACTIVE';
  tariffId: string;
}

export interface OCTIPricing {
  tariffId: string;
  pricePerKwh: number;
  currency: string;
  validFrom: string;
  validTo: string;
}

/** 
 * Mock Adapter to simulate OCPI Hub responses.
 * This allows the App to implement roaming logic before the backend is fully ready.
 */
export class OCPIHubAdapter {
  private static mockLocations: OCPILocation[] = [
    {
      id: 'roam-1',
      name: 'Roaming Partner Station A',
      address: { street: 'Partnerstraße 1', city: 'Berlin' },
      evses: [
        { id: 'evse-1', connectorType: 'CCS', powerKw: 150, status: 'AVAILABLE', tariffId: 'roam-t1' }
      ]
    }
  ];

  private static mockTariffs: Record<string, OCTIPricing> = {
    'roam-t1': {
      tariffId: 'roam-t1',
      pricePerKwh: 0.65,
      currency: 'EUR',
      validFrom: new Date().toISOString(),
      validTo: new Date(Date.now() + 86400000).toISOString()
    }
  };

  async fetchLocations(): Promise<OCPILocation[]> {
    return new Promise((res) => setTimeout(() => res(OCPIHubAdapter.mockLocations), 300));
  }

  async fetchTariff(id: string): Promise<OCTIPricing | null> {
    return new Promise((res) => setTimeout(() => res(OCPIHubAdapter.mockTariffs[id] || null), 200));
  }

async startSession(_evseId: string, _token: string): Promise<{ sessionId: string; success: boolean }> {
    return new Promise((res) => setTimeout(() => res({ sessionId: 'sess-' + Math.random().toString(36).substring(2, 11), success: true }), 500));
  }
}

export const ocpiAdapter = new OCPIHubAdapter();
