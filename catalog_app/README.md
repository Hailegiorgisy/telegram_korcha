# Korcha Standalone 3-Bar Showcase Bot & Seamless Mini App

Completely independent, isolated component residing in the `catalog_app/` folder. It shares the repository for version control but maintains zero code, database, or process coupling with the main Korcha app.

## Features
- **Advertisement Post Format**: Formats showcase posts matching your Telegram reference image with hero image, listing code, specifications, and delivery details.
- **Three Horizontal Action Bars**:
  1. `👟 Inflight shoes (የበረራ ጫማዎች)`
  2. `👗 Children clothes (የህፃናት ልብሶች)`
  3. `📦 Others (ሌሎች እቃዎች)`
- **Seamless Mini App (`public/index.html`)**: Pure native JavaScript (100% CSP safe, zero Babel, zero runtime eval, instant 10ms loading). Features expandable multi-photo sliders, full specifications, ETB pricing, and direct Telegram ordering.
- **In-Chat Fallbacks**: Users without the WebApp can tap inline callback buttons to receive photo galleries directly in Telegram chat.

## Standalone Configuration (.env)
```env
CATALOG_BOT_TOKEN=your_bot_token_from_botfather
PORT=3002
WEBAPP_URL=https://telegram.korcha.com.et/catalog_app
SELLER_USERNAME=Hailegiorgisy
```

## Running Independently
```bash
cd catalog_app
npm install
npm start
```

Or via PM2 on Plesk:
```bash
pm2 start ecosystem.config.cjs
```
