# Trading chart native zoom/pan fix

## What changed

- Replaced the custom SVG candlestick renderer with TradingView Lightweight Charts.
- Added `lightweight-charts` dependency to both root and frontend package files.
- Enabled the chart library's native interaction options:
  - `handleScale.mouseWheel = true`
  - `handleScale.pinch = true`
  - `handleScroll.pressedMouseMove = true`
  - `handleScroll.horzTouchDrag = true`
  - `handleScale.axisDoubleClickReset = false`
- The chart no longer uses CSS `transform: scale()` and no longer simulates zoom by slicing a custom visible array.
- Zoom now changes the actual time-scale visible logical range and bar spacing internally through Lightweight Charts.
- Added native candlestick, line, volume histogram, MA(7), MA(25), and RSI(6) series.
- Synchronized the RSI panel with the main chart using visible logical range subscriptions.
- Saved the current visible logical range in localStorage so the user's zoom/pan range persists after refresh.
- Increased generated fallback candle history so zooming out can show many candles.

## Files changed

- `frontend/src/pages/Trading.jsx`
- `src/pages/Trading.jsx`
- `frontend/package.json`
- `frontend/package-lock.json`
- `package.json`
- `package-lock.json`

## Validation performed in this environment

- JSX syntax parse passed for both Trading.jsx files using Babel parser.
- Verified the `lightweight-charts` package exposes the required ESM exports: `createChart`, `CandlestickSeries`, `HistogramSeries`, and `LineSeries`.

## Manual QA still required

This environment does not provide a real Android touch device. Please verify two-finger pinch on Android Chrome or Chrome Device Emulator after installing dependencies and running the frontend.
