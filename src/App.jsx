import React, { useState, useEffect, useRef } from 'react';
import { Download, Award, User, Settings2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Upload, FileImage, FileText } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// --- MASUKKAN KONFIGURASI FIREBASE ANDA DI SINI ---
// Kunci API telah diperbaiki dan dicocokkan 100% dengan screenshot Anda
const myFirebaseConfig = {
  apiKey: "AIzaSyD0bRJtRya-36iUTtxsHx47BD739EOYQPc",
  authDomain: "sertifikat-ramadhan.firebaseapp.com",
  projectId: "sertifikat-ramadhan",
  storageBucket: "sertifikat-ramadhan.firebasestorage.app",
  messagingSenderId: "66047807637",
  appId: "1:66047807637:web:3037d809740b4bd86acb9c",
  measurementId: "G-ZYZEVM7C6Y"
};

// --- SISTEM PENGAMAN ---
const getFirebaseConfig = () => {
  try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
      return JSON.parse(__firebase_config);
    }
  } catch (e) {
    console.warn("Konfigurasi Firebase lingkungan tidak ditemukan.");
  }
  
  if (myFirebaseConfig && myFirebaseConfig.apiKey !== "") {
    return myFirebaseConfig;
  }
  
  return null;
};

const fConfig = getFirebaseConfig();
let auth, db;

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
  const [logoError, setLogoError] = useState(false);
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

  useEffect(() => {
    if (!user || !db) return;
    const participantsCol = collection(db, 'artifacts', appId, 'public', 'data', 'participants');
    const unsubscribe = onSnapshot(participantsCol, (snapshot) => {
      setParticipantsCount(snapshot.size);
      const myDoc = snapshot.docs.find(d => d.id === user.uid);
      if (myDoc) {
        setNoSertifikat(myDoc.data().noUrut);
        // Memastikan nama dari DB hanya dimuat jika input sedang kosong (mencegah bentrokan saat mengetik)
        setNama(prev => prev === '' ? myDoc.data().nama : prev);
      }
    });
    return () => unsubscribe();
  }, [user, db]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  const drawCertificate = (overrideNo = null) => {
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

    if (nama.trim() !== '') {
      ctx.fillStyle = config.name.color;
      ctx.font = `bold ${config.name.size * scaleX}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nama.toUpperCase(), config.name.x * scaleX, config.name.y * scaleY);
    }

    const currentNo = overrideNo !== null ? overrideNo : noSertifikat;
    const displayNo = currentNo ? currentNo : (isAdminMode || !db ? '001' : '');
    
    if (displayNo) {
      ctx.fillStyle = config.number.color;
      ctx.font = `bold ${config.number.size * scaleX}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(displayNo, config.number.x * scaleX, config.number.y * scaleY);
    }
  };

  const handleGenerateAndDownload = async () => {
    if (!nama.trim()) return;
    
    if (!db) {
      setIsProcessing(true);
      setNoSertifikat('001'); 
      drawCertificate('001'); 
      
      setTimeout(() => {
        const canvas = canvasRef.current;
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save(`Sertifikat_001_${nama.replace(/\s+/g, '_')}.pdf`);
        setIsProcessing(false);
      }, 500);
      return;
    }

    if (!user) {
      alert("Koneksi gagal: Pastikan Anda sudah mengaktifkan 'Anonymous' di menu Authentication Firebase.");
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
      } else {
        // PERBARUI NAMA: Jika nomor sertifikat sudah ada, kita perbarui nama di databasenya (jika ada typo)
        await setDoc(userRef, { nama: nama.toUpperCase(), noUrut: currentNo, timestamp: Date.now() }, { merge: true });
      }

      drawCertificate(currentNo); 

      setTimeout(() => {
        const canvas = canvasRef.current;
        const { jsPDF } = window.jspdf;
        const imgData = canvas.toDataURL('image/jpeg', 1.0);
        const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
        pdf.save(`Sertifikat_${currentNo}_${nama.replace(/\s+/g, '_')}.pdf`);
        setIsProcessing(false);
      }, 500);
      
    } catch (error) {
      console.error(error);
      alert("Sistem sedang sibuk. Pastikan internet lancar dan pengaturan Firebase sudah benar.");
      setIsProcessing(false);
    }
  };

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

  useEffect(() => { drawCertificate(); }, [nama, noSertifikat, config, isAdminMode]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        <header className="bg-white rounded-3xl shadow-sm p-6 flex flex-col md:flex-row items-start md:items-center justify-between border border-red-100 gap-4">
          <div className="flex items-center gap-4">
            <div onClick={() => setSecretClick(s => s + 1)} className="bg-red-600 p-1.5 w-14 h-14 flex items-center justify-center rounded-2xl text-white shadow-lg shadow-red-200 cursor-pointer active:scale-90 transition-transform overflow-hidden shrink-0">
              {!logoError ? (
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" onError={() => setLogoError(true)} />
              ) : (
                <Award size={32} />
              )}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-red-900 uppercase tracking-tight">E-Sertifikat Kursus Kilat Ramadhan 2026</h1>
              <p className="text-red-600/80 font-medium text-sm mt-0.5">Kursus Kilat Ramadhan, Ngabuburit Pro</p>
            </div>
          </div>
          {secretClick >= 5 && (
            <button onClick={() => setIsAdminMode(!isAdminMode)} className="p-2.5 text-red-600 bg-red-50 rounded-full border border-red-100 shrink-0">
              <Settings2 size={22} />
            </button>
          )}
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-1.5 h-6 bg-red-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-slate-800">Data Peserta</h2>
              </div>
              <div className="space-y-6">
                
                {!db && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex items-center gap-2 text-amber-700 text-xs font-bold">
                    <AlertCircle size={16} />
                    Mode Lokal: Uji coba PDF aktif. Nomor rilis saat online.
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-2.5 uppercase tracking-widest">Masukkan Nama Lengkap</label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    disabled={isProcessing}
                    className="w-full bg-white rounded-xl border border-slate-200 px-5 py-4 focus:border-red-500 focus:ring-4 focus:ring-red-50 outline-none text-lg font-bold text-slate-800 disabled:bg-slate-50 disabled:text-slate-400 uppercase transition-all shadow-sm placeholder:text-slate-300"
                    placeholder="CONTOH: MUHAMMAD ARYA"
                  />
                </div>
                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleGenerateAndDownload}
                    disabled={!nama.trim() || isProcessing || imageError || isLoading}
                    className={`w-full flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-black text-lg transition-all 
                      ${nama.trim() && !isProcessing && !isLoading 
                        ? 'bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-200/50 cursor-pointer active:scale-95' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'}`}
                  >
                    {isProcessing ? <RefreshCw className="animate-spin" /> : <Download size={22} />}
                    {noSertifikat ? 'PERBARUI & UNDUH PDF' : 'GENERATE & UNDUH PDF'}
                  </button>
                </div>
              </div>
            </section>
            
            {isAdminMode && (
              <section className="bg-slate-900 rounded-3xl p-6 md:p-8 text-white shadow-2xl space-y-6">
                <div className="flex items-center gap-2 text-red-400 border-b border-slate-800 pb-4">
                  <ShieldCheck size={20} />
                  <h3 className="font-bold uppercase text-sm w-full text-center tracking-wider">Panel Konfigurasi</h3>
                </div>

                <div className="space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-800/30">
                  <h4 className="text-xs font-bold text-slate-400 text-center uppercase tracking-widest">Atur Teks Nama</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu X: {config.name.x}</label>
                      <input type="range" min="0" max="2000" value={config.name.x} onChange={(e) => setConfig({...config, name: {...config.name, x: Number(e.target.value)}})} className="w-full accent-red-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu Y: {config.name.y}</label>
                      <input type="range" min="0" max="1414" value={config.name.y} onChange={(e) => setConfig({...config, name: {...config.name, y: Number(e.target.value)}})} className="w-full accent-red-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-red-400 font-bold uppercase block text-center">Ukuran: {config.name.size}</label>
                      <input type="range" min="10" max="300" value={config.name.size} onChange={(e) => setConfig({...config, name: {...config.name, size: Number(e.target.value)}})} className="w-full accent-red-500" />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 border border-slate-800 p-4 rounded-xl bg-slate-800/30">
                  <h4 className="text-xs font-bold text-slate-400 text-center uppercase tracking-widest">Atur Teks Nomor</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu X: {config.number.x}</label>
                      <input type="range" min="0" max="2000" value={config.number.x} onChange={(e) => setConfig({...config, number: {...config.number, x: Number(e.target.value)}})} className="w-full accent-red-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase block text-center">Sumbu Y: {config.number.y}</label>
                      <input type="range" min="0" max="1414" value={config.number.y} onChange={(e) => setConfig({...config, number: {...config.number, y: Number(e.target.value)}})} className="w-full accent-red-500" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-red-400 font-bold uppercase block text-center">Ukuran: {config.number.size}</label>
                      <input type="range" min="10" max="150" value={config.number.size} onChange={(e) => setConfig({...config, number: {...config.number, size: Number(e.target.value)}})} className="w-full accent-red-500" />
                    </div>
                  </div>
                </div>

                <button onClick={() => setSecretClick(0) || setIsAdminMode(false)} className="w-full py-3 bg-red-900/30 text-red-400 rounded-xl text-xs font-bold uppercase border border-red-900/50 hover:bg-red-900/50 transition-colors">Tutup & Kunci Pengaturan</button>
              </section>
            )}
          </div>

          <div className="lg:col-span-7 bg-white rounded-[2rem] p-4 md:p-8 flex flex-col items-center justify-center border border-slate-200 shadow-sm min-h-[550px]">
            {isLoading ? <RefreshCw size={48} className="animate-spin text-red-600" /> : (
              <div className="bg-white shadow-xl w-full rounded-lg overflow-hidden border border-slate-100 relative">
                <canvas ref={canvasRef} className="w-full h-auto block" />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
