import { useState, useRef, useEffect } from 'react';
import { Camera, User, Loader2, Check, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { databaseService } from '../../services/databaseService';

interface ContactAvatarUploaderProps {
  leadId: string;
  photoURL?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  editable?: boolean;
  className?: string;
  inputId?: string;
}

export default function ContactAvatarUploader({ 
  leadId, 
  photoURL, 
  name, 
  size = 'md', 
  editable = true,
  className = '',
  inputId
}: ContactAvatarUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeClasses = {
    xs: 'w-8 h-8 text-xs',
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
    xl: 'w-24 h-24 text-2xl'
  };

  const iconSizes = {
    xs: 14,
    sm: 18,
    md: 22,
    lg: 28,
    xl: 36
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation
    if (file.size > 5 * 1024 * 1024) {
      showToast('Arquivo muito grande (máx 5MB)', 'error');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Formato inválido (JPG, PNG ou WEBP)', 'error');
      return;
    }

    setUploading(true);
    try {
      const filePath = `lead_photos/${leadId}/${Date.now()}_${file.name}`;
      const url = await databaseService.uploadFile(file, filePath);
      await databaseService.updateLeadPhoto(leadId, url);
      showToast('Avatar atualizado!', 'success');
    } catch (error) {
      console.error('Error uploading photo:', error);
      showToast('Erro ao atualizar foto', 'error');
    } finally {
      setUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => setImageFailed(false), [photoURL]);

  const initials = (name || 'Contato WhatsApp')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || 'CW';

  return (
    <div className={`relative group ${className}`}>
      <div 
        className={`${sizeClasses[size]} rounded-full overflow-hidden bg-[#dfe5e7] flex items-center justify-center text-[#54656f] border-2 border-white/50 shadow-sm transition-all group-hover:shadow-md relative`}
      >
        {photoURL && !imageFailed ? (
          <img 
            src={photoURL}
            alt={name}
            className="w-full h-full object-cover transition-transform group-hover:scale-110"
            draggable={false}
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => {
              console.error('[Avatar Frontend] erro ao carregar:', photoURL);
              setImageFailed(true);
            }}
          />
        ) : (
          <span className="avatar-initial font-black select-none">{initials}</span>
        )}

        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10 backdrop-blur-[1px]">
            <Loader2 size={iconSizes[size] / 1.5} className="text-white animate-spin" />
          </div>
        )}

        {editable && !uploading && (
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white backdrop-blur-[2px] cursor-pointer"
            title="Alterar foto"
          >
            <Camera size={iconSizes[size] / 1.5} />
          </button>
        )}
      </div>

      <input 
        ref={fileInputRef}
        id={inputId}
        type="file"
        className="hidden"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
      />

      {/* Local Toast Portal-like behavior */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap ${
              toast.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'
            }`}
          >
            {toast.type === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
            <span className="text-[10px] font-black uppercase tracking-widest">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
