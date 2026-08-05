import { Plus, Users, FileText, Calendar, Headset, X } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingActionMenuProps {
  onAction: (actionId: string) => void;
}

export default function FloatingActionMenu({ onAction }: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    { id: 'new-lead', label: 'Novo Lead', icon: Users, color: 'bg-primary' },
    { id: 'new-client', label: 'Novo Cliente', icon: Users, color: 'bg-secondary' },
    { id: 'new-quote', label: 'Novo Orçamento', icon: FileText, color: 'bg-tertiary' },
    { id: 'new-visit', label: 'Nova Visita', icon: Calendar, color: 'bg-warning' },
    { id: 'new-ticket', label: 'Novo Chamado', icon: Headset, color: 'bg-error' },
  ];

  return (
    <div className="fixed bottom-20 lg:bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <div className="flex flex-col gap-3 mb-4 items-end">
            {actions.map((action, index) => (
              <motion.button
                key={action.id}
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.8 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  onAction(action.id);
                  setIsOpen(false);
                }}
                className="flex items-center gap-3 group"
              >
                <span className="bg-surface-container-lowest border border-surface-container-high px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-on-surface shadow-xl opacity-0 group-hover:opacity-100 transition-opacity">
                  {action.label}
                </span>
                <div className={`w-12 h-12 ${action.color} text-white rounded-2xl flex items-center justify-center shadow-xl hover:scale-110 transition-transform`}>
                  <action.icon size={20} />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl transition-all duration-300 ${
          isOpen ? 'bg-surface-container-high text-on-surface rotate-45' : 'bg-primary text-white hover:scale-105'
        }`}
      >
        {isOpen ? <X size={32} /> : <Plus size={32} />}
      </button>
    </div>
  );
}
