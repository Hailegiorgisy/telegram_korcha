# Korcha Mobile App (React Native + Expo SDK)

Cross-platform Android & iOS mobile app for **Korcha (ኮርቻ)** with full feature parity with your Telegram Mini App and Web App, powered by **Expo SDK 52** and the custom **KorchaClient SDK** (`src/sdk/KorchaClient.js`).

## Features Included
- **Korcha Mobile SDK (`src/sdk/KorchaClient.js`):** Connects directly to `https://telegram.korcha.com.et` (`/api/shelf`, `/api/shelf/order`, `/api/quotes`, `/api/messages/customer`) with offline fallback.
- **Global Marketplaces & China Market:** Direct Play Store & App Store links for AliExpress, Shein, Amazon, and Pinduoduo, plus link-order quote modal.
- **3 Regional Marts Shelf:** USA Mart, Arabian Mart, and Korean Mart with category filters, multi-photo sliding carousels, 1x–3x zoom modal, and `በዚህ መደርደሪያ ላይ ዕቃ የለም። ሌላ ከፈለጉ ይምረጡ` empty state.
- **ካርት (Cart) & Direct Order:** Persistent cart (`AsyncStorage`), Telebirr/CBE payment selection, and automatic 40% deposit calculation.
- **Order Tracker & Live Chat:** Real-time order code lookup (`KC-...`) and support messaging to `@korcha_support`.

## Quick Start (Test on Your Phone in 2 Minutes)
1. Install **Expo Go** on your Android or iPhone.
2. Extract `korcha_mobile.zip` into `D:\Projects\korcha_mobile`.
3. Install dependencies and start:
   ```bash
   cd D:\Projects\korcha_mobile
   npm install
   npx expo start
   ```
4. Scan the QR code with Expo Go.

## Build Android APK / Play Store Bundle
```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```
