from trading_utils import animate_market_prices, apply_trade_balances, build_custom_markets, market_price_map, pair_rate, split_pair


def test_custom_markets_have_fluctuating_prices_and_symbols():
    first = build_custom_markets(epoch_seconds=1000)
    second = build_custom_markets(epoch_seconds=1300)
    assert len(first) >= 4
    assert {item["symbol"].upper() for item in first} >= {"ERGN", "RYL", "MRKT", "BTD"}
    assert first[0]["current_price"] != second[0]["current_price"]


def test_animate_market_prices_moves_quotes_without_mutating_input():
    rows = [{"symbol": "btc", "name": "Bitcoin", "current_price": 60000, "market_cap": 100, "total_volume": 50}]
    moved = animate_market_prices(rows, epoch_seconds=1000)
    moved_again = animate_market_prices(rows, epoch_seconds=1004)
    assert rows[0]["current_price"] == 60000
    assert moved[0]["current_price"] != moved_again[0]["current_price"]
    assert moved[0]["sparkline_in_7d"]["price"]


def test_pair_rate_uses_usd_prices():
    prices = {"BTC": 60000, "ETH": 3000, "USDT": 1}
    assert pair_rate("BTC", "USDT", prices) == 60000
    assert pair_rate("ETH", "BTC", prices) == 0.05


def test_apply_buy_and_sell_balances():
    prices = {"BTC": 50000, "USDT": 1}
    bought = apply_trade_balances({"USDT": 1000}, "BTC/USDT", "buy", 500, prices, fee_rate=0.001)
    assert bought["after"]["USDT"] == 500
    assert bought["after"]["BTC"] > 0
    sold = apply_trade_balances(bought["after"], "BTC/USDT", "sell", bought["after"]["BTC"], prices, fee_rate=0.001)
    assert sold["after"]["BTC"] == 0
    assert sold["after"]["USDT"] < 1000  # fees were paid


def test_split_pair_accepts_dash_or_slash():
    assert split_pair("eth-usdt") == ("ETH", "USDT")
    assert split_pair("ETH/BTC") == ("ETH", "BTC")
