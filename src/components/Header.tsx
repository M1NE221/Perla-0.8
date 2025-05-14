'use client';

import { useAuth } from '@/components/AuthGate';

export default function Header() {
  const { signOut } = useAuth();
  return (
    <div className="w-full flex justify-end p-2 bg-black text-green-400 text-sm border-b border-green-900/40">
      <button
        onClick={signOut}
        className="px-3 py-1 border border-green-600 rounded hover:bg-green-600/20 transition-colors disabled:opacity-50"
      >
        Cerrar sesión
      </button>
    </div>
  );
} 