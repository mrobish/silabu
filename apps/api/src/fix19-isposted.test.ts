/**
 * Fix #19: Verify isposted filter on all report queries.
 * 
 * Static analysis: grep for isposted in report SQL blocks.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROUTES_PATH = resolve(__dirname, '../src/accounting-routes.ts');
const MONTHLY_PL_PATH = resolve(__dirname, '../src/utils/monthly-pl.ts');

let _routesSrc: string | null = null;
let _monthlySrc: string | null = null;

function routesSrc(): string {
  if (!_routesSrc) _routesSrc = readFileSync(ROUTES_PATH, 'utf-8');
  return _routesSrc!;
}
function monthlySrc(): string {
  if (!_monthlySrc) _monthlySrc = readFileSync(MONTHLY_PL_PATH, 'utf-8');
  return _monthlySrc!;
}

function countIsposted(text: string): number {
  return (text.match(/isposted\s*=\s*true/gi) || []).length;
}

describe('Fix #19: isposted filter on report queries', () => {

  it('computeLabaRugi should filter isposted', () => {
    const src = routesSrc();
    const start = src.indexOf('async function computeLabaRugi');
    expect(start).toBeGreaterThan(0);
    const chunk = src.slice(start, start + 2000);
    expect(chunk).toContain('je.isposted = true');
  });

  it('/neraca should filter isposted', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/neraca'");
    const end = src.indexOf("app.get('/perubahan-modal'");
    const chunk = src.slice(start, end > start ? end : start + 3000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(1);
  });

  it('/perubahan-modal should filter isposted (3 queries)', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/perubahan-modal'");
    const end = src.indexOf("app.get('/neraca-saldo'");
    const chunk = src.slice(start, end > start ? end : start + 6000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(3);
  });

  it('/neraca-saldo should filter isposted', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/neraca-saldo'");
    const end = src.indexOf("app.get('/neraca-lajur'");
    const chunk = src.slice(start, end > start ? end : start + 2000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(1);
  });

  it('/buku-besar should filter isposted (2 queries)', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/buku-besar'");
    const end = src.indexOf('async function computeLabaRugi');
    const chunk = src.slice(start, end > start ? end : start + 5000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(2);
  });

  it('/arus-kas should filter isposted (4 queries)', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/arus-kas'");
    const end = src.indexOf("app.get('/calk-details'");
    const chunk = src.slice(start, end > start ? end : start + 8000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(4);
  });

  it('/dashboard-summary should filter isposted (2 queries)', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/dashboard-summary'");
    const end = src.indexOf("app.get('/neraca'");
    const chunk = src.slice(start, end > start ? end : start + 3000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(2);
  });

  it('monthly-pl.ts should filter isposted', () => {
    expect(monthlySrc()).toContain('je.isposted = true');
  });

  it('existing stock/HPP queries still have isposted (not removed)', () => {
    const src = routesSrc();
    const stockStart = src.indexOf("app.get('/penjualan/stock-check'");
    if (stockStart > 0) {
      const chunk = src.slice(stockStart, stockStart + 1500);
      expect(chunk).toContain('isposted = true');
    }
  });

  it('/neraca-lajur/export should filter isposted', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/neraca-lajur/export'");
    expect(start).toBeGreaterThan(0);
    const end = src.indexOf("app.get('/calk-details'");
    const chunk = src.slice(start, end > start ? end : start + 3000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(1);
  });

  it('/calk-details should filter isposted', () => {
    const src = routesSrc();
    const start = src.indexOf("app.get('/calk-details'");
    expect(start).toBeGreaterThan(0);
    const chunk = src.slice(start, start + 3000);
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(1);
  });

  it('/tutup-buku P&L and Prive should filter isposted', () => {
    const src = routesSrc();
    const start = src.indexOf("app.post('/tutup-buku'");
    expect(start).toBeGreaterThan(0);
    const chunk = src.slice(start, start + 6000);
    // Should have at least 2 (P&L + prive)
    expect(countIsposted(chunk)).toBeGreaterThanOrEqual(2);
  });

  it('total isposted count in accounting-routes is >= 26', () => {
    const src = routesSrc();
    expect(countIsposted(src)).toBeGreaterThanOrEqual(26);
  });
});
