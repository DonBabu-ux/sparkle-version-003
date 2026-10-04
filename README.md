from pathlib import Path
import textwrap

root = Path("/mnt/data/sparkle-readme")
assets = root / "assets"
assets.mkdir(parents=True, exist_ok=True)

hero_svg = r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 680">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#090612"/><stop offset=".55" stop-color="#160923"/><stop offset="1" stop-color="#2b0d35"/>
  </linearGradient>
  <linearGradient id="pink" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#ff2d87"/><stop offset="1" stop-color="#9b5cff"/>
  </linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
    <stop stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#ffffff" stop-opacity=".04"/>
  </linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="35"/></filter>
  <filter id="shadow"><feDropShadow dx="0" dy="20" stdDeviation="25" flood-opacity=".45"/></filter>
</defs>

<rect width="1200" height="680" rx="42" fill="url(#bg)"/>

<!-- animated ambient blobs -->
<circle cx="170" cy="120" r="115" fill="#ff2d87" opacity=".28" filter="url(#blur)">
  <animate attributeName="cx" values="170;270;170" dur="7s" repeatCount="indefinite"/>
  <animate attributeName="cy" values="120;210;120" dur="9s" repeatCount="indefinite"/>
</circle>
<circle cx="1030" cy="510" r="150" fill="#7c3aed" opacity=".28" filter="url(#blur)">
  <animate attributeName="cx" values="1030;910;1030" dur="8s" repeatCount="indefinite"/>
  <animate attributeName="cy" values="510;410;510" dur="10s" repeatCount="indefinite"/>
</circle>

<!-- particles -->
<g fill="#fff">
  <circle cx="100" cy="510" r="3"><animate attributeName="cy" values="510;420;510" dur="4s" repeatCount="indefinite"/></circle>
  <circle cx="300" cy="90" r="2"><animate attributeName="cy" values="90;145;90" dur="3s" repeatCount="indefinite"/></circle>
  <circle cx="900" cy="110" r="3"><animate attributeName="cy" values="110;60;110" dur="4.5s" repeatCount="indefinite"/></circle>
  <circle cx="1080" cy="230" r="2"><animate attributeName="cy" values="230;300;230" dur="3.5s" repeatCount="indefinite"/></circle>
</g>

<!-- left branding -->
<g transform="translate(82 100)">
  <circle cx="48" cy="48" r="48" fill="url(#pink)">
    <animateTransform attributeName="transform" type="rotate" values="0 48 48;360 48 48" dur="12s" repeatCount="indefinite"/>
  </circle>
  <path d="M25 51c13-28 29-28 44 0-15 18-29 18-44 0Z" fill="none" stroke="white" stroke-width="7" stroke-linecap="round"/>
  <circle cx="47" cy="51" r="6" fill="white"/>
</g>

<text x="82" y="230" fill="white" font-family="Arial, sans-serif" font-size="72" font-weight="800">SPARKLE</text>
<text x="84" y="276" fill="#f2d7e7" font-family="Arial, sans-serif" font-size="23">A Kenyan social experience built for connection.</text>

<!-- animated pill -->
<g transform="translate(84 325)">
  <rect width="255" height="52" rx="26" fill="url(#glass)" stroke="#ffffff" stroke-opacity=".18"/>
  <circle cx="28" cy="26" r="7" fill="#ff2d87">
    <animate attributeName="r" values="7;11;7" dur="1.5s" repeatCount="indefinite"/>
    <animate attributeName="opacity" values="1;.35;1" dur="1.5s" repeatCount="indefinite"/>
  </circle>
  <text x="48" y="34" fill="white" font-family="Arial, sans-serif" font-size="17">LIVE • BUILD • CONNECT</text>
</g>

<!-- phone -->
<g filter="url(#shadow)">
  <rect x="705" y="55" width="330" height="570" rx="46" fill="#08070d" stroke="#ffffff" stroke-opacity=".22" stroke-width="3"/>
  <rect x="722" y="76" width="296" height="528" rx="34" fill="#110d19"/>
  <rect x="835" y="89" width="70" height="6" rx="3" fill="#4b4350"/>

  <!-- story strip -->
  <circle cx="760" cy="135" r="26" fill="url(#pink)"/>
  <circle cx="827" cy="135" r="26" fill="#9b5cff"/>
  <circle cx="894" cy="135" r="26" fill="#ff5c9d"/>
  <circle cx="961" cy="135" r="26" fill="#6337ff"/>

  <!-- feed card -->
  <rect x="742" y="184" width="256" height="195" rx="25" fill="url(#glass)" stroke="#ffffff" stroke-opacity=".12"/>
  <rect x="762" y="205" width="38" height="38" rx="19" fill="url(#pink)"/>
  <rect x="814" y="211" width="105" height="9" rx="4.5" fill="#fff" opacity=".85"/>
  <rect x="814" y="227" width="70" height="7" rx="3.5" fill="#fff" opacity=".3"/>
  <rect x="762" y="262" width="216" height="82" rx="18" fill="#25142b"/>
  <circle cx="785" cy="364" r="8" fill="#ff2d87">
    <animate attributeName="r" values="8;13;8" dur="1.2s" repeatCount="indefinite"/>
  </circle>
  <text x="803" y="370" fill="#fff" font-family="Arial" font-size="13">1.8K Sparks</text>

  <!-- bottom nav -->
  <rect x="742" y="540" width="256" height="48" rx="24" fill="#0b0910" stroke="#fff" stroke-opacity=".08"/>
  <circle cx="775" cy="564" r="7" fill="#fff" opacity=".5"/>
  <circle cx="830" cy="564" r="7" fill="#ff2d87"/>
  <circle cx="885" cy="564" r="7" fill="#fff" opacity=".5"/>
  <circle cx="940" cy="564" r="7" fill="#fff" opacity=".5"/>
  <circle cx="775" cy="564" r="15" fill="none" stroke="#fff" stroke-opacity=".12"/>
  <circle cx="830" cy="564" r="15" fill="none" stroke="#ff2d87" stroke-opacity=".25">
    <animate attributeName="r" values="15;19;15" dur="1.6s" repeatCount="indefinite"/>
  </circle>
