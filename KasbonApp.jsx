import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Lock, Unlock, Eye, EyeOff, Search, X, Check, Trash2, Edit3, ChevronLeft, BookOpen, User, ArrowLeft } from 'lucide-react';

// ---------- Logo ----------
function RavisaLogo({ size = 56 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#7A3B2E" />
      <circle cx="50" cy="50" r="48" stroke="#E8D9B5" strokeWidth="2" />
      <text x="50" y="44" textAnchor="middle" fontFamily="Georgia, serif" fontSize="30" fontWeight="700" fill="#F4E9C9">R</text>
      <text x="50" y="68" textAnchor="middle" fontFamily="Georgia, serif" fontSize="9" letterSpacing="2" fill="#E8D9B5">TOKO</text>
      <text x="50" y="80" textAnchor="middle" fontFamily="Georgia, serif" fontSize="10" fontWeight="600" letterSpacing="1.5" fill="#F4E9C9">RAVISA</text>
    </svg>
  );
}

// ---------- Helpers ----------
// Format lengkap dengan titik pemisah ribuan, contoh: Rp 50.000
const fmtRp = (n) => 'Rp ' + Math.abs(Math.round(n)).toLocaleString('id-ID');

// Format singkat untuk ringkasan, contoh: Rp 1.500, Rp 50rb, Rp 2,3jt
const fmtRpShort = (n) => {
  const abs = Math.abs(Math.round(n));
  if (abs >= 1000000) {
    const jt = abs / 1000000;
    return 'Rp ' + (jt % 1 === 0 ? jt : jt.toFixed(1).replace('.', ',')) + 'jt';
  }
  if (abs >= 10000) {
    const rb = abs / 1000;
    return 'Rp ' + (rb % 1 === 0 ? rb : rb.toFixed(1).replace('.', ',')) + 'rb';
  }
  return 'Rp ' + abs.toLocaleString('id-ID');
};
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const STORAGE_KEY = 'kasbon-data'; // PENTING: jangan ganti key ini di edit berikutnya, agar data lama tetap terhubung
const AUTH_KEY = 'ravisa_admin_session_v1';
// ============================================================
// 🔑 PASSWORD ADMIN — ganti angka/kata di bawah ini kapan saja.
// Catatan: karena ini kode yang bisa dibuka siapa saja yang melihat
// file ini, jangan pakai password yang sama dengan akun penting lain.
// ============================================================
const ADMIN_PASSWORD = 'ravisa123';

// ============================================================
// 📊 GOOGLE SHEETS — sumber data utama.
// URL Web App dari Google Apps Script yang terhubung ke
// spreadsheet "Data Kasbon Ravisa" milik Toko Ravisa.
// ============================================================
const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbx-5HD8L3Td2pKbbhL_Yaa3AfUde_WFNFIAjJrjXQ-EbuyG7gDen05bB30N9TKsrFww/exec';

async function loadData() {
  try {
    const res = await fetch(SHEETS_API_URL, { method: 'GET' });
    if (!res.ok) throw new Error('Respons server tidak OK (status ' + res.status + ')');
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    // Simpan cache lokal supaya tetap ada cadangan kalau Sheets sedang tidak bisa diakses
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(json)); } catch (e) {}
    return { data: json, fromSheets: true };
  } catch (err) {
    // Fallback: kalau Google Sheets gagal diakses (misal offline), coba pakai cache lokal terakhir.
    // PENTING: tetap kembalikan info errornya supaya UI bisa memberi tahu, bukan diam-diam sukses.
    let cachedData = { customers: [] };
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) cachedData = JSON.parse(cached);
    } catch (e) {}
    return {
      data: cachedData,
      fromSheets: false,
      error: 'Gagal terhubung ke Google Sheets: ' + (err?.message || String(err)),
    };
  }
}

async function saveData(data) {
  const res = await fetch(SHEETS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' }, // text/plain agar tidak memicu CORS preflight di Apps Script
    body: JSON.stringify(data),
    redirect: 'follow', // Apps Script Web App selalu redirect 302 ke googleusercontent.com; pastikan diikuti
  });
  if (!res.ok) throw new Error('Gagal menyimpan ke Google Sheets (status ' + res.status + ')');
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  // PENTING: pastikan benar-benar doPost yang terpanggil, bukan doGet (bisa terjadi kalau
  // ada redirect yang mengubah method secara diam-diam, sehingga save terlihat sukses
  // padahal sebenarnya cuma membaca data lama tanpa menulis apa pun).
  if (json.handler !== 'doPost') {
    throw new Error('Permintaan simpan ternyata diproses sebagai "' + (json.handler || 'tidak dikenal') + '", bukan doPost. Data TIDAK tersimpan.');
  }
  // Simpan juga ke cache lokal supaya konsisten dengan data terbaru
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
  return json;
}

