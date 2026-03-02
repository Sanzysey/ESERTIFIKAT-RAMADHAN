import React, { useState, useEffect, useRef } from 'react';
import { Download, Award, User, Settings2, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Upload, FileImage, FileText } from 'lucide-react';

export default function App() {
  // --- STATE UTAMA ---
  const [nama, setNama] = useState(''); 
  const [templateSrc, setTemplateSrc] = useState('SERTIFIKAT RAMADHAN 2026.jpg');
  
  // --- STATE STATUS & RAHASIA ---
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [secretClick, setSecretClick] = useState(0); 
  
  // --- CONFIG TEKS (SUDAH DIKUNCI: FONT 104) ---
  const [textConfig, setTextConfig] = useState({
    x: 510,          // Terkunci: Posisi horizontal
    y: 557,          // Terkunci: Posisi vertikal
    fontSize: 104,   // Terkunci: Ukuran font baru 104
    color: '#1a1a1a', 
    fontFamily: 'Arial' 
  });

  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Memuat pustaka jsPDF secara dinamis
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const handleSecretTrigger = () => {
    setSecretClick(prev => prev + 1);
  };

  const drawCertificate = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img || !img.complete) return;

    const ctx = canvas.getContext('2d');
    
    // Set resolusi kanvas sesuai ukuran asli gambar template
    canvas.width = img.naturalWidth || 2000;
    canvas.height = img.naturalHeight || 1414;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (nama.trim() !== '') {
      // Hitung skala agar ukuran font konsisten di semua resolusi gambar
      const scaleX = canvas.width / 2000;
      const scaleY = canvas.height / 1414;
      
      const scaledFontSize = textConfig.fontSize * scaleX;

      ctx.fillStyle = textConfig.color;
      ctx.font = `bold ${scaledFontSize}px "${textConfig.fontFamily}", sans-serif`;
      ctx.textAlign = 'center'; 
      ctx.textBaseline = 'middle';
      
      ctx.fillText(nama.toUpperCase(), textConfig.x * scaleX, textConfig.y * scaleY);
    }
  };

  const handleManualUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setIsLoading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        setTemplateSrc(event.target.result);
        setImageError(false);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!templateSrc) return;
    setIsLoading(true);
    const img = new Image();
    
    let finalPath = templateSrc;
    if (typeof templateSrc === 'string' && !templateSrc.startsWith('data:')) {
      const baseName = templateSrc.startsWith('/') ? templateSrc.substring(1) : templateSrc;
      finalPath = encodeURI(baseName);
    }

    img.src = finalPath;
    img.onload = () => {
      imageRef.current = img;
      setImageError(false);
      setIsLoading(false);
      drawCertificate();
    };

    img.onerror = () => {
      if (typeof templateSrc === 'string' && !templateSrc.startsWith('data:') && !finalPath.startsWith('/')) {
        const retryPath = '/' + finalPath;
        const retryImg = new Image();
        retryImg.src = retryPath;
        retryImg.onload = () => {
          imageRef.current = retryImg;
          setImageError(false);
          setIsLoading(false);
          drawCertificate();
        };
        retryImg.onerror = () => {
          setImageError(true);
          setIsLoading(false);
        };
      } else {
        setImageError(true);
        setIsLoading(false);
      }
    };
  }, [templateSrc]);

  useEffect(() => {
    drawCertificate();
  }, [nama, textConfig]);

  const handleDownloadPDF = () => {
    if (!nama.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!window.jspdf) {
      alert("Sistem PDF sedang disiapkan, silakan coba lagi...");
      return;
    }

    const { jsPDF } = window.jspdf;
    const imgData = canvas.toDataURL('image/jpeg', 1.0);
    const orientation = canvas.width > canvas.height ? 'l' : 'p';
    
    const pdf = new jsPDF({
      orientation: orientation,
      unit: 'px',
      format: [canvas.width, canvas.height]
    });

    pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
    pdf.save(`Sertifikat-${nama.replace(/\s+/g, '_')}.pdf`);
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-10 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        
        {/* Header (Ikon Award diklik 5x untuk memunculkan setting) */}
        <header className="bg-white rounded-3xl shadow-sm p-6 flex items-center justify-between border border-slate-200">
          <div className="flex items-center gap-4">
            <div 
              onClick={handleSecretTrigger}
              className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg shadow-emerald-200 cursor-pointer active:scale-90 transition-transform"
            >
              <Award size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-emerald-900 uppercase">E-Sertifikat Online</h1>
              <p className="text-slate-500 text-sm font-medium">Format PDF HD - Siap Cetak</p>
            </div>
          </div>

          {secretClick >= 5 && (
            <button 
              onClick={() => setIsAdminMode(!isAdminMode)}
              className="p-2.5 text-emerald-600 animate-pulse bg-emerald-50 rounded-full border border-emerald-100"
              title="Aktifkan Mode Admin"
            >
              <Settings2 size={22} />
            </button>
          )}
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Kolom Input */}
          <div className="lg:col-span-5 space-y-6">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-1.5 h-6 bg-emerald-600 rounded-full"></div>
                <h2 className="text-xl font-bold text-slate-700">Identitas Peserta</h2>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">Nama Lengkap</label>
                  <input
                    type="text"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="w-full bg-slate-50 rounded-2xl border-2 border-slate-100 px-5 py-4 focus:border-emerald-500 focus:bg-white outline-none text-lg transition-all font-bold uppercase"
                    placeholder="Masukkan nama Anda..."
                  />
                </div>

                <button
                  onClick={handleDownloadPDF}
                  disabled={!nama.trim() || imageError || isLoading}
                  className={`w-full flex items-center justify-center gap-3 px-8 py-5 rounded-2xl font-black text-lg transition-all shadow-xl
                    ${nama.trim() && !imageError && !isLoading 
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200 cursor-pointer active:scale-95' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}`}
                >
                  <FileText size={24} />
                  UNDUH PDF (HD)
                </button>
              </div>
            </section>

            {/* Error Template */}
            {imageError && (
              <section className="bg-rose-50 border-2 border-rose-100 rounded-3xl p-8 space-y-5">
                <div className="flex gap-4 text-rose-700">
                  <AlertCircle size={32} className="shrink-0" />
                  <div>
                    <h3 className="font-black text-lg text-rose-800">Template Gagal Dimuat</h3>
                    <p className="text-sm opacity-80 leading-relaxed">Pastikan file <span className="font-bold">SERTIFIKAT RAMADHAN 2026.jpg</span> ada di folder <span className="font-mono bg-rose-100 px-1 text-rose-900">public/</span>.</p>
                  </div>
                </div>
                <label className="flex flex-col items-center justify-center gap-2 bg-white border-2 border-dashed border-rose-300 p-4 rounded-2xl cursor-pointer hover:bg-rose-100 transition-all">
                  <Upload size={24} className="text-rose-500" />
                  <span className="text-xs font-bold text-rose-700 uppercase">Pilih File Manual</span>
                  <input type="file" accept="image/*" onChange={handleManualUpload} className="hidden" />
                </label>
              </section>
            )}

            {/* Admin Panel */}
            {isAdminMode && (
              <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-2xl space-y-6 animate-in slide-in-from-top duration-300">
                <div className="flex items-center gap-2 text-emerald-400 border-b border-slate-800 pb-4">
                  <ShieldCheck size={20} />
                  <h3 className="font-bold uppercase tracking-widest text-sm text-center w-full">Konfigurasi Sistem</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-black uppercase text-center block tracking-tighter">Sumbu X (Kunci: {textConfig.x})</label>
                    <input type="range" min="0" max="2000" value={textConfig.x} onChange={(e) => setTextConfig({...textConfig, x: Number(e.target.value)})} className="w-full accent-emerald-500" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-400 font-black uppercase text-center block tracking-tighter">Sumbu Y (Kunci: {textConfig.y})</label>
                    <input type="range" min="0" max="1414" value={textConfig.y} onChange={(e) => setTextConfig({...textConfig, y: Number(e.target.value)})} className="w-full accent-emerald-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 font-black uppercase text-center block tracking-tighter text-emerald-400">Ukuran Font Sekarang: {textConfig.fontSize}</label>
                  <input type="range" min="10" max="400" value={textConfig.fontSize} onChange={(e) => setTextConfig({...textConfig, fontSize: Number(e.target.value)})} className="w-full accent-emerald-500" />
                </div>
                <button onClick={() => setSecretClick(0) || setIsAdminMode(false)} className="w-full py-2 bg-rose-900/30 text-rose-400 rounded-xl text-xs font-bold border border-rose-900/50 hover:bg-rose-900/50 uppercase tracking-widest transition-colors">Tutup & Simpan Permanen</button>
              </section>
            )}
          </div>

          {/* Kolom Pratinjau */}
          <div className="lg:col-span-7 bg-slate-300 rounded-[2.5rem] p-4 md:p-10 flex flex-col items-center justify-center border-4 border-white shadow-inner min-h-[550px]">
            {isLoading ? (
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <RefreshCw size={48} className="animate-spin text-emerald-600" />
                <p className="font-bold tracking-tight">Memuat Pratinjau HD...</p>
              </div>
            ) : imageError ? (
              <div className="text-center space-y-4 max-w-sm">
                <FileImage size={48} className="mx-auto text-slate-400 opacity-20" />
                <p className="text-slate-500 font-bold italic">Pratinjau Belum Siap</p>
              </div>
            ) : (
              <div className="bg-white shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] w-full rounded-lg overflow-hidden ring-8 ring-white/50 relative">
                <canvas ref={canvasRef} className="w-full h-auto block" />
              </div>
            )}
          </div>

        </main>
      </div>
    </div>
  );
}