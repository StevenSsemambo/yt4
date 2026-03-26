# YoSpeech — Find Your Flow 💧

> A speech confidence PWA for everyone who stutters — from toddlers to adults.
> Built by SayMyTech Developers · 2025

---

## 🚀 Quick Deploy to Netlify

1. Unzip and push folder to GitHub (drag & drop via GitHub browser UI)
2. Go to [app.netlify.com](https://app.netlify.com) → New site → Import from GitHub
3. Build command: `npm run build`
4. Publish directory: `dist`
5. Deploy!

---

## 🔑 AI Setup (Optional but Recommended)

YoSpeech works **100% offline** with the built-in Flux response library. For the full AI-powered experience (Claude-powered Flux, dynamic BraveMissions, story generation):

1. Get an API key at [console.anthropic.com](https://console.anthropic.com)
2. In Netlify: Site Settings → Environment Variables → Add:
   - Key: `VITE_ANTHROPIC_API_KEY`
   - Value: `sk-ant-...`
3. Redeploy

**Note:** The app never sends audio or voice data to Claude. Only text inputs are sent.

---

## 🛠️ Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`

---

## 📁 Project Structure

```
src/
├── ai/
│   └── fluxEngine.js       # Flux AI — Claude API + offline library
├── components/
│   ├── flux/
│   │   └── Flux.jsx         # Animated Flux companion (SVG)
│   └── shared/
│       ├── BottomNav.jsx    # Mobile navigation
│       └── Notification.jsx # Toast notifications
├── hooks/
│   └── useAppContext.jsx    # Global app state
├── pages/
│   ├── Onboarding.jsx       # Age group selection + profile setup
│   ├── Home.jsx             # Main dashboard
│   ├── Adventure.jsx        # World map + 6 zones × 5 missions
│   ├── Breathe.jsx          # Breathing games (4 types)
│   ├── SpeakLab.jsx         # Daily speech exercises
│   ├── BraveMissions.jsx    # Fear Ladder + exposure therapy
│   ├── TalkTales.jsx        # AI collaborative storytelling
│   ├── Journal.jsx          # Voice journal
│   ├── FamilyMode.jsx       # Co-reading + parent tips
│   ├── Progress.jsx         # Star universe + achievements
│   ├── FluxChat.jsx         # Direct AI conversation
│   └── Settings.jsx         # Profile + preferences
├── styles/
│   └── globals.css          # Tailwind + custom design system
└── utils/
    └── db.js                # Dexie (IndexedDB) — all local storage
```

---

## 🧠 Therapeutic Pillars

| Pillar | Features |
|--------|----------|
| Motor Retraining | SpeakLab, Adventure zones, rhythm guides |
| Amygdala Calming | Breathe & Flow, zero-pressure design |
| Avoidance Breaking | BraveMissions, Fear Ladder, voluntary stuttering rewards |
| Identity Rebuilding | Voice Journal, TalkTales, Progress Universe |
| Support System | Family Mode (co-reading), parent coaching tips |

---

## 📶 Offline Architecture

- **Layer 1:** App shell cached at install (Workbox)
- **Layer 2:** All user data in IndexedDB (Dexie.js)
- **Layer 3:** 1,400+ Flux responses pre-loaded offline
- **Layer 4:** Web Speech API on-device recognition
- **Layer 5:** Background sync when connectivity returns

---

## 🎮 Features

- ✅ 4 age groups (Little Speaker · Explorer · Navigator · Adult)
- ✅ Flux AI companion (Claude-powered + offline fallback)
- ✅ Adventure Mode — 6 zones × 5 missions
- ✅ Breathe & Flow — 4 breathing games with mic detection
- ✅ SpeakLab — 4 daily speech exercises
- ✅ BraveMissions — Fear Ladder + AI roleplay + voluntary stutter rewards
- ✅ TalkTales — Collaborative AI storytelling
- ✅ Voice Journal — 30-second daily recordings
- ✅ Family Mode — Co-reading + parent coaching
- ✅ Progress Universe — Star sky + 15 achievements + Flux evolution
- ✅ Flux Chat — Direct AI conversation
- ✅ Offline-first PWA — installable, works without internet
- ✅ Netlify-ready deployment

---

## 📄 License

© 2025 SayMyTech Developers. All rights reserved.
