# 🌿 PlasticTrack

**PlasticTrack** is a robust, community-driven sustainability React Native application designed to incentivize recycling and track plastic footprints across residential societies. 

Built using Expo and React Native, the application securely maps residents to their authorized Housing Societies, computes individual vs. societal eco-trends, and facilitates community-wide environmental action through a beautifully gamified interface!

---

## 🚀 Key Features

### User Experience (Residents)
- **First-Launch Onboarding:** An elegant swipe-through introductory sequence for new users.
- **Smart Footprint Calculator:** Rapidly calculate the carbon/weight footprint of your daily lifestyle simply by inputting plastic item usage.
- **Sustainability Report Card:** A personalized, automatically graded feedback hub tracking individual 4-week emission trends and assigning dynamic "Eco-Grades."
- **Society Marketplace & Vendors:** Members can schedule physical waste pickups, donating their sorted household plastics to designated vendors in exchange for points.
- **Reward Redemptions:** Utilize society points to gain discounts on local services (e.g., Water Bill Discounts, Certifications, Tax Reductions).
- **FAQ Ecosystem:** An interactive, vertically animating dropdown hub answering crucial questions.

### Admin Dashboards
- **Code Generation:** Instantly bootstrap a new 'Society' and share an automated registration code with prospective members securely.
- **Member Activity Overview:** A dedicated dashboard evaluating every society resident's footprint logging consistency relative to the current week (Active this week, Last week, Inactive, Never).
- **Community Voting (Polls):** Create polls binding to specific community parameters (e.g., "Vote for this Week's Vendor Pickup Date"). Custom tie-breaker components unlock exclusively for Admins to finalize votes.
- **Broadcast Network (Updates):** Effortlessly transmit announcements, progress goals, or upcoming events directly to every society resident. 

### Core App Intelligence
- **Normalized "Fair" Leaderboards:** Societies aren't ranked by *total* points alone, which biases older/larger groups. Instead, scores are mathematically "normalized" based on household density and registration lifespan to evaluate true *efficiency*.
- **Role-Based Isolation:** `AsyncStorage` securely enforces Admin vs Member role boundaries upon authentication, routing to completely isolated interface stacks.

---

## 🛠 Tech Stack

- **Framework:** React Native / Expo
- **Navigation:** `@react-navigation/native` (Stack & Bottom Tabs)
- **Storage:** `@react-native-async-storage/async-storage` (Simulated NoSQL persistence)
- **Icons & Graphics:** `@expo/vector-icons` & `react-native-svg`
- **Charting:** `react-native-chart-kit`

---

## 📦 Setup & Installation

Follow these steps to run the application locally on your machine.

### Prerequisites
- Node.js installed on your machine.
- Expo CLI or Expo Go app installed on your smartphone to test natively. 

### 1. Clone & Install Dependencies
Navigate into your terminal and prepare the directory:
```bash
cd fieldProject
npm install
```

### 2. Start the Metro Bundler
Boot up your environment using Expo:
```bash
npx expo start
```

### 3. Run the App
- Press `w` in your terminal to open it fluidly in a **Web Browser**.
- Press `i` to launch an **iOS Simulator** / `a` for an **Android Emulator**.
- Or, scan the **QR Code** projected in the terminal with the **Expo Go** application on your physical smartphone to interact with the camera and touch natively.

---

## 📁 Project Architecture

```
fieldProject/
├── App.js                   # Application entry point and router logic
├── src/
│   ├── components/          # Reusable UI elements (Cards, Buttons, Charts)
│   ├── context/             # Global AppContext managing authentication
│   ├── navigation/          # React Navigation stacks (Auth, MemberTab, AdminTab)
│   ├── screens/             # Screen components (Home, Calculator, Voting, Leaderboards...)
│   ├── services/            # Storage methods interacting with AsyncStorage
│   └── theme/               # Centralized style tokens (Colors, Typography)
```

---

*Thank you for contributing to a cleaner, greener planet through PlasticTrack! 🌍*
