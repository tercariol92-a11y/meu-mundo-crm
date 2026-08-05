import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Check, RotateCw, RefreshCw } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (base64Data: string) => void;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onCapture
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    setLoading(true);
    setError(null);
    stopCamera();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      console.error('Error starting camera with facingMode:', facingMode, err);
      // Fallback to any camera if environment/rear fails
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: false 
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (fallbackErr: any) {
        setError('Não foi possível acessar a câmera. Verifique as permissões do navegador ou utilize a opção de galeria.');
      }
    } finally {
      setLoading(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
    setCapturedImage(null);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Match canvas dimensions to actual video dimensions
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        // Draw video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to Base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);
      }
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
      onClose();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-neutral-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <h3 className="text-base font-bold tracking-tight">Câmera em Tempo Real</h3>
        <button 
          onClick={() => { stopCamera(); onClose(); }} 
          className="p-2 hover:bg-neutral-800 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Camera Viewport */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-neutral-900">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/85 z-10">
            <RefreshCw size={36} className="animate-spin text-primary" />
            <p className="text-sm font-medium text-neutral-400">Iniciando câmera...</p>
          </div>
        )}

        {error ? (
          <div className="max-w-md text-center p-6 space-y-4">
            <p className="text-sm text-red-400 leading-relaxed">{error}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={startCamera}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                Tentar Novamente
              </button>
              <button
                onClick={() => { stopCamera(); onClose(); }}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/35 text-red-400 rounded-xl text-xs font-semibold uppercase tracking-wider transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Live Feed */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover max-h-[80vh] ${capturedImage ? 'hidden' : 'block'}`}
            />

            {/* Photo Preview */}
            {capturedImage && (
              <img
                src={capturedImage}
                alt="Captura"
                className="w-full h-full object-contain max-h-[80vh]"
              />
            )}
          </>
        )}

        {/* Hidden Canvas for processing the snap */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Control Bar */}
      <div className="px-6 py-6 border-t border-neutral-800 bg-neutral-950 flex flex-col items-center justify-center gap-4">
        {!error && !loading && (
          <>
            {!capturedImage ? (
              // Live controls
              <div className="flex items-center justify-between w-full max-w-sm">
                {/* Switch Camera */}
                <button
                  onClick={toggleCamera}
                  className="p-4 bg-neutral-900 hover:bg-neutral-800 rounded-full transition-colors"
                  title="Inverter Câmera"
                >
                  <RotateCw size={24} />
                </button>

                {/* Snap Button */}
                <button
                  onClick={capturePhoto}
                  className="w-20 h-20 bg-white hover:bg-neutral-100 active:scale-95 rounded-full flex items-center justify-center border-4 border-neutral-800 transition-all shadow-lg"
                  title="Tirar Foto"
                >
                  <div className="w-14 h-14 bg-red-600 hover:bg-red-500 rounded-full transition-all" />
                </button>

                {/* Empty placeholder to balance spacing */}
                <div className="w-14" />
              </div>
            ) : (
              // Preview confirmation controls
              <div className="flex items-center justify-center gap-6 w-full max-w-sm">
                <button
                  onClick={handleRetake}
                  className="flex-1 py-3 px-5 bg-neutral-900 hover:bg-neutral-800 active:scale-95 rounded-2xl border border-neutral-800 text-sm font-semibold transition-all flex items-center justify-center gap-2 text-neutral-300"
                >
                  <RotateCw size={18} /> Tirar Outra
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 px-5 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg"
                >
                  <Check size={18} /> Confirmar Foto
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
