# Security Gate Management App — React Native / Expo Implementation Spec

**Target platform:** Expo SDK 52+ with Expo Router v4
**Backend:** Frappe / ERPNext (Kaitet instance) via REST API + cookie session
**Source:** 1:1 React Native rewrite of the existing Flutter `KaitetUnifiedCheckInPage`
**Modules covered:** Visitor / Staff / Contractor check-in & check-out, Walk-in registration, Company Vehicle (Tractor) gate tracking, Daily summary

---

## Table of contents

1. [Tech stack & packages](#1-tech-stack--packages)
2. [Project structure](#2-project-structure)
3. [Navigation architecture](#3-navigation-architecture)
4. [Authentication & API layer](#4-authentication--api-layer)
5. [DocTypes & custom API methods](#5-doctypes--custom-api-methods)
6. [State machine & workflow](#6-state-machine--workflow)
7. [Screen specifications](#7-screen-specifications)
8. [Data flows & React Query keys](#8-data-flows--react-query-keys)
9. [QR scanner specifics](#9-qr-scanner-specifics)
10. [Build & deployment checklist](#10-build--deployment-checklist)

---

## 1. Tech stack & packages

### Core Expo & navigation

```json
{
  "expo": "~52.0.0",
  "expo-router": "~4.0.0",
  "react": "18.3.1",
  "react-native": "0.76.x",
  "react-native-safe-area-context": "~4.12.0",
  "react-native-screens": "~4.1.0",
  "react-native-gesture-handler": "~2.20.0",
  "react-native-reanimated": "~3.16.0"
}
```

### UI & styling

```json
{
  "nativewind": "^4.1.0",
  "tailwindcss": "3.4.0",
  "react-native-svg": "15.8.0",
  "@expo/vector-icons": "^14.0.0",
  "react-native-toast-message": "^2.2.0",
  "react-native-collapsible": "^1.6.2"
}
```

### Forms, validation, state

```json
{
  "react-hook-form": "^7.53.0",
  "zod": "^3.23.0",
  "@hookform/resolvers": "^3.9.0",
  "@tanstack/react-query": "^5.59.0",
  "zustand": "^5.0.0"
}
```

### Storage, network, cookie session

```json
{
  "@react-native-async-storage/async-storage": "1.23.1",
  "@react-native-cookies/cookies": "^6.2.1",
  "axios": "^1.7.0",
  "@react-native-community/netinfo": "11.4.1"
}
```

`@react-native-cookies/cookies` is critical — Frappe's `/api/method/login` returns a session cookie (`sid`) that must be persisted and sent on every subsequent request, mirroring the Flutter `SharedPrefsHelper.prefs.getString("cookie")` behavior.

### Device features

```json
{
  "expo-camera": "~16.0.0",
  "expo-barcode-scanner": "~13.0.0",
  "expo-haptics": "~14.0.0",
  "expo-av": "~15.0.0",
  "expo-status-bar": "~2.0.0",
  "expo-constants": "~17.0.0",
  "expo-linking": "~7.0.0"
}
```

`expo-av` plays the `submit.mp3` and `error.mp3` audio cues that the Flutter app uses on success/error. `expo-haptics` replaces `package:vibration` for the warning vibration.

### Dev dependencies

```json
{
  "@types/react": "~18.3.12",
  "typescript": "~5.3.3",
  "eslint": "^8.57.0",
  "eslint-config-expo": "~8.0.0",
  "prettier": "^3.3.0"
}
```

### Install command

```bash
npx create-expo-app@latest security-gate --template default
cd security-gate

npx expo install expo-router react-native-safe-area-context react-native-screens \
  expo-linking expo-constants expo-status-bar \
  expo-camera expo-barcode-scanner expo-haptics expo-av \
  @react-native-async-storage/async-storage @react-native-community/netinfo \
  react-native-gesture-handler react-native-reanimated react-native-svg

npm install nativewind tailwindcss@3.4.0 axios react-hook-form zod \
  @hookform/resolvers @tanstack/react-query zustand \
  react-native-toast-message react-native-collapsible \
  @react-native-cookies/cookies

npm install --save-dev @types/react typescript prettier
```

### Asset files to add

Place these in `assets/sounds/` (extracted from the Flutter app):
- `submit.mp3` — success sound
- `error.mp3` — error sound

---

## 2. Project structure

```
security-gate/
├── app/                                  # Expo Router file-based routes
│   ├── _layout.tsx                       # Root: providers + auth gate
│   ├── index.tsx                         # Redirect → /login or /(app)/gate
│   ├── login.tsx                         # Screen 0: Login (URL + email + pwd)
│   │
│   └── (app)/                            # Authenticated stack
│       ├── _layout.tsx                   # Auth-protected stack with tabs
│       │
│       └── gate/
│           ├── _layout.tsx               # Top tab navigator (Gate | Summary)
│           ├── index.tsx                 # Tab 1: Gate (Screen 1)
│           ├── summary.tsx               # Tab 2: Summary (Screen 2)
│           └── scan.tsx                  # Modal: QR scanner (Screen 3)
│
├── components/
│   ├── ui/
│   │   ├── Loader.tsx                    # Full-screen spinner (mirrors `Loader`)
│   │   ├── Card.tsx
│   │   ├── Button.tsx
│   │   ├── ChoiceChip.tsx                # Mirrors Flutter ChoiceChip
│   │   ├── StatusChip.tsx                # Workflow state pill
│   │   ├── StatCard.tsx                  # Summary tab stat cards
│   │   ├── LiveTimer.tsx                 # Mirrors `_LiveTimer`
│   │   ├── DialogRow.tsx                 # Icon + label + value row
│   │   └── ExpandableRow.tsx             # Activity log row
│   │
│   ├── forms/
│   │   ├── FormInput.tsx                 # Decorated TextField equivalent
│   │   ├── FormSelect.tsx                # Dropdown
│   │   └── HostSearchField.tsx           # Type-ahead employee search
│   │
│   └── gate/
│       ├── HeaderSelectors.tsx           # Visitor/Staff/Contractor/Vehicle chips
│       ├── SearchBar.tsx
│       ├── FoundResultCard.tsx           # Green card when appointment found
│       ├── NoAppointmentCard.tsx         # Orange card with walk-in CTA
│       ├── VisitorForm.tsx
│       ├── WalkInSection.tsx
│       ├── StaffForm.tsx
│       ├── ContractorForm.tsx
│       ├── VehicleScanAction.tsx         # Scan button + manual entry
│       ├── VehicleEntryDialog.tsx        # Confirm vehicle entry modal
│       ├── VehicleInsideCard.tsx         # Live timer card with completion note
│       ├── ActionButtons.tsx             # Check in / Check out
│       └── WorkflowTrail.tsx             # Vertical workflow timeline
│
├── lib/
│   ├── api/
│   │   ├── client.ts                     # Axios w/ cookie interceptor
│   │   ├── auth.ts                       # login, _getWorkingUrl
│   │   ├── visitors.ts                   # All Appointment endpoints
│   │   ├── staff.ts                      # Staff search
│   │   ├── contractors.ts                # Contractor search
│   │   ├── vehicles.ts                   # Tractor Daily Task endpoints
│   │   ├── employees.ts                  # Employee type-ahead search
│   │   ├── summary.ts                    # Daily summary fetch
│   │   ├── workflow.ts                   # apply_workflow helper
│   │   └── types.ts                      # All TypeScript types
│   │
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useVisitorSearch.ts
│   │   ├── useStaffSearch.ts
│   │   ├── useContractorSearch.ts
│   │   ├── useEmployeeSearch.ts
│   │   ├── useAppointmentWorkflowState.ts
│   │   ├── useDailySummary.ts
│   │   ├── useVehicleTicket.ts
│   │   └── useFeedback.ts                 # Sound + haptic + snackbar
│   │
│   ├── stores/
│   │   ├── authStore.ts                  # User, instance URL, cookie
│   │   ├── gateStore.ts                  # Cross-tab gate UI state
│   │   └── vehicleStore.ts               # Active vehicle inside (timer state)
│   │
│   ├── schemas/
│   │   ├── walkIn.ts                     # Zod schema for walk-in registration
│   │   └── completionNote.ts
│   │
│   └── utils/
│       ├── url.ts                        # _getWorkingUrl logic
│       ├── date.ts                       # Duration, formatting helpers
│       ├── workflow.ts                   # State color & icon mapping
│       └── qr.ts                         # Strip URL prefix from QR
│
├── constants/
│   ├── theme.ts                          # primaryColor, secondaryAccent, etc.
│   ├── checkInTypes.ts                   # CheckInType enum
│   ├── workflowStates.ts                 # All workflow states + colors
│   └── transportModes.ts                 # On Foot / Vehicle / Motor Bike
│
├── assets/
│   ├── sounds/
│   │   ├── submit.mp3
│   │   └── error.mp3
│   └── icons/
│
├── global.css
├── tailwind.config.js
├── babel.config.js
├── metro.config.js
├── app.json
├── eas.json
└── package.json
```

---

## 3. Navigation architecture

### Root layout — `app/_layout.tsx`

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
      <Toast />
    </QueryClientProvider>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

### Root index redirect — `app/index.tsx`

```tsx
// Reads cookie + instanceurl from AsyncStorage
// If both present → <Redirect href="/(app)/gate" />
// Else → <Redirect href="/login" />
```

### Auth-protected layout — `app/(app)/_layout.tsx`

Verifies cookie present in cookie store; redirects to `/login` if not. Renders a single `Stack` containing the tabbed gate area:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Screen name="gate" />
</Stack>
```

### Gate tab navigator — `app/(app)/gate/_layout.tsx`

The Flutter app uses a `TabController` with two tabs (Gate, Summary). In Expo Router this is a `MaterialTopTabs` navigator OR a simple custom toggle — the Flutter visual is a top tab bar inside the AppBar. Use `@react-navigation/material-top-tabs` if you want the same swipe-between-tabs behavior; otherwise build a custom top tab bar component.

```tsx
// Using material-top-tabs (recommended for 1:1 fidelity)
import { withLayoutContext } from 'expo-router';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';

const { Navigator } = createMaterialTopTabNavigator();
const MaterialTopTabs = withLayoutContext(Navigator);

export default function Layout() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: theme.primaryColor }}>
      <Header title="Security Gate Management" />
      <MaterialTopTabs
        screenOptions={{
          tabBarStyle: { backgroundColor: theme.primaryColor },
          tabBarActiveTintColor: 'white',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.7)',
          tabBarIndicatorStyle: { backgroundColor: 'white' },
        }}
      >
        <MaterialTopTabs.Screen name="index" options={{ title: 'Gate' }} />
        <MaterialTopTabs.Screen name="summary" options={{ title: 'Summary' }} />
      </MaterialTopTabs>
    </SafeAreaView>
  );
}
```

If you prefer to avoid the additional dep, build a 2-button toggle bar at the top of the screen and conditionally render Gate vs Summary in a single screen file. The 1:1 spec calls for tabs, so include them.

### QR scanner modal — `app/(app)/gate/scan.tsx`

```tsx
// In gate/_layout.tsx, register as a sibling stack entry
<Stack.Screen
  name="scan"
  options={{ presentation: 'modal', headerShown: true, title: 'Scan Work Ticket' }}
/>
```

Navigation: from the Gate tab, tapping "SCAN WORK TICKET" calls `router.push('/(app)/gate/scan')`. The scanner returns the scanned value via params or a Zustand store callback, then `router.dismiss()`.

### Typed routes

Enable in `app.json`:
```json
"experiments": { "typedRoutes": true }
```

---

## 4. Authentication & API layer

### Login flow (mirrors Flutter `_getWorkingUrl` + `apiService.login`)

The Flutter app accepts a partial URL (e.g. `kaitet`) and resolves it to a working full URL (e.g. `https://kaitet.upande.com`) by trying common patterns. The RN spec must do the same.

**`lib/utils/url.ts`** — replicate `_getWorkingUrl`:

```typescript
const URL_CANDIDATES = (input: string): string[] => {
  const trimmed = input.trim().replace(/\/$/, '');
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return [trimmed];
  }
  return [
    `https://${trimmed}`,
    `https://${trimmed}.upande.com`,
    `https://${trimmed}.frappe.cloud`,
    `http://${trimmed}`,
  ];
};

export async function getWorkingUrl(input: string): Promise<string | null> {
  const candidates = URL_CANDIDATES(input);
  for (const url of candidates) {
    try {
      // Frappe ping endpoint
      const res = await fetch(`${url}/api/method/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) return url;
    } catch {
      continue;
    }
  }
  return null;
}
```

**`lib/api/auth.ts`** — `login`:

```typescript
import axios from 'axios';
import CookieManager from '@react-native-cookies/cookies';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getWorkingUrl } from '../utils/url';

export async function login(email: string, password: string, urlInput: string) {
  const fullUrl = await getWorkingUrl(urlInput);
  if (!fullUrl) throw new Error('Could not reach the instance URL');

  // Frappe expects form-encoded login
  const formData = new URLSearchParams();
  formData.append('usr', email);
  formData.append('pwd', password);

  const res = await axios.post(`${fullUrl}/api/method/login`, formData.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    withCredentials: true,
  });

  // Capture cookie from response
  const cookies = await CookieManager.get(fullUrl);
  const sid = cookies.sid?.value;
  const userId = cookies.user_id?.value;
  if (!sid) throw new Error('Login succeeded but no session cookie returned');

  // Persist instance URL and the raw cookie string for header reuse
  await AsyncStorage.setItem('instanceurl', fullUrl);
  await AsyncStorage.setItem('cookie', `sid=${sid}; user_id=${userId}`);
  await AsyncStorage.setItem('user_email', email);

  return { fullUrl, sid, userId, message: res.data.message };
}

export async function logout() {
  await CookieManager.clearAll();
  await AsyncStorage.multiRemove(['instanceurl', 'cookie', 'user_email']);
}
```

### Axios client — `lib/api/client.ts`

```typescript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const api = axios.create({ timeout: 30000 });

api.interceptors.request.use(async (config) => {
  const baseURL = await AsyncStorage.getItem('instanceurl');
  const cookie = await AsyncStorage.getItem('cookie');
  if (!baseURL) throw new Error('No instance URL configured');
  if (!cookie) throw new Error('Authentication Error: No cookies found');

  config.baseURL = baseURL;
  config.headers.Cookie = cookie;
  config.headers['Content-Type'] = config.headers['Content-Type'] || 'application/json';
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      await AsyncStorage.multiRemove(['cookie']);
      router.replace('/login');
    }
    return Promise.reject(err);
  }
);

export default api;
```

### Endpoint inventory (1:1 with Flutter `apiService`)

| Function | HTTP | Endpoint | Body / params |
|---|---|---|---|
| `fetchVisitorAppointment(query)` | POST | `/api/method/getVisitorAppointment` | `{ query }` |
| `fetchStaffEmployee(query)` | POST | `/api/method/getStaffEmployee` | `{ query }` |
| `fetchContractorContract(query)` | POST | `/api/method/getContractorContract` | `{ query }` |
| `fetchAppointmentDoc(name)` | GET | `/api/resource/Appointment/{name}` | — |
| `getEmployeeName(employeeId)` | GET | `/api/resource/Employee/{employeeId}?fields=["employee_name"]` | — |
| `searchEmployees(query)` | GET | `/api/resource/Employee?filters=...&fields=...&limit_page_length=20&order_by=employee_name asc` | filter on `employee_name like %query%` AND `status = Active` |
| `setAppointmentClosed(name)` | PUT | `/api/resource/Appointment/{name}` | `{ status: "Closed" }` |
| `updateAppointmentStatus({...})` | PUT | `/api/resource/Appointment/{name}` | `custom_mode_of_transport`, `custom_vehicles_number_plate`, `custom_vehicles_colour`, `custom_reporting_status`, optional `custom_check_in_time`, `custom_check_out_time` |
| `runWorkflowAction({name, action})` | POST | `/api/method/frappe.model.workflow.apply_workflow` | `{ doc: <full Appointment doc as JSON string>, action }` (note: doc must be fetched first via `fetchAppointmentDoc`) |
| `createAppointment({...})` | POST | `/api/resource/Appointment` | `customer_name`, `customer_phone_number`, `customer_email`, `custom_meet_with`, `scheduled_time`, `customer_details`, `custom_mode_of_transport`, `status: "Open"`, optional vehicle fields |
| `fetchDailySummary({date})` | GET | `/api/resource/Appointment?filters=...&fields=...&limit_page_length=200&order_by=custom_check_in_time desc` | Filter `scheduled_time between [00:00:00, 23:59:59]` |
| `fetchTractorDailyTask(name)` | GET | `/api/resource/Tractor%20Daily%20Task/{name}` | — |
| `recordTractorGateEntry({name, entryTime, farm})` | PUT | `/api/resource/Tractor%20Daily%20Task/{name}` | `custom_gate_entry_time`, `custom_gate_entry_farm`, `custom_gate_status: "Inside"` |
| `recordTractorGateExit({name, exitTime, completionNote})` | PUT | `/api/resource/Tractor%20Daily%20Task/{name}` | `custom_gate_exit_time`, `custom_completion_note`, `custom_gate_status: "Exited"` |
| `updateTractorDailyTask({name, data})` | PUT | `/api/resource/Tractor Daily Task/{name}` | arbitrary partial update |

### Workflow action mapping

The Flutter `BLoC` events map to these workflow actions on the Appointment doc:

| Flutter event | Workflow action | Resulting state |
|---|---|---|
| `ConfirmGateCheckIn` | Update fields then run `Check In` action OR set `workflow_state = "Visitor Checked In"` directly with `custom_check_in_time = now` | `Visitor Checked In` |
| `ConfirmGateCheckOut` | Run `Check Out` action with `custom_check_out_time = now` | `Visitor Checked Out` |
| `SendToSecretary` | Run `Send to Secretary` action | `Pending Secretary Review` |

Look at the actual Frappe workflow definition on `Appointment` to confirm action names. The RN code should mirror Flutter's behavior: fetch the full doc, then POST to `apply_workflow` with `doc` (stringified JSON) + `action`.

---

## 5. DocTypes & custom API methods

These already exist on the Kaitet instance (the Flutter app uses them as-is). The RN app does NOT create any new DocTypes — it only consumes them.

### `Appointment` DocType (existing, with custom fields)

| Field | Type | Notes |
|---|---|---|
| `name` | Data (auto) | Document name |
| `customer_name` | Data | Visitor's name |
| `customer_phone_number` | Data | Phone |
| `customer_email` | Data | Email (use `{phone}@walkin.gate` for walk-ins without email) |
| `custom_meet_with` | Link → Employee | Host employee ID |
| `host_name` | Data | Host's display name (often denormalized) |
| `scheduled_time` | Datetime | Scheduled appointment time |
| `customer_details` | Long Text | Used as the **purpose** of visit |
| `status` | Select | `Open`, `Closed`, etc. (Frappe core field) |
| `workflow_state` | Select | See workflow states below |
| `custom_mode_of_transport` | Select | `On Foot`, `Vehicle`, `Motor Bike` |
| `custom_vehicles_number_plate` | Data | Vehicle reg |
| `custom_vehicles_colour` | Data | Vehicle colour |
| `custom_reporting_status` | Data | Mirrors workflow state on update |
| `custom_check_in_time` | Datetime | Set on check-in |
| `custom_check_out_time` | Datetime | Set on check-out |
| `custom_number_of_passengers` | Int | Passengers excluding driver |

### `Employee` DocType (existing core ERPNext)

Used for host search. Fields read by the app:
- `name` (employee ID, e.g. `EMP-0023`)
- `employee_name`
- `designation`
- `department`
- `status` (filtered to `Active`)

### `Tractor Daily Task` DocType (existing, with custom fields)

| Field | Type | Notes |
|---|---|---|
| `name` | Data (auto) | Encoded in QR code |
| `motor_vehicle` | Link → Vehicle | Vehicle reg / display |
| `farm` | Link → Farm | Farm where work is being done |
| `operator` | Link → Employee | Operator name |
| `task` | Table | Child rows with `activity_type` |
| `custom_gate_entry_time` | Datetime | Set when gate scans on entry |
| `custom_gate_entry_farm` | Data | Farm at entry (snapshot) |
| `custom_gate_exit_time` | Datetime | Set on exit |
| `custom_completion_note` | Long Text | Required at exit |
| `custom_gate_status` | Select | `Inside` / `Exited` |

### Custom Frappe API methods (already deployed on Kaitet)

| Method | Purpose | Request | Response shape |
|---|---|---|---|
| `getVisitorAppointment` | Server-side fuzzy search for visitor by name/ID/phone, returns single best appointment match for today | `POST { query }` | `{ message: { has_appointment, visitor_name, id_no, phone_number, organization, host_name, scheduled_time, purpose, transport_mode, vehicle_reg_no, vehicle_color, name, status } }` |
| `getStaffEmployee` | Lookup staff by ID | `POST { query }` | `{ message: { full_name, employee_id, ... } }` |
| `getContractorContract` | Lookup active contractor contract | `POST { query }` | `{ message: { contract_name, contractor_name, ... } }` |

**Standard Frappe methods used:**
- `frappe.model.workflow.apply_workflow` — runs a workflow transition

The RN dev does not need to create or modify any of these on the server.

---

## 6. State machine & workflow

### Appointment workflow states (from `_stateColor` / `_stateIcon` in Flutter)

| State | Color | Icon | Meaning |
|---|---|---|---|
| `Open` | (default teal) | `fiber_new` | Newly created or scheduled appointment, not yet acted on |
| `Pending Secretary Review` | orange | `hourglass_top` | Sent for secretary to review |
| `Approved by Secretary` | green | `check_circle` | Secretary approved |
| `Rescheduled by Secretary` | blue | `schedule` | Secretary changed timing |
| `Redirected to Another Host` | purple | `alt_route` | Secretary redirected to a different host |
| `Rejected by Secretary` | red | `cancel` | Secretary rejected |
| `Visitor Checked In` | teal | `login` | At gate, visitor entered |
| `Visitor Checked Out` | grey | `logout` | At gate, visitor exited |

Map these in `constants/workflowStates.ts`:

```typescript
import {
  HourglassEmpty, CheckCircle, Schedule, AltRoute, Cancel, Login, Logout, FiberNew
} from '@expo/vector-icons/MaterialIcons';

export const WORKFLOW_META: Record<string, { color: string; icon: string }> = {
  'Open':                          { color: '#26A69A', icon: 'fiber-new' },
  'Pending Secretary Review':      { color: '#FB8C00', icon: 'hourglass-top' },
  'Approved by Secretary':         { color: '#43A047', icon: 'check-circle' },
  'Rescheduled by Secretary':      { color: '#1E88E5', icon: 'schedule' },
  'Redirected to Another Host':    { color: '#8E24AA', icon: 'alt-route' },
  'Rejected by Secretary':         { color: '#E53935', icon: 'cancel' },
  'Visitor Checked In':            { color: '#00897B', icon: 'login' },
  'Visitor Checked Out':           { color: '#9E9E9E', icon: 'logout' },
};
```

### Vehicle gate states

Stored in `Tractor Daily Task.custom_gate_status`:
- `(empty / null)` — never been to gate today
- `Inside` — currently inside, timer running
- `Exited` — completed today's run

---

## 7. Screen specifications

---

### Screen 0 — Login
**Route:** `/login`
**File:** `app/login.tsx`

**Purpose:** Authenticate the gate user against the Frappe instance.

**Header:** None (custom logo + title in body).

**Content:**
- App logo + "Security Gate Management" title
- **Instance URL** input (Data) — accepts short form like `kaitet` or full `https://...`
- **Email** input (Data, email keyboard)
- **Password** input (Data, secure)
- **LOGIN** button (primary)
- Error message area below the button

**Logic:**
1. On submit, validate fields are non-empty
2. Call `getWorkingUrl(urlInput)` — try candidate URLs in order, take first that responds to `/api/method/ping`
3. If null → show "Could not reach the instance URL"
4. Call `POST {fullUrl}/api/method/login` with `usr` + `pwd` form-encoded
5. On success, capture `sid` cookie via `CookieManager.get(fullUrl)`, persist `instanceurl` + `cookie` strings to AsyncStorage
6. `router.replace('/(app)/gate')`

**Data fetched:** `/api/method/ping` (probe), `/api/method/login` (auth)

**Data posted:**
```
POST /api/method/login
Content-Type: application/x-www-form-urlencoded

usr=user@example.com&pwd=xxxxx
```

**Validation (Zod):**
```typescript
z.object({
  url: z.string().min(1, 'Instance URL required'),
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
})
```

**Navigation:**
- Successful login → `router.replace('/(app)/gate')`

---

### Screen 1 — Gate (Tab 1)
**Route:** `/(app)/gate`
**File:** `app/(app)/gate/index.tsx`

**Purpose:** The main check-in workspace. Replicates `_buildGateTab()` from Flutter exactly.

**Header (shared with Tab 2 from layout):**
- Title: "Security Gate Management"
- Back arrow → `router.back()` (or `logout` action menu)
- Top tabs: **Gate** (active) | **Summary**

**Body — wrapped in a single Card with rounded corners and elevation:**

#### 1. Header selectors (chip row)

Horizontal scrollable row of `ChoiceChip`s, one per `CheckInType`:
- `VISITOR`
- `STAFF`
- `CONTRACTOR`
- `COMPANYVEHICLE`

Tapping a chip:
1. Sets `selectedType` in local state
2. Calls `clearForm()` (resets all fields and cached data)

#### 2. Search bar (hidden when type === companyVehicle)

```tsx
<TextInput
  value={searchQuery}
  onChangeText={setSearchQuery}
  placeholder={`Search ${selectedType.toUpperCase()} (ID/Name)`}
  onSubmitEditing={onManualSearch}
  rightIcon={<SearchIcon onPress={onManualSearch} />}
/>
```

**Logic on `onManualSearch()`:**
1. Empty query → show warning snackbar "Please enter a search query"
2. Set `loading=true`, hide previous search result
3. Branch by `selectedType`:
   - `visitor` → call `fetchVisitorAppointment(query)` via `useVisitorSearch` mutation
   - `staff` → `fetchStaffEmployee(query)`
   - `contractor` → `fetchContractorContract(query)`

#### 3. Search result rendering (visitor only)

After search completes, if `selectedType === visitor && showSearchResult`:

**If `searchResult.has_appointment === true` → render `<FoundResultCard>`:**
- Green-tinted card with calendar icon
- Visitor name (bold, 16pt)
- Subtitle: `Phone: {phone}\nVisiting: {host}\nScheduled: {time}\nPurpose: {purpose}`
- Status badge top-right with `searchResult.status`
- Full-width **PROCEED** button → calls `onProceed(searchResult)` which:
  1. Sets `selectedAppointment = searchResult`
  2. Pre-fills all visitor form fields from the appointment
  3. Calls `fetchAppointmentWorkflowState(appt.name)` via React Query to load current `workflow_state`
- Below card: **"Different visit? Register as new walk-in"** text button (orange, person_add icon) — converts to walk-in mode

**If `searchResult.has_appointment === false` → render `<NoAppointmentCard>`:**
- Orange-tinted card
- Info icon, "NO APPOINTMENT FOUND" text
- Full-width **REGISTER AS WALK-IN** button (secondary accent color) — sets `isWalkIn=true`

#### 4. Walk-in section (when `isWalkIn === true`)

- Header row: person_add icon (orange), "Register Walk-In Visitor" title, close button on the right
- Divider
- `<VisitorForm>` (see below)
- **SAVE & CHECK IN** button (full width, green, save icon) → calls `onCreateWalkIn()`

#### 5. Visitor form (rendered when appointment selected OR walk-in mode)

```
[Full Name]                              (TextInput, person icon)
[ID / Ref]    [Phone]                    (Two TextInputs in a row)
[Mode of Transport ▾]                    (Dropdown: On Foot/Vehicle/Motor Bike)

# If transport != 'On Foot':
[Number Plate]                           (TextInput)
[Vehicle Colour]                         (TextInput)
[Number of Passengers (excl. driver)]    (Numeric input)

[Person to Visit *]                      (HostSearchField — see below)
[Purpose]                                (Multiline TextInput, max 2 lines)
```

#### 6. Host search field (`<HostSearchField>`)

Mirrors `_buildHostSearchField()` from Flutter:

- TextInput labeled "Person to Visit *", search icon on right
- Read-only when a host is already selected; clear icon (×) shown to deselect
- On `onChangeText` with length ≥ 2, debounce ~250ms then call `searchEmployees(query)` (filters Active employees by `employee_name like %query%`, limit 20)
- Below input: if a host is selected, show a green pill with their name + employee ID
- Below input: if results exist and no host selected, show a dropdown ListView (max height 200, elevated shadow):
  - Each result: avatar circle (initial), employee name (bold), designation • department subtitle, employee ID on right
  - Tapping a result populates `selectedHostId`, `selectedHostName`, fills the input, dismisses the dropdown

#### 7. Action buttons (`<ActionButtons>`)

Conditionally rendered when `selectedAppointment != null` OR `selectedType === staff`.

**State branches:**
1. `currentWorkflowState === null` (still loading) → show small centered spinner
2. `currentWorkflowState === 'Visitor Checked Out'` → show `<StatusChip state="Visitor Checked Out" />` only
3. `currentWorkflowState === 'Open'` → show full-width **CHECK IN** button (green, login icon) → calls `onCheckIn()`
4. Any other state → show full-width **CHECK OUT** button (red, logout icon) → calls `onCheckOut()`, plus a `<StatusChip>` of the current state below it

**`<StatusChip>`:** rounded container with state's color (10% opacity background, 30% opacity border), state icon + label centered.

#### 8. Vehicle action (companyVehicle type only — `<VehicleScanAction>`)

**If `vehicleInside === true && ticketData != null`:**
- Render `<VehicleInsideCard>` (see below)

**Else:**
- Big full-width **SCAN WORK TICKET** button (60pt tall, secondary accent color, qr_code_scanner icon) → opens `/(app)/gate/scan` modal
- Below: TextInput "Or enter ticket name manually" with search icon trigger
- Both routes call `onWorkTicketScanned(value)`:
  1. Trim, strip URL prefix if it contains `/app/tractor-daily-task/` or `/`
  2. URL-decode the remaining ticket name
  3. Set `loading=true`
  4. Call `fetchTractorDailyTask(ticketName)`
  5. On success → open `<VehicleEntryDialog>`

#### 9. Vehicle entry dialog (`<VehicleEntryDialog>`)

Modal triggered after a ticket is fetched. Mirrors `_showGateEntryDialog()`.

**Header:** Agriculture icon + "Confirm Vehicle Entry"

**Body:**
- `_dialogRow` for each: Vehicle, Farm, Operator, Activity (joined unique activity_types from task child table)
- Divider
- Green info box: timer icon + "Timer starts on entry. Time is recorded to the timesheet when the vehicle exits."

**Actions:**
- **Cancel** (text button) → close, `loading=false`
- **CONFIRM ENTRY** (green, login icon) → close dialog, set `loading=true`, call `recordTractorGateEntry({name, farm, entryTime: now ISO})`. On success: `vehicleInside=true`, `gateEntryTime=entryTime`, success snackbar "Vehicle entered — timer started ✓"

#### 10. Vehicle inside card (`<VehicleInsideCard>`)

Shown while a vehicle is tracked inside. Mirrors `_buildVehicleInsideCard()`.

**Card with green border, white bg.**

- **Header row:** agriculture icon (green, padded), vehicle name (bold) + farm (secondary text), `<LiveTimer>` on the right
- Divider
- **Activities row:** task_alt icon + comma-joined activity types
- **Entry timestamp banner:** green-tinted strip "Entered at HH:mm, dd MMM"
- **Completion Note ***" label
- Multiline TextInput (2 lines, hint "e.g. Avocado transportation — 54ha covered")
- **TASK COMPLETE — CHECK OUT** button (full width, red, logout icon, 52pt tall) → calls `onVehicleCheckOut()`:
  1. Validate completion note non-empty (else warning snackbar)
  2. Set `loading=true`, call `recordTractorGateExit({name, exitTime: now ISO, completionNote})`
  3. On success: reset all vehicle state, success snackbar, refresh summary if on that tab

#### 11. `<LiveTimer>` component

Receives `entryTime: Date` prop. Uses a 1-second `setInterval` to update elapsed duration.

```tsx
function LiveTimer({ entryTime }: { entryTime: Date }) {
  const [elapsed, setElapsed] = useState(() => Date.now() - entryTime.getTime());
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - entryTime.getTime()), 1000);
    return () => clearInterval(id);
  }, [entryTime]);
  const h = Math.floor(elapsed / 3_600_000);
  const m = Math.floor((elapsed / 60_000) % 60);
  const s = Math.floor((elapsed / 1000) % 60);
  const label = h > 0
    ? `${h}h ${String(m).padStart(2, '0')}m`
    : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return (
    <View className="flex-row items-center bg-green-600 rounded-full px-2.5 py-1.5">
      <TimerIcon size={14} color="white" />
      <Text className="text-white text-[13px] font-bold ml-1" style={{ fontVariant: ['tabular-nums'] }}>
        {label}
      </Text>
    </View>
  );
}
```

#### 12. Loading overlay

When `loading === true`, render a full-screen translucent overlay with a centered spinner (mirrors the Flutter `Loader` stack overlay).

#### Data fetched on this screen

| Trigger | Endpoint |
|---|---|
| Manual visitor search | `POST /api/method/getVisitorAppointment` |
| Manual staff search | `POST /api/method/getStaffEmployee` |
| Manual contractor search | `POST /api/method/getContractorContract` |
| Tap PROCEED on found appointment | `GET /api/resource/Appointment/{name}` (to get current `workflow_state`) |
| Host search (debounced) | `GET /api/resource/Employee?filters=...&fields=...` |
| Scan/enter ticket | `GET /api/resource/Tractor%20Daily%20Task/{name}` |

#### Data posted on this screen

| Action | Endpoint | Body |
|---|---|---|
| Check in (visitor or walk-in) | `PUT /api/resource/Appointment/{name}` then `POST /api/method/frappe.model.workflow.apply_workflow` | Update fields then transition workflow to "Visitor Checked In" with `custom_check_in_time = now` |
| Check out | Same pattern | Transition to "Visitor Checked Out" with `custom_check_out_time = now` |
| Create walk-in | `POST /api/resource/Appointment` | All visitor fields + `status: "Open"` |
| Send to secretary | `POST /api/method/frappe.model.workflow.apply_workflow` | action: "Send to Secretary" |
| Vehicle entry | `PUT /api/resource/Tractor%20Daily%20Task/{name}` | `custom_gate_entry_time`, `custom_gate_entry_farm`, `custom_gate_status: "Inside"` |
| Vehicle exit | `PUT /api/resource/Tractor%20Daily%20Task/{name}` | `custom_gate_exit_time`, `custom_completion_note`, `custom_gate_status: "Exited"` |

#### Sound + haptic feedback (`useFeedback` hook)

| Event | Effect |
|---|---|
| Success snackbar | Play `submit.mp3` via expo-av |
| Error snackbar | Play `error.mp3` via expo-av |
| Warning snackbar | `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)` |

#### Form clearing (`clearForm()`)

Resets ALL state to initial values:
- `searchResult`, `selectedAppointment`, `showSearchResult`, `isWalkIn`, `currentWorkflowState`, `selectedHostId`, `selectedHostName`, `employeeResults`, `showEmployeeDropdown`, `numberOfPassengers` → initial
- All TextInput controllers → empty strings
- `transportMode` → `'On Foot'`
- Vehicle gate state → all null/false
- Dismiss keyboard

---

### Screen 2 — Summary (Tab 2)
**Route:** `/(app)/gate/summary`
**File:** `app/(app)/gate/summary.tsx`

**Purpose:** Today's gate activity dashboard. Mirrors `_buildSummaryTab()`.

**Header:** Same as Screen 1 (shared layout).

**Logic on mount:**
- If `dailySummary` is empty AND tab is selected, fetch via `useDailySummary` hook (which calls `fetchDailySummary()`)

**Empty state:**
- Centered dashboard icon (grey)
- **Load Today's Summary** button (refresh icon) → triggers fetch

**Loaded state:**

#### 1. Title
"Gate Activity — Friday, 17 April 2026" (using `date-fns` `format(date, 'EEEE, d MMMM yyyy')`)

#### 2. Stat cards (2×2 grid)

```
[Checked In: 24] (green, login)    [Checked Out: 18] (red, logout)
[Inside: 6] (blue, person_pin)     [Total: 24] (grey, people)
```

Each is a `<StatCard>`:
- Card with elevation, rounded 12px corners
- Icon (28pt, color)
- Value (28pt, bold, color)
- Label (12pt, grey)

Computations:
```typescript
const totalIn = summary.total_checked_in ?? 0;
const totalOut = summary.total_checked_out ?? 0;
const stillInside = summary.still_inside ?? 0;
const allDocs = summary.all ?? [];
```

#### 3. "Currently on Premises" section (only if `still_inside_list.length > 0`)

- Blue-tinted header: person_pin icon + "Currently on Premises (N)"
- For each entry in `still_inside_list`, render `<InsideCard>`:
  - Card with blue-tinted left border
  - **Top row:** person_pin icon, name (bold), phone (subtitle), live duration pill on right (computed via `getDuration(custom_check_in_time)`)
  - **Bottom row:** state icon + state label (colored), entry time, transport mode, passengers count (deepPurple "+N pax")

#### 4. "Today's Activity Log" section (if `all.length > 0`)

- Header: "Today's Activity Log"
- For each entry, render `<ActivityRow>` — an ExpansionTile-equivalent (use `react-native-collapsible`):
  - **Background:** grey if checked out, blue-tinted if currently inside, orange-tinted if not yet checked in
  - **Left border:** colored 3px stripe matching workflow state color
  - **Tile header:**
    - State icon (left, colored)
    - Name (bold)
    - Subtitle row: state pill (small), passenger count "+N", spacer, "In HH:mm → Out HH:mm" or just "In HH:mm" plus duration pill or "INSIDE" label
  - **Expanded content:**
    - Detail rows (each `_dRow`): Phone, Host, Transport, Passengers, Purpose, Check-in, Check-out, Duration
    - **Workflow trail box** (grey-tinted):
      - Title "Workflow trail"
      - Vertical timeline of states this appointment passed through (built by `_buildTrail`)
      - Each step: check_circle (past) or radio_button_checked (current) icon, vertical line connector, step label

#### 5. Pull-to-refresh

`RefreshIndicator` (in RN: `RefreshControl` on the ScrollView) → re-fetches `dailySummary`.

#### Data fetched

```typescript
GET /api/resource/Appointment
  ?filters=[["Appointment","scheduled_time","between",["2026-04-17 00:00:00","2026-04-17 23:59:59"]]]
  &fields=["name","customer_name","customer_phone_number","custom_meet_with",
           "workflow_state","custom_reporting_status","custom_check_in_time",
           "custom_check_out_time","scheduled_time","custom_mode_of_transport",
           "custom_vehicles_number_plate","custom_vehicles_colour","customer_details"]
  &limit_page_length=200
  &order_by=custom_check_in_time desc
```

Then locally compute (to mirror Flutter's `DailySummaryLoaded` shape):
```typescript
const all = response.data;
const checkedIn = all.filter(a => a.custom_check_in_time);
const checkedOut = all.filter(a => a.custom_check_out_time);
const stillInside = checkedIn.filter(a => !a.custom_check_out_time);

const summary = {
  total_checked_in: checkedIn.length,
  total_checked_out: checkedOut.length,
  still_inside: stillInside.length,
  still_inside_list: stillInside,
  all,
};
```

#### Helpers

`getDuration(checkInTime)`:
```typescript
function getDuration(iso?: string): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff / 60_000) % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch { return ''; }
}
```

`fmtTime(iso)` → `format(parseISO(iso), 'HH:mm')`
`fmtDateTime(iso)` → `format(parseISO(iso), 'HH:mm, dd MMM')`

---

### Screen 3 — QR Scanner (modal)
**Route:** `/(app)/gate/scan`
**File:** `app/(app)/gate/scan.tsx`

**Purpose:** Scan a `Tractor Daily Task` QR code.

**Presentation:** Modal (set `presentation: 'modal'` on the route).

**Header:** Modal header with X close button + title "Scan Work Ticket".

**Content:**
- Full-screen `<CameraView>` from `expo-camera` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`
- Overlay frame (rounded square cutout) centered
- "Position QR code in the frame" text below the frame

**Logic:**
1. On mount, request camera permission via `useCameraPermissions()`
2. If denied → show "Camera permission required" + "Open Settings" button → `Linking.openSettings()`
3. On `onBarcodeScanned({data})`:
   - Trigger `Haptics.notificationAsync(Success)`
   - Pass result back to Gate screen via Zustand store callback OR `router.setParams` then `router.dismiss()`
   - The Gate screen's effect picks it up and calls `onWorkTicketScanned(data)`

**Returning the result (Zustand approach — preferred):**
```typescript
// gateStore
{
  pendingScannedTicket: string | null,
  setPendingScannedTicket: (v: string | null) => void
}

// In scan.tsx onBarcodeScanned:
gateStore.setPendingScannedTicket(data);
router.dismiss();

// In gate/index.tsx useEffect:
const ticket = gateStore(s => s.pendingScannedTicket);
useEffect(() => {
  if (ticket) {
    onWorkTicketScanned(ticket);
    gateStore.setPendingScannedTicket(null);
  }
}, [ticket]);
```

---

## 8. Data flows & React Query keys

### Convention

| Key pattern | Used by |
|---|---|
| `['visitor-search', query]` | `fetchVisitorAppointment` (mutation, not cached) |
| `['staff-search', query]` | `fetchStaffEmployee` (mutation) |
| `['contractor-search', query]` | `fetchContractorContract` (mutation) |
| `['employee-search', query]` | `searchEmployees` (debounced query, 5min staleTime) |
| `['appointment', name]` | `fetchAppointmentDoc` |
| `['appointment-workflow', name]` | Derived from `appointment` query (just reads `workflow_state`) |
| `['vehicle-ticket', name]` | `fetchTractorDailyTask` |
| `['daily-summary', dateString]` | `fetchDailySummary` (5min staleTime) |

### Mutation invalidation

| Mutation | Invalidate |
|---|---|
| `confirmCheckIn(name)` | `['appointment', name]`, `['daily-summary']` |
| `confirmCheckOut(name)` | Same |
| `createWalkIn` | `['daily-summary']` |
| `recordVehicleEntry(name)` | `['vehicle-ticket', name]`, `['daily-summary']` |
| `recordVehicleExit(name)` | Same |
| `sendToSecretary(name)` | `['appointment', name]` |

### Zustand stores

**`authStore`:**
```typescript
{
  user: { email: string, userId: string } | null,
  instanceUrl: string | null,
  isAuthenticated: boolean,
  hydrate: () => Promise<void>,    // Read from AsyncStorage on app boot
  login: (url, email, pwd) => Promise<void>,
  logout: () => Promise<void>,
}
```

**`gateStore`:**
```typescript
{
  selectedType: CheckInType,
  pendingScannedTicket: string | null,
  setSelectedType: (t) => void,
  setPendingScannedTicket: (v) => void,
}
```

**`vehicleStore`:** (persists across tab switches)
```typescript
{
  ticketName: string | null,
  ticketData: TractorDailyTask | null,
  gateEntryTime: string | null,    // ISO
  vehicleInside: boolean,
  setVehicleInside: (data) => void,
  clearVehicle: () => void,
}
```

---

## 9. QR scanner specifics

### QR payload formats handled

The Flutter `_onWorkTicketScanned` accepts three formats:

1. **Plain ticket name:** `TDT-2026-0123` → use as-is
2. **Frappe URL:** `https://kaitet.upande.com/app/tractor-daily-task/TDT-2026-0123` → split on `/app/tractor-daily-task/` and decode the last segment
3. **Generic URL:** any other URL → take the last path segment after `/`, URL-decode

```typescript
// utils/qr.ts
export function extractTicketName(raw: string): string {
  let v = raw.trim();
  if (!v) return '';
  if (v.includes('/app/tractor-daily-task/')) {
    return decodeURIComponent(v.split('/app/tractor-daily-task/').pop()!);
  }
  if (v.includes('/')) {
    return decodeURIComponent(v.split('/').pop()!);
  }
  return v;
}
```

### Permissions

`app.json`:
```json
{
  "expo": {
    "plugins": [
      ["expo-camera", { "cameraPermission": "Allow $(PRODUCT_NAME) to scan vehicle work tickets." }]
    ]
  }
}
```

### iOS `Info.plist` (auto-injected by plugin):
- `NSCameraUsageDescription`

### Android (auto-injected):
- `android.permission.CAMERA`

---

## 10. Build & deployment checklist

### Pre-build configuration

- [ ] `app.json`:
  ```json
  {
    "expo": {
      "name": "Kaitet Gate",
      "slug": "kaitet-gate",
      "scheme": "kaitetgate",
      "ios": { "bundleIdentifier": "com.upande.kaitetgate" },
      "android": { "package": "com.upande.kaitetgate" },
      "plugins": [
        "expo-router",
        ["expo-camera", { "cameraPermission": "Allow Kaitet Gate to scan work tickets." }]
      ],
      "experiments": { "typedRoutes": true }
    }
  }
  ```

- [ ] `tailwind.config.js`:
  ```js
  module.exports = {
    content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
      extend: {
        colors: {
          primary: '#YOUR_PRIMARY',          // mirror AppTheme.primaryColor
          accent: '#YOUR_SECONDARY_ACCENT',   // mirror AppTheme.secondaryAccent
        }
      }
    },
    plugins: []
  };
  ```

- [ ] `babel.config.js`:
  ```js
  module.exports = function (api) {
    api.cache(true);
    return {
      presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
      plugins: ["react-native-reanimated/plugin"]
    };
  };
  ```

- [ ] `metro.config.js`:
  ```js
  const { getDefaultConfig } = require("expo/metro-config");
  const { withNativeWind } = require("nativewind/metro");
  const config = getDefaultConfig(__dirname);
  module.exports = withNativeWind(config, { input: "./global.css" });
  ```

- [ ] Copy `submit.mp3` and `error.mp3` from the existing Flutter app's `assets/` into `assets/sounds/`

### Backend assumptions (already in place on Kaitet)

- [ ] `Appointment` DocType has all `custom_*` fields listed in section 5
- [ ] Workflow on `Appointment` includes states: `Open`, `Pending Secretary Review`, `Approved by Secretary`, `Rescheduled by Secretary`, `Redirected to Another Host`, `Rejected by Secretary`, `Visitor Checked In`, `Visitor Checked Out`
- [ ] Workflow transitions: `Send to Secretary`, `Check In`, `Check Out` (verify exact action names with the existing Flutter app's BLoC events)
- [ ] Custom methods exist and are whitelisted: `getVisitorAppointment`, `getStaffEmployee`, `getContractorContract`
- [ ] `Tractor Daily Task` DocType has all `custom_gate_*` fields and the `custom_completion_note` field
- [ ] Gate user has Frappe permissions: read/write on `Appointment`, read/write on `Tractor Daily Task`, read on `Employee`, ability to call workflow transitions

### Build commands

```bash
npm i -g eas-cli
eas login
eas build:configure

# Development client (recommended — supports expo-camera and other native modules)
eas build --profile development --platform android
eas build --profile development --platform ios

# Internal preview APK
eas build --profile preview --platform android

# Production
eas build --profile production --platform all
```

`eas.json`:
```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    },
    "production": {
      "autoIncrement": true
    }
  }
}
```

### Post-build smoke test

- [ ] Login with valid Kaitet credentials, then with invalid → verify error UX
- [ ] Visitor flow: search known appointment → PROCEED → CHECK IN → state flips → CHECK OUT
- [ ] Walk-in flow: search → no result → REGISTER AS WALK-IN → host search type-ahead works → SAVE & CHECK IN
- [ ] Staff flow: search by employee ID → CHECK IN → CHECK OUT
- [ ] Contractor flow: search by contract → check in/out
- [ ] Vehicle flow: scan QR → confirm dialog → entry recorded → live timer ticks → completion note required → check out clears card
- [ ] Vehicle flow: manual ticket entry as fallback
- [ ] Summary tab: stat cards correct, inside list shows live durations, activity log expands with workflow trail
- [ ] Pull-to-refresh on summary tab
- [ ] Sound + haptic feedback on success/error/warning
- [ ] Cookie persists across app restart (no re-login required)
- [ ] 401 response forces re-login

---

## Appendix A — Component-to-Flutter mapping

| RN component | Flutter equivalent |
|---|---|
| `<Loader>` | `Loader` from `cicular_loader.dart` |
| `<HeaderSelectors>` | `_buildHeaderSelectors()` |
| `<FoundResultCard>` | `_buildFoundResultCard()` |
| `<NoAppointmentCard>` | `_buildNoAppointmentCard()` |
| `<VisitorForm>` | `_buildVisitorForm()` |
| `<WalkInSection>` | `_buildWalkInSection()` |
| `<StaffForm>` | `_buildStaffForm()` |
| `<HostSearchField>` | `_buildHostSearchField()` |
| `<VehicleScanAction>` | `_buildVehicleAction()` |
| `<VehicleInsideCard>` | `_buildVehicleInsideCard()` |
| `<VehicleEntryDialog>` | `_showGateEntryDialog()` |
| `<ActionButtons>` | `_buildActionButtons()` |
| `<StatusChip>` | `_buildStatusChip()` |
| `<LiveTimer>` | `_LiveTimer` |
| `<StatCard>` | `_statCard()` |
| `<InsideCard>` | `_buildInsideCard()` |
| `<ActivityRow>` (with collapsible) | `_buildActivityRow()` ExpansionTile |
| `<WorkflowTrail>` | `_buildTrail()` |
| `<DialogRow>` | `_dialogRow()` |

## Appendix B — Workflow event-to-action mapping

| Flutter BLoC event | RN mutation function | Server effect |
|---|---|---|
| `SearchVisitorAppointment` | `useVisitorSearch.mutate(query)` | Calls `getVisitorAppointment` |
| `SearchStaffEmployee` | `useStaffSearch.mutate(query)` | Calls `getStaffEmployee` |
| `SearchContractorContract` | `useContractorSearch.mutate(query)` | Calls `getContractorContract` |
| `FetchAppointmentWorkflowState` | `useAppointment(name)` query | GET Appointment |
| `ConfirmGateCheckIn` | `useCheckIn.mutate({...})` | PUT update fields + apply_workflow |
| `ConfirmGateCheckOut` | `useCheckOut.mutate(name)` | PUT update + apply_workflow |
| `CreateWalkInAppointment` | `useCreateWalkIn.mutate({...})` | POST Appointment |
| `SearchEmployees` | `useEmployeeSearch(query)` debounced query | GET Employee with filters |
| `FetchDailySummary` | `useDailySummary()` query | GET Appointment list with date range |
| `FetchWorkTicketForGate` | `useVehicleTicket(name)` query | GET Tractor Daily Task |
| `RecordVehicleGateEntry` | `useVehicleEntry.mutate({...})` | PUT Tractor Daily Task |
| `RecordVehicleGateExit` | `useVehicleExit.mutate({...})` | PUT Tractor Daily Task |

## Appendix C — Theme tokens

Mirror the Flutter `AppTheme`:
- `primaryColor` → app bar background, accents
- `secondaryAccent` → input focus borders, scan button bg, secondary CTAs
- Success → `#43A047` (green 600)
- Error → `#E53935` (red 600)
- Warning → `#FB8C00` (orange 600)
- Info → `#1E88E5` (blue 600)

Gate workflow colors map directly to material colors (see section 6).

---

**Document version:** 1.0
**Last updated:** 17 April 2026
**For:** Kaitet / Karen Roses Security Gate Management — React Native rewrite of existing Flutter app