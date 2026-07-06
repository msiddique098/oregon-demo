# Trading realtime chart fix

Implemented after screenshot feedback that the chart was still not behaving like a realtime exchange chart.

## Backend
- Binance-backed pairs now use Binance kline/ticker data as the live candle source.
- The current candle is no longer moved by internally animated/fallback market prices.
- Kline refresh frequency for short timeframes was reduced to keep the active candle current.
- `/api/trading/ohlc` now returns the latest candle close as the route `rate` when candle data is available.

## Frontend
- Added direct Binance kline WebSocket streaming for supported exchange pairs.
- The open candle updates in real time from Binance `@kline` stream messages.
- Candles are merged into existing history instead of regenerating random-looking data.
- The visible chart range is no longer forcibly reset on every live update, so native zoom/pan is not interrupted.
- Chart labels show whether data is coming from `BINANCE REALTIME`, `BINANCE KLINES`, or `INTERNAL CHART`.

## Chart behavior
- Uses TradingView Lightweight Charts native time-scale zoom/pan.
- No CSS transform scaling is used for zoom.
- RSI, MA, volume, and candle series stay on the same time data and visible range.

## Notes
- Custom/internal coins cannot use Binance WebSocket because they do not exist on Binance. They continue to use stable deterministic internal history.
- If Binance WebSocket is blocked by the browser/network, the chart falls back to backend kline polling.