</g>

<!-- orbiting spark -->
<g>
  <circle cx="600" cy="500" r="5" fill="#ff2d87">
    <animateMotion dur="6s" repeatCount="indefinite" path="M0,0 C80,-180 160,-180 230,0 C160,180 80,180 0,0"/>
  </circle>
</g>
</svg>'''

architecture_svg = r'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 520">
<defs>
 <linearGradient id="a" x1="0" x2="1"><stop stop-color="#ff2d87"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
 <filter id="glow"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="1200" height="520" rx="32" fill="#0b0711"/>
<text x="60" y="70" fill="white" font-family="Arial" font-size="30" font-weight="700">SPARKLE • SYSTEM FLOW</text>
<text x="60" y="102" fill="#a99cab" font-family="Arial" font-size="15">Requests move through the stack — visually, not just in a diagram.</text>

<g font-family="Arial" text-anchor="middle">
 <g transform="translate(80 190)">
  <rect width="190" height="110" rx="24" fill="#17101c" stroke="#ff2d87" stroke-opacity=".45"/>
  <text x="95" y="48" fill="white" font-size="19" font-weight="700">React / Vite</text>
  <text x="95" y="73" fill="#a99cab" font-size="13">Web + Capacitor</text>
 </g>
 <g transform="translate(355 190)">
  <rect width="190" height="110" rx="24" fill="#17101c" stroke="#8b5cf6" stroke-opacity=".45"/>
  <text x="95" y="48" fill="white" font-size="19" font-weight="700">Express API</text>
  <text x="95" y="73" fill="#a99cab" font-size="13">Auth + Services</text>
 </g>
 <g transform="translate(630 190)">
  <rect width="190" height="110" rx="24" fill="#17101c" stroke="#ff2d87" stroke-opacity=".45"/>
  <text x="95" y="48" fill="white" font-size="19" font-weight="700">Redis</text>
  <text x="95" y="73" fill="#a99cab" font-size="13">Cache + Presence</text>
 </g>
 <g transform="translate(905 190)">
  <rect width="190" height="110" rx="24" fill="#17101c" stroke="#8b5cf6" stroke-opacity=".45"/>
  <text x="95" y="48" fill="white" font-size="19" font-weight="700">MySQL</text>
  <text x="95" y="73" fill="#a99cab" font-size="13">Persistent data</text>
 </g>
</g>

<g fill="none" stroke="url(#a)" stroke-width="4" stroke-linecap="round">
 <path d="M270 245H355"/>
 <path d="M545 245H630"/>
 <path d="M820 245H905"/>
</g>

<!-- moving packets -->
<g fill="#fff" filter="url(#glow)">
 <circle r="7"><animateMotion dur="2s" repeatCount="indefinite" path="M270,245 H355"/></circle>
 <circle r="7"><animateMotion dur="2.2s" repeatCount="indefinite" path="M545,245 H630"/></circle>
 <circle r="7"><animateMotion dur="2.4s" repeatCount="indefinite" path="M820,245 H905"/></circle>
</g>

<g font-family="Arial" text-anchor="middle">
 <rect x="390" y="365" width="420" height="70" rx="22" fill="#15101b" stroke="#fff" stroke-opacity=".09"/>
 <text x="600" y="395" fill="white" font-size="16" font-weight="700">Socket.IO • realtime events</text>
 <text x="600" y="417" fill="#a99cab" font-size="13">Messages • typing • presence • notifications</text>
</g>
</svg>'''

readme = r'''# ✨ Sparkle

<p align="center">
  <img src="./assets/sparkle-hero.svg" alt="Sparkle animated product hero" width="100%">
</p>

<p align="center">
  <b>Connect. Express. Discover. Spark.</b><br>
  A Kenyan social platform engineered as a real-time, mobile-first experience.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React%20%2B%20Vite-ff2d87?style=for-the-badge">
  <img src="https://img.shields.io/badge/Backend-Node%20%2B%20Express-8b5cf6?style=for-the-badge">
  <img src="https://img.shields.io/badge/Database-MySQL-ff2d87?style=for-the-badge">
  <img src="https://img.shields.io/badge/Realtime-Socket.IO-8b5cf6?style=for-the-badge">
</p>

---

## ⚡ This README is alive

The visual above is **not a screenshot**.

It is an SVG generated with animation code: moving ambient light, orbiting particles, pulsing interactions and a living app mockup.

That is the direction of Sparkle itself:

```text
             ┌──────────────────────────────┐
             │            SPARKLE            │
             │  social • realtime • mobile   │
             └──────────────┬───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
     EXPLORE             CONNECT             EXPRESS
        │                   │                   │
     Home Feed           Messages           AfterGlow
     Moments             Presence           Sparks
     Connect             Typing             Confessions
     Profiles            Notifications      Reactions
