# Trading Mobile Binance-density Final UI Fix

Implemented in this package:

- Removed the top mobile tab bar containing Convert / Spot / Stocks / P2P / Alpha.
- Reduced mobile trading UI density to better match Binance proportions:
  - Smaller pair header
  - Smaller Buy/Sell tabs
  - Smaller order type buttons
  - Smaller form fields
  - Smaller order book text
  - Tighter spacing and gutters
  - Lower button heights
- Reworked full-screen chart page layout:
  - Compact header
  - Compact Price / Info / Trading Data tab row
  - Timeframe row placed above the chart like Binance
  - Removed chart title chrome from analysis chart
  - Smaller chart axis text and candle strokes
  - More candles visible by default so the chart does not look zoomed-in
- Improved chart interaction:
  - Added touch handlers for two-finger pinch zoom
  - Added touch drag/pan support
  - Kept mouse wheel zoom and pointer drag support
  - Candle width changes with zoom level
  - Zoom level persists in localStorage
- Business logic and API endpoints were not modified.

Updated files:

- frontend/src/pages/Trading.jsx
- src/pages/Trading.jsx
