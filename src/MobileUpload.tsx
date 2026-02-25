/**
 * MobileUpload — Lightweight phone upload page.
 * Rendered when the URL contains ?mode=upload&peer=PEER_ID.
 * Connects to the PC browser via PeerJS WebRTC and sends selected photos.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { Upload, CheckCircle2, Loader2, Wifi, WifiOff, ImagePlus, Send } from 'lucide-react';

type Status = 'connecting' | 'connected' | 'sending' | 'done' | 'error';

export default function MobileUpload() {
    const params = new URLSearchParams(window.location.search);
    const remotePeerId = params.get('peer') || '';

    const [status, setStatus] = useState<Status>('connecting');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previews, setPreviews] = useState<string[]>([]);
    const [sendProgress, setSendProgress] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);
    const connRef = useRef<DataConnection | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!remotePeerId) {
            setStatus('error');
            return;
        }

        const peer = new Peer();

        peer.on('open', () => {
            const conn = peer.connect(remotePeerId, { reliable: true });

            conn.on('open', () => {
                connRef.current = conn;
                setStatus('connected');
            });

            conn.on('close', () => {
                // Don't set error if we already completed
                setStatus(prev => prev === 'done' ? 'done' : 'error');
            });

            conn.on('error', () => {
                setStatus('error');
            });
        });

        peer.on('error', () => {
            setStatus('error');
        });

        return () => {
            peer.destroy();
        };
    }, [remotePeerId]);

    // Clean up preview URLs
    useEffect(() => {
        return () => {
            previews.forEach(url => URL.revokeObjectURL(url));
        };
    }, [previews]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        const files = Array.from(e.target.files) as File[];
        setSelectedFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(f => URL.createObjectURL(f as Blob));
        setPreviews(prev => [...prev, ...newPreviews]);
    };

    const sendFiles = useCallback(async () => {
        const conn = connRef.current;
        if (!conn || selectedFiles.length === 0) return;

        setStatus('sending');
        setTotalFiles(selectedFiles.length);
        setSendProgress(0);

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const arrayBuffer = await file.arrayBuffer();

            conn.send({
                type: 'file',
                name: file.name,
                mimeType: file.type,
                data: arrayBuffer,
                index: i,
                total: selectedFiles.length,
            });

            setSendProgress(i + 1);

            // Small delay to avoid overwhelming the data channel
            await new Promise(r => setTimeout(r, 100));
        }

        // Signal completion
        conn.send({ type: 'done' });
        setStatus('done');
    }, [selectedFiles]);

    const removeFile = (index: number) => {
        URL.revokeObjectURL(previews[index]);
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => prev.filter((_, i) => i !== index));
    };

    return (
        <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans">
            <div className="max-w-lg mx-auto px-4 py-8">

                {/* Header */}
                <header className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-white rounded-2xl shadow-sm mb-4 border border-black/5">
                        <Upload className="w-7 h-7 text-black" />
                    </div>
                    <h1 className="text-2xl font-semibold tracking-tight mb-1">SnapConvert</h1>
                    <p className="text-sm text-[#666]">Send photos to your PC</p>
                </header>

                {/* Status Banner */}
                <div className={`rounded-2xl p-4 mb-6 flex items-center gap-3 text-sm font-medium border ${status === 'connecting' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    status === 'connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        status === 'sending' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            status === 'done' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-red-50 text-red-700 border-red-200'
                    }`}>
                    {status === 'connecting' && <><Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> Connecting to PC…</>}
                    {status === 'connected' && <><Wifi className="w-5 h-5 flex-shrink-0" /> Connected! Select photos to send.</>}
                    {status === 'sending' && <><Loader2 className="w-5 h-5 animate-spin flex-shrink-0" /> Sending {sendProgress}/{totalFiles}…</>}
                    {status === 'done' && <><CheckCircle2 className="w-5 h-5 flex-shrink-0" /> All photos sent! You can close this page.</>}
                    {status === 'error' && <><WifiOff className="w-5 h-5 flex-shrink-0" /> Connection failed. Please scan the QR code again.</>}
                </div>

                {/* File picker + preview (only when connected or has files) */}
                {(status === 'connected' || status === 'sending') && (
                    <>
                        {/* Pick Photos Button */}
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={status === 'sending'}
                            className={`w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all mb-4 ${status === 'sending'
                                ? 'bg-[#E5E5E5] text-[#999] cursor-not-allowed'
                                : 'bg-white text-black border-2 border-dashed border-black/15 hover:border-black/30 active:scale-[0.98]'
                                }`}
                        >
                            <ImagePlus className="w-5 h-5" />
                            {selectedFiles.length > 0 ? `Add more photos` : `Select photos`}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/png"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        {/* Preview Grid */}
                        {selectedFiles.length > 0 && (
                            <div className="bg-white rounded-2xl border border-black/5 overflow-hidden mb-4">
                                <div className="p-3 bg-[#FAFAFA] border-b border-black/5 text-sm font-medium text-[#666]">
                                    {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} selected
                                </div>
                                <div className="p-3 grid grid-cols-3 gap-2">
                                    {previews.map((src, i) => (
                                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-[#F5F5F5]">
                                            <img src={src} alt="" className="w-full h-full object-cover" />
                                            {status === 'connected' && (
                                                <button
                                                    onClick={() => removeFile(i)}
                                                    className="absolute top-1 right-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center text-white text-xs"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Send Button */}
                        {selectedFiles.length > 0 && status === 'connected' && (
                            <button
                                onClick={sendFiles}
                                className="w-full py-4 rounded-2xl font-semibold flex items-center justify-center gap-3 transition-all bg-black text-white hover:scale-[1.01] active:scale-[0.98] shadow-xl"
                            >
                                <Send className="w-5 h-5" />
                                Send {selectedFiles.length} photo{selectedFiles.length !== 1 ? 's' : ''} to PC
                            </button>
                        )}

                        {/* Send progress bar */}
                        {status === 'sending' && (
                            <div className="bg-white rounded-2xl border border-black/5 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-medium text-[#333]">Sending photos…</p>
                                    <p className="text-sm font-semibold text-black tabular-nums">{sendProgress}/{totalFiles}</p>
                                </div>
                                <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-black rounded-full transition-all duration-300"
                                        style={{ width: `${(sendProgress / totalFiles) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Done state */}
                {status === 'done' && (
                    <div className="text-center py-8">
                        <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                        <p className="text-lg font-semibold mb-1">Photos sent!</p>
                        <p className="text-sm text-[#666]">Check your PC browser — your photos are ready.</p>
                    </div>
                )}

                {/* Error retry */}
                {status === 'error' && (
                    <div className="text-center py-8">
                        <WifiOff className="w-16 h-16 text-red-400 mx-auto mb-4" />
                        <p className="text-lg font-semibold mb-1">Connection lost</p>
                        <p className="text-sm text-[#666] mb-4">Make sure your phone and PC are on the same WiFi network.</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-3 rounded-xl bg-black text-white font-medium text-sm"
                        >
                            Try again
                        </button>
                    </div>
                )}

                <footer className="mt-12 text-center text-xs text-[#999]">
                    <p>Peer-to-peer transfer • No cloud uploads</p>
                </footer>
            </div>
        </div>
    );
}
