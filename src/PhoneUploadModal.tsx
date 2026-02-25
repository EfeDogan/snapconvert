/**
 * PhoneUploadModal — QR code modal shown on the PC.
 * Creates a PeerJS peer, generates a QR code URL, and receives files from the phone.
 */

import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Wifi, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PhoneUploadModalProps {
    onClose: () => void;
    onFilesReceived: (files: File[]) => void;
    t: Record<string, string>;
}

type ModalStatus = 'initializing' | 'waiting' | 'connected' | 'receiving' | 'done' | 'error';

export default function PhoneUploadModal({ onClose, onFilesReceived, t }: PhoneUploadModalProps) {
    const [status, setStatus] = useState<ModalStatus>('initializing');
    const [qrUrl, setQrUrl] = useState('');
    const [receivedCount, setReceivedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const peerRef = useRef<Peer | null>(null);
    const receivedFilesRef = useRef<File[]>([]);

    useEffect(() => {
        const peer = new Peer();
        peerRef.current = peer;

        peer.on('open', (id) => {
            // Use the injected LAN IP so the phone can reach the PC
            const localIP = (process.env.LOCAL_IP as string) || window.location.hostname;
            const hostname = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? localIP
                : window.location.hostname;
            const port = window.location.port ? `:${window.location.port}` : '';
            const baseUrl = `${window.location.protocol}//${hostname}${port}`;
            const url = `${baseUrl}?mode=upload&peer=${id}`;
            setQrUrl(url);
            setStatus('waiting');
        });

        peer.on('connection', (conn: DataConnection) => {
            setStatus('connected');

            conn.on('data', (data: unknown) => {
                const payload = data as {
                    type: string;
                    name?: string;
                    mimeType?: string;
                    data?: ArrayBuffer;
                    index?: number;
                    total?: number;
                };

                if (payload.type === 'file' && payload.data && payload.name && payload.mimeType) {
                    const blob = new Blob([payload.data], { type: payload.mimeType });
                    const file = new File([blob], payload.name, { type: payload.mimeType });
                    receivedFilesRef.current.push(file);

                    setTotalCount(payload.total || 0);
                    setReceivedCount(receivedFilesRef.current.length);
                    setStatus('receiving');
                }

                if (payload.type === 'done') {
                    setStatus('done');
                    onFilesReceived(receivedFilesRef.current);
                }
            });

            conn.on('close', () => {
                // If files were received, treat as done
                if (receivedFilesRef.current.length > 0) {
                    setStatus('done');
                    onFilesReceived(receivedFilesRef.current);
                }
            });
        });

        peer.on('error', () => {
            setStatus('error');
        });

        return () => {
            peer.destroy();
        };
    }, [onFilesReceived]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-black/5">
                    <h2 className="font-semibold flex items-center gap-2">
                        <Smartphone className="w-5 h-5" />
                        {t.uploadFromPhone || 'Upload from Phone'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 text-center">

                    {/* Initializing */}
                    {status === 'initializing' && (
                        <div className="py-8">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto text-black/40 mb-3" />
                            <p className="text-sm text-[#666]">{t.phoneInitializing || 'Setting up connection…'}</p>
                        </div>
                    )}

                    {/* QR Code */}
                    {status === 'waiting' && (
                        <>
                            <p className="text-sm text-[#666] mb-5">
                                {t.scanQR || 'Scan this QR code with your phone to send photos'}
                            </p>
                            <div className="inline-block p-4 bg-white rounded-2xl border-2 border-black/5 shadow-sm mb-5">
                                <QRCodeSVG
                                    value={qrUrl}
                                    size={200}
                                    level="M"
                                    includeMargin={false}
                                />
                            </div>
                            <div className="flex items-center justify-center gap-2 text-xs text-[#999] mb-3">
                                <Wifi className="w-3.5 h-3.5" />
                                {t.sameWifi || 'Both devices must be on the same WiFi network'}
                            </div>
                            {/* Show the URL for manual entry */}
                            <div className="mt-2 p-3 bg-[#F5F5F5] rounded-xl">
                                <p className="text-xs text-[#999] mb-1">{t.orTypeUrl || 'Or type this URL on your phone:'}</p>
                                <p className="text-xs font-mono text-[#333] select-all break-all">{qrUrl}</p>
                            </div>
                        </>
                    )}

                    {/* Connected */}
                    {status === 'connected' && (
                        <div className="py-8">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                            <p className="font-semibold mb-1">{t.phoneConnected || 'Phone connected!'}</p>
                            <p className="text-sm text-[#666]">{t.waitingForPhotos || 'Waiting for photos…'}</p>
                        </div>
                    )}

                    {/* Receiving */}
                    {status === 'receiving' && (
                        <div className="py-6">
                            <Loader2 className="w-10 h-10 animate-spin mx-auto text-black/60 mb-3" />
                            <p className="font-semibold mb-2">{t.receivingPhotos || 'Receiving photos…'}</p>
                            <div className="w-full h-2.5 bg-black/5 rounded-full overflow-hidden mb-2">
                                <div
                                    className="h-full bg-black rounded-full transition-all duration-300"
                                    style={{ width: `${totalCount > 0 ? (receivedCount / totalCount) * 100 : 0}%` }}
                                />
                            </div>
                            <p className="text-sm text-[#666] tabular-nums">{receivedCount} / {totalCount}</p>
                        </div>
                    )}

                    {/* Done */}
                    {status === 'done' && (
                        <div className="py-6">
                            <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                            <p className="font-semibold mb-1">{t.photosReceived || 'Photos received!'}</p>
                            <p className="text-sm text-[#666] mb-4">
                                {receivedFilesRef.current.length} {t.photosAdded || 'photos added to SnapConvert'}
                            </p>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl bg-black text-white font-medium text-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                {t.doneContinue || 'Continue'}
                            </button>
                        </div>
                    )}

                    {/* Error */}
                    {status === 'error' && (
                        <div className="py-6">
                            <p className="font-semibold text-red-600 mb-2">{t.phoneError || 'Connection error'}</p>
                            <p className="text-sm text-[#666] mb-4">{t.phoneErrorDetail || 'Please close and try again.'}</p>
                            <button
                                onClick={onClose}
                                className="px-6 py-3 rounded-xl bg-black text-white font-medium text-sm"
                            >
                                {t.close || 'Close'}
                            </button>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
}
