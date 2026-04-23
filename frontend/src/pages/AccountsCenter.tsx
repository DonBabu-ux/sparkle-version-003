import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  UserCircle, 
  Lock, 
  Smartphone, 
  Mail, 
  Key, 
  ChevronRight, 
  Plus, 
  Orbit,
  Zap,
  Shield
} from 'lucide-react';
import { useUserStore } from '../store/userStore';
import Navbar from '../components/Navbar';

export default function AccountsCenter() {
  const navigate = useNavigate();
  const { user, accounts, switchAccount } = useUserStore();

  const sections = [
    {
      title: 'Profiles',
      items: [
        { label: 'Manage Profiles', icon: UserCircle, sub: 'Switch, add or remove accounts', path: '/settings/profiles' }
      ]
    },
    {
      title: 'Account Settings',
      items: [
        { label: 'Password and security', icon: Lock, sub: 'Change password, 2FA, saved logins', path: '/settings/security' },
        { label: 'Personal details', icon: UserCircle, sub: 'Contact info, identity verification', path: '/settings/details' },
        { label: 'Ad preferences', icon: Smartphone, sub: 'Manage what you see', path: '/settings/ads' }
      ]
    },
    {
      title: 'Login & Security',
      items: [
        { label: 'Recent emails', icon: Mail, sub: 'View communications from Sparkle', path: '/settings/emails' },
        { label: 'Devices', icon: Smartphone, sub: 'Where you are logged in', path: '/settings/devices' },
        { label: 'Recovery codes', icon: Key, sub: 'Generate or reset recovery keys', path: '/settings/recovery' }
      ]
    }
  ];

  return (
    <div className="flex bg-[#fdf2f4] min-h-screen text-black overflow-x-hidden font-sans">
      <Navbar />

      {/* Background orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-[700px] h-[700px] bg-red-200/30 rounded-full blur-[140px] pointer-events-none z-0" />
      <div className="fixed bottom-0 left-[-5%] w-[500px] h-[500px] bg-pink-200/30 rounded-full blur-[120px] pointer-events-none z-0" />

      <main className="flex-1 lg:ml-72 p-6 lg:p-12 relative z-10 max-w-5xl mx-auto w-full pt-20 md:pt-32">
        <header className="flex flex-col xl:flex-row items-center justify-between gap-16 mb-24 animate-fade-in px-4">
          <div className="max-w-2xl space-y-8 text-center xl:text-left">
            <div className="inline-flex items-center gap-4 px-6 py-2.5 bg-white/80 backdrop-blur-3xl border border-white rounded-full shadow-xl shadow-primary/5 mx-auto xl:mx-0">
               <Shield size={18} strokeWidth={3} className="text-primary" />
               <span className="text-[10px] font-black text-black uppercase tracking-[0.4em] italic">Consolidated Node Matrix</span>
            </div>
            <h1 className="text-6xl md:text-9xl font-black text-black tracking-tighter leading-none italic uppercase">
               Account <span className="text-primary italic">Center.</span>
            </h1>
            <p className="text-xl font-bold text-black opacity-60 leading-relaxed italic border-l-8 border-primary/20 pl-8 mx-auto xl:mx-0 uppercase tracking-tighter">
               Manage profiles, security protocols, and connected harmonics across the village.
            </p>
          </div>
          
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center gap-6 h-20 px-12 bg-white/60 border border-white backdrop-blur-3xl text-black hover:bg-black hover:text-white transition-all rounded-[28px] font-black text-sm uppercase tracking-[0.4em] italic shadow-2xl active:scale-95 group"
          >
            <ArrowLeft size={24} strokeWidth={4} className="group-hover:-translate-x-2 transition-transform" /> 
            Back Vector
          </button>
        </header>

        <div className="space-y-24 animate-fade-in relative z-10 w-full mb-64 px-4 text-left">
          {/* Linked Profiles */}
          <section>
            <h2 className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.5em] mb-12 ml-10 italic">Linked Satellite Nodes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {accounts?.map(acc => (
                <div key={acc.user.user_id} className={`p-10 rounded-[56px] border-4 transition-all duration-700 flex items-center justify-between group ${acc.user.user_id === user?.user_id ? 'bg-black border-black text-white shadow-2xl' : 'bg-white border-white text-black hover:shadow-2xl'}`}>
                  <div className="flex items-center gap-8">
                    <div className="relative">
                      <img 
                        src={acc.user.avatar_url || '/uploads/avatars/default.png'} 
                        className={`w-20 h-20 rounded-[28px] object-cover border-4 transition-all duration-700 ${acc.user.user_id === user?.user_id ? 'border-primary' : 'border-black/5 group-hover:border-black'}`} 
                        alt="" 
                      />
                      {acc.user.user_id === user?.user_id && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white shadow-lg"></div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="font-black text-xl italic uppercase tracking-tighter leading-none group-hover:text-primary transition-colors">{acc.user.name}</span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${acc.user.user_id === user?.user_id ? 'text-primary' : 'text-black/30'}`}>@{acc.user.username}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {acc.user.user_id === user?.user_id ? (
                      <span className="px-6 py-2 bg-primary/10 text-primary border border-primary/20 rounded-full text-[9px] font-black uppercase tracking-widest italic group-hover:bg-primary group-hover:text-white transition-all shadow-xl">Active Node</span>
                    ) : (
                      <button 
                        onClick={() => { switchAccount(acc.user.user_id); navigate('/dashboard'); }}
                        className="h-14 px-8 border-2 border-black/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-all active:scale-95 italic"
                      >
                        Switch
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button 
                onClick={() => navigate('/login')} 
                className="p-10 rounded-[56px] border-4 border-dashed border-black/5 hover:border-primary/20 hover:bg-white transition-all flex items-center justify-center gap-8 group"
              >
                <div className="w-16 h-16 rounded-[24px] bg-black/5 flex items-center justify-center text-black/10 group-hover:bg-primary group-hover:text-white transition-all shadow-inner">
                  <Plus size={32} strokeWidth={4} />
                </div>
                <span className="text-xl font-black italic uppercase tracking-tighter text-black opacity-10 group-hover:opacity-100 transition-all">Add Satellite Node</span>
              </button>
            </div>
          </section>

          {/* System Fragments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 pt-16 border-t-8 border-black/[0.03]">
            {sections?.map(section => (
              <div key={section.title} className="space-y-12">
                <h2 className="text-[10px] font-black text-black opacity-20 uppercase tracking-[0.5em] italic ml-10">{section.title} Protocol</h2>
                <div className="flex flex-col gap-6">
                  {section.items.map(item => (
                    <button 
                      key={item.label}
                      onClick={() => navigate(item.path)}
                      className="w-full p-10 rounded-[48px] bg-white border-2 border-transparent hover:border-primary/10 text-left transition-all duration-700 group hover:-translate-y-2 shadow-2xl shadow-primary/5 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-10 text-primary opacity-[0.01] pointer-events-none group-hover:opacity-[0.05] transition-all group-hover:rotate-12 group-hover:scale-150">
                         <Orbit size={140} strokeWidth={1} />
                      </div>
                      <div className="flex items-center justify-between mb-8 relative z-10">
                        <div className="w-16 h-16 rounded-[24px] bg-black/5 flex items-center justify-center text-black/10 group-hover:bg-primary group-hover:text-white transition-all duration-700 shadow-inner">
                          <item.icon size={28} strokeWidth={4} />
                        </div>
                        <ChevronRight size={28} strokeWidth={4} className="text-black/5 group-hover:text-primary group-hover:translate-x-4 transition-all duration-700" />
                      </div>
                      <div className="text-3xl font-black text-black italic uppercase tracking-tighter leading-none mb-4 group-hover:text-primary transition-colors relative z-10">
                        {item.label}
                      </div>
                      <div className="text-[10px] font-black text-black opacity-20 leading-relaxed uppercase tracking-[0.2em] mb-2 group-hover:text-black transition-colors relative z-10 italic">
                        {item.sub}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          <footer className="pt-48 pb-24 text-center space-y-10 relative z-10">
            <div className="flex justify-center gap-12">
              {['Manifesto', 'Stealth', 'Codex'].map(link => (
                <button key={link} className="text-[10px] font-black uppercase tracking-[0.5em] text-black/10 hover:text-primary transition-colors italic leading-none">{link}</button>
              ))}
            </div>
            <div className="flex flex-col items-center gap-4">
               <Zap size={24} className="text-primary opacity-20 animate-pulse" />
               <p className="text-[10px] font-black uppercase tracking-[0.6em] text-black/5">© 2026 SPARKLE COLLECTIVE</p>
            </div>
          </footer>
        </div>
      </main>

      <style>{`
        .animate-fade-in { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
