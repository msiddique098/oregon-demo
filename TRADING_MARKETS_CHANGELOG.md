# Trading + Markets Feature Update

## Added

- New **Market Overview** page: `/dashboard/markets`
  - Shows top market-cap coins from CoinGecko using `/coins/markets` with `per_page=200`.
  - Adds Eregon custom coins: `ERGN`, `RYL`, `MRKT`, and `BTD`.
  - Auto-refreshes every 15 seconds in the frontend.
  - Backend caches provider responses briefly to reduce rate-limit issues.

- New **Spot Trading** page: `/dashboard/trading`
  - Modern exchange-style layout with pair selector, live chart, order book simulation, portfolio, and recent trades.
  - Supports market buy/sell orders.
  - Supports USDT pairs and several cross pairs like `ETH/BTC`, `BNB/BTC`, and `SOL/BTC`.
  - Internal fee defaults to `0.10%`.

- New backend endpoints:
  - `GET /api/markets`
  - `GET /api/trading/pairs`
  - `GET /api/trading/portfolio`
  - `GET /api/trading/orders`
  - `POST /api/trading/orders`

- New backend trading helpers:
  - `backend/trading_utils.py`

- New tests:
  - `backend/tests/test_trading_utils.py`

## Important notes

- This is an **internal wallet conversion/trading simulation**. It does not connect to Binance, Coinbase, or any real external exchange for execution.
- Prices are fetched from CoinGecko when available. If the provider is unreachable, the backend returns clearly marked fallback data.
- Add your own CoinGecko key in production for better reliability and higher rate limits.
- Frontend `build/` was removed from the zip to prevent stale UI from being copied accidentally. Run `npm install` then `npm run build` or `npm start` locally.

## Validation completed

- `python -m py_compile server.py trading_utils.py reward_math.py`
- `pytest tests/test_trading_utils.py tests/test_reward_math.py -q` → `9 passed`