// ---------- Error Boundary ----------
// Menangkap error React yang sebelumnya bisa membuat UI "diam" tanpa pesan apapun
// (modal tetap terbuka, tidak ada badge, tidak ada apa-apa) karena React crash
// secara silent di balik layar.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('KasbonApp crashed:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F4ECD8] flex flex-col items-center justify-center px-6 text-center">
          <RavisaLogo size={60} />
          <h2 className="font-serif text-lg font-bold text-[#A14B3C] mt-4">Terjadi Error</h2>
          <p className="text-xs text-[#6B5640] mt-2 break-words max-w-sm">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-5 bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-2.5 px-5 text-sm font-medium"
          >
            Coba Lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Helper global: panggil ini dari mana pun untuk menampilkan modal error
// yang TIDAK bisa hilang sendiri/tertutup navigasi, harus ditutup manual.
// Ini dipakai khusus untuk error penyimpanan data yang kritis, supaya
// tidak pernah terlewat lagi seperti masalah sebelumnya.
function reportCriticalError(message) {
  window.dispatchEvent(new CustomEvent('kasbon-critical-error', { detail: message }));
}

function GlobalErrorModal() {
  const [errors, setErrors] = useState([]);
  useEffect(() => {
    function handler(e) {
      setErrors((prev) => [...prev, { id: uid(), message: e.detail, time: new Date().toLocaleTimeString('id-ID') }]);
    }
    window.addEventListener('kasbon-critical-error', handler);
    return () => window.removeEventListener('kasbon-critical-error', handler);
  }, []);

  if (errors.length === 0) return null;
  const current = errors[0];

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full">
        <h3 className="font-serif font-bold text-[#A14B3C] text-lg mb-2">⚠️ Gagal Menyimpan</h3>
        <p className="text-xs text-[#8A7350] mb-1">{current.time}</p>
        <p className="text-sm text-[#3D2B1F] mb-4 break-words">{current.message}</p>
        {errors.length > 1 && (
          <p className="text-xs text-[#8A7350] mb-3">+{errors.length - 1} error lain menunggu</p>
        )}
        <button
          onClick={() => setErrors((prev) => prev.slice(1))}
          className="w-full bg-[#7A3B2E] text-white rounded-xl py-2.5 font-medium"
        >
          Mengerti, Tutup
        </button>
      </div>
    </div>
  );
}

export default function KasbonApp() {
  return (
    <>
      <GlobalErrorModal />
      <ErrorBoundary>
        <KasbonAppInner />
      </ErrorBoundary>
    </>
  );
}

