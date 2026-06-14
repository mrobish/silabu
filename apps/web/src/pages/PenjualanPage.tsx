import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/apiFetch';
import { useCutoffDate } from "../hooks/useCutoffDate";
import { ShoppingCart, Plus, Trash2, X, CheckCircle, AlertTriangle, Package, Search } from 'lucide-react';

// ── helpers ──────────────────────────────────────────────────────────────────
const formatCurrencyDisplay = (n: number) => 'Rp ' + Number(n).toLocaleString('id-ID');
const parseCurrencyInput = (s: string) => Number(s.replace(/[^0-9]/g, '')) || 0;
const inputCls = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition';
const br = 'rounded-2xl border border-white/70 bg-white/80 backdrop-blur-xl shadow-sm';
const getToken = () => localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || '';

// ── types ────────────────────────────────────────────────────────────────────
type StockItem = {
  id: string;
  nama: string;
  kode: string;
  satuan: string;
  hargaSatuan: number;
  stok: number;
};

type CartItem = {
  inventory_item_id: string;
  nama: string;
  kode: string;
  satuan: string;
  qty: number;
  harga_jual: number;
  hpp: number;
  stok_sekarang: number;
};

type CoAAccount = {
  id: string;
  kode: string;
  nama: string;
};

type SaleResult = {
  success: boolean;
  entry: { id: string; noJurnal: string; tanggal: string; keterangan: string };
  items: Array<{ nama: string; qty: number; harga_jual: number; hpp: number; stok_sesudah: number; is_negative: boolean }>;
  total_penjualan: number;
  total_hpp: number;
  laba_kotor: number;
};

// ── Currency Input ───────────────────────────────────────────────────────────
function CurrencyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [focused, setFocused] = useState(false);
  const display = focused ? value : (value ? formatCurrencyDisplay(parseCurrencyInput(value)) : '');
  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder || 'Rp 0'}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={e => {
        const digits = e.target.value.replace(/[^0-9]/g, '');
        onChange(digits);
      }}
      className={inputCls}
    />
  );
}

