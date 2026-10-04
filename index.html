<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Sparkle — Presence over performance</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,800&family=DM+Sans:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root{--bg:#0b0712;--ink:#f6eefc;--mut:#b9a8cc;--pink:#ff2d87;--pur:#8134af;--ind:#6d5dfc;--edge:rgba(255,255,255,.16);--ok:#46e6a0;
box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);color-scheme:dark}
html{scroll-padding-top:env(safe-area-inset-top,0px);scroll-behavior:smooth}
*,*::before,*::after{box-sizing:inherit}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "DM Sans",system-ui,sans-serif;overflow-x:hidden}
h1,h2,h3{font-family:"Bricolage Grotesque","DM Sans",system-ui,sans-serif;margin:0;line-height:1.02;letter-spacing:-.02em}
h1{font-size:clamp(2.8rem,7vw,5.6rem);font-weight:800}
h2{font-size:clamp(2rem,4.4vw,3.2rem);font-weight:800}
h3{font-size:1.25rem;font-weight:800}
p{margin:0;color:var(--mut);max-width:60ch}
.orb{position:fixed;border-radius:50%;filter:blur(90px);opacity:.55;z-index:-1;animation:drift 22s ease-in-out infinite alternate}
.o1{width:520px;height:520px;background:var(--pink);top:-140px;left:-120px}
.o2{width:560px;height:560px;background:var(--pur);right:-180px;top:30vh;animation-delay:-8s}
.o3{width:420px;height:420px;background:var(--ind);left:25vw;bottom:-200px;animation-delay:-14s}
@keyframes drift{to{transform:translate(70px,50px) scale(1.15)}}
.wrap{max-width:1120px;margin:0 auto;padding:0 22px}
section{padding:90px 0 20px}
.head{margin-bottom:34px;display:grid;gap:14px}

