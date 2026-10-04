import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface OnboardingSheetProps {
  onGetStarted?: () => void;
  showDismiss?: boolean;
  onDismiss?: () => void;
}

export default function OnboardingSheet({
  onGetStarted,
  showDismiss = false,
  onDismiss,
}: OnboardingSheetProps) {
  const navigate = useNavigate();

  // 1. Sparks Counter
  const [sparks, setSparks] = useState<number>(284);

  // 2. Afterglow countdown timer
  const totalSeconds = 522; // 08:42
  const [timeLeft, setTimeLeft] = useState<number>(totalSeconds);

  // 3. Connect filter chips
  const [activeChip, setActiveChip] = useState<string>('all');

  // 4. Anonymous toggle switch
  const [isAnon, setIsAnon] = useState<boolean>(true);

  // 5. Simulated Live Chat Script
  const [messages, setMessages] = useState<Array<{ text: string; type: 'in' | 'out'; isTyping?: boolean }>>([]);
  const scriptIndexRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 6. 3D Phone Tilt
  const stageRef = useRef<HTMLDivElement | null>(null);
  const phoneRef = useRef<HTMLDivElement | null>(null);

  // Handle phone 3D tilt
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!stageRef.current || !phoneRef.current) return;

    const rect = stageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    phoneRef.current.style.transform = `rotateY(${x * 22}deg) rotateX(${-y * 16}deg)`;
  };

  const handlePointerLeave = () => {
    if (phoneRef.current) {
      phoneRef.current.style.transform = '';
    }
  };

  // Timer tick
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev <= 0 ? totalSeconds : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  const strokeDashoffset = 364.4 * (1 - timeLeft / totalSeconds);

  // Simulated Chat Script Loop
  const chatScript = useRef<Array<{ type: 'in' | 'out'; text: string }>>([
    { type: 'in', text: 'hey 👋' },
    { type: 'in', text: 'You coming to the event tonight?' },
    { type: 'out', text: 'definitely ✦' },
    { type: 'in', text: 'Save me a seat?' },
    { type: 'out', text: 'Already did. Front row.' },
  ]);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const stepChat = () => {
      const idx = scriptIndexRef.current;
      if (idx >= chatScript.current.length) {
        timeoutRef.current = setTimeout(() => {
          setMessages([]);
          scriptIndexRef.current = 0;
          stepChat();
        }, 3200);
        return;
      }

      const nextMsg = chatScript.current[idx];
      // First show typing indicator
      setMessages((prev) => {
        const filtered = prev.filter((m) => !m.isTyping);
        return [...filtered, { text: '•••', type: nextMsg.type, isTyping: true }];
      });

      timeoutRef.current = setTimeout(() => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => !m.isTyping);
          const updated = [...filtered, { text: nextMsg.text, type: nextMsg.type }];
          return updated.slice(-6);
        });
        scriptIndexRef.current++;
        stepChat();
      }, reduceMotion ? 0 : 1300);
    };

    stepChat();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Handle Get Started action
  const handleStart = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      navigate('/dashboard');
    }
  };

  // People data for connect section
  const people = [
    { name: 'Brian', sub: 'CS · Year 2 · 0.8 km', tags: ['CS', 'on'], grad: 'radial-gradient(circle at 35% 30%,#ffa0c8,#8134af)' },
    { name: 'Amina', sub: 'IT · Year 1 · 1.2 km', tags: ['IT', 'y1', 'on'], grad: 'radial-gradient(circle at 35% 30%,#a99cff,#3a2c9c)' },
    { name: 'Kevin', sub: 'Law · Year 3 · 1.8 km', tags: ['LAW'], grad: 'radial-gradient(circle at 35% 30%,#ffd0a0,#d4106a)' },
    { name: 'Wanjiru', sub: 'CS · Year 1 · 2.1 km', tags: ['CS', 'y1'], grad: 'radial-gradient(circle at 35% 30%,#9ff0d0,#6d5dfc)' },
  ];

  return (
    <div className="sparkle-onboarding-sheet-root text-[#f6eefc] min-h-screen bg-[#0b0712] relative overflow-x-hidden selection:bg-[#ff2d87] selection:text-white">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=DM+Sans:wght@400;500;700&display=swap');

        .sparkle-onboarding-sheet-root {
          --bg: #0b0712;
          --ink: #f6eefc;
          --mut: #b9a8cc;
          --pink: #ff2d87;
          --pur: #8134af;
          --ind: #6d5dfc;
          --edge: rgba(255,255,255,.16);
          --ok: #46e6a0;
          font-family: "DM Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          line-height: 1.6;
        }

        .sparkle-heading {
          font-family: "Bricolage Grotesque", "DM Sans", sans-serif;
          letter-spacing: -0.02em;
          line-height: 1.02;
        }

        .orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          opacity: .55;
          z-index: 0;
          pointer-events: none;
          animation: driftOrb 22s ease-in-out infinite alternate;
        }
        .o1 { width: 520px; height: 520px; background: #ff2d87; top: -140px; left: -120px; }
        .o2 { width: 560px; height: 560px; background: #8134af; right: -180px; top: 30vh; animation-delay: -8s; }
        .o3 { width: 420px; height: 420px; background: #6d5dfc; left: 25vw; bottom: -200px; animation-delay: -14s; }

        @keyframes driftOrb {
          to { transform: translate(70px, 50px) scale(1.15); }
        }

        .glass-sheet {
          background: linear-gradient(160deg, rgba(255,255,255,.13), rgba(255,255,255,.03));
          backdrop-filter: blur(22px) saturate(160%);
          -webkit-backdrop-filter: blur(22px) saturate(160%);
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 28px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.38), inset 0 -14px 28px rgba(0,0,0,.28), 0 28px 60px -22px rgba(0,0,0,.75);
        }

        .sparkle-btn {
          font-family: "DM Sans", sans-serif;
          font-weight: 700;
          font-size: 15px;
          color: #fff;
          border: 0;
          border-radius: 999px;
          padding: 13px 24px;
          cursor: pointer;
          background: linear-gradient(180deg, #ff6aa9, #ff2d87 45%, #d4106a);
          box-shadow: inset 0 1px 0 rgba(255,255,255,.65), inset 0 -3px 6px rgba(120,0,50,.5), 0 10px 24px -6px rgba(255,45,135,.7), 0 2px 0 #9b0a4d;
          transition: transform .12s, box-shadow .12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none;
        }
        .sparkle-btn:active {
          transform: translateY(2px);
          box-shadow: inset 0 3px 8px rgba(80,0,35,.7), 0 4px 10px -4px rgba(255,45,135,.6), 0 0 0 #9b0a4d;
        }

        .sparkle-btn-ghost {
          font-family: "DM Sans", sans-serif;
          font-weight: 700;
          font-size: 15px;
          color: #fff;
          border-radius: 999px;
          padding: 13px 24px;
          cursor: pointer;
          background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.05));
          box-shadow: inset 0 1px 0 rgba(255,255,255,.4), 0 8px 20px -8px #000;
          border: 1px solid rgba(255,255,255,.16);
          transition: transform .12s, box-shadow .12s;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }
        .sparkle-btn-ghost:active {
          transform: translateY(2px);
        }

        .phone-mockup {
          width: 290px;
          aspect-ratio: 9/19;
          border-radius: 46px;
          padding: 11px;
          position: relative;
          transform-style: preserve-3d;
          transition: transform .15s ease-out;
          background: linear-gradient(145deg, #4a3d5c, #15101d 40%, #3a2f49);
          box-shadow: inset 0 0 0 2px #6a5b7e, inset 0 0 12px #000, 0 50px 80px -30px #000, 0 0 90px -20px rgba(255,45,135,.5);
          animation: riseMockup 1.1s cubic-bezier(.2,.8,.2,1) both;
        }
        .phone-mockup::before, .phone-mockup::after {
          content: "";
          position: absolute;
          width: 4px;
          border-radius: 3px;
          background: linear-gradient(90deg, #2a2236, #6a5b7e);
          left: -4px;
        }
        .phone-mockup::before { top: 110px; height: 44px; }
        .phone-mockup::after { top: 170px; height: 70px; }

        .phone-screen {
          height: 100%;
          border-radius: 36px;
          overflow: hidden;
          position: relative;
          padding: 38px 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: radial-gradient(120% 70% at 20% 0%, #4b1858, #1a0b27 60%, #0f0818);
        }
        .phone-screen::before {
          content: "";
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 82px;
          height: 22px;
          border-radius: 99px;
          background: #05030a;
          box-shadow: inset 0 -1px 2px #333;
        }
        .phone-screen::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg, rgba(255,255,255,.16), transparent 35%);
          pointer-events: none;
          border-radius: inherit;
        }

        .avatar-ring {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          padding: 2.5px;
          background: conic-gradient(#ff2d87, #6d5dfc, #ff2d87);
          animation: spinRing 6s linear infinite;
        }
        .avatar-ring i {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: #1a0b27;
          border: 2px solid #1a0b27;
          background-image: radial-gradient(circle at 35% 30%, #ff9dc6, #8134af);
        }

        @keyframes spinRing {
          to { filter: hue-rotate(40deg); transform: rotate(360deg); }
        }

        .float-badge {
          position: absolute;
          padding: 12px 16px;
          border-radius: 20px;
          font-size: 13px;
          animation: riseMockup 1.3s .5s cubic-bezier(.2,.8,.2,1) both, bobBadge 6s 1.8s ease-in-out infinite;
          z-index: 2;
        }
        .float-f1 { left: -4%; top: 22%; }
        .float-f2 { right: -2%; bottom: 20%; animation-delay: .8s, 2s; }

        @keyframes riseMockup {
          from { opacity: 0; transform: translateY(60px) scale(.94); }
        }
        @keyframes bobBadge {
          50% { transform: translateY(-12px); }
        }

        .flow-path {
          fill: none;
          stroke: #ff2d87;
          stroke-width: 2;
          stroke-dasharray: 6 8;
          animation: dashFlow 1.4s linear infinite;
        }
        @keyframes dashFlow {
          to { stroke-dashoffset: -28; }
        }

        .live-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #46e6a0;
          box-shadow: 0 0 12px #46e6a0;
          animation: pulseLive 2s infinite;
        }
        @keyframes pulseLive {
          50% { opacity: .4; }
        }

        .chat-bubble {
          max-width: 80%;
          padding: 10px 16px;
          border-radius: 20px;
          font-size: 15px;
          animation: popBubble .35s cubic-bezier(.3,1.4,.5,1) both;
        }
        @keyframes popBubble {
          from { opacity: 0; transform: translateY(14px) scale(.9); }
        }
      `}</style>

      {/* Glowing Ambient Background Orbs */}
      <div className="orb o1" />
      <div className="orb o2" />
      <div className="orb o3" />

      {/* Top Floating Glass Navigation */}
      <nav
        className="glass-sheet sticky top-4 z-40 mx-auto max-w-[680px] w-[calc(100%-28px)] flex items-center justify-between px-4 py-2.5 my-3 shadow-2xl"
        aria-label="Onboarding sheet navigation"
      >
        <div className="flex items-center gap-2">
          <b className="sparkle-heading text-lg font-black tracking-tight text-white flex items-center gap-1.5">
            <span className="text-[#ff2d87]">✦</span> Sparkle
          </b>
          <span className="text-[11px] font-bold uppercase tracking-wider bg-white/10 text-[#b9a8cc] px-2 py-0.5 rounded-full ml-1 border border-white/10 hidden sm:inline-block">
            Onboarding Sheet
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <a
            href="#universe"
            className="text-[#b9a8cc] hover:text-white text-sm font-medium transition-colors hidden md:inline-block"
          >
            Universe
          </a>
          <a
            href="#connect"
            className="text-[#b9a8cc] hover:text-white text-sm font-medium transition-colors hidden md:inline-block"
          >
            Connect
          </a>
          <a
            href="#safety"
            className="text-[#b9a8cc] hover:text-white text-sm font-medium transition-colors hidden md:inline-block"
          >
            Safety
          </a>
          <a
            href="#roadmap"
            className="text-[#b9a8cc] hover:text-white text-sm font-medium transition-colors hidden md:inline-block"
          >
            Roadmap
          </a>

          <button
            onClick={handleStart}
            className="sparkle-btn text-xs sm:text-sm !py-2 !px-4 sm:!py-2.5 sm:!px-5"
          >
            Get started ✦
          </button>

          {showDismiss && onDismiss && (
            <button
              onClick={onDismiss}
              className="text-[#b9a8cc] hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors ml-1"
              title="Close sheet"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-[1140px] mx-auto px-5 sm:px-6 relative z-10 pb-24">
        {/* HERO SECTION */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.1fr_.9fr] gap-8 lg:gap-12 items-center pt-8 md:pt-14 pb-12">
          <div className="flex flex-col gap-6">
            <h1 className="sparkle-heading text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.04]">
              Presence over performance.
              <span className="block text-[#ff2d87]">
                Connection over clout.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#b9a8cc] max-w-[58ch] leading-relaxed">
              Sparkle is a social app built around your campus: the people near you, what's happening today, and what you want to share, without a follower count in sight.
            </p>

            <div className="flex flex-wrap gap-2.5">
              <span className="text-xs font-bold py-1.5 px-3.5 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur shadow-sm flex items-center gap-1.5">
                <i className="not-italic text-[#ff2d87]">✦</i> Campus first
              </span>
              <span className="text-xs font-bold py-1.5 px-3.5 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur shadow-sm flex items-center gap-1.5">
                <i className="not-italic text-[#ff2d87]">◉</i> Privacy first
              </span>
              <span className="text-xs font-bold py-1.5 px-3.5 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur shadow-sm flex items-center gap-1.5">
                <i className="not-italic text-[#ff2d87]">⚡</i> Real time
              </span>
              <span className="text-xs font-bold py-1.5 px-3.5 rounded-full border border-white/15 bg-white/10 text-white backdrop-blur shadow-sm flex items-center gap-1.5">
                <i className="not-italic text-[#ff2d87]">◈</i> Community
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              <button onClick={handleStart} className="sparkle-btn">
                <span>Start Campus Setup</span>
                <span className="text-lg">→</span>
              </button>
              <a href="#universe" className="sparkle-btn-ghost">
                Explore the universe
              </a>
            </div>
          </div>

          {/* Interactive 3D Phone Stage */}
          <div
            ref={stageRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            className="perspective-[1200px] grid place-items-center min-h-[580px] sm:min-h-[620px] relative mt-6 lg:mt-0"
          >
            {/* Floating Glass Pill 1 */}
            <div className="float-badge float-f1 glass-sheet">
              <b className="sparkle-heading block text-sm font-extrabold text-white">
                Amina posted a Moment
              </b>
              <span className="text-xs text-[#b9a8cc]">Karatina University</span>
            </div>

            {/* 3D Phone Shell */}
            <div ref={phoneRef} className="phone-mockup">
              <div className="phone-screen">
                <div className="flex items-center justify-between text-white">
                  <span className="sparkle-heading font-extrabold text-lg text-white">
                    Good evening, Don
                  </span>
                  <span className="text-sm">🔔</span>
                </div>

                {/* Animated Dynamic Rings */}
                <div className="flex gap-2.5 my-1">
                  <div className="avatar-ring">
                    <i />
                  </div>
                  <div className="avatar-ring">
                    <i />
                  </div>
                  <div className="avatar-ring">
                    <i />
                  </div>
                  <div className="avatar-ring">
                    <i />
                  </div>
                </div>

                {/* Campus Pulse Mini Card */}
                <div className="glass-sheet p-3.5 rounded-[20px] text-xs">
                  <b className="sparkle-heading block text-sm font-extrabold text-white">
                    Campus pulse
                  </b>
                  <span className="text-[#b9a8cc]">284 sparks · 31 online</span>
                </div>

                {/* Video Stage */}
                <div className="flex-1 rounded-[20px] bg-[radial-gradient(circle_at_30%_20%,#ff5fa5,transparent_50%),radial-gradient(circle_at_80%_80%,#6d5dfc,transparent_55%),#2a1040] grid place-items-center text-3xl shadow-inner text-white/80">
                  🎬
                </div>

                {/* Bottom App Tabs */}
                <div className="flex justify-around pt-2.5 pb-1 text-[11px] text-[#b9a8cc] border-t border-white/10 font-medium">
                  <span className="text-white font-bold">Home</span>
                  <span>Connect</span>
                  <span>Spark</span>
                  <span>Chats</span>
                  <span>Me</span>
                </div>
              </div>
            </div>

            {/* Floating Glass Pill 2 */}
            <div className="float-badge float-f2 glass-sheet">
              <b className="sparkle-heading block text-sm font-extrabold text-white">
                Afterglow ends in 08:42
              </b>
              <span className="text-xs text-[#b9a8cc]">Share, glow, disappear</span>
            </div>
          </div>
        </section>

        {/* SECTION 1: UNIVERSE */}
        <section id="universe" className="pt-20 pb-8">
          <div className="mb-9 flex flex-col gap-3">
            <h2 className="sparkle-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              Three places to spend an evening
            </h2>
            <p className="text-base text-[#b9a8cc] max-w-[62ch]">
              Home shows your campus today. Afterglow is for stories that fade. Moments is short video without a scoreboard. Try the controls.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Home */}
            <article className="glass-sheet p-7 flex flex-col gap-4">
              <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-gradient-to-br from-[#ff6aa9] to-[#8134af] shadow-lg shadow-[#ff2d87]/30 text-white">
                🏠
              </div>
              <h3 className="sparkle-heading text-xl font-bold text-white">Home</h3>
              <p className="text-sm text-[#b9a8cc]">
                Your campus, your people, your pulse. Tap the button to send a spark.
              </p>
              <div className="flex items-center gap-3.5 mt-auto pt-4">
                <button
                  onClick={() => setSparks((prev) => prev + 1)}
                  className="sparkle-btn text-xs !py-2.5 !px-4"
                >
                  ✦ Send a spark
                </button>
                <output className="sparkle-heading text-2xl font-extrabold text-white tabular-nums">
                  {sparks}
                </output>
              </div>
            </article>

            {/* Card 2: Afterglow */}
            <article className="glass-sheet p-7 flex flex-col gap-4 text-center items-center">
              <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-gradient-to-br from-[#ff6aa9] to-[#8134af] shadow-lg shadow-[#ff2d87]/30 text-white">
                🌤
              </div>
              <h3 className="sparkle-heading text-xl font-bold text-white">Afterglow</h3>
              <p className="text-sm text-[#b9a8cc]">
                Stories without the pressure. Everything fades when the ring runs out.
              </p>
              <div className="relative w-[132px] height-[132px] mt-2 flex items-center justify-center">
                <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
                  <circle
                    cx="66"
                    cy="66"
                    r="58"
                    fill="none"
                    stroke="rgba(255,255,255,.1)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="66"
                    cy="66"
                    r="58"
                    fill="none"
                    stroke="url(#gradientStroke)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray="364.4"
                    strokeDashoffset={strokeDashoffset}
                  />
                  <defs>
                    <linearGradient id="gradientStroke">
                      <stop offset="0%" stopColor="#ff2d87" />
                      <stop offset="100%" stopColor="#6d5dfc" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="sparkle-heading absolute inset-0 grid place-items-center text-2xl font-black text-white tabular-nums">
                  {timeFormatted}
                </div>
              </div>
            </article>

            {/* Card 3: Moments */}
            <article className="glass-sheet p-7 flex flex-col gap-4">
              <div className="w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-gradient-to-br from-[#ff6aa9] to-[#8134af] shadow-lg shadow-[#ff2d87]/30 text-white">
                🎬
              </div>
              <h3 className="sparkle-heading text-xl font-bold text-white">Moments</h3>
              <p className="text-sm text-[#b9a8cc]">
                Short video from campus life. Swipe to the next one; nobody sees a like count.
              </p>
              <div className="flex-1 min-h-[130px] rounded-2xl bg-[#2a1040] border border-white/10 grid place-items-center text-3xl text-[#ff2d87] shadow-inner mt-2">
                ✦
              </div>
            </article>
          </div>
        </section>

        {/* SECTION 2: CONNECT */}
        <section id="connect" className="pt-20 pb-8">
          <div className="mb-9 flex flex-col gap-3">
            <h2 className="sparkle-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              Discover people, not followers
            </h2>
            <p className="text-base text-[#b9a8cc] max-w-[62ch]">
              Sparkle treats closeness as more meaningful than popularity. Filter the people near you.
            </p>
          </div>

          <div className="glass-sheet p-6 sm:p-8 flex flex-col gap-6">
            <div className="py-3.5 px-5 rounded-2xl bg-black/35 shadow-inner border border-white/10 text-sm text-[#b9a8cc] flex items-center gap-2">
              <span>🔍</span> Search your campus
            </div>

            {/* Filter Chips */}
            <div className="flex gap-2.5 flex-wrap">
              {[
                { key: 'all', label: 'Campus' },
                { key: 'CS', label: 'Course: CS' },
                { key: 'y1', label: 'Year 1' },
                { key: 'on', label: 'Active now' },
              ].map((chip) => {
                const isSelected = activeChip === chip.key;
                return (
                  <button
                    key={chip.key}
                    onClick={() => setActiveChip(chip.key)}
                    className={`font-medium text-sm px-4 py-2 rounded-full border transition-all ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#ff6aa9] to-[#d4106a] text-white border-transparent shadow-md shadow-[#ff2d87]/40'
                        : 'bg-white/10 hover:bg-white/15 text-[#f6eefc] border-white/15'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            {/* People Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 sm:gap-4">
              {people.map((person, idx) => {
                const isMatch = activeChip === 'all' || person.tags.includes(activeChip);
                return (
                  <div
                    key={idx}
                    className={`glass-sheet p-5 text-center rounded-[22px] transition-all duration-300 ${
                      isMatch ? 'opacity-100 scale-100' : 'opacity-25 scale-95 pointer-events-none'
                    }`}
                  >
                    <div
                      className="w-14 h-14 rounded-full mx-auto mb-2.5 shadow-md shadow-black/40"
                      style={{ background: person.grad }}
                    />
                    <b className="sparkle-heading block text-base font-bold text-white">
                      {person.name}
                    </b>
                    <small className="text-xs text-[#b9a8cc]">{person.sub}</small>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 3: ANONYMOUS & CHAT */}
        <section id="anon" className="pt-20 pb-8">
          <div className="mb-9 flex flex-col gap-3">
            <h2 className="sparkle-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              Say it without your name on it
            </h2>
            <p className="text-base text-[#b9a8cc] max-w-[62ch]">
              Anonymous does not mean unmoderated. Confessions stay inside your campus and every post can be reported and reviewed.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Confession Box */}
            <div className="glass-sheet p-7 sm:p-8 flex flex-col justify-between gap-6">
              <div className="flex items-center gap-4 font-bold text-sm">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isAnon}
                  onClick={() => setIsAnon(!isAnon)}
                  className={`w-[74px] h-[40px] rounded-full p-1 cursor-pointer relative transition-colors border-0 ${
                    isAnon ? 'bg-gradient-to-r from-[#8134af] to-[#ff2d87]' : 'bg-[#1b1228]'
                  }`}
                >
                  <span
                    className={`block w-8 h-8 rounded-full bg-gradient-to-b from-white to-[#cfc3dc] shadow-md transition-transform duration-300 ${
                      isAnon ? 'translate-x-[34px]' : 'translate-x-0'
                    }`}
                  />
                </button>
                <span className="text-white">
                  {isAnon ? 'Anonymous mode on' : 'Anonymous mode off'}
                </span>
              </div>

              <blockquote className="sparkle-heading text-xl sm:text-2xl font-medium leading-relaxed text-white/95 my-2">
                “I accidentally attended the wrong lecture for 40 minutes…”
              </blockquote>

              <div className="flex items-center justify-between border-t border-white/10 pt-4">
                <span
                  className={`text-sm text-[#b9a8cc] transition-all duration-300 ${
                    isAnon ? 'blur-sm select-none opacity-40' : 'blur-0 opacity-100'
                  }`}
                >
                  Posted by Brian
                </span>
                <b className="sparkle-heading font-extrabold text-white text-sm">✦ 842 sparks</b>
              </div>

              <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#46e6a0] bg-[#46e6a0]/10 px-3 py-1.5 rounded-full border border-[#46e6a0]/20 w-fit">
                🛡 Abuse detection · Blocking · Reporting · Moderation
              </div>
            </div>

            {/* Simulated Live Chat */}
            <div className="glass-sheet p-5 sm:p-6 h-[390px] flex flex-col">
              <header className="flex items-center gap-3 pb-3 border-b border-white/10">
                <div className="live-dot" />
                <div>
                  <b className="sparkle-heading block text-sm font-extrabold text-white leading-tight">
                    Amina
                  </b>
                  <small className="text-xs text-[#b9a8cc]">online</small>
                </div>
              </header>

              <div className="flex-1 overflow-hidden flex flex-col justify-end gap-2.5 py-4">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`chat-bubble ${
                      m.type === 'in'
                        ? 'bg-white/10 text-white rounded-bl-md self-start border border-white/10 shadow-sm'
                        : 'bg-gradient-to-r from-[#ff6aa9] to-[#d4106a] text-white rounded-br-md self-end shadow-md shadow-[#ff2d87]/30'
                    } ${m.isTyping ? 'tracking-widest text-[#b9a8cc]' : ''}`}
                  >
                    {m.text}
                  </div>
                ))}
              </div>

              <div className="py-2.5 px-4 rounded-full bg-black/35 text-xs text-[#b9a8cc] border border-white/10">
                ＋ Type a message…
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: SAFETY */}
        <section id="safety" className="pt-20 pb-8">
          <div className="mb-9 flex flex-col gap-3">
            <h2 className="sparkle-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              Built around trust
            </h2>
            <p className="text-base text-[#b9a8cc] max-w-[62ch]">
              Moderation, privacy and security run through the whole app instead of sitting in a settings page.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-sheet p-6">
              <h3 className="sparkle-heading text-lg font-bold text-white mb-2">🧹 Moderation</h3>
              <p className="text-sm text-[#b9a8cc]">
                Content review, anonymous confession review, and community moderation for groups.
              </p>
            </div>
            <div className="glass-sheet p-6">
              <h3 className="sparkle-heading text-lg font-bold text-white mb-2">🔒 Privacy</h3>
              <p className="text-sm text-[#b9a8cc]">
                Blocking, visibility controls, and campus-scoped identity.
              </p>
            </div>
            <div className="glass-sheet p-6">
              <h3 className="sparkle-heading text-lg font-bold text-white mb-2">🔐 Security</h3>
              <p className="text-sm text-[#b9a8cc]">
                JWT sessions, hashed passwords, one-time codes and two-factor sign-in.
              </p>
            </div>
            <div className="glass-sheet p-6">
              <h3 className="sparkle-heading text-lg font-bold text-white mb-2">🚫 Enforcement</h3>
              <p className="text-sm text-[#b9a8cc]">
                Ban, mute and reach control, plus verification and campus administration.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: REAL-TIME ARCHITECTURE */}
        <section id="stack" className="pt-20 pb-8">
          <div className="mb-9 flex flex-col gap-3">
            <h2 className="sparkle-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              One interface, several real-time systems
            </h2>
            <p className="text-base text-[#b9a8cc] max-w-[62ch]">
              React and Capacitor on the front; Node, MySQL, Redis and Cloudinary behind it.
            </p>
          </div>

          <div className="glass-sheet p-6 overflow-x-auto">
            <svg
              viewBox="0 0 760 400"
              className="min-w-[640px] w-full h-auto"
              role="img"
              aria-label="Sparkle architecture diagram"
            >
              {/* Nodes */}
              <g className="fill-white/10 stroke-white/25">
                <rect x="290" y="10" width="180" height="46" rx="14" />
                <text x="380" y="38" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  Sparkle client
                </text>
              </g>

              <g className="fill-white/10 stroke-white/25">
                <rect x="150" y="100" width="150" height="42" rx="14" />
                <text x="225" y="126" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  REST API
                </text>
              </g>

              <g className="fill-white/10 stroke-white/25">
                <rect x="460" y="100" width="150" height="42" rx="14" />
                <text x="535" y="126" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  Socket.IO
                </text>
              </g>

              <g className="fill-white/10 stroke-white/25">
                <rect x="290" y="186" width="180" height="46" rx="14" />
                <text x="380" y="215" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  Node + Express
                </text>
              </g>

              <g className="fill-white/10 stroke-white/25">
                <rect x="90" y="272" width="140" height="42" rx="14" />
                <text x="160" y="298" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  MySQL
                </text>
              </g>

              <g className="fill-white/10 stroke-white/25">
                <rect x="310" y="272" width="140" height="42" rx="14" />
                <text x="380" y="298" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  Redis
                </text>
              </g>

              <g className="fill-white/10 stroke-white/25">
                <rect x="530" y="272" width="140" height="42" rx="14" />
                <text x="600" y="298" fill="#f6eefc" fontWeight="700" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  Cloudinary
                </text>
              </g>

              {/* Core Node */}
              <g>
                <rect x="290" y="346" width="180" height="46" rx="14" fill="rgba(255,45,135,.25)" stroke="#ff2d87" strokeWidth="1.5" />
                <text x="380" y="375" fill="#fff" fontWeight="800" fontSize="14" textAnchor="middle" fontFamily="DM Sans">
                  ✦ Sparkle core
                </text>
              </g>

              {/* Animated Flow Connectors */}
              <path className="flow-path" d="M340 56 C340 80 240 80 225 100" />
              <path className="flow-path" d="M420 56 C420 80 520 80 535 100" />
              <path className="flow-path" d="M225 142 C225 170 340 160 345 186" />
              <path className="flow-path" d="M535 142 C535 170 420 160 415 186" />
              <path className="flow-path" d="M340 232 C300 250 200 250 160 272" />
              <path className="flow-path" d="M380 232 V272" />
              <path className="flow-path" d="M420 232 C460 250 560 250 600 272" />
              <path className="flow-path" d="M160 314 C180 335 320 330 340 346" />
              <path className="flow-path" d="M380 314 V346" />
              <path className="flow-path" d="M600 314 C580 335 440 330 420 346" />
            </svg>
          </div>
        </section>

        {/* SECTION 6: ROADMAP */}
        <section id="roadmap" className="pt-20 pb-8">
          <div className="mb-9 flex flex-col gap-3">
            <h2 className="sparkle-heading text-3xl sm:text-4xl md:text-5xl font-extrabold text-white">
              From one campus to many communities
            </h2>
            <p className="text-base text-[#b9a8cc] max-w-[62ch]">
              The long-term idea is bigger than a feed: shared infrastructure for real-world communities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-sheet p-7">
              <h3 className="sparkle-heading text-xl font-bold text-white mb-4">Live today</h3>
              <ul className="space-y-3">
                {[
                  'Authentication and profiles',
                  'Home feed and messaging',
                  'Moments and Afterglow',
                  'Connect, anonymous mode, confessions',
                  'Notifications and security',
                  'Mobile app',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#f6eefc]">
                    <span className="w-5 h-5 rounded-md flex-none bg-gradient-to-b from-[#5ff0b0] to-[#1fae75] shadow-sm shadow-[#46e6a0]/40 flex items-center justify-center text-[10px] text-black font-bold">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="glass-sheet p-7">
              <h3 className="sparkle-heading text-xl font-bold text-white mb-4">Growing</h3>
              <ul className="space-y-3">
                {[
                  'Advanced campus discovery',
                  'Communities and campus events',
                  'Sparkle Pay and marketplace',
                  'Creator ecosystem',
                  'Sparkle connectivity',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-[#f6eefc]">
                    <span className="w-5 h-5 rounded-md flex-none bg-gradient-to-b from-[#ff6aa9] to-[#8134af] shadow-sm shadow-[#ff2d87]/40 flex items-center justify-center text-[10px] text-white font-bold">
                      ✦
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="pt-24 text-center flex flex-col items-center gap-6">
          <h2 className="sparkle-heading text-3xl sm:text-4xl font-extrabold text-white">
            Who's around you?
          </h2>
          <p className="text-base text-[#b9a8cc] max-w-[50ch]">
            A social network that doesn't ask how popular you are. Presence, privacy, connection, community.
          </p>
          <div className="flex gap-4">
            <button onClick={handleStart} className="sparkle-btn">
              Get Started with Sparkle ✦
            </button>
            <a href="#universe" className="sparkle-btn-ghost">
              Back to the top ↑
            </a>
          </div>
          <small className="text-xs text-[#b9a8cc]/60 mt-4">
            © Sparkle · Campus-first social technology
          </small>
        </footer>
      </main>
    </div>
  );
}
