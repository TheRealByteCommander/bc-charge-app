import { describe, expect, it } from 'vitest';
import {
  citrineosDataApiPathMap,
  citrineosPaths,
  resolveClientDataApiPath,
  resolveClientDataApiPaths,
} from './paths';

describe('citrineos paths #849 dual-map', () => {
  it('maps merge-spec command targets', () => {
    expect(citrineosDataApiPathMap.getTransaction.commands).toBe('/commands/transaction');
    expect(citrineosDataApiPathMap.getTariffs.commands).toBe('/commands/tariff');
    expect(citrineosDataApiPathMap.getBoot.commands).toBe('/commands/bootConfig');
  });

  it('auto prefers legacy then commands', () => {
    expect(resolveClientDataApiPaths('getTransaction', 'auto')).toEqual([
      '/data/transactions/transactionType',
      '/data/transactions/transaction',
      '/commands/transaction',
    ]);
    expect(resolveClientDataApiPaths('getTariffs', 'auto')).toEqual([
      '/data/transactions/tariff',
      '/commands/tariff',
    ]);
  });

  it('legacy and commands surfaces', () => {
    expect(resolveClientDataApiPaths('getTariffs', 'legacy')).toEqual([
      '/data/transactions/tariff',
    ]);
    expect(resolveClientDataApiPaths('getTariffs', 'commands')).toEqual(['/commands/tariff']);
    expect(resolveClientDataApiPath('getBoot', 'commands')).toBe('/commands/bootConfig');
  });

  it('static citrineosPaths stay legacy-first for pin 1.8.4', () => {
    expect(citrineosPaths.transactions.getTransaction).toBe(
      '/data/transactions/transactionType'
    );
    expect(citrineosPaths.transactions.getTariffs).toBe('/data/transactions/tariff');
    expect(citrineosPaths.commands.transaction).toBe('/commands/transaction');
  });
});
