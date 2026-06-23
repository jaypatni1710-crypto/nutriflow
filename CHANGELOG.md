# NutriFlow Changelog

## Module 3 - Dietitian Dashboard Layout (Sidebar + Topbar)

### Added
- **Collapsible sidebar navigation** (`frontend/src/components/layout/Sidebar.tsx`)
  - Fixed to the left, 260px expanded / 80px collapsed, smooth width transition
  - Expanded: icon + label per item. Collapsed: icon-only with tooltip
  - V1 items only: **Dashboard**, **Clients** (`navConfig.tsx` — extend this list when the next module ships, no placeholder items added)
  - Active route highlighted via `NavLink`
  - Becomes an off-canvas drawer with backdrop on mobile (< 768px)
- **Top navbar** (`frontend/src/components/layout/Topbar.tsx`)
  - Hamburger toggle (top-left) — collapses/expands the sidebar on desktop & tablet, opens/closes the drawer on mobile
  - NutriFlow logo, current page title, dark-mode toggle, and profile dropdown (My Profile / Settings / Logout)
- **`DashboardLayout`** (`frontend/src/components/layout/DashboardLayout.tsx`) — composes Sidebar + Topbar, persists collapsed state to `localStorage` (`nutriflow:sidebar-collapsed`) so it survives a refresh, and closes the mobile drawer on route change
- **Dark mode support**: `useTheme` hook + `ThemeProvider` (`frontend/src/hooks/useTheme.tsx`), persisted to `localStorage` (`nutriflow:theme`), `darkMode: 'class'` enabled in `tailwind.config.js`
- `/dashboard` now renders `DashboardHomePage`, `/dashboard/clients` renders `ClientsPage`, both nested under `DashboardLayout` via `react-router-dom`'s `<Outlet />`

### Removed
- Inline `DietitianDashboardPage` placeholder ("coming in the next module") from `pages/ProtectedRoute.tsx` — replaced by the real dashboard layout above

### Unchanged
- Module 1 authentication and Module 2 admin user management — all existing functionality preserved


## Module 2 - Admin User Management & Live Support Chat

### Added
- **Users Panel** (Admin Dashboard): lists active/rejected/suspended dietitians (pending excluded), with ability to change status anytime (`GET /api/auth/admin/users`, `POST /api/auth/admin/users/:id/status`)
- **Live Support Chat**: real-time Socket.IO chat between Admin and Dietitian
  - Session-only — no DB persistence, no chat history, cleared on disconnect
  - Available from Admin Dashboard ("Live Chat" tab) — shows list of active conversations
  - Available from Login Page via "Contact Admin" button when account is pending/rejected/suspended
- Admin Dashboard restructured into tabs: **Pending Users / Users / Live Chat**
- `backend/src/socket/chat.socket.ts` — Socket.IO handlers (`join-support`, `send-message`, `receive-message`, `active-rooms`, `session-ended`)
- `frontend/src/components/chat/SupportChatWidget.tsx` — `UserSupportChat` (login modal) and `AdminSupportChat` (dashboard panel)
- `frontend/src/lib/socket.ts` — socket.io-client connection helper
- New dependencies: `socket.io` (backend), `socket.io-client` (frontend)

### Unchanged
- Module 1 authentication, registration, email verification, and Pending Users panel — all existing functionality preserved


## v2.0.0 - Module 2: Admin User Management & Live Support Chat

### Added
- **Pending Users Panel**: Tab showing users with `status = pending`
  - Columns: Full Name, Email, Phone Number, Registration Date, Email Verification Status
  - Actions: Approve, Reject, Suspend
- **Users Panel**: Tab showing `active`, `rejected`, `suspended` users (no pending)
  - Columns: Full Name, Email, Phone Number, Registration Date, Current Status
  - Admin can change status anytime via dropdown
- **Live Support Chat**: Real-time chat using Socket.IO
  - Admin ↔ Dietitian communication
  - Available from Admin Dashboard (Live Chat tab)
  - Available from Login Page when account is pending/rejected/suspended
  - Session-only communication (no DB persistence)
  - Messages clear on disconnect
- **Contact Admin button** on Login Page for non-active users
- **Admin Dashboard tabs**: Pending Users | Users | Live Chat
- Socket.IO server setup in backend
- `GET /admin/users` API endpoint
- `POST /admin/users/:id/status` API endpoint for status changes
- `changeStatusSchema` validation

### Fixed
- nodemailer downgraded to ^6.9.16 for stability
- Added @types/socket.io and @types/socket.io-client for TypeScript compatibility

### Module 1 Features Preserved
- All Module 1 auth features unchanged (login, register, verify, reset password)
- Auto token refresh
- Email verification flow
- Admin approval workflow
- Role-based access control
