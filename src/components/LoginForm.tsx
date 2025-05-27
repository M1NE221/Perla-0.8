import { useState } from 'react';
import { signInWithEmail, signUpWithEmail } from '@/services/firebaseService';

interface LoginFormProps {
  onSuccess?: () => void;
}

export default function LoginForm({ onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(err.message || 'Error de autenticación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4 text-white"
      style={{ background: 'rgb(0,0,0)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-black/40 border border-white/10 p-6 rounded-lg"
      >
        <h2 className="text-2xl font-semibold text-center mb-2">
          {isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
        </h2>
        {error && (
          <div className="text-red-400 text-sm text-center">{error}</div>
        )}
        <label className="block">
          <span className="text-sm text-gray-300">Email</span>
          <input
            type="email"
            className="mt-1 w-full p-2 bg-transparent border border-white/20 rounded-md focus:outline-none focus:border-accent"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-300">Contraseña</span>
          <input
            type="password"
            className="mt-1 w-full p-2 bg-transparent border border-white/20 rounded-md focus:outline-none focus:border-accent"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          className="w-full py-2 bg-accent/20 hover:bg-accent/30 text-accent rounded-md transition-colors disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Procesando...' : isSignUp ? 'Registrarse' : 'Entrar'}
        </button>
        <div className="text-center text-sm text-gray-400">
          {isSignUp ? (
            <>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-accent hover:underline"
              >
                Inicia sesión
              </button>
            </>
          ) : (
            <>
              ¿No tienes una cuenta?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-accent hover:underline"
              >
                Regístrate
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