/* glass + skeuomorphic surfaces */
.glass{background:linear-gradient(160deg,rgba(255,255,255,.13),rgba(255,255,255,.03));backdrop-filter:blur(22px) saturate(160%);-webkit-backdrop-filter:blur(22px) saturate(160%);border:1px solid var(--edge);border-radius:28px;
box-shadow:inset 0 1px 0 rgba(255,255,255,.38),inset 0 -14px 28px rgba(0,0,0,.28),0 28px 60px -22px rgba(0,0,0,.75)}
.btn{font:700 15px "DM Sans",sans-serif;color:#fff;border:0;border-radius:999px;padding:13px 24px;cursor:pointer;background:linear-gradient(180deg,#ff6aa9,var(--pink) 45%,#d4106a);
box-shadow:inset 0 1px 0 rgba(255,255,255,.65),inset 0 -3px 6px rgba(120,0,50,.5),0 10px 24px -6px rgba(255,45,135,.7),0 2px 0 #9b0a4d;transition:transform .12s,box-shadow .12s;text-decoration:none;display:inline-block}
.btn:active{transform:translateY(2px);box-shadow:inset 0 3px 8px rgba(80,0,35,.7),0 4px 10px -4px rgba(255,45,135,.6),0 0 0 #9b0a4d}
.btn.ghost{background:linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,.05));box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 8px 20px -8px #000;border:1px solid var(--edge)}
:focus-visible{outline:2px solid #fff;outline-offset:3px}

nav{position:sticky;top:calc(env(safe-area-inset-top,0px) + 12px);z-index:20;margin:12px auto 0;max-width:640px;width:calc(100% - 28px);display:flex;align-items:center;justify-content:space-between;padding:10px 12px 10px 20px;border-radius:999px}
nav b{font:800 18px "Bricolage Grotesque",sans-serif}
nav div{display:flex;gap:6px;align-items:center}
nav a:not(.btn){color:var(--mut);text-decoration:none;font-size:14px;padding:6px 10px}
nav a:not(.btn):hover{color:#fff}
@media(max-width:560px){nav a:not(.btn){display:none}}

/* hero */
.hero{display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:center;padding-top:60px}
.hero .copy{display:grid;gap:22px}
.hero h1 span{display:block;background:linear-gradient(90deg,var(--pink),#c06bff,var(--ind));-webkit-background-clip:text;background-clip:text;color:transparent}
.pills{display:flex;flex-wrap:wrap;gap:10px}
.pill{font-size:13px;font-weight:700;padding:7px 14px;border-radius:999px;border:1px solid var(--edge);background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.03));box-shadow:inset 0 1px 0 rgba(255,255,255,.35)}
.pill i{font-style:normal;color:var(--pink);margin-right:6px}
.stage{perspective:1200px;display:grid;place-items:center;min-height:620px;position:relative}
.phone{width:290px;aspect-ratio:9/19;border-radius:46px;padding:11px;position:relative;transform-style:preserve-3d;transition:transform .15s ease-out;
background:linear-gradient(145deg,#4a3d5c,#15101d 40%,#3a2f49);box-shadow:inset 0 0 0 2px #6a5b7e,inset 0 0 12px #000,0 50px 80px -30px #000,0 0 90px -20px rgba(255,45,135,.5);animation:rise 1.1s cubic-bezier(.2,.8,.2,1) both}
.phone::before,.phone::after{content:"";position:absolute;width:4px;border-radius:3px;background:linear-gradient(90deg,#2a2236,#6a5b7e);left:-4px}
.phone::before{top:110px;height:44px}.phone::after{top:170px;height:70px}
.screen{height:100%;border-radius:36px;overflow:hidden;position:relative;padding:38px 14px 12px;display:flex;flex-direction:column;gap:12px;background:radial-gradient(120% 70% at 20% 0%,#4b1858,#1a0b27 60%,#0f0818)}
.screen::before{content:"";position:absolute;top:10px;left:50%;translate:-50% 0;width:82px;height:22px;border-radius:99px;background:#05030a;box-shadow:inset 0 -1px 2px #333}
.screen::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,rgba(255,255,255,.16),transparent 35%);pointer-events:none;border-radius:inherit}
.row{display:flex;align-items:center;justify-content:space-between}
.hi{font:800 18px "Bricolage Grotesque",sans-serif}
.dots{display:flex;gap:9px}
.ring{width:42px;height:42px;border-radius:50%;padding:2.5px;background:conic-gradient(var(--pink),var(--ind),var(--pink));animation:spin 6s linear infinite}
.ring i{display:block;width:100%;height:100%;border-radius:50%;background:#1a0b27;border:2px solid #1a0b27;background-image:radial-gradient(circle at 35% 30%,#ff9dc6,#8134af)}
@keyframes spin{to{filter:hue-rotate(40deg);transform:rotate(360deg)}}
.mini{border-radius:20px;padding:13px;font-size:13px}
.mini b{display:block;font:800 15px "Bricolage Grotesque",sans-serif;color:#fff}
.mini span{color:var(--mut)}
.vid{flex:1;border-radius:20px;background:radial-gradient(circle at 30% 20%,#ff5fa5,transparent 50%),radial-gradient(circle at 80% 80%,#6d5dfc,transparent 55%),#2a1040;display:grid;place-items:center;font-size:34px;box-shadow:inset 0 0 30px rgba(0,0,0,.4)}
.tabs{display:flex;justify-content:space-around;padding:10px 0 2px;font-size:11px;color:var(--mut);border-top:1px solid var(--edge)}
.tabs .on{color:#fff}
.float{position:absolute;padding:12px 16px;border-radius:20px;font-size:13px;animation:rise 1.3s .5s cubic-bezier(.2,.8,.2,1) both,bob 6s 1.8s ease-in-out infinite;z-index:2}
.float b{display:block;font:800 15px "Bricolage Grotesque",sans-serif;color:#fff}
.f1{left:-4%;top:22%}.f2{right:-2%;bottom:20%;animation-delay:.8s,2s}
@keyframes rise{from{opacity:0;transform:translateY(60px) scale(.94)}}
@keyframes bob{50%{translate:0 -12px}}
@media(max-width:860px){.hero{grid-template-columns:1fr}.stage{min-height:600px}.f1{left:0}.f2{right:0}}

/* universe cards */
.grid3{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}
.card{padding:26px;display:grid;gap:14px;align-content:start}
.glyph{width:54px;height:54px;border-radius:17px;display:grid;place-items:center;font-size:24px;background:linear-gradient(160deg,#ff6aa9,#8134af);box-shadow:inset 0 2px 0 rgba(255,255,255,.55),inset 0 -4px 8px rgba(0,0,0,.35),0 10px 20px -6px rgba(255,45,135,.6)}
.timer{position:relative;width:132px;height:132px;margin:6px auto 0}
.timer svg{transform:rotate(-90deg)}
.timer .t{position:absolute;inset:0;display:grid;place-items:center;font:800 24px "Bricolage Grotesque",sans-serif;font-variant-numeric:tabular-nums}
.spark{display:flex;align-items:center;gap:12px}
.spark output{font:800 22px "Bricolage Grotesque",sans-serif;font-variant-numeric:tabular-nums;min-width:3ch}

/* connect */
.panel{padding:28px;display:grid;gap:22px}
.search{padding:14px 20px;border-radius:16px;background:rgba(0,0,0,.35);box-shadow:inset 0 3px 8px rgba(0,0,0,.6),0 1px 0 rgba(255,255,255,.12);color:var(--mut)}
.chips{display:flex;gap:10px;flex-wrap:wrap}
.chip{font:500 14px "DM Sans",sans-serif;color:var(--ink);padding:9px 18px;border-radius:999px;border:1px solid var(--edge);cursor:pointer;background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.04));box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 4px 10px -4px #000}
.chip[aria-pressed=true]{background:linear-gradient(180deg,#ff6aa9,#d4106a);box-shadow:inset 0 2px 6px rgba(90,0,40,.6)}
.people{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px}
.person{padding:18px;text-align:center;border-radius:22px;transition:opacity .3s,transform .3s}
.person.off{opacity:.18;transform:scale(.95)}
.av{width:58px;height:58px;border-radius:50%;margin:0 auto 10px;box-shadow:inset 0 2px 3px rgba(255,255,255,.6),inset 0 -5px 8px rgba(0,0,0,.35),0 8px 16px -6px #000}
.person b{display:block}.person small{color:var(--mut)}

/* anonymous */
.two{display:grid;grid-template-columns:1fr 1fr;gap:22px;align-items:center}
@media(max-width:820px){.two{grid-template-columns:1fr}}
.switch{display:flex;align-items:center;gap:16px;font-weight:700}
.sw{width:74px;height:40px;border-radius:99px;border:0;padding:4px;cursor:pointer;background:#1b1228;box-shadow:inset 0 4px 10px #000,0 1px 0 rgba(255,255,255,.18);position:relative;transition:background .3s}
.sw::after{content:"";position:absolute;top:4px;left:4px;width:32px;height:32px;border-radius:50%;background:linear-gradient(180deg,#fff,#cfc3dc);box-shadow:0 3px 6px rgba(0,0,0,.6),inset 0 -2px 3px rgba(0,0,0,.2);transition:transform .3s cubic-bezier(.3,1.5,.5,1)}
.sw[aria-checked=true]{background:linear-gradient(90deg,#8134af,var(--pink))}
.sw[aria-checked=true]::after{transform:translateX(34px)}
.conf{padding:26px;display:grid;gap:14px}
.conf q{font:500 20px/1.4 "Bricolage Grotesque",sans-serif;quotes:none}
.who{transition:filter .4s}
.who.hide{filter:blur(6px)}
.badge{display:inline-flex;gap:8px;align-items:center;font-size:13px;color:var(--ok)}

/* chat */
.chat{padding:18px;height:380px;display:flex;flex-direction:column}
.chat header{display:flex;align-items:center;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--edge)}
.live{width:10px;height:10px;border-radius:50%;background:var(--ok);box-shadow:0 0 12px var(--ok);animation:pulse 2s infinite}
@keyframes pulse{50%{opacity:.4}}
.msgs{flex:1;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:10px;padding:14px 0}
.m{max-width:78%;padding:10px 16px;border-radius:20px;font-size:15px;animation:pop .35s cubic-bezier(.3,1.4,.5,1) both}
.m.in{background:rgba(255,255,255,.1);border-bottom-left-radius:6px;align-self:flex-start;box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.m.out{background:linear-gradient(180deg,#ff6aa9,#d4106a);border-bottom-right-radius:6px;align-self:flex-end;color:#fff;box-shadow:inset 0 1px 0 rgba(255,255,255,.5)}
.m.typing{letter-spacing:4px;color:var(--mut)}
@keyframes pop{from{opacity:0;transform:translateY(14px) scale(.9)}}
.compose{padding:12px 18px;border-radius:99px;background:rgba(0,0,0,.35);box-shadow:inset 0 3px 8px rgba(0,0,0,.6);color:var(--mut);font-size:15px}

/* safety + arch */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px}
.tile{padding:20px;border-radius:22px}
.tile h3{font-size:1.05rem;margin-bottom:6px}
.tile p{font-size:15px}
.arch{padding:20px;overflow-x:auto}
.arch svg{min-width:640px;width:100%;height:auto;display:block}
.node rect{fill:rgba(255,255,255,.08);stroke:rgba(255,255,255,.25)}
.node text{fill:#f6eefc;font:700 14px "DM Sans",sans-serif;text-anchor:middle}
.node.core rect{fill:rgba(255,45,135,.25);stroke:var(--pink)}
.flow{fill:none;stroke:var(--pink);stroke-width:2;stroke-dasharray:6 8;animation:dash 1.4s linear infinite}
@keyframes dash{to{stroke-dashoffset:-28}}

/* roadmap */
.road ul{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:10px}
.road li{display:flex;gap:12px;align-items:center}
.road li::before{content:"";width:22px;height:22px;border-radius:7px;flex:none;background:linear-gradient(180deg,#5ff0b0,#1fae75);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),0 3px 8px -2px rgba(70,230,160,.6)}
.road .grow li::before{background:linear-gradient(180deg,#ff6aa9,#8134af);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 3px 8px -2px rgba(255,45,135,.6)}
.road .card{padding:28px}

footer{text-align:center;padding:110px 0 70px;display:grid;gap:22px;justify-items:center}
footer p{margin:0 auto}
footer small{color:var(--mut)}

@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
</style>
</head>
<body>
<div class="orb o1"></div><div class="orb o2"></div><div class="orb o3"></div>

<nav class="glass" aria-label="Main">
  <b>✦ Sparkle</b>
  <div><a href="#universe">Universe</a><a href="#connect">Connect</a><a href="#safety">Safety</a><a href="#roadmap">Roadmap</a><a class="btn" href="#connect">Get started</a></div>
</nav>

<main class="wrap">
<div class="hero">
  <div class="copy">
    <h1>Presence over performance.<span>Connection over clout.</span></h1>
    <p>Sparkle is a social app built around your campus: the people near you, what's happening today, and what you want to share, without a follower count in sight.</p>
    <div class="pills">
      <span class="pill"><i>✦</i>Campus first</span><span class="pill"><i>◉</i>Privacy first</span><span class="pill"><i>⚡</i>Real time</span><span class="pill"><i>◈</i>Community</span>
    </div>
    <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn" href="#universe">Explore the app</a><a class="btn ghost" href="#stack">See how it's built</a></div>
  </div>
  <div class="stage" id="stage">
    <div class="float glass f1"><b>Amina posted a Moment</b>Karatina University</div>
    <div class="phone" id="phone">
      <div class="screen">
        <div class="row"><span class="hi">Good evening, Don</span><span>🔔</span></div>
        <div class="dots"><div class="ring"><i></i></div><div class="ring"><i></i></div><div class="ring"><i></i></div><div class="ring"><i></i></div></div>
        <div class="mini glass"><b>Campus pulse</b><span>284 sparks · 31 online</span></div>
        <div class="vid">🎬</div>
        <div class="tabs"><span class="on">Home</span><span>Connect</span><span>Spark</span><span>Chats</span><span>Me</span></div>
      </div>
    </div>
    <div class="float glass f2"><b>Afterglow ends in 08:42</b>Share, glow, disappear</div>
  </div>
</div>

<section id="universe">
  <div class="head"><h2>Three places to spend an evening</h2><p>Home shows your campus today. Afterglow is for stories that fade. Moments is short video without a scoreboard. Try the controls.</p></div>
  <div class="grid3">
    <article class="glass card"><div class="glyph">🏠</div><h3>Home</h3><p>Your campus, your people, your pulse. Tap the button to send a spark.</p>
      <div class="spark"><button class="btn" id="sparkBtn">✦ Send a spark</button><output id="sparks">284</output></div></article>
    <article class="glass card"><div class="glyph">🌤</div><h3>Afterglow</h3><p>Stories without the pressure. Everything fades when the ring runs out.</p>
      <div class="timer"><svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r="58" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="10"/><circle id="arc" cx="66" cy="66" r="58" fill="none" stroke="url(#g)" stroke-width="10" stroke-linecap="round" stroke-dasharray="364.4" stroke-dashoffset="0"/><defs><linearGradient id="g"><stop offset="0" stop-color="#ff2d87"/><stop offset="1" stop-color="#6d5dfc"/></linearGradient></defs></svg><div class="t" id="clock">08:42</div></div></article>
    <article class="glass card"><div class="glyph">🎬</div><h3>Moments</h3><p>Short video from campus life. Swipe to the next one; nobody sees a like count.</p>
      <div class="vid" style="min-height:130px;aspect-ratio:16/10">✦</div></article>
  </div>
</section>

<section id="connect">
  <div class="head"><h2>Discover people, not followers</h2><p>Sparkle treats closeness as more meaningful than popularity. Filter the people near you.</p></div>
  <div class="glass panel">
    <div class="search">🔍 Search your campus</div>
    <div class="chips" id="chips"><button class="chip" aria-pressed="true" data-k="all">Campus</button><button class="chip" aria-pressed="false" data-k="CS">Course: CS</button><button class="chip" aria-pressed="false" data-k="y1">Year 1</button><button class="chip" aria-pressed="false" data-k="on">Active now</button></div>
    <div class="people" id="people">
      <div class="glass person" data-t="CS on"><div class="av" style="background:radial-gradient(circle at 35% 30%,#ffa0c8,#8134af)"></div><b>Brian</b><small>CS · Year 2 · 0.8 km</small></div>
      <div class="glass person" data-t="IT y1 on"><div class="av" style="background:radial-gradient(circle at 35% 30%,#a99cff,#3a2c9c)"></div><b>Amina</b><small>IT · Year 1 · 1.2 km</small></div>
      <div class="glass person" data-t="LAW"><div class="av" style="background:radial-gradient(circle at 35% 30%,#ffd0a0,#d4106a)"></div><b>Kevin</b><small>Law · Year 3 · 1.8 km</small></div>
      <div class="glass person" data-t="CS y1"><div class="av" style="background:radial-gradient(circle at 35% 30%,#9ff0d0,#6d5dfc)"></div><b>Wanjiru</b><small>CS · Year 1 · 2.1 km</small></div>
    </div>
  </div>
</section>

<section id="anon">
  <div class="head"><h2>Say it without your name on it</h2><p>Anonymous does not mean unmoderated. Confessions stay inside your campus and every post can be reported and reviewed.</p></div>
  <div class="two">
    <div class="glass conf">
      <div class="switch"><button class="sw" id="sw" role="switch" aria-checked="true" aria-label="Anonymous mode"></button><span id="swLabel">Anonymous mode on</span></div>
      <q>I accidentally attended the wrong lecture for 40 minutes…</q>
      <div class="row"><span class="who hide" id="who">Posted by Brian</span><b>✦ 842 sparks</b></div>
      <span class="badge">🛡 Abuse detection · Blocking · Reporting · Moderation</span>
    </div>
    <div class="glass chat" aria-label="Messaging demo">
      <header><div class="live"></div><div><b>Amina</b><br><small style="color:var(--mut)">online</small></div></header>
      <div class="msgs" id="msgs"></div>
      <div class="compose">＋ Type a message…</div>
    </div>
  </div>
</section>

<section id="safety">
  <div class="head"><h2>Built around trust</h2><p>Moderation, privacy and security run through the whole app instead of sitting in a settings page.</p></div>
  <div class="tiles">
    <div class="glass tile"><h3>🧹 Moderation</h3><p>Content review, anonymous confession review, and community moderation for groups.</p></div>
    <div class="glass tile"><h3>🔒 Privacy</h3><p>Blocking, visibility controls, and campus-scoped identity.</p></div>
    <div class="glass tile"><h3>🔐 Security</h3><p>JWT sessions, hashed passwords, one-time codes and two-factor sign-in.</p></div>
    <div class="glass tile"><h3>🚫 Enforcement</h3><p>Ban, mute and reach control, plus verification and campus administration.</p></div>
  </div>
</section>

<section id="stack">
  <div class="head"><h2>One interface, several real-time systems</h2><p>React and Capacitor on the front; Node, MySQL, Redis and Cloudinary behind it.</p></div>
  <div class="glass arch">
    <svg viewBox="0 0 760 400" role="img" aria-label="Architecture diagram: client to REST and Socket.IO, Node and Express, then MySQL, Redis and Cloudinary into Sparkle core">
      <g class="node"><rect x="290" y="10" width="180" height="46" rx="14"/><text x="380" y="39">Sparkle client</text></g>
      <g class="node"><rect x="150" y="100" width="150" height="42" rx="14"/><text x="225" y="126">REST API</text></g>
      <g class="node"><rect x="460" y="100" width="150" height="42" rx="14"/><text x="535" y="126">Socket.IO</text></g>
      <g class="node"><rect x="290" y="186" width="180" height="46" rx="14"/><text x="380" y="215">Node + Express</text></g>
      <g class="node"><rect x="90" y="272" width="140" height="42" rx="14"/><text x="160" y="298">MySQL</text></g>
      <g class="node"><rect x="310" y="272" width="140" height="42" rx="14"/><text x="380" y="298">Redis</text></g>
      <g class="node"><rect x="530" y="272" width="140" height="42" rx="14"/><text x="600" y="298">Cloudinary</text></g>
      <g class="node core"><rect x="290" y="346" width="180" height="46" rx="14"/><text x="380" y="375">✦ Sparkle core</text></g>
      <path class="flow" d="M340 56 C340 80 240 80 225 100"/><path class="flow" d="M420 56 C420 80 520 80 535 100"/>
      <path class="flow" d="M225 142 C225 170 340 160 345 186"/><path class="flow" d="M535 142 C535 170 420 160 415 186"/>
      <path class="flow" d="M340 232 C300 250 200 250 160 272"/><path class="flow" d="M380 232 V272"/><path class="flow" d="M420 232 C460 250 560 250 600 272"/>
      <path class="flow" d="M160 314 C180 335 320 330 340 346"/><path class="flow" d="M380 314 V346"/><path class="flow" d="M600 314 C580 335 440 330 420 346"/>
    </svg>
  </div>
</section>

<section id="roadmap" class="road">
  <div class="head"><h2>From one campus to many communities</h2><p>The long-term idea is bigger than a feed: shared infrastructure for real-world communities.</p></div>
  <div class="grid3" style="grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
    <div class="glass card"><h3>Live today</h3><ul>
      <li>Authentication and profiles</li><li>Home feed and messaging</li><li>Moments and Afterglow</li><li>Connect, anonymous mode, confessions</li><li>Notifications and security</li><li>Mobile app</li></ul></div>
    <div class="glass card grow"><h3>Growing</h3><ul>
      <li>Advanced campus discovery</li><li>Communities and campus events</li><li>Sparkle Pay and marketplace</li><li>Creator ecosystem</li><li>Sparkle connectivity</li></ul></div>
  </div>
</section>
</main>

<footer class="wrap">
  <h2>Who's around you?</h2>
  <p>A social network that doesn't ask how popular you are. Presence, privacy, connection, community.</p>
  <a class="btn" href="#universe">Back to the top</a>
  <small>© Sparkle · Campus-first social technology</small>
</footer>

<script>
(function(){
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // phone tilt
  var stage=document.getElementById('stage'),phone=document.getElementById('phone');
  if(!reduce){
    stage.addEventListener('pointermove',function(e){var r=stage.getBoundingClientRect();var x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;phone.style.transform='rotateY('+(x*22)+'deg) rotateX('+(-y*16)+'deg)';});
    stage.addEventListener('pointerleave',function(){phone.style.transform='';});
  }
  // sparks
  var n=284,out=document.getElementById('sparks');
  document.getElementById('sparkBtn').onclick=function(){n++;out.textContent=n;};
  // afterglow timer
  var total=522,left=total,arc=document.getElementById('arc'),clock=document.getElementById('clock');
  function tick(){var m=Math.floor(left/60),s=left%60;clock.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;arc.style.strokeDashoffset=364.4*(1-left/total);left=left<=0?total:left-1;}
  tick();setInterval(tick,1000);
  // connect filters
  var chips=document.querySelectorAll('.chip'),ppl=document.querySelectorAll('.person');
  chips.forEach(function(c){c.onclick=function(){
    chips.forEach(function(x){x.setAttribute('aria-pressed',x===c)});
    var k=c.dataset.k;ppl.forEach(function(p){p.classList.toggle('off',k!=='all'&&p.dataset.t.split(' ').indexOf(k)<0)});
  };});
  // anonymous switch
  var sw=document.getElementById('sw'),who=document.getElementById('who'),lab=document.getElementById('swLabel');
  sw.onclick=function(){var on=sw.getAttribute('aria-checked')!=='true';sw.setAttribute('aria-checked',on);who.classList.toggle('hide',on);lab.textContent=on?'Anonymous mode on':'Anonymous mode off';};
  // chat loop
  var script=[['in','hey 👋'],['in','You coming to the event tonight?'],['out','definitely ✦'],['in','Save me a seat?'],['out','Already did. Front row.']];
  var box=document.getElementById('msgs'),i=0;
  function add(t,c){var d=document.createElement('div');d.className='m '+c;d.textContent=t;box.appendChild(d);while(box.children.length>6)box.removeChild(box.firstChild);return d;}
  function step(){
    if(i>=script.length){setTimeout(function(){box.innerHTML='';i=0;step();},3200);return;}
    var m=script[i++],t=add('•••',m[0]+' typing');
    setTimeout(function(){t.remove();add(m[1],m[0]);step();},reduce?0:1300);
  }
  step();
})();
</script>
</body>
</html>
