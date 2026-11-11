import type { AnimationType } from '../../store/themeStore';

/**
 * Ambient weather/particle animation layer for the chat.
 *
 * Extracted from pages/Messages.tsx one component at a time, reading first
 * rather than line-slicing: this one needs only the AnimationType type, which
 * the earlier brace-matching sweep could not see and so would have left behind.
 *
 * The positions are generated with Math.random() rather than a seeded PRNG,
 * which is correct here — these are decorative, non-security values, and a
 * different arrangement on every render is the intended effect.
 */
const LiveAnimations = ({ type }: { type: AnimationType | undefined }) => {
  if (!type || type === 'none') return null;

  if (type === 'snow') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-60">
        {[...Array(30)].map((_, i) => (
          <div key={i} className="absolute bg-white dark:bg-[#1b1b24] rounded-full opacity-80 animate-snow" style={{
            left: `${Math.random() * 100}%`,
            width: `${Math.random() * 4 + 2}px`,
            height: `${Math.random() * 4 + 2}px`,
            animationDuration: `${Math.random() * 3 + 2}s`,
            animationDelay: `${Math.random() * 2}s`
          }} />
        ))}
        <style>{` .animate-snow { animation: snow linear infinite; }`}</style>
      </div>
    );
  }

  if (type === 'rain') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 opacity-40">
        {[...Array(40)].map((_, i) => (
          <div key={i} className="absolute bg-blue-200 opacity-60 animate-rain" style={{
            left: `${Math.random() * 100}%`,
            width: '1.5px',
            height: `${Math.random() * 15 + 10}px`,
            animationDuration: `${Math.random() * 0.5 + 0.3}s`,
            animationDelay: `${Math.random() * 1}s`
          }} />
        ))}
        <style>{` .animate-rain { animation: rain linear infinite; }`}</style>
      </div>
    );
  }

  if (type === 'particles' || type === 'stars' || type === 'fireflies') {
    const color = type === 'fireflies' ? 'bg-yellow-300' : 'bg-white';
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {[...Array(25)].map((_, i) => (
          <div key={i} className={`absolute ${color} rounded-full opacity-50 animate-float`} style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${Math.random() * 3 + 1}px`,
            height: `${Math.random() * 3 + 1}px`,
            animationDuration: `${Math.random() * 4 + 3}s`,
            animationDelay: `${Math.random() * 2}s`,
            boxShadow: `0 0 ${Math.random() * 4 + 2}px ${type === 'fireflies' ? '#FDE047' : '#FFFFFF'}`
          }} />
        ))}
        <style>{`@keyframes float { 0%, 100% { transform: translate(0, 0); opacity: 0.2; } 50% { transform: translate(20px, -30px); opacity: 0.8; } } .animate-float { animation: float linear infinite; }`}</style>
      </div>
    );
  }

  return null;
};

export default LiveAnimations;
