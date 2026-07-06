# Trading Chart History + Native Zoom Fix

Updated the trading chart implementation to stop using generated/random-looking candles for real exchange pairs and to make zoom/pan behave through TradingView Lightweight Charts native time-scale behavior.

## Backend

- Added Binance `/klines` OHLC history fetching for supported pairs such as `BTC/USDT`, `ETH/USDT`, etc.
- Increased OHLC history capacity to up to 1000 candles so users can zoom out and inspect previous market data.
- The latest candle now updates from the current live pair rate instead of being regenerated.
- Candle history is de-duplicated and sorted by timestamp before being returned.
- For unsupported custom/internal coins, candles are deterministic and stable, not random; the latest candle still follows the live/internal price.
- `/api/trading/ohlc` now returns `candle_source` so it is clear whether candles came from Binance klines or internal deterministic fallback.

## Frontend

- Reworked `CandleChart` to rely on TradingView Lightweight Charts native `handleScale` and `handleScroll` behavior.
- Removed custom manual touch/wheel zoom handlers that were fighting native chart interactions.
- Added touch-action isolation on chart canvases so mobile pinch gestures go to the chart instead of the page.
- Preserves current logical range during live data updates instead of resetting zoom every refresh.
- Saves and restores visible logical range in `localStorage`.
- Requests 1000 candles from the backend instead of 360.
- Main candle chart, volume, MA lines, and RSI remain synchronized by visible logical range.

## Files changed

- `backend/server.py`
- `frontend/src/pages/Trading.jsx`
- `src/pages/Trading.jsx`
