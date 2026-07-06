# Trading chart black screen and realtime chart fix

## Issue found
The trading page was relying on the in-app Lightweight Charts implementation. On some browsers/devices this could crash or show a blank/black trading view after the page rendered, especially when the chart package/API behaved differently from the expected version or when realtime updates fought with chart range handling.

## Fix applied
- Removed the `lightweight-charts` runtime import from the Trading page so the whole page cannot crash because of the chart package.
- Added a safe TradingView Advanced Chart widget for real exchange pairs such as `BTC/USDT`.
- Real exchange pairs are mapped to TradingView/Binance symbols such as `BINANCE:BTCUSDT`.
- TradingView handles candle history, live candles, pinch zoom, wheel zoom, and pan natively.
- Added a crash guard and fallback internal chart so the trading page no longer goes fully black if TradingView cannot load.
- Kept backend APIs and trading business logic unchanged.

## Notes
Custom coins cannot have TradingView/Binance realtime candles unless those symbols exist on TradingView/Binance. They fall back to the internal chart instead of crashing.
