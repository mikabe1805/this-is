### Navigation model

- Tab state mapping (src/App.tsx)
  - Path to tab: 197-213 (sets 'home','search','favorites','profile')
  - Tab -> navigate: 236-252
  - Reels special layout: 262-277

- Global providers (src/App.tsx)
  - Providers tree: 363-385 (Auth → Navigation → Filters → Modal)

- Navbar component
  - src/components/Navbar.tsx: tabs 15-20; scroll interception 22-35; layout 38-43

- Modal system (src/contexts/ModalContext.tsx)
  - API: 39-78; used in App.tsx GlobalModals 33-153

- Navigation context (src/contexts/NavigationContext.tsx)
  - State: 47-66
  - openHubModal: 79-112
  - openListModal: 114-134
  - openProfileModal: 136-154
  - goBack: 194-213
  - Full-screen open helpers: 214-227

- In-screen flows referencing navigation
  - Search: src/pages/Search.tsx 315-349 (openHubModal/openListModal/openProfileModal)
  - ListView: src/pages/ListView.tsx 266-285 (openHubModal from list)

GAP: Deep-linking for nested modals is not encoded in URL; consider adding a query-state router layer under `src/utils/`.
