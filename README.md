# Quizzer - Angular Quiz Application

A zoneless Angular quiz platform with signal-based state management and localStorage persistence.

I didn't have too much experience with signals or using Angular without Zone.js prior to writing this
(many years of RxJS and change detection) but I definitely learned a lot from this exercise.

## Architecture

```
Components (Quiz List, Quiz Builder, Taker, Results)
        ↓
Services (State Management with Signals)
        ↓
localStorage (Persistence)
```

## Design Decisions

| Decision | Reasoning | Trade-off |
|----------|-----------|-----------|
| **Zoneless Architecture** | Smaller bundle without zone.js, only updates DOM where needed (better performance) | Requires explicit signal updates (no automatic change detection) |
| **Signal-Based State** | Seems to be the direction Angular is moving, simpler than RxJS for this case | No operators like `map`, `filter`, `switchMap` (need RxJS for complex async flows) |
| **Manual Time Tracking with `setInterval`** | RxJS timers don't work well without Zone.js | ±1 second variance apparently; manual cleanup |
| **localStorage Only** | Client-side only, no backend complexity | Data lost on cache clear; limited storage (~5-10MB) |
| **One Result per Quiz** | Simpler state model, always uses latest attempt | New attempt replaces previous result |

## Getting Started

```bash
npm install
npm start           # http://localhost:4200
npm test            # run tests
npm run build       # prod build
```

## Tips

To reset the app back to it's default state (get rid of all quizzes and state) just nuke localStorage
```F12 -> application -> local storage -> clear```

## Tech Used

- **Angular** 20.3.0
- **TypeScript** 5.9+
- **PrimeNG** 20.3.0 (UI components)
- **PrimeFlex CSS** (styling)
- **Jasmine/Karma** (testing)