function KasbonAppInner() {
  const [data, setData] = useState({ customers: [] });
  const [loading, setLoading] = useState(true);
  // FIX: status loading khusus saat pindah mode (admin/lihat), supaya tidak
  // menampilkan "Belum ada pelanggan" sebelum data terbaru selesai diambil.
  const [modeLoading, setModeLoading] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorDetail, setSaveErrorDetail] = useState('');
  // Status simpan terakhir yang TIDAK hilang sendiri, supaya bisa dicek kapan saja:
  // 'idle' | 'success' | 'error'
  const [lastSaveStatus, setLastSaveStatus] = useState('idle');
  const [mode, setMode] = useState(null); // 'admin' | 'view' | null
  const [isAuthed, setIsAuthed] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [editingTxn, setEditingTxn] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [logoTapCount, setLogoTapCount] = useState(0);
  const [pinVerifiedFor, setPinVerifiedFor] = useState(null); // customer id yang sudah lolos PIN
  const [pinPromptFor, setPinPromptFor] = useState(null); // customer id yang sedang diminta PIN
  const [pinAttemptInput, setPinAttemptInput] = useState('');
  const [pinAttemptError, setPinAttemptError] = useState('');
  // PIN pelanggan disembunyikan default di tampilan admin; harus diketuk untuk dilihat
  const [revealPin, setRevealPin] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initial load
  useEffect(() => {
    loadData()
      .then((result) => {
        setData(result.data);
        setLoading(false);
        if (!result.fromSheets) {
          setSaveError(true);
          setSaveErrorDetail(result.error || 'Tidak terhubung ke Google Sheets, memakai data cache terakhir.');
        }
      })
      .catch((err) => {
        setSaveError(true);
        setSaveErrorDetail('Gagal memuat data awal: ' + (err?.message || String(err)));
        setLoading(false);
      });
  }, []);

  // Track whether any modal/form is currently open, via ref to avoid stale closures
  const modalOpenRef = React.useRef(false);
  useEffect(() => {
    modalOpenRef.current = !!(showAddCustomer || showAddTxn || editingTxn || confirmDelete || pinPromptFor);
  }, [showAddCustomer, showAddTxn, editingTxn, confirmDelete, pinPromptFor]);

  // Track in-flight saves so we never fetch/overwrite while a save hasn't finished yet
  const pendingSavesRef = React.useRef(0);

  // NOTE: automatic background polling was removed because it risked overwriting
  // freshly-saved data with a stale server copy if a fetch landed right after a save.
  // Instead, we refresh data manually at safe moments: when switching from landing
  // into admin or view mode (see onAdmin/onView below), never silently in the background.
  //
  // FIX: fungsi ini sekarang mengembalikan Promise dan menerima opsi `markLoading`.
  // Sebelumnya, refresh dipanggil tanpa menunggu hasilnya (fire-and-forget), jadi
  // pelanggan bisa langsung melihat daftar yang masih kosong/lama sebelum fetch
  // selesai. Sekarang pemanggil bisa `await` dan menampilkan status memuat.
  function refreshFromServer({ markLoading = false } = {}) {
    if (pendingSavesRef.current > 0) return Promise.resolve(); // jangan fetch saat ada save berjalan
    if (markLoading) setModeLoading(true);
    return loadData()
      .then((result) => {
        if (pendingSavesRef.current > 0) return; // cek ulang setelah fetch selesai
        setData(result.data);
        if (result.fromSheets) {
          setSaveError(false);
          setSaveErrorDetail('');
        } else {
          // PENTING: kalau gagal mengambil data dari Sheets, JANGAN diam-diam dianggap sukses.
          // Data cache lokal tetap ditampilkan, tapi beri tahu bahwa ini bukan data terbaru dari Sheets.
          setSaveError(true);
          setSaveErrorDetail(result.error || 'Tidak terhubung ke Google Sheets, memakai data cache terakhir.');
        }
      })
      .catch((err) => {
        setSaveError(true);
        setSaveErrorDetail('Gagal memuat ulang data: ' + (err?.message || String(err)));
      })
      .finally(() => {
        if (markLoading) setModeLoading(false);
      });
  }

  // Helper to update data: updates local state immediately, then persists.
  // Retries once on failure since the storage call can be flaky on slow connections.
  function mutateData(updater) {
    let nextSnapshot;
    try {
      setData((prev) => {
        nextSnapshot = updater(prev);
        return nextSnapshot;
      });
    } catch (syncErr) {
      // Error sinkron (misal updater melempar exception) - tangkap supaya tidak diam-diam gagal
      setSaveError(true);
      setLastSaveStatus('error');
      setSaveErrorDetail('Error saat memproses data: ' + (syncErr?.message || String(syncErr)));
      return;
    }

    pendingSavesRef.current += 1;
    setIsSaving(true);

    const attemptSave = (retriesLeft) =>
      saveData(nextSnapshot).catch((err) => {
        if (retriesLeft > 0) return attemptSave(retriesLeft - 1);
        throw err;
      });

    attemptSave(1)
      .then(() => {
        setSaveError(false);
        setSaveErrorDetail('');
        setLastSaveStatus('success');
      })
      .catch((err) => {
        setSaveError(true);
        setLastSaveStatus('error');
        const msg = err?.message || String(err);
        setSaveErrorDetail(msg);
        reportCriticalError('Gagal menyimpan data ke Google Sheets: ' + msg);
      })
      .finally(() => {
        pendingSavesRef.current = Math.max(0, pendingSavesRef.current - 1);
        if (pendingSavesRef.current === 0) setIsSaving(false);
      });
  }

  const customers = data.customers || [];

  const customerTotals = useMemo(() => {
    const map = {};
    customers.forEach((c) => {
      const total = (c.transactions || []).reduce((sum, t) => {
        return t.type === 'utang' ? sum + t.amount - (t.paid || 0) : sum;
      }, 0);
      map[c.id] = total;
    });
    return map;
  }, [customers]);

  const grandTotalBelumLunas = useMemo(() => {
    return Object.values(customerTotals).reduce((a, b) => a + b, 0);
  }, [customerTotals]);

  const grandTotalLunas = useMemo(() => {
    let lunas = 0;
    customers.forEach((c) => {
      (c.transactions || []).forEach((t) => {
        if (t.type === 'utang') lunas += (t.paid || 0);
      });
    });
    return lunas;
  }, [customers]);

  const filteredCustomers = customers
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4ECD8] flex flex-col items-center justify-center px-6">
        <RavisaLogo size={70} />
        <p className="text-sm text-[#8A7350] mt-4">Memuat data...</p>
      </div>
    );
  }

  function handleLogin() {
    if (pwInput === ADMIN_PASSWORD) {
      // FIX: tunggu refresh selesai dulu baru masuk ke mode admin, supaya
      // admin juga melihat data terbaru (bukan cuma pelanggan).
      setModeLoading(true);
      refreshFromServer().finally(() => {
        setIsAuthed(true);
        setMode('admin');
        setModeLoading(false);
      });
      setPwError('');
      setPwInput('');
    } else {
      setPwError('Password salah, coba lagi.');
    }
  }

  function handleLogout() {
    if (pendingSavesRef.current > 0) {
      // Masih ada proses simpan berjalan - tunggu sebentar sebelum keluar agar data tidak ketinggalan
      setTimeout(handleLogout, 300);
      return;
    }
    setIsAuthed(false);
    setMode(null);
    setSelectedCustomer(null);
    setPinVerifiedFor(null);
    setLogoTapCount(0);
  }

  function addCustomer(name, pin) {
    try {
      if (!name.trim()) return;
      const finalPin = (pin || '').trim() || String(Math.floor(1000 + Math.random() * 9000));
      const newCustomer = { id: uid(), name: name.trim(), pin: finalPin, transactions: [] };
      mutateData((d) => ({ ...d, customers: [...(d.customers || []), newCustomer] }));
      setShowAddCustomer(false);
    } catch (err) {
      setSaveError(true);
      setLastSaveStatus('error');
      setSaveErrorDetail('Gagal menambah pelanggan: ' + (err?.message || String(err)));
    }
  }

  function deleteCustomer(id) {
    mutateData((d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) }));
    setSelectedCustomer(null);
    setConfirmDelete(null);
  }

  function addTransaction(customerId, txn) {
    mutateData((d) => ({
      ...d,
      customers: d.customers.map((c) =>
        c.id === customerId
          ? { ...c, transactions: [...c.transactions, { ...txn, id: uid() }] }
          : c
      ),
    }));
    setShowAddTxn(false);
  }

  function updateTransaction(customerId, txnId, updates) {
    mutateData((d) => ({
      ...d,
      customers: d.customers.map((c) =>
        c.id === customerId
          ? {
              ...c,
              transactions: c.transactions.map((t) =>
                t.id === txnId ? { ...t, ...updates } : t
              ),
            }
          : c
      ),
    }));
    setEditingTxn(null);
  }

  function deleteTransaction(customerId, txnId) {
    mutateData((d) => ({
      ...d,
      customers: d.customers.map((c) =>
        c.id === customerId
          ? { ...c, transactions: c.transactions.filter((t) => t.id !== txnId) }
          : c
      ),
    }));
    setConfirmDelete(null);
  }

  // ---------- Landing: choose mode ----------
  if (!mode) {
    return (
      <LandingScreen
        showAdminButton={logoTapCount >= 5}
        onLogoTap={() => setLogoTapCount((n) => n + 1)}
        onAdmin={() => {
          if (isAuthed) {
            // FIX: tunggu refresh selesai dulu sebelum render mode admin
            setModeLoading(true);
            refreshFromServer().finally(() => {
              setMode('admin');
              setModeLoading(false);
            });
          } else {
            setMode('login');
          }
        }}
        onView={() => {
          // FIX: dulu refreshFromServer() dipanggil tanpa di-`await`, jadi
          // setMode('view') langsung render lebih dulu pakai data lama/kosong.
          // Sekarang tunggu fetch selesai dulu, baru pindah ke mode view.
          setModeLoading(true);
          refreshFromServer().finally(() => {
            setMode('view');
            setModeLoading(false);
          });
        }}
      />
    );
  }

  // Tampilkan layar memuat saat sedang pindah mode (sebelum data terbaru siap)
  if (modeLoading) {
    return (
      <div className="min-h-screen bg-[#F4ECD8] flex flex-col items-center justify-center px-6">
        <RavisaLogo size={70} />
        <p className="text-sm text-[#8A7350] mt-4">Memuat data terbaru...</p>
      </div>
    );
  }

  // ---------- Login screen ----------
  if (mode === 'login') {
    return (
      <LoginScreen
        pwInput={pwInput}
        setPwInput={setPwInput}
        pwError={pwError}
        onSubmit={handleLogin}
        onBack={() => setMode(null)}
      />
    );
  }

  const isAdmin = mode === 'admin' && isAuthed;

  // ---------- Customer detail ----------
  if (selectedCustomer) {
    const cust = customers.find((c) => c.id === selectedCustomer);
    if (!cust) {
      setSelectedCustomer(null);
      return null;
    }
    if (!isAdmin && pinVerifiedFor !== cust.id) {
      // Akses langsung tanpa verifikasi PIN - tolak dan kembalikan ke list
      setSelectedCustomer(null);
      return null;
    }
    const total = customerTotals[cust.id] || 0;
    const sortedTxns = [...(cust.transactions || [])].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    return (
      <div className="min-h-screen bg-[#F4ECD8]">
        <Header isAdmin={isAdmin} onLogout={handleLogout} saveError={saveError} saveErrorDetail={saveErrorDetail} lastSaveStatus={lastSaveStatus} isSaving={isSaving} onRefresh={() => refreshFromServer({ markLoading: true })} />
        <div className="max-w-md mx-auto px-4 pb-28">
          <button
            onClick={() => { setSelectedCustomer(null); setPinVerifiedFor(null); }}
            className="flex items-center gap-1 text-[#7A3B2E] mt-4 mb-3 text-sm font-medium"
          >
            <ArrowLeft size={16} /> Kembali ke daftar
          </button>

          <div className="bg-[#FFFBF2] border border-[#D9C9A3] rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#7A3B2E] text-[#F4E9C9] flex items-center justify-center font-serif text-lg font-bold">
                  {cust.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-serif text-lg text-[#3D2B1F] font-semibold">{cust.name}</p>
                  <p className="text-xs text-[#8A7350]">{cust.transactions?.length || 0} catatan</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  onClick={() => setConfirmDelete({ type: 'customer', id: cust.id })}
                  className="text-[#A14B3C] p-2 hover:bg-[#F4E0D6] rounded-lg"
                  aria-label="Hapus pelanggan"
                >
                  <Trash2 size={18} />
                </button>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-dashed border-[#D9C9A3] flex items-end justify-between">
              <div>
                <p className="text-xs text-[#8A7350] uppercase tracking-wide">Sisa Kasbon</p>
                <p className={`font-serif text-2xl font-bold mt-1 ${total > 0 ? 'text-[#A14B3C]' : 'text-[#3D7A4D]'}`}>
                  {total > 0 ? fmtRp(total) : 'Lunas ✓'}
                </p>
              </div>
              {isAdmin && cust.pin && (
                <button
                  onClick={() => setRevealPin((v) => !v)}
                  className="text-right active:opacity-70"
                  aria-label={revealPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                >
                  <p className="text-xs text-[#8A7350] uppercase tracking-wide flex items-center justify-end gap-1">
                    PIN {revealPin ? <EyeOff size={11} /> : <Eye size={11} />}
                  </p>
                  <p className="font-serif text-lg font-bold mt-1 text-[#3D2B1F] tracking-widest">
                    {revealPin ? cust.pin : '••••'}
                  </p>
                </button>
              )}
            </div>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddTxn(true)}
              className="w-full mb-4 bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3 font-medium flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition"
            >
              <Plus size={18} /> Tambah Catatan
            </button>
          )}

          <p className="text-xs text-[#8A7350] uppercase tracking-wide mb-2 mt-2">Riwayat</p>
          <div className="space-y-2">
            {sortedTxns.length === 0 && (
              <div className="text-center py-10 text-[#8A7350] text-sm">
                Belum ada catatan kasbon.
              </div>
            )}
            {sortedTxns.map((t) => {
              const sisa = t.type === 'utang' ? t.amount - (t.paid || 0) : 0;
              const lunas = t.type === 'utang' && sisa <= 0;
              return (
                <div
                  key={t.id}
                  className="bg-[#FFFBF2] border border-[#D9C9A3] rounded-lg p-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-sm text-[#3D2B1F] font-medium">{t.note || 'Kasbon'}</p>
                      <p className="text-xs text-[#8A7350] mt-0.5">{fmtDate(t.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-serif font-semibold text-[#3D2B1F]">{fmtRp(t.amount)}</p>
                      {t.type === 'utang' && (
                        <span
                          className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            lunas
                              ? 'bg-[#DCEEDC] text-[#3D7A4D]'
                              : t.paid > 0
                              ? 'bg-[#FBE8C8] text-[#9A6B1E]'
                              : 'bg-[#F4E0D6] text-[#A14B3C]'
                          }`}
                        >
                          {lunas ? 'Lunas' : t.paid > 0 ? `Cicil ${fmtRp(t.paid)}` : 'Belum bayar'}
                        </span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 mt-2 pt-2 border-t border-dashed border-[#E5DAC0]">
                      {t.type === 'utang' && !lunas && (
                        <button
                          onClick={() =>
                            updateTransaction(cust.id, t.id, { paid: t.amount })
                          }
                          className="text-xs flex items-center gap-1 text-[#3D7A4D] font-medium px-2 py-1 rounded hover:bg-[#DCEEDC]"
                        >
                          <Check size={13} /> Lunas
                        </button>
                      )}
                      <button
                        onClick={() => setEditingTxn(t)}
                        className="text-xs flex items-center gap-1 text-[#6B5640] font-medium px-2 py-1 rounded hover:bg-[#EEE3C7]"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ type: 'txn', customerId: cust.id, id: t.id })}
                        className="text-xs flex items-center gap-1 text-[#A14B3C] font-medium px-2 py-1 rounded hover:bg-[#F4E0D6]"
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {showAddTxn && (
          <TxnModal
            title="Tambah Catatan"
            onClose={() => setShowAddTxn(false)}
            onSave={(txn) => addTransaction(cust.id, txn)}
          />
        )}
        {editingTxn && (
          <TxnModal
            title="Edit Catatan"
            initial={editingTxn}
            onClose={() => setEditingTxn(null)}
            onSave={(updates) => updateTransaction(cust.id, editingTxn.id, updates)}
          />
        )}
        {confirmDelete && (
          <ConfirmModal
            message={
              confirmDelete.type === 'customer'
                ? `Hapus pelanggan "${cust.name}" beserta semua catatannya?`
                : 'Hapus catatan ini?'
            }
            onCancel={() => setConfirmDelete(null)}
            onConfirm={() =>
              confirmDelete.type === 'customer'
                ? deleteCustomer(confirmDelete.id)
                : deleteTransaction(confirmDelete.customerId, confirmDelete.id)
            }
          />
        )}
      </div>
    );
  }

  // ---------- Customer list ----------
  return (
    <div className="min-h-screen bg-[#F4ECD8]">
      <Header isAdmin={isAdmin} onLogout={handleLogout} saveError={saveError} saveErrorDetail={saveErrorDetail} lastSaveStatus={lastSaveStatus} isSaving={isSaving} onRefresh={() => refreshFromServer({ markLoading: true })} />
      <div className="max-w-md mx-auto px-4 pb-28">
        {/* Summary - hanya admin */}
        {isAdmin && (
          <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
            <div className="bg-[#FFFBF2] border border-[#D9C9A3] rounded-xl p-3">
              <p className="text-[10px] text-[#8A7350] uppercase tracking-wide">Belum Lunas</p>
              <p className="font-serif text-lg font-bold text-[#A14B3C] mt-1">{fmtRpShort(grandTotalBelumLunas)}</p>
            </div>
            <div className="bg-[#FFFBF2] border border-[#D9C9A3] rounded-xl p-3">
              <p className="text-[10px] text-[#8A7350] uppercase tracking-wide">Total Terbayar</p>
              <p className="font-serif text-lg font-bold text-[#3D7A4D] mt-1">{fmtRpShort(grandTotalLunas)}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7350]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama pelanggan..."
            className="w-full bg-[#FFFBF2] border border-[#D9C9A3] rounded-xl py-2.5 pl-9 pr-3 text-sm text-[#3D2B1F] placeholder-[#A8967A] focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
          />
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAddCustomer(true)}
            className="w-full mb-4 bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3 font-medium flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition"
          >
            <Plus size={18} /> Tambah Pelanggan
          </button>
        )}

        <p className="text-xs text-[#8A7350] uppercase tracking-wide mb-2">
          {mode === 'view' ? 'Pilih nama untuk melihat kasbon' : `Daftar Pelanggan (${filteredCustomers.length})`}
        </p>

        <div className="space-y-2">
          {filteredCustomers.length === 0 && (
            <div className="text-center py-10 text-[#8A7350] text-sm">
              {customers.length === 0 ? 'Belum ada pelanggan tercatat.' : 'Tidak ditemukan.'}
            </div>
          )}
          {filteredCustomers.map((c) => {
            const total = customerTotals[c.id] || 0;
            return (
              <button
                key={c.id}
                onClick={() => {
                  if (isAdmin) {
                    setSelectedCustomer(c.id);
                    setRevealPin(false);
                  } else {
                    setPinPromptFor(c.id);
                    setPinAttemptInput('');
                    setPinAttemptError('');
                  }
                }}
                className="w-full bg-[#FFFBF2] border border-[#D9C9A3] rounded-xl p-3 flex items-center justify-between active:scale-[0.98] transition text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#7A3B2E] text-[#F4E9C9] flex items-center justify-center font-serif font-bold">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#3D2B1F]">{c.name}</p>
                    {isAdmin && (
                      <p className="text-xs text-[#8A7350]">{c.transactions?.length || 0} catatan</p>
                    )}
                  </div>
                </div>
                {isAdmin ? (
                  <p className={`font-serif font-semibold text-sm ${total > 0 ? 'text-[#A14B3C]' : 'text-[#3D7A4D]'}`}>
                    {total > 0 ? fmtRp(total) : 'Lunas'}
                  </p>
                ) : (
                  <Lock size={15} className="text-[#A8967A]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {showAddCustomer && (
        <AddCustomerModal onClose={() => setShowAddCustomer(false)} onSave={addCustomer} />
      )}

      {pinPromptFor && (() => {
        const target = customers.find((c) => c.id === pinPromptFor);
        if (!target) return null;
        return (
          <PinModal
            customerName={target.name}
            value={pinAttemptInput}
            onChange={(v) => { setPinAttemptInput(v); setPinAttemptError(''); }}
            error={pinAttemptError}
            onClose={() => setPinPromptFor(null)}
            onSubmit={() => {
              if (pinAttemptInput.trim() === String(target.pin)) {
                setPinVerifiedFor(target.id);
                setSelectedCustomer(target.id);
                setPinPromptFor(null);
                setPinAttemptInput('');
              } else {
                setPinAttemptError('PIN salah, coba lagi.');
              }
            }}
          />
        );
      })()}
    </div>
  );
}

// ---------- Sub components ----------

function PinModal({ customerName, value, onChange, error, onClose, onSubmit }) {
  return (
    <ModalShell title={`Masukkan PIN — ${customerName}`} onClose={onClose}>
      <p className="text-xs text-[#8A7350] mb-3">PIN didapat dari Toko Ravisa saat pertama kali kasbon dicatat.</p>
      <input
        autoFocus
        type="password"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
        placeholder="PIN 4 digit"
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mb-2 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30 text-center tracking-widest"
      />
      {error && <p className="text-xs text-[#A14B3C] mb-2">{error}</p>}
      <button
        onClick={onSubmit}
        disabled={!value.trim()}
        className="w-full bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3 font-medium mt-2 disabled:opacity-40"
      >
        Lihat Kasbon
      </button>
    </ModalShell>
  );
}

function Header({ isAdmin, onLogout, saveError, saveErrorDetail, lastSaveStatus, isSaving, onRefresh }) {
  return (
    <div className="bg-[#7A3B2E] text-[#F4E9C9] sticky top-0 z-10 shadow-md">
      <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RavisaLogo size={34} />
          <div>
            <p className="font-serif font-bold text-sm leading-tight">Toko Ravisa</p>
            <p className="text-[10px] text-[#E8D9B5] leading-tight flex items-center gap-1">
              {isAdmin ? <Lock size={9} /> : <Eye size={9} />}
              {isAdmin ? 'Mode Admin' : 'Mode Lihat'}
              {isSaving && <span className="ml-1 opacity-80">· Menyimpan...</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="text-xs bg-[#612C21] px-2.5 py-1.5 rounded-lg font-medium"
              aria-label="Muat ulang data"
            >
              ↻
            </button>
          )}
          <button
            onClick={onLogout}
            className="text-xs bg-[#612C21] px-3 py-1.5 rounded-lg font-medium"
          >
            Keluar
          </button>
        </div>
      </div>
      {/* Status simpan: tetap tampil sampai aksi berikutnya, tidak hilang sendiri */}
      {isAdmin && lastSaveStatus === 'success' && !saveError && (
        <div className="bg-[#3D7A4D] text-white text-[11px] text-center py-1 px-4">
          ✓ Permintaan simpan selesai tanpa error
        </div>
      )}
      {saveError && (
        <div className="bg-[#A14B3C] text-white text-xs text-center py-1.5 px-4">
          ✗ Gagal menyimpan ke server. {saveErrorDetail || 'Periksa koneksi internet, lalu coba simpan ulang.'}
        </div>
      )}
    </div>
  );
}

function LandingScreen({ showAdminButton, onLogoTap, onAdmin, onView }) {
  return (
    <div className="min-h-screen bg-[#F4ECD8] flex flex-col items-center justify-center px-6">
      <button
        onClick={onLogoTap}
        className="focus:outline-none active:scale-95 transition"
        aria-label="Toko Ravisa"
      >
        <RavisaLogo size={90} />
      </button>
      <h1 className="font-serif text-2xl font-bold text-[#3D2B1F] mt-4">Buku Kasbon</h1>
      <p className="text-sm text-[#8A7350] mb-10">Toko Ravisa</p>

      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={onView}
          className="w-full bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition"
        >
          <Eye size={18} /> Lihat Kasbon Saya
        </button>

        {showAdminButton && (
          <button
            onClick={onAdmin}
            className="w-full bg-[#FFFBF2] border border-[#D9C9A3] text-[#3D2B1F] rounded-xl py-3.5 font-medium flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition"
          >
            <Lock size={18} /> Masuk sebagai Admin
          </button>
        )}
      </div>
      <p className="text-[11px] text-[#A8967A] mt-8 text-center max-w-xs">
        Masukkan PIN yang diberikan Toko Ravisa untuk melihat kasbon Anda.
      </p>
    </div>
  );
}

function LoginScreen({ pwInput, setPwInput, pwError, onSubmit, onBack }) {
  return (
    <div className="min-h-screen bg-[#F4ECD8] flex flex-col items-center justify-center px-6">
      <RavisaLogo size={70} />
      <h2 className="font-serif text-xl font-bold text-[#3D2B1F] mt-4 mb-1">Masuk Admin</h2>
      <p className="text-xs text-[#8A7350] mb-6">Masukkan password untuk mengelola kasbon</p>

      <div className="w-full max-w-xs">
        <input
          type="password"
          value={pwInput}
          onChange={(e) => setPwInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="Password"
          autoFocus
          className="w-full bg-[#FFFBF2] border border-[#D9C9A3] rounded-xl py-3 px-4 text-sm text-[#3D2B1F] focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30 mb-2"
        />
        {pwError && <p className="text-xs text-[#A14B3C] mb-2">{pwError}</p>}
        <button
          onClick={onSubmit}
          className="w-full bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3 font-medium mt-2 shadow-sm active:scale-[0.98] transition"
        >
          Masuk
        </button>
        <button
          onClick={onBack}
          className="w-full text-[#8A7350] text-sm py-3 flex items-center justify-center gap-1"
        >
          <ChevronLeft size={15} /> Batal
        </button>
      </div>
    </div>
  );
}

function AddCustomerModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');

  function handleSave() {
    onSave(name, pin);
  }

  return (
    <ModalShell title="Tambah Pelanggan" onClose={onClose}>
      <label className="text-xs text-[#8A7350] uppercase tracking-wide">Nama Pelanggan</label>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="Contoh: Budi"
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mt-1.5 mb-3 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
      />

      <label className="text-xs text-[#8A7350] uppercase tracking-wide">PIN (4 digit, kosongkan untuk acak otomatis)</label>
      <input
        inputMode="numeric"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        placeholder="Contoh: 1234"
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mt-1.5 mb-4 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
      />

      <button
        onClick={handleSave}
        disabled={!name.trim()}
        className="w-full bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3 font-medium disabled:opacity-40"
      >
        Simpan
      </button>
    </ModalShell>
  );
}

function TxnModal({ title, initial, onClose, onSave }) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [note, setNote] = useState(initial?.note || '');
  const [date, setDate] = useState(
    initial?.date ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [paid, setPaid] = useState(initial?.paid ? String(initial.paid) : '0');

  function handleSave() {
    const amt = parseInt(amount.replace(/\D/g, ''), 10);
    if (!amt) return;
    const paidAmt = parseInt(paid.replace(/\D/g, ''), 10) || 0;
    onSave({
      type: 'utang',
      amount: amt,
      paid: Math.min(paidAmt, amt),
      note: note.trim(),
      date: new Date(date).toISOString(),
    });
  }

  return (
    <ModalShell title={title} onClose={onClose}>
      <label className="text-xs text-[#8A7350] uppercase tracking-wide">Jumlah Kasbon</label>
      <input
        autoFocus
        inputMode="numeric"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Contoh: 50000"
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mt-1.5 mb-3 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
      />

      <label className="text-xs text-[#8A7350] uppercase tracking-wide">Sudah Dibayar (jika ada)</label>
      <input
        inputMode="numeric"
        value={paid}
        onChange={(e) => setPaid(e.target.value)}
        placeholder="0"
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mt-1.5 mb-3 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
      />

      <label className="text-xs text-[#8A7350] uppercase tracking-wide">Keterangan</label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Contoh: Beli beras & gula"
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mt-1.5 mb-3 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
      />

      <label className="text-xs text-[#8A7350] uppercase tracking-wide">Tanggal</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full bg-[#F4ECD8] border border-[#D9C9A3] rounded-lg py-2.5 px-3 text-sm text-[#3D2B1F] mt-1.5 mb-4 focus:outline-none focus:ring-2 focus:ring-[#7A3B2E]/30"
      />

      <button
        onClick={handleSave}
        disabled={!amount.trim()}
        className="w-full bg-[#7A3B2E] text-[#F4E9C9] rounded-xl py-3 font-medium disabled:opacity-40"
      >
        Simpan
      </button>
    </ModalShell>
  );
}

function ConfirmModal({ message, onCancel, onConfirm }) {
  return (
    <ModalShell title="Konfirmasi" onClose={onCancel}>
      <p className="text-sm text-[#3D2B1F] mb-5">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-[#F4ECD8] border border-[#D9C9A3] text-[#3D2B1F] rounded-xl py-2.5 font-medium"
        >
          Batal
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 bg-[#A14B3C] text-white rounded-xl py-2.5 font-medium"
        >
          Hapus
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#FFFBF2] w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif font-bold text-[#3D2B1F]">{title}</h3>
          <button onClick={onClose} className="text-[#8A7350] p-1">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
