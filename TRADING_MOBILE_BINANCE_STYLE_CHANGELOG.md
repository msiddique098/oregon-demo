# Trading Mobile Exchange Layout Update

## Changed
- Rebuilt the user Trading page mobile layout into a tighter exchange-style screen inspired by modern crypto exchanges while keeping the Eregon/Royal theme.
- Added a mobile Spot trade surface with top market tabs, campaign strip, pair header, buy/sell segmented controls, market/order type controls, percentage slider, order book, open orders, holdings, and chart entry card.
- Added a dedicated mobile chart/graph view launched from the trading screen.
- Added large mobile price header with 24h high/low/volume summary.
- Added chart tabs, timeframe row, MA/EMA/BOLL/SAR/AVL/SUPER/VOL indicator row, and bottom Buy/Sell actions.
- Added chart zoom controls, mouse-wheel zoom, and drag-to-pan support on the candlestick chart.
- Improved desktop chart area with the same zoomable chart component.
- Default trading mode is now Spot instead of Trade-X/options.

## Files changed
- frontend/src/pages/Trading.jsx
- src/pages/Trading.jsx

## Notes
- This update does not use Binance branding or copyrighted assets. It uses a similar exchange-style information hierarchy with the app's own Eregon theme.
- No backend schema changes were needed.
- The old compiled build folders were removed to avoid stale UI being deployed accidentally.