// ── Warning Modal ────────────────────────────────────────────────────────────
function WarningModal({
  negativeItems,
  onContinue,
  onCancel,
}: {
  negativeItems: Array<{ nama: string; stok: number; qty: number; sisa: number }>;
  onContinue: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className={`${br} max-w-md w-full p-6 space-y-4`}>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <AlertTriangle size={24} className="text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">⚠️ PERHATIAN: Stok Akan Minus!</h3>
          </div>
        </div>

        <div className="space-y-2">
          {negativeItems.map((item, i) => (
            <div key={i} className="bg-amber-50 rounded-xl px-4 py-2.5 border border-amber-200">
              <p className="text-sm font-semibold text-amber-800">{item.nama}</p>
              <p className="text-xs text-amber-700">
                stok sistem <span className="font-bold">{item.stok}</span>, dijual <span className="font-bold">{item.qty}</span>, sisa <span className="font-bold text-red-600">{item.sisa}</span>
              </p>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Transaksi tetap bisa dilanjutkan. Lakukan <span className="font-semibold">Stock Opname</span> untuk penyesuaian stok.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            Batal
          </button>
          <button
            onClick={onContinue}
            className="flex-1 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl bg-gradient-to-r from-amber-500 to-orange-500"
          >
            Lanjutkan Jual
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PenjualanPage({ setPage }: { setPage: (p: any) => void }) {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [accounts, setAccounts] = useState<CoAAccount[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [qty, setQty] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [kasAkunId, setKasAkunId] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const cutoff = useCutoffDate();
  const [keterangan, setKeterangan] = useState('');
  const [saving, setSaving] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [warningItems, setWarningItems] = useState<Array<{ nama: string; stok: number; qty: number; sisa: number }>>([]);
  const [successResult, setSuccessResult] = useState<SaleResult | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [itemSearch, setItemSearch] = useState('');

  // Auto-hide toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Fetch stock items and accounts
  const fetchData = useCallback(async () => {
    try {
      const [stockRes, coaRes] = await Promise.all([
        fetch('/api/accounting/penjualan/stock-check', {
          headers: { Authorization: 'Bearer ' + getToken() },
        }),
        fetch('/api/accounting/coa', {
          headers: { Authorization: 'Bearer ' + getToken() },
        }),
      ]);
      const stockData = await stockRes.json();
      const coaData = await coaRes.json();
      setStockItems(stockData.items || []);
      const allAccounts: CoAAccount[] = (coaData.coa || []);
      setAccounts(allAccounts);
    } catch {
      setToast({ message: 'Gagal memuat data', type: 'error' });
    }
    setLoaded(true);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Selected item details
  const selectedItem = stockItems.find(i => i.id === selectedItemId);

  // Calculate HPP for display (moving average from existing stock data)
  const getItemHpp = (itemId: string) => {
    const item = stockItems.find(i => i.id === itemId);
    return item ? Number(item.hargaSatuan) || 0 : 0;
  };

  // Filtered items for dropdown
  const filteredItems = stockItems.filter(i =>
    !itemSearch || i.nama.toLowerCase().includes(itemSearch.toLowerCase()) || (i.kode || '').toLowerCase().includes(itemSearch.toLowerCase())
  );

  // Kas/Bank accounts (1.1.01.xx and 1.1.02.xx)
  const kasBankAccounts = accounts.filter(a => {
    const k = (a.kode || '').replace(/\s/g, '');
    return k.startsWith('1.1.01') || k.startsWith('1.1.02');
  });

  // Add item to cart
  const addToCart = () => {
    if (!selectedItemId) {
      setToast({ message: 'Pilih barang terlebih dahulu', type: 'error' });
      return;
    }
    const qtyNum = parseInt(qty, 10);
    if (!qtyNum || qtyNum <= 0) {
      setToast({ message: 'Jumlah harus lebih dari 0', type: 'error' });
      return;
    }
    const hargaNum = parseCurrencyInput(hargaJual);
    if (!hargaNum || hargaNum <= 0) {
      setToast({ message: 'Harga jual harus lebih dari 0', type: 'error' });
      return;
    }

    // Check if already in cart
    const existing = cart.find(c => c.inventory_item_id === selectedItemId);
    if (existing) {
      setToast({ message: 'Barang sudah ada di keranjang, hapus dulu jika ingin mengubah', type: 'error' });
      return;
    }

    const hpp = getItemHpp(selectedItemId);
    const item = selectedItem!;

    setCart(prev => [...prev, {
      inventory_item_id: selectedItemId,
      nama: item.nama,
      kode: item.kode,
      satuan: item.satuan,
      qty: qtyNum,
      harga_jual: hargaNum,
      hpp,
      stok_sekarang: Number(item.stok) || 0,
    }]);

    // Reset selection
    setSelectedItemId('');
    setQty('');
    setHargaJual('');
    setItemSearch('');
  };

  // Remove from cart
  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(c => c.inventory_item_id !== id));
  };

  // Calculate totals
  const totalPenjualan = cart.reduce((sum, c) => sum + c.qty * c.harga_jual, 0);
  const totalHpp = cart.reduce((sum, c) => sum + c.qty * c.hpp, 0);
  const labaKotor = totalPenjualan - totalHpp;

  // Check for negative stock warnings
  const checkNegativeStock = (): Array<{ nama: string; stok: number; qty: number; sisa: number }> => {
    const negative: Array<{ nama: string; stok: number; qty: number; sisa: number }> = [];
    for (const item of cart) {
      // Use the fresh stock from stockItems (fetched at load time)
      const freshStock = stockItems.find(s => s.id === item.inventory_item_id);
      const stok = freshStock ? Number(freshStock.stok) || 0 : item.stok_sekarang;
      const sisa = stok - item.qty;
      if (sisa < 0) {
        negative.push({ nama: item.nama, stok, qty: item.qty, sisa });
      }
    }
    return negative;
  };

  // Submit handler
  const handleSubmit = () => {
    if (cart.length === 0) {
      setToast({ message: 'Keranjang kosong, tambahkan barang terlebih dahulu', type: 'error' });
      return;
    }
    if (!kasAkunId) {
      setToast({ message: 'Pilih akun kas/bank', type: 'error' });
      return;
    }
    if (!tanggal) {
      setToast({ message: 'Tanggal wajib diisi', type: 'error' });
      return;
    }

    // Check for negative stock
    const negativeItems = checkNegativeStock();
    if (negativeItems.length > 0) {
      setWarningItems(negativeItems);
      setShowWarning(true);
      return;
    }

    // Proceed directly
    processSubmit();
  };

  const processSubmit = async () => {
    setSaving(true);
    try {
      const body = {
        items: cart.map(c => ({
          inventory_item_id: c.inventory_item_id,
          qty: c.qty,
          harga_jual: c.harga_jual,
        })),
        kas_akun_id: kasAkunId,
        tanggal,
        keterangan: keterangan || undefined,
      };

      const d: SaleResult = await apiFetch('/api/accounting/penjualan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + getToken(),
        },
        body: JSON.stringify(body),
      });

      if (d.success) {
        setSuccessResult(d);
        setCart([]);
        setKeterangan('');
      } else {
        setToast({ message: (d as any).error || 'Gagal menyimpan transaksi', type: 'error' });
      }
    } catch (e: any) {
      setToast({ message: e.message || 'Terjadi kesalahan jaringan', type: 'error' });
    } finally {
      setSaving(false);
      setShowWarning(false);
    }
  };

  // Reset to new sale
  const newSale = () => {
    setSuccessResult(null);
    setCart([]);
    setKasAkunId('');
    setKeterangan('');
    fetchData(); // Refresh stock data
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  // ── Success Screen ───────────────────────────────────────────────────────
  if (successResult) {
    const noJurnal = successResult.entry?.noJurnal || '-';
    return (
      <div className="space-y-4">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {toast.message}
          </div>
        )}

        <div className={`${br} p-6 text-center`}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/20 mb-4">
            <CheckCircle size={32} className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">Penjualan Berhasil! 🎉</h3>
          <p className="text-sm text-slate-500 mb-4">Transaksi penjualan telah dicatat</p>

          <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">No. Jurnal</span>
              <span className="font-bold text-emerald-700 tabular-nums">{noJurnal}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tanggal</span>
              <span className="font-semibold text-slate-800">{successResult.entry.tanggal}</span>
            </div>
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total Penjualan</span>
              <span className="font-bold text-slate-900 tabular-nums">{formatCurrencyDisplay(successResult.total_penjualan)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Total HPP</span>
              <span className="font-semibold text-slate-700 tabular-nums">{formatCurrencyDisplay(successResult.total_hpp)}</span>
            </div>
            <div className="h-px bg-slate-200 my-1" />
            <div className="flex justify-between text-sm">
              <span className="text-emerald-600 font-semibold">Laba Kotor</span>
              <span className="font-bold text-emerald-700 tabular-nums">{formatCurrencyDisplay(successResult.laba_kotor)}</span>
            </div>
          </div>

          {/* Item details */}
          {successResult.items.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-3 mb-4">
              <p className="text-xs font-bold text-slate-500 mb-2">Detail Item:</p>
              {successResult.items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs py-1.5 border-b border-slate-100 last:border-0">
                  <span className="text-slate-700">{item.nama} × {item.qty}</span>
                  <span className={`font-semibold tabular-nums ${item.is_negative ? 'text-red-600' : 'text-slate-800'}`}>
                    {item.is_negative ? `⚠️ sisa ${item.stok_sesudah}` : `sisa ${item.stok_sesudah}`}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => typeof setPage === 'function' && setPage({ page: 'dashboard' })}
              className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Kembali
            </button>
            <button
              onClick={newSale}
              className="flex-1 rounded-2xl px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:shadow-xl bg-gradient-to-r from-emerald-600 to-green-600"
            >
              Jual Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main POS Interface ───────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {toast.message}
        </div>
      )}

      {/* Warning Modal */}
      {showWarning && (
        <WarningModal
          negativeItems={warningItems}
          onContinue={processSubmit}
          onCancel={() => setShowWarning(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-600">
          <ShoppingCart size={20} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-slate-900">🛒 Penjualan</h2>
          <p className="text-xs text-slate-500">Mini POS — Catat penjualan barang persediaan</p>
        </div>
      </div>

      {/* Item Selector Card */}
      <div className={`${br} p-5 space-y-4`}>
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <Package size={16} className="text-emerald-600" />
          Tambah Barang
        </h3>

        {/* Item Search / Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Pilih Barang</label>
          <div className="relative">
            <input
              type="text"
              value={itemSearch}
              onChange={e => {
                setItemSearch(e.target.value);
                if (selectedItemId) setSelectedItemId('');
              }}
              placeholder="Cari barang..."
              data-help-target="pos-search"
              className={`${inputCls} pl-9`}
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Dropdown */}
          {itemSearch && !selectedItemId && (
            <div className="mt-1 rounded-xl bg-white border border-slate-200 shadow-lg max-h-48 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <p className="px-3 py-2 text-xs text-slate-400">Tidak ditemukan</p>
              ) : (
                filteredItems.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setItemSearch(item.nama);
                      setHargaJual(String(item.hargaSatuan || ''));
                    }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-emerald-50 transition border-b border-slate-50 last:border-0"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-semibold text-slate-800">{item.nama}</span>
                        {item.kode && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full ml-2">{item.kode}</span>}
                      </div>
                      <span className={`text-xs font-semibold tabular-nums ${Number(item.stok) <= 0 ? 'text-red-500' : 'text-slate-500'}`}>
                        Stok: {Number(item.stok).toLocaleString('id-ID')} {item.satuan}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Selected item info */}
        {selectedItem && (
          <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold text-emerald-800">{selectedItem.nama}</p>
                <p className="text-xs text-emerald-600">
                  {selectedItem.kode && `${selectedItem.kode} · `}{selectedItem.satuan}
                </p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold tabular-nums ${Number(selectedItem.stok) <= 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                  Stok: {Number(selectedItem.stok).toLocaleString('id-ID')}
                </p>
                <p className="text-xs text-emerald-600">HPP: {formatCurrencyDisplay(Number(selectedItem.hargaSatuan) || 0)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Qty & Harga */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Jumlah (Qty)</label>
            <input
              type="number"
              min="1"
              value={qty}
              onChange={e => setQty(e.target.value)}
              placeholder="0"
              data-help-target="pos-qty"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Harga Jual / Unit</label>
            <CurrencyInput value={hargaJual} onChange={setHargaJual} placeholder="Rp 0" />
          </div>
        </div>

        {/* Subtotal preview */}
        {qty && hargaJual && parseCurrencyInput(hargaJual) > 0 && (
          <div className="bg-slate-50 rounded-xl px-4 py-2 flex justify-between items-center">
            <span className="text-xs text-slate-500">Subtotal</span>
            <span className="text-sm font-bold text-slate-900 tabular-nums">
              {formatCurrencyDisplay(parseInt(qty, 10) * parseCurrencyInput(hargaJual))}
            </span>
          </div>
        )}

        <button
          onClick={addToCart}
          disabled={!selectedItemId || !qty || !hargaJual}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:shadow-lg disabled:opacity-40 transition flex items-center justify-center gap-2"
        >
          <Plus size={16} />
          Tambah ke Keranjang
        </button>
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className={`${br} p-5 space-y-3`}>
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <ShoppingCart size={16} className="text-emerald-600" />
            Keranjang ({cart.length} item)
          </h3>

          <div className="space-y-2">
            {cart.map((item, i) => (
              <div key={item.inventory_item_id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-3 py-2.5">
                <span className="text-xs font-bold text-slate-400 w-5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{item.nama}</p>
                  <p className="text-xs text-slate-500">
                    {item.qty} {item.satuan} × {formatCurrencyDisplay(item.harga_jual)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">{formatCurrencyDisplay(item.qty * item.harga_jual)}</p>
                  <p className="text-[10px] text-slate-400">HPP: {formatCurrencyDisplay(item.hpp)}/unit</p>
                </div>
                <button
                  onClick={() => removeFromCart(item.inventory_item_id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary & Settings */}
      <div className={`${br} p-5 space-y-4`}>
        <h3 className="text-sm font-bold text-slate-700">Ringkasan Penjualan</h3>

        {/* Summary numbers */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total Penjualan</span>
            <span className="font-bold text-slate-900 tabular-nums">{formatCurrencyDisplay(totalPenjualan)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Total HPP</span>
            <span className="font-semibold text-slate-700 tabular-nums">{formatCurrencyDisplay(totalHpp)}</span>
          </div>
          <div className="h-px bg-slate-200 my-1" />
          <div className="flex justify-between text-sm">
            <span className="text-emerald-600 font-bold">Laba Kotor</span>
            <span className="font-bold text-emerald-700 tabular-nums text-base">{formatCurrencyDisplay(labaKotor)}</span>
          </div>
        </div>

        <div className="h-px bg-slate-200" />

        {/* Kas/Bank selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">🏦 Kas/Bank Penerima</label>
          <select
            value={kasAkunId}
            onChange={e => setKasAkunId(e.target.value)}
            className={inputCls}
          >
            <option value="">Pilih akun kas/bank...</option>
            {kasBankAccounts.map(a => (
              <option key={a.id} value={a.id}>{a.kode} — {a.nama}</option>
            ))}
          </select>
        </div>

        {/* Tanggal */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">📅 Tanggal</label>
          <input type="date" value={tanggal} min={cutoff || undefined} onChange={e => setTanggal(e.target.value)} className={inputCls} />
        </div>

        {/* Keterangan */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">📝 Keterangan <span className="text-slate-400 font-normal">(opsional)</span></label>
          <textarea
            value={keterangan}
            onChange={e => setKeterangan(e.target.value)}
            placeholder="Catatan penjualan..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={saving || cart.length === 0}
          data-help-target="btn-bayar"
          className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 px-5 py-3 text-sm font-bold text-white shadow-lg hover:shadow-xl disabled:opacity-40 transition flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Memproses...
            </>
          ) : (
            <>
              <ShoppingCart size={16} />
              Proses Penjualan
            </>
          )}
        </button>
      </div>

      {/* Spacer for mobile */}
      <div className="h-4" />
    </div>
  );
}
