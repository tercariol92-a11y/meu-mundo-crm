import { useState, FormEvent } from 'react';
import { databaseService } from '../services/databaseService';
import { LogIn, UserPlus, Mail, Lock, AlertCircle } from 'lucide-react';
import { useCompanyConfig } from '../hooks/useCompanyConfig';
import Logo from './Logo';

interface AuthFormProps {
  onSuccess: (user: any) => void;
}

export default function AuthForm({ onSuccess }: AuthFormProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { companyConfig } = useCompanyConfig();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        const user = await databaseService.signInWithEmail(email, password);
        if (user) onSuccess(user);
      } else {
        const user = await databaseService.signUpWithEmail(email, password, nome);
        if (user) {
          setError("Conta criada com sucesso!");
          setIsLogin(true);
        }
      }
    } catch (err: any) {
      console.error("Auth error details:", {
        code: err.code,
        message: err.message,
        email: email,
        isLogin: isLogin
      });
      let message = "Ocorreu um erro na autenticação. Verifique os dados e tente novamente.";
      
      const errorCode = String(err.code || "");
      const errorMessage = String(err.message || "");
      
      if (
        errorCode === 'auth/invalid-credential' || 
        errorCode === 'auth/invalid-login-credentials' || 
        errorCode.includes('invalid-credential') ||
        errorMessage.includes('auth/invalid-credential') ||
        errorMessage.includes('invalid-credential') ||
        errorMessage.includes('auth/invalid-login-credentials')
      ) {
        message = "E-mail ou senha incorretos. Por favor, verifique suas credenciais.";
      } else if (errorCode === 'auth/user-not-found' || errorMessage.includes('user-not-found')) {
        message = "Usuário não encontrado em nossa base.";
      } else if (errorCode === 'auth/wrong-password' || errorMessage.includes('wrong-password')) {
        message = "Senha incorreta. Verifique se o Caps Lock está ativado.";
      } else if (errorCode === 'auth/email-already-in-use' || errorMessage.includes('email-already-in-use')) {
        message = "Este e-mail já está sendo utilizado por outra conta.";
      } else if (errorCode === 'auth/weak-password' || errorMessage.includes('weak-password')) {
        message = "A senha deve ter pelo menos 6 caracteres.";
      } else if (errorCode === 'auth/too-many-requests' || errorMessage.includes('too-many-requests')) {
        message = "Muitas tentativas sem sucesso. Sua conta foi temporariamente bloqueada por segurança. Tente novamente em alguns minutos.";
      } else if (errorCode === 'auth/popup-closed-by-user' || errorMessage.includes('popup-closed-by-user')) {
        message = "O login com Google foi cancelado.";
      } else if (errorCode === 'auth/operation-not-allowed' || errorMessage.includes('operation-not-allowed')) {
        message = "O acesso por e-mail e senha não está habilitado no servidor. Contate o administrador.";
      } else if (err.message) {
        message = err.message;
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Por favor, informe seu e-mail para recuperar a senha.");
      return;
    }
    setLoading(true);
    try {
      await databaseService.resetUserPassword(email);
      setError("Link de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError("Erro ao enviar e-mail de recuperação. Verifique o e-mail informado.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const user = await databaseService.signInWithGoogle();
      if (user) onSuccess(user);
    } catch (err: any) {
      console.error("Google login error:", err);
      let message = "Erro ao entrar com Google.";
      
      if (err.code === 'auth/popup-closed-by-user') {
        message = "O login com Google foi cancelado.";
      } else if (err.code === 'auth/unauthorized-domain') {
        message = "Este domínio não está autorizado para login com Google.";
      } else if (err.code === 'auth/operation-not-allowed') {
        message = "O provedor de autenticação não está ativado no Console do Firebase. Por favor, ative 'E-mail/Senha' e 'Google' nas configurações de Authentication.";
      } else if (err.message) {
        message = err.message;
      }
      
      setError(message);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-8 p-8 bg-surface-container-lowest rounded-2xl shadow-xl border border-surface-container-high animate-in fade-in zoom-in duration-300">
      <div className="flex justify-center py-4">
        <Logo showText className="h-10 w-auto" />
      </div>

      <div className="flex p-1 bg-surface-container-high rounded-xl">
        <button
          onClick={() => setIsLogin(true)}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${isLogin ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
        >
          Entrar
        </button>
        <button
          onClick={() => setIsLogin(false)}
          className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${!isLogin ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-highest'}`}
        >
          Cadastrar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div className="space-y-1 animate-in slide-in-from-top-2">
            <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">Nome Completo</label>
            <div className="relative">
              <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
              <input
                type="text"
                required
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-container-highest rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
                placeholder="Seu nome completo"
              />
            </div>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-on-surface-variant ml-1">E-mail</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-container-highest rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              placeholder="seu@email.com"
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center ml-1">
            <label className="text-[10px] font-black uppercase text-on-surface-variant">Senha</label>
            {isLogin && (
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-[10px] font-black uppercase text-primary hover:underline"
              >
                Esqueci a senha
              </button>
            )}
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-surface border border-surface-container-highest rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-error-container text-on-error-container rounded-lg text-xs font-medium animate-in slide-in-from-top-2">
            <AlertCircle size={14} />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2 text-xs"
        >
          {loading ? (
            <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
              {isLogin ? 'Acessar Painel' : 'Criar minha Conta'}
            </>
          )}
        </button>
      </form>

      <p className="text-center text-[10px] text-on-surface-variant uppercase font-bold tracking-tight">
        Ao entrar, você concorda com nossos <br />
        <span className="text-primary cursor-pointer hover:underline">Termos de Uso</span> e <span className="text-primary cursor-pointer hover:underline">Privacidade</span>.
      </p>
    </div>
  );
}
