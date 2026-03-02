import React, { useState, useEffect, useRef } from 'react';
import { Download, Award, User, Settings2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Upload, FileImage, FileText } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// --- SISTEM PENGAMAN KONFIGURASI (ANTI LAYAR PUTIH) ---
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.warn("Konfigurasi Firebase tidak ditemukan (Mode Lokal).");
  }
  return null;
};

const fConfig = getFirebaseConfig();
let auth, db;

// Hanya inisialisasi jika sedang online (mencegah error di komputer lokal)
if (fConfig && fConfig.apiKey) {
  const app = initializeApp(fConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'sertifikat-ramadhan-001';

export default function App() {
  const [user, setUser] = useState(null);
  const [nama, setNama] = useState('');
  const [noSertifikat, setNoSertifikat] = useState('');
  const [participantsCount, setParticipantsCount] = useState(0);
  
  const [templateSrc, setTemplateSrc] = useState('SERTIFIKAT RAMADHAN 2026.jpg');
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [secretClick, setSecretClick] = useState(0); 

  // --- CONFIG TERKUNCI PERMANEN: Sesuai Setting Terakhir Anda ---
  const [config, setConfig] = useState({
    name: { x: 999, y: 602, size: 94, color: '#1a1a1a' },
    number: { x: 834, y: 410, size: 33, color: '#1a1a1a' }
  });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // 1. Firebase Auth
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) { console.error("Auth error:", err); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. Monitoring Database (Untuk Auto-Numbering)
  useEffect(() => {
    if (!user || !db) return;
    const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      setParticipantsCount(snapshot.size);
      const myDoc = snapshot.docs.find(d => d.id === user.uid);
      if (myDoc) {
        setNoSertifikat(myDoc.data().noUrut);
        setNama(myDoc.data().nama);
      }
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Load Engine PDF
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // 4. Proses Menggambar ke Kanvas
  const drawCertificate = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    canvas.width = img.naturalWidth || 2000;
    canvas.height = img.naturalHeight || 1414;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / 2000;
    const scaleY = canvas.height / 1414;

    // GAMBAR NAMA
    if (nama.trim() !== '') {
      ctx.fillStyle = config.name.color;
      ctx.font = `bold ${config.name.size * scaleX}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nama.toUpperCase(), config.name.x * scaleX, config.name.y * scaleY);
    }

    // GAMBAR NOMOR SERTIFIKAT
    // Karena template sudah ada tulisan "No :", kita HANYA mencetak angkanya saja.
    // Jika di lokal (!db), paksa tampilkan '001' agar bisa dilihat posisinya
    const displayNo = noSertifikat ? noSertifikat : (isAdminMode || !db ? '001' : '');
    
    if (displayNo) {
      ctx.fillStyle = config.number.color;
      ctx.font = `bold ${config.number.size * scaleX}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      // HANYA mencetak angka, tanpa awalan teks
      ctx.fillText(displayNo, config.number.x * scaleX, config.number.y * scaleY);
    }
  };

  // 5. Fungsi Generate & Unduh
  const handleGenerateAndDownload = async () => {
    if (!nama.trim()) return;
    
    // Jika di komputer lokal (Tanpa DB online), beri nomor uji coba '001' lalu unduh
    if (!db) {
      setIsProcessing(true);
      setNoSertifikat('001'); // Beri nomor uji coba
      
      // Tunggu sejenak agar kanvas menggambar ulang dengan nomor
      setTimeout(() => {
        const canvas = canvasRef.current;
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save(`Sertifikat_001_${nama.replace(/\s+/g, '_')}.pdf`);
        setIsProcessing(false);
      }, 800);
      return;
    }

    setIsProcessing(true);
    try {
      const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'participants', user.uid);
      let currentNo = noSertifikat;

      if (!currentNo) {
        const nextNo = String(participantsCount + 1).padStart(3, '0');
        await setDoc(userRef, { nama: nama.toUpperCase(), noUrut: nextNo, timestamp: Date.now() });
        currentNo = nextNo;
        setNoSertifikat(nextNo);
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const canvas = canvasRef.current;
      const { jsPDF } = window.jspdf;
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`Sertifikat_${currentNo}_${nama.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      alert("Sistem sedang sibuk, silakan klik lagi.");
    } finally { setIsProcessing(false); }
  };

  // 6. Monitor File Gambar
  useEffect(() => {
    if (!templateSrc) return;
    setIsLoading(true);
    const img = new Image();
    let fp = templateSrc;
    if (typeof templateSrc === 'string' && !templateSrc.startsWith('data:')) {
      fp = encodeURI(templateSrc.startsWith('/') ? templateSrc : '/' + templateSrc);
    }
    img.src = fp;
    img.onload = () => { imageRef.current = img; setImageError(false); setIsLoading(false); drawCertificate(); };
    img.onerror = () => { setImageError(true); setIsLoading(false); };
  }, [templateSrc]);

  // Redraw canvas jika ada perubahan teks, konfigurasi, atau mode admin
  useEffect(() => { drawCertificate(); }, [nama, noSertifikat, config, isAdminMode]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header - Klik Piala 5x untuk menu admin */}
        <header className="bg-white rounded-3xl shadow-sm p-6 flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-4">
            <div onClick={() => setSecretClick(s => s + 1)} className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg cursor-pointer active:scale-90 transition-transform">
              <Award size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-emerald-900 uppercase">E-Sertifikat Online</h1>
              <p className="text-slate-500 text-sm">Kursus Kilat Ramadhan Ngabuburit Pro</p>
            </div>
          </div>
          {secretClick >= 5 && (
            <button onClick={() => setIsAdminMode(!isAdminMode)} className="p-2.5 text-emerald-600 bg-emerald-50 rounded-full border border-emerald-100">
              <Settings2 size={22} />
            </button>
          )}
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Kolom Kiri: Input Peserta & Admin Panel */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                <h2 className="text-xl font-bold">Data Peserta</h2>
              </div>
              <div className="space-y-6">
                
                {/* Peringatan Mode Lokal */}
                {!db && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-amber-700 text-xs font-bold">
                    <AlertCircle size={16} />
                    Mode Lokal: Uji coba PDF aktif. Nomor rilis saat sudah online.
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Masukkan Nama Lengkap</label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    disabled={!!noSertifikat || isProcessing}
                    className="w-full bg-slate-50 rounded-2xl border-2 border-slate-100 px-5 py-4 focus:border-emerald-500 outline-none text-lg font-bold disabled:opacity-60 uppercase"
                    placeholder="CONTOH: MUHAMMAD ARYA"
                  />
                </div>
                <div className="space-y-3">
                  <button
                    onClick={handleGenerateAndDownload}
                    disabled={!nama.trim() || isProcessing || imageError || isLoading}
                    className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black text-lg transition-all shadow-xl
                      ${nama.trim() && !isProcessing && !isLoading 
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 cursor-pointer active:scale-95' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                  >
                    {isProcessing ? <RefreshCw className="animate-spin" /> : <Download size={24} />}
                    {noSertifikat ? 'UNDUH ULANG PDF' : 'GENERATE & UNDUH PDF'}
                  </button>
                  {noSertifikat && (
                    <div className="flex items-center justify-center gap-2 text-emerald-600 font-bold text-sm bg-emerald-50 py-3 rounded-xl border border-emerald-100">
                      <CheckCircle2 size={18} />
                      <span>Sertifikat Terdaftar: No. {noSertifikat}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>
            
            {/* Panel Rahasia (Hanya muncul jika di-klik piala 5x) */}
            {isAdminMode && (
              <section className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl space-y-6">
                <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-800 pb-4">
                  <ShieldCheck size={20} />
                  <h3 className="font-bold uppercase text-sm w-full text-center">Panel Konfigurasi</h3>
                </div>

                {/* --- KONTROL NAMA --- */}
                <div className="space-y-4 border border-slate-800 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-slate-300 text-center uppercase tracking-widest">Atur Teks Nama</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu X: {config.name.x}</label>
                      <input type="range" min="0" max="2000" value={config.name.x} onChange={(e) => setConfig({...config, name: {...config.name, x: Number(e.target.value)}})} className="w-full accent-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu Y: {config.name.y}</label>
                      <input type="range" min="0" max="1414" value={config.name.y} onChange={(e) => setConfig({...config, name: {...config.name, y: Number(e.target.value)}})} className="w-full accent-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-emerald-400 font-bold uppercase block text-center">Ukuran: {config.name.size}</label>
                      <input type="range" min="10" max="300" value={config.name.size} onChange={(e) => setConfig({...config, name: {...config.name, size: Number(e.target.value)}})} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                </div>

                {/* --- KONTROL NOMOR SERTIFIKAT --- */}
                <div className="space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-800/50">
                  <h4 className="text-xs font-bold text-slate-300 text-center uppercase tracking-widest">Atur Teks Nomor</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu X: {config.number.x}</label>
                      <input type="range" min="0" max="2000" value={config.number.x} onChange={(e) => setConfig({...config, number: {...config.number, x: Number(e.target.value)}})} className="w-full accent-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu Y: {config.number.y}</label>
                      <input type="range" min="0" max="1414" value={config.number.y} onChange={(e) => setConfig({...config, number: {...config.number, y: Number(e.target.value)}})} className="w-full accent-emerald-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-emerald-400 font-bold uppercase block text-center">Ukuran: {config.number.size}</label>
                      <input type="range" min="10" max="150" value={config.number.size} onChange={(e) => setConfig({...config, number: {...config.number, size: Number(e.target.value)}})} className="w-full accent-emerald-500" />
                    </div>
                  </div>
                </div>

                <button onClick={() => setSecretClick(0) || setIsAdminMode(false)} className="w-full py-3 bg-red-900/30 text-red-400 rounded-xl text-xs font-bold uppercase border border-red-900/50 hover:bg-red-900/50 transition-colors">Tutup & Kunci Pengaturan</button>
              </section>
            )}
          </div>

          {/* Kolom Kanan: Pratinjau Kanvas */}
          <div className="lg:col-span-7 bg-slate-300 rounded-[2.5rem] p-4 md:p-10 flex flex-col items-center justify-center border-4 border-white shadow-inner min-h-[550px]">
            {isLoading ? <RefreshCw size={48} className="animate-spin text-emerald-600" /> : (
              <div className="bg-white shadow-2xl w-full rounded-lg overflow-hidden ring-8 ring-white/50 relative">
                <canvas ref={canvasRef} className="w-full h-auto block" />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
