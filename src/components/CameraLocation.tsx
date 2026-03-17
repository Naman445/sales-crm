import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Camera, MapPin, CheckCircle2, AlertTriangle,
  RefreshCw, Loader2, Navigation, Clock, X, FlipHorizontal,
} from 'lucide-react';
import { MeetingProof } from '../types';

interface Props {
  onProofCaptured: (proof: MeetingProof) => void;
  userName: string;
  onCancel?: () => void;
}

type Step = 'location' | 'camera' | 'preview';

export default function CameraLocation({ onProofCaptured, userName, onCancel }: Props) {
  const [step, setStep] = useState<Step>('location');

  // Location state
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [locationData, setLocationData] = useState<{ lat: number; lon: number; address: string } | null>(null);
  const [locError, setLocError] = useState('');

  // Camera state
  const [camStatus, setCamStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [camError, setCamError] = useState('');
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [photoBase64, setPhotoBase64] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const facingRef = useRef<'user' | 'environment'>('environment');
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, []);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Stop stream ──────────────────────────────────────────────────────────────
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // ── Location ─────────────────────────────────────────────────────────────────
  const requestLocation = useCallback(() => {
    setLocStatus('loading');
    setLocError('');

    if (!navigator.geolocation) {
      setLocError('Geolocation not supported by this browser.');
      setLocStatus('error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        let address = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { 'Accept-Language': 'en' } }
          );
          const data = await res.json();
          if (data?.display_name) address = data.display_name;
        } catch { /* fallback to coords */ }
        if (!mountedRef.current) return;
        setLocationData({ lat, lon, address });
        setLocStatus('success');
      },
      (err) => {
        let msg = 'Could not get location.';
        if (err.code === 1) msg = 'Location permission denied. Please allow location access in browser settings.';
        else if (err.code === 2) msg = 'Location unavailable. Check GPS / network.';
        else if (err.code === 3) msg = 'Location request timed out. Try again.';
        setLocError(msg);
        setLocStatus('error');
      },
      { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
    );
  }, []);

  // ── Camera — THE CORE FIX ────────────────────────────────────────────────────
  const startCamera = useCallback(async (facingMode: 'user' | 'environment') => {
    if (!mountedRef.current) return;

    // Stop any existing stream first
    stopStream();
    setCamStatus('loading');
    setCamError('');

    let mediaStream: MediaStream | null = null;

    // Try 1: with ideal facing
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (_e1) {
      // Try 2: exact facing
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false,
        });
      } catch (_e2) {
        // Try 3: any camera
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        } catch (e3: any) {
          if (!mountedRef.current) return;
          let msg = `Camera error: ${e3?.message ?? 'Unknown'}`;
          if (e3?.name === 'NotAllowedError' || e3?.name === 'PermissionDeniedError')
            msg = '🚫 Camera permission denied. Tap the camera icon in your browser address bar → Allow, then try again.';
          else if (e3?.name === 'NotFoundError' || e3?.name === 'DevicesNotFoundError')
            msg = '📷 No camera found on this device.';
          else if (e3?.name === 'NotReadableError' || e3?.name === 'TrackStartError')
            msg = '⚠️ Camera is being used by another app. Close other tabs / apps using the camera.';
          setCamError(msg);
          setCamStatus('error');
          return;
        }
      }
    }

    if (!mountedRef.current) {
      mediaStream?.getTracks().forEach(t => t.stop());
      return;
    }

    streamRef.current = mediaStream;

    // THE KEY: we must wait for the video element to be in DOM
    // We use requestAnimationFrame + a small delay to ensure paint
    const attachStream = () => {
      const video = videoRef.current;
      if (!video) {
        // retry once more
        setTimeout(attachStream, 200);
        return;
      }

      // Reset video element completely
      video.pause();
      video.removeAttribute('src');
      video.load();

      // Attach stream
      video.srcObject = mediaStream;

      // Use multiple event strategies for cross-browser support
      let played = false;

      const tryPlay = () => {
        if (played) return;
        played = true;
        video.play()
          .then(() => {
            if (!mountedRef.current) return;
            setCamStatus('ready');
          })
          .catch((playErr) => {
            console.warn('play() failed:', playErr);
            // On some browsers autoplay is blocked — still show the stream
            if (!mountedRef.current) return;
            setCamStatus('ready');
          });
      };

      video.onloadedmetadata = () => tryPlay();
      video.oncanplay = () => tryPlay();

      // Absolute fallback after 3 seconds
      setTimeout(() => {
        if (!mountedRef.current) return;
        tryPlay();
        setCamStatus('ready');
      }, 3000);

      // Also directly try play (some browsers don't fire events if already ready)
      setTimeout(() => {
        if (video.readyState >= 2) tryPlay();
      }, 500);
    };

    // Small delay to ensure DOM has rendered the video element
    setTimeout(attachStream, 100);

  }, []);

  // Auto-start camera when step becomes 'camera'
  useEffect(() => {
    if (step === 'camera') {
      facingRef.current = facing;
      startCamera(facing);
    }
    return () => {
      if (step === 'camera') {
        stopStream();
        setCamStatus('idle');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const switchCamera = async () => {
    const newFacing = facing === 'environment' ? 'user' : 'environment';
    setFacing(newFacing);
    facingRef.current = newFacing;
    await startCamera(newFacing);
  };

  // ── Take Photo ───────────────────────────────────────────────────────────────
  const takePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext('2d')!;

    if (facing === 'user') {
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, w, h);
    }

    // Stamp
    const lines = [
      `📍 ${locationData?.lat.toFixed(5) ?? '—'}, ${locationData?.lon.toFixed(5) ?? '—'}`,
      `👤 ${userName}`,
      `🕐 ${new Date().toLocaleString('en-IN')}`,
    ];
    const fs = Math.max(14, Math.round(w / 50));
    const lh = fs + 12;
    const boxH = lines.length * lh + 20;

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, h - boxH, w, boxH);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fs}px monospace`;
    ctx.textBaseline = 'top';
    lines.forEach((line, i) => ctx.fillText(line, 14, h - boxH + 10 + i * lh));

    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    stopStream();
    setCamStatus('idle');
    setPhotoBase64(base64);
    setStep('preview');
  };

  const retakePhoto = () => {
    setPhotoBase64('');
    setCamStatus('idle');
    setStep('camera');
  };

  const confirmAndProceed = () => {
    if (!locationData || !photoBase64) return;
    onProofCaptured({
      photoBase64,
      latitude: locationData.lat,
      longitude: locationData.lon,
      locationAddress: locationData.address,
      capturedAt: new Date().toISOString(),
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  const stepIdx = step === 'location' ? 0 : step === 'camera' ? 1 : 2;
  const stepLabels = ['📍 Location', '📷 Camera', '✅ Confirm'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 flex items-center justify-center p-4">
      {/* bg blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-indigo-500/15 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6 relative">
          {onCancel && (
            <button
              onClick={() => { stopStream(); onCancel(); }}
              className="absolute left-0 top-0 text-indigo-400 hover:text-white text-xs flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 transition-all"
            >
              <X size={14} /> Cancel
            </button>
          )}
          <h2 className="text-2xl font-bold text-white">Verify Your Visit</h2>
          <p className="text-indigo-400 text-sm mt-1">
            Hi <span className="text-yellow-300 font-semibold">{userName}</span> — capture location &amp; photo
          </p>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {stepLabels.map((label, i) => (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                i < stepIdx ? 'bg-emerald-500 text-white'
                  : i === stepIdx ? 'bg-yellow-400 text-black'
                  : 'bg-white/10 text-indigo-400'
              }`}>
                {i < stepIdx ? '✓ ' : ''}{label}
              </div>
              {i < stepLabels.length - 1 && (
                <div className={`w-6 h-0.5 rounded ${i < stepIdx ? 'bg-emerald-500' : 'bg-white/20'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden">

          {/* ── STEP 1: Location ── */}
          {step === 'location' && (
            <div className="p-8 text-center">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-2 transition-all ${
                locStatus === 'success' ? 'bg-emerald-500/20 border-emerald-400/40' : 'bg-blue-500/20 border-blue-400/40'
              }`}>
                {locStatus === 'success'
                  ? <CheckCircle2 size={40} className="text-emerald-400" />
                  : <Navigation size={40} className={`text-blue-400 ${locStatus === 'loading' ? 'animate-pulse' : ''}`} />
                }
              </div>

              <h3 className="text-xl font-bold text-white mb-2">Allow Location Access</h3>
              <p className="text-indigo-300 text-sm mb-6 leading-relaxed">
                Your GPS coordinates will be stamped on the meeting photo to verify where the meeting took place.
              </p>

              {locStatus === 'error' && (
                <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-3 mb-4 text-red-300 text-sm flex items-start gap-2 text-left">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{locError}</span>
                </div>
              )}

              {locStatus === 'success' && locationData && (
                <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-xl p-4 mb-4 text-left">
                  <div className="flex items-center gap-2 text-emerald-300 font-semibold mb-1">
                    <CheckCircle2 size={16} /> Location Captured
                  </div>
                  <p className="text-xs text-emerald-200 line-clamp-2">{locationData.address}</p>
                  <p className="text-xs text-emerald-400 mt-1 font-mono">
                    {locationData.lat.toFixed(6)}, {locationData.lon.toFixed(6)}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-indigo-400 text-sm mb-6">
                <Clock size={14} />
                <span>{currentTime.toLocaleString('en-IN')}</span>
              </div>

              {locStatus !== 'success' ? (
                <button
                  onClick={requestLocation}
                  disabled={locStatus === 'loading'}
                  className="w-full py-4 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-bold rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {locStatus === 'loading'
                    ? <><Loader2 size={20} className="animate-spin" /> Getting Location...</>
                    : <><MapPin size={20} /> Allow Location Access</>
                  }
                </button>
              ) : (
                <button
                  onClick={() => setStep('camera')}
                  className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-2xl shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <Camera size={20} /> Continue to Camera →
                </button>
              )}

              {locStatus === 'error' && (
                <button
                  onClick={requestLocation}
                  className="w-full mt-3 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} /> Try Again
                </button>
              )}
            </div>
          )}

          {/* ── STEP 2: Camera ── */}
          {step === 'camera' && (
            <div className="p-4">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Take a Meeting Photo</h3>
                <p className="text-indigo-400 text-xs mt-1">Photo will be stamped with GPS + time for proof</p>
              </div>

              {/* Loading */}
              {camStatus === 'loading' && (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={40} className="text-purple-400 animate-spin" />
                  <span className="text-indigo-300 text-sm font-medium">Starting camera...</span>
                  <span className="text-indigo-500 text-xs text-center px-4">
                    Please allow camera access when your browser asks
                  </span>
                </div>
              )}

              {/* Error */}
              {camStatus === 'error' && (
                <div className="py-4">
                  <div className="bg-red-500/20 border border-red-400/40 rounded-xl p-4 mb-4 text-red-300 text-sm text-center">
                    <AlertTriangle size={28} className="mx-auto mb-2 text-red-400" />
                    <p className="font-semibold mb-1">Camera Error</p>
                    <p className="text-xs whitespace-pre-line">{camError}</p>
                  </div>
                  <button
                    onClick={() => startCamera(facing)}
                    className="w-full py-3 bg-purple-500/30 hover:bg-purple-500/50 text-white rounded-xl flex items-center justify-center gap-2 transition-all border border-purple-400/30"
                  >
                    <RefreshCw size={16} /> Try Again
                  </button>
                </div>
              )}

              {/* Video — always rendered in DOM when step=camera */}
              <div style={{ display: camStatus === 'ready' ? 'block' : 'none' }}>
                <div
                  className="relative rounded-2xl overflow-hidden bg-black border border-white/20 mb-4"
                  style={{ minHeight: '240px' }}
                >
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      display: 'block',
                      width: '100%',
                      maxHeight: '360px',
                      objectFit: 'cover',
                      transform: facing === 'user' ? 'scaleX(-1)' : 'none',
                      backgroundColor: '#000',
                    }}
                  />
                  {/* Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 pointer-events-none">
                    <div className="text-xs text-white/90 font-mono space-y-0.5">
                      <div>📍 {locationData?.lat.toFixed(5)}, {locationData?.lon.toFixed(5)}</div>
                      <div>👤 {userName} · {currentTime.toLocaleTimeString('en-IN')}</div>
                    </div>
                  </div>
                  {/* REC dot */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-white text-xs font-bold drop-shadow">LIVE</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={switchCamera}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10"
                  >
                    <FlipHorizontal size={16} /> Flip
                  </button>
                  <button
                    onClick={takePhoto}
                    className="flex-[2] py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 transition-all"
                  >
                    <Camera size={20} /> Take Photo
                  </button>
                </div>
              </div>

              {/* Hidden canvas for capture */}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}

          {/* ── STEP 3: Preview ── */}
          {step === 'preview' && (
            <div className="p-6">
              <div className="text-center mb-4">
                <h3 className="text-lg font-bold text-white">Confirm Your Photo</h3>
                <p className="text-indigo-400 text-xs mt-1">Make sure the photo is clear. Retake if needed.</p>
              </div>

              {photoBase64 && (
                <div className="rounded-2xl overflow-hidden border border-white/20 mb-4 shadow-xl">
                  <img src={photoBase64} alt="Meeting proof" className="w-full object-cover" />
                </div>
              )}

              {locationData && (
                <div className="bg-emerald-500/15 border border-emerald-400/30 rounded-xl p-3 mb-4">
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-emerald-300 text-xs font-semibold">✅ Location Verified</p>
                      <p className="text-emerald-200/70 text-xs mt-0.5 line-clamp-2">{locationData.address}</p>
                      <p className="text-emerald-400 text-xs mt-1 font-mono">
                        {locationData.lat.toFixed(6)}, {locationData.lon.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={retakePhoto}
                  className="flex-1 py-3.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all border border-white/10"
                >
                  <RefreshCw size={16} /> Retake
                </button>
                <button
                  onClick={confirmAndProceed}
                  className="flex-[2] py-3.5 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 transition-all"
                >
                  <CheckCircle2 size={20} /> Confirm &amp; Continue
                </button>
              </div>
            </div>
          )}

        </div>

        <p className="text-center text-indigo-600 text-xs mt-4">
          🔒 Photo &amp; location stored securely in Supabase
        </p>
      </div>
    </div>
  );
}
