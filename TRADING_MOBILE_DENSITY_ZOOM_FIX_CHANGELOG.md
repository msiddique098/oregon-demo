# Trading Mobile Density + Chart Zoom Fix

## Changes

- Reduced mobile trading typography, button heights, input heights, gaps, and chart-page header sizing so the layout feels closer to Binance mobile density instead of being oversized.
- Tightened the mobile order-book column and trade form spacing to fit more content above the fold.
- Reduced the graph page price header and statistics area so the candlestick chart gets more usable space.
- Added real mobile pinch-to-zoom support for the SVG candlestick chart.
- Added pointer-based drag-to-pan with safe offset clamping.
- Improved mouse/touchpad wheel zoom and zoom buttons by keeping offsets clamped after every zoom change.
- Applied the same Trading.jsx to both `frontend/src/pages/Trading.jsx` and `src/pages/Trading.jsx`.
- Removed stale build folders from the zip so old mobile UI is not reused accidentally.
