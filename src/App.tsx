/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  Download,
  Loader2,
  CheckCircle2,
  FileCode,
  ArrowRight,
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { saveAs } from 'file-saver';
import confetti from 'canvas-confetti';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// ─── i18n ───────────────────────────────────────────────
type Lang = 'en' | 'es' | 'tr';

const LANGUAGES: { code: Lang; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

const translations: Record<Lang, Record<string, string>> = {
  en: {
    subtitle: 'Extract text from your images and save them as professional PDF or Word documents.',
    dropImages: 'Drop your images here',
    addMore: 'Add more images',
    fileHint: 'Supports JPG and PNG up to 10MB each',
    selectedImages: 'Selected Images',
    clearAll: 'Clear all',
    converting: 'Extracting & Converting…',
    success: 'Success!',
    convertBtn: 'Convert to Word (DOCX)',
    conversionComplete: 'Conversion complete!',
    downloadedAuto: 'Your file has been downloaded automatically.',
    conversionFailed: 'Conversion failed. Please try again.',
    footer: 'Privacy First • No Server Uploads',
  },
  es: {
    subtitle: 'Extrae texto de tus imágenes y guárdalas como documentos profesionales en PDF o Word.',
    dropImages: 'Suelta tus imágenes aquí',
    addMore: 'Añadir más imágenes',
    fileHint: 'Admite JPG y PNG de hasta 10 MB cada uno',
    selectedImages: 'Imágenes seleccionadas',
    clearAll: 'Borrar todo',
    converting: 'Extrayendo y convirtiendo…',
    success: '¡Éxito!',
    convertBtn: 'Convertir a Word (DOCX)',
    conversionComplete: '¡Conversión completa!',
    downloadedAuto: 'Tu archivo se ha descargado automáticamente.',
    conversionFailed: 'La conversión falló. Inténtalo de nuevo.',
    footer: 'Privacidad ante todo • Sin subidas al servidor',
  },
  tr: {
    subtitle: 'Görsellerinizdeki metni çıkarın ve profesyonel PDF veya Word belgeleri olarak kaydedin.',
    dropImages: 'Görsellerinizi buraya bırakın',
    addMore: 'Daha fazla görsel ekle',
    fileHint: 'Her biri en fazla 10 MB boyutunda JPG ve PNG desteklenir',
    selectedImages: 'Seçilen Görseller',
    clearAll: 'Tümünü temizle',
    converting: 'Çıkarılıyor ve dönüştürülüyor…',
    success: 'Başarılı!',
    convertBtn: "Word'e Dönüştür (DOCX)",
    conversionComplete: 'Dönüştürme tamamlandı!',
    downloadedAuto: 'Dosyanız otomatik olarak indirildi.',
    conversionFailed: 'Dönüştürme başarısız oldu. Lütfen tekrar deneyin.',
    footer: 'Önce Gizlilik • Sunucuya Yükleme Yok',
  },
};
// ─────────────────────────────────────────────────────────

interface FileItem {
  id: string;
  file: File;
  preview: string;
}

export default function App() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [lang, setLang] = useState<Lang>('tr');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[lang];
  const currentLang = LANGUAGES.find(l => l.code === lang)!;

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const newFiles = filesArray.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        preview: window.URL.createObjectURL(file)
      }));
      setFiles(prev => [...prev, ...newFiles]);
      setIsSuccess(false);
    }
  };

  const clearFiles = () => {
    files.forEach(f => window.URL.revokeObjectURL(f.preview));
    setFiles([]);
    setIsSuccess(false);
  };

  const removeFile = (id: string) => {
    const removed = files.find(f => f.id === id);
    if (removed) {
      window.URL.revokeObjectURL(removed.preview);
    }
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      files.forEach(f => window.URL.revokeObjectURL(f.preview));
    };
  }, [files]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArray = Array.from(e.dataTransfer.files) as File[];
      const newFiles = filesArray
        .filter(file => file.type.startsWith('image/'))
        .map(file => ({
          id: Math.random().toString(36).substring(7),
          file,
          preview: window.URL.createObjectURL(file)
        }));
      setFiles(prev => [...prev, ...newFiles]);
      setIsSuccess(false);
    }
  };

  const fileToGenerativePart = async (file: File) => {
    const base64Data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.readAsDataURL(file);
    });
    return {
      inlineData: {
        data: base64Data,
        mimeType: file.type,
      },
    };
  };

  const extractTextFromImages = async () => {
    const extractedData: { text: string; alignment: 'left' | 'center' | 'right' }[][] = [];
    const model = "gemini-3-flash-preview";

    for (const fileItem of files) {
      const imagePart = await fileToGenerativePart(fileItem.file);
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              imagePart,
              {
                text: `Extract all text from this image accurately. For each block of text, identify its horizontal alignment (left, center, or right) as it appears in the image. 
              Return the result as a JSON array of objects, where each object has "text" and "alignment" properties. 
              Example: [{"text": "Hello World", "alignment": "center"}, {"text": "Footer text", "alignment": "right"}]
              Return ONLY the JSON array.` }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      try {
        const parsed = JSON.parse(response.text || "[]");
        extractedData.push(parsed);
      } catch (e) {
        console.error("Failed to parse Gemini response", e);
        extractedData.push([{ text: response.text || "", alignment: 'left' }]);
      }
    }
    return extractedData;
  };

  const convertToDocx = async () => {
    const extractedData = await extractTextFromImages();
    const children: Paragraph[] = [];

    extractedData.forEach((imageBlocks) => {
      imageBlocks.forEach(block => {
        const alignmentMap = {
          left: AlignmentType.LEFT,
          center: AlignmentType.CENTER,
          right: AlignmentType.RIGHT
        };

        children.push(
          new Paragraph({
            alignment: alignmentMap[block.alignment] || AlignmentType.LEFT,
            children: [new TextRun(block.text)],
            spacing: { after: 200 }
          })
        );
      });

      // Add a page break after each image's text except the last one
      children.push(new Paragraph({ children: [new TextRun("")] }));
    });

    const doc = new Document({
      sections: [{
        children: children,
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'extracted-text.docx');
  };

  const handleConvert = async () => {
    if (files.length === 0) return;

    setIsConverting(true);
    try {
      await convertToDocx();
      setIsSuccess(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (error) {
      console.error('Conversion failed:', error);
      alert(t.conversionFailed);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
      <div className="max-w-4xl mx-auto px-6 py-12 md:py-24">

        {/* Language Selector – top-right */}
        <div className="flex justify-end mb-4 relative">
          <button
            onClick={() => setLangMenuOpen(prev => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-black/10 shadow-sm hover:shadow-md transition-all text-sm font-medium"
          >
            <Globe className="w-4 h-4 text-black/50" />
            <span>{currentLang.flag}</span>
            <span>{currentLang.label}</span>
            <svg className={`w-3 h-3 text-black/40 transition-transform ${langMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5l3 3 3-3" /></svg>
          </button>

          <AnimatePresence>
            {langMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl border border-black/10 shadow-lg overflow-hidden min-w-[160px]"
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => { setLang(l.code); setLangMenuOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors
                      ${l.code === lang ? 'bg-black/5 font-semibold' : 'hover:bg-black/[0.03]'}`}
                  >
                    <span>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-sm mb-6 border border-black/5"
          >
            <FileCode className="w-8 h-8 text-black" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-semibold tracking-tight mb-4"
          >
            SnapConvert
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-lg text-[#666] max-w-md mx-auto"
          >
            {t.subtitle}
          </motion.p>
        </header>

        <main className="space-y-8">
          {/* Upload Area */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              relative border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300
              ${files.length > 0 ? 'bg-white border-black/10' : 'bg-white/50 border-black/10 hover:border-black/30 hover:bg-white'}
            `}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={onFileSelect}
              multiple
              accept="image/jpeg,image/png"
              className="hidden"
            />

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-black/5 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-black/60" />
              </div>
              <p className="text-lg font-medium mb-1">
                {files.length > 0 ? t.addMore : t.dropImages}
              </p>
              <p className="text-sm text-[#999]">
                {t.fileHint}
              </p>
            </div>
          </motion.div>

          {/* File List */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden"
              >
                <div className="p-6 border-bottom border-black/5 bg-[#FAFAFA] flex items-center justify-between">
                  <h3 className="font-medium flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    {t.selectedImages} ({files.length})
                  </h3>
                  <button
                    onClick={clearFiles}
                    className="text-xs text-[#999] hover:text-black transition-colors"
                  >
                    {t.clearAll}
                  </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {files.map((file) => (
                    <motion.div
                      key={file.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-[#F5F5F5] border border-black/5"
                    >
                      <img
                        src={file.preview}
                        alt="Preview"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                          className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black hover:bg-red-500 hover:text-white transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls */}
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-center"
            >
              <button
                onClick={handleConvert}
                disabled={isConverting}
                className={`
                  w-full md:w-auto px-12 py-5 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all
                  ${isConverting
                    ? 'bg-[#E5E5E5] text-[#999] cursor-not-allowed'
                    : 'bg-black text-white hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl'}
                `}
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.converting}
                  </>
                ) : isSuccess ? (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    {t.success}
                  </>
                ) : (
                  <>
                    {t.convertBtn}
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>
          )}

          {/* Success Message */}
          <AnimatePresence>
            {isSuccess && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-center p-6 bg-emerald-50 rounded-3xl border border-emerald-100"
              >
                <p className="text-emerald-800 font-medium mb-1">{t.conversionComplete}</p>
                <p className="text-emerald-600 text-sm">{t.downloadedAuto}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="mt-24 pt-12 border-t border-black/5 text-center text-[#999] text-sm">
          <p>© {new Date().getFullYear()} SnapConvert • {t.footer}</p>
        </footer>
      </div>
    </div>
  );
}
