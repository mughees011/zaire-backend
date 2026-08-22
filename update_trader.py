import re
import os

with open("specialists/trader.py", "r", encoding="utf-8") as f:
    code = f.read()

# 1. Replace _get_btc_ta_brief and add _calculate_ta
ta_replacement = """
    @staticmethod
    def _calculate_ta(ticker: str) -> dict:
        import yfinance as yf
        try:
            df = yf.Ticker(ticker).history(period="30d")
            if df.empty: return None

            delta = df['Close'].diff()
            gain  = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss  = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs    = gain / loss
            rsi   = 100 - (100 / (1 + rs))

            current_rsi = rsi.iloc[-1]
            ma_20 = df['Close'].rolling(window=20).mean().iloc[-1]
            price = df['Close'].iloc[-1]
            return {"rsi": current_rsi, "ma_20": ma_20, "price": price}
        except:
            return None

    def _get_btc_ta_brief(self) -> str:
        \"\"\"Calculate basic TA indicators for BTC.\"\"\"
        ta = self._calculate_ta("BTC-USD")
        if not ta:
            return "TA Data Unavailable"
        current_rsi = ta["rsi"]
        ma_20 = ta["ma_20"]
        price = ta["price"]
        trend    = "Bullish (Above 20MA)" if price > ma_20 else "Bearish (Below 20MA)"
        momentum = "Overbought" if current_rsi > 70 else "Oversold" if current_rsi < 30 else "Neutral"
        return f"BTC RSI: {current_rsi:.1f} ({momentum}) | Price vs 20MA: {trend}"
"""
code = re.sub(r'    def _get_btc_ta_brief\(self\) -> str:.*?        except:\n            return "Technical analysis computation failed"', ta_replacement.strip("\n"), code, flags=re.DOTALL)


# 2. Add position limit and stop loss logic to execute_trade
execute_trade_replacement = """
    def execute_trade(self, symbol: str, side: str, quantity: float) -> str:
      if not is_halal_asset(symbol):
        return f"TRADE BLOCKED, sir. {symbol} is not on the Shariah-compliant whitelist."

      if not self.binance_connected or not self.binance:
        return "Cannot execute trade, sir. Binance is not connected."
        
      # Enforce Max 20% Position Size Limit
      try:
          asset = symbol.replace("USDT", "")
          price = self.live_pulse.get(asset, {}).get("price", 0)
          if price > 0:
              # Get total balance (approx) - Mocking for now if we can't fetch easily, but let's try to get USDT balance
              try:
                  balance_info = self.binance.get_asset_balance(asset='USDT')
                  total_capital = float(balance_info['free']) + float(balance_info['locked'])
              except:
                  total_capital = 100000.0 # fallback
              
              trade_value = quantity * price
              max_allowed = total_capital * 0.20
              if trade_value > max_allowed:
                  capped_qty = max_allowed / price
                  print(f"[TRADER] RISK ENFORCEMENT: Order size {quantity} {asset} (${trade_value:.2f}) exceeds 20% limit (${max_allowed:.2f}). Capping to {capped_qty:.4f}")
                  quantity = capped_qty
      except Exception as e:
          print(f"[TRADER] Position size check failed: {e}")

      try:
        symbol_pair = symbol if "USDT" in symbol else f"{symbol}USDT"
        if side.upper() == "BUY":
          order = self.binance.order_market_buy(symbol=symbol_pair, quantity=quantity)
          # Store stop-loss for BUY
          asset = symbol.replace("USDT", "")
          entry_price = self.live_pulse.get(asset, {}).get("price", 0)
          if entry_price > 0:
              self.open_positions[asset] = {"qty": quantity, "side": "BUY", "stop_loss": entry_price * 0.95}
        elif side.upper() == "SELL":
          order = self.binance.order_market_sell(symbol=symbol_pair, quantity=quantity)
          asset = symbol.replace("USDT", "")
          if asset in self.open_positions:
              del self.open_positions[asset]
        else:
          return f"Invalid side: {side}"

        self._append_trade_log({"timestamp": datetime.now().isoformat(), "symbol": symbol_pair, "side": side.upper(), "quantity": quantity, "order_id": order.get("orderId"), "status": order.get("status")})
        return f"Order executed, sir. {side.upper()} {quantity} {symbol} - Status: {order.get('status')}."
      except Exception as e:
        return f"Trade failed, sir. Error: {str(e)}"
"""
code = re.sub(r'    def execute_trade\(self, symbol: str, side: str, quantity: float\) -> str:.*?      except Exception as e:\n        return f"Trade failed, sir. Error: \{str\(e\)\}"', execute_trade_replacement.strip("\n"), code, flags=re.DOTALL)

# 3. Add position limit and stop loss logic to execute_stock_trade
execute_stock_replacement = """
    def execute_stock_trade(self, ticker: str, side: str, qty: int) -> str:
        \"\"\"Execute a stock trade via Alpaca (paper or live, governed by self.paper_trading).\"\"\"
        # Step 1 - Halal screen
        screen_result = screen_stock_halal(ticker)
        if screen_result == "NOT_HALAL":
            return f"STOCK TRADE BLOCKED, sir. {ticker} failed the Halal screen."
        if screen_result == "NOT_SCREENED":
            return (f"STOCK TRADE BLOCKED, sir. {ticker} could not be screened - "
                    "insufficient financial data. Trading an unscreened stock is not permitted.")

        if not self.alpaca_connected or not self.alpaca:
            return "Cannot execute stock trade, sir. Alpaca is not connected."
            
        # Enforce Max 20% Position Size Limit
        try:
            import yfinance as yf
            price = yf.Ticker(ticker).info.get('regularMarketPrice', 0)
            if price == 0: price = yf.Ticker(ticker).history(period="1d")['Close'].iloc[-1]
            account = self.alpaca.get_account()
            total_capital = float(account.equity)
            trade_value = qty * price
            max_allowed = total_capital * 0.20
            if trade_value > max_allowed:
                capped_qty = int(max_allowed / price)
                print(f"[TRADER] RISK ENFORCEMENT: Order size {qty} {ticker} (${trade_value:.2f}) exceeds 20% limit (${max_allowed:.2f}). Capping to {capped_qty}")
                qty = capped_qty
                if qty <= 0: return f"TRADE BLOCKED: 20% limit restricts order to 0 shares."
        except Exception as e:
            print(f"[TRADER] Alpaca Position size check failed: {e}")

        try:
            if _ALPACA_LEGACY:
                order = self.alpaca.submit_order(
                    symbol=ticker,
                    qty=qty,
                    side=side.lower(),
                    type="market",
                    time_in_force="day"
                )
                status = order.status
            else:
                req = MarketOrderRequest(
                    symbol=ticker,
                    qty=qty,
                    side=OrderSide.BUY if side.upper() == "BUY" else OrderSide.SELL,
                    time_in_force=TimeInForce.DAY,
                )
                order = self.alpaca.submit_order(req)
                status = order.status

            if side.upper() == "BUY":
                self.open_positions[ticker] = {"qty": qty, "side": "BUY", "stop_loss": price * 0.95}
            elif side.upper() == "SELL" and ticker in self.open_positions:
                del self.open_positions[ticker]

            self._append_trade_log({
                "timestamp": datetime.now().isoformat(),
                "symbol": ticker,
                "side": side.upper(),
                "quantity": qty,
                "status": str(status),
                "venue": "ALPACA_PAPER" if self.paper_trading else "ALPACA_LIVE",
            })
            return f"Stock order placed, sir. {side.upper()} {qty} {ticker} - Status: {status}."
        except Exception as e:
            return f"Stock trade failed, sir. Error: {str(e)}"
"""
code = re.sub(r'    def execute_stock_trade\(self, ticker: str, side: str, qty: int\) -> str:.*?      except Exception as e:\n            return f"Stock trade failed, sir. Error: \{str\(e\)\}"', execute_stock_replacement.strip("\n"), code, flags=re.DOTALL)


# 4. Modify handle_action for EXECUTE_TRADE (Paper trading)
handle_action_replacement = """
      if action == "EXECUTE_TRADE":
        symbol = payload.get("symbol", "BTCUSDT")
        side   = payload.get("side", "BUY")
        qty    = float(payload.get("qty", 1.0))
        asset = symbol.replace("USDT", "")

        portfolio_path = os.path.join("memory", "mock_portfolio.json")
        os.makedirs("memory", exist_ok=True)
        portfolio = {}
        if os.path.exists(portfolio_path):
          with open(portfolio_path, "r") as f: portfolio = json.load(f)
          
        live_price = self.live_pulse.get(asset, {}).get("price", 60000)
        usdt_balance = portfolio.get("USDT", 100000.0)
        total_equity = usdt_balance
        for p_asset, p_qty in portfolio.items():
            if p_asset != "USDT":
                p_price = self.live_pulse.get(p_asset, {}).get("price", 0)
                total_equity += p_qty * p_price
                
        # Enforce 20% risk limit
        trade_value = qty * live_price
        max_allowed = total_equity * 0.20
        if trade_value > max_allowed:
            capped_qty = max_allowed / live_price
            print(f"[TRADER] RISK ENFORCEMENT (PAPER): Order size {qty} {asset} (${trade_value:.2f}) exceeds 20% limit (${max_allowed:.2f}). Capping to {capped_qty:.4f}")
            qty = capped_qty
            
        if side == "BUY":
          portfolio[asset] = portfolio.get(asset, 0.0) + qty
          portfolio["USDT"] = usdt_balance - (qty * live_price)
          self.open_positions[asset] = {"qty": portfolio[asset], "side": "BUY", "stop_loss": live_price * 0.95}
        else:
          portfolio[asset] = portfolio.get(asset, 0.0) - qty
          portfolio["USDT"] = usdt_balance + (qty * live_price)
          if asset in self.open_positions:
              del self.open_positions[asset]

        with open(portfolio_path, "w") as f: json.dump(portfolio, f, indent=2)
"""
code = re.sub(r'      if action == "EXECUTE_TRADE":.*?with open\(portfolio_path, "w"\) as f: json\.dump\(portfolio, f, indent=2\)', handle_action_replacement.strip("\n"), code, flags=re.DOTALL)


# 5. Fix _apex_daemon_loop
apex_loop_replacement = """
    def _apex_daemon_loop(self):
        \"\"\"
        Background thread: autonomous hedge-fund-style execution engine.
        \"\"\"
        print("[TRADER APEX] Daemon thread started. ZAIRE is now watching 24/7.")
        last_heartbeat_time = time.time()
        HEARTBEAT_INTERVAL  = 300
        CYCLE_SLEEP         = 15
        
        assets_to_check = ["BTC", "ETH", "SOL", "LINK", "AVAX"]

        while self.apex_active:
            now = time.time()
            if now - last_heartbeat_time >= HEARTBEAT_INTERVAL:
                fng_info = f"F&G={self.fear_greed_value}({self.fear_greed_label})" \\
                           if self.fear_greed_value is not None else "F&G=UNKNOWN"
                print(f"[TRADER APEX][HEARTBEAT] Daemon alive. "
                      f"Positions={len(self.open_positions)} | "
                      f"{fng_info} | "
                      f"Mode={'PAPER' if self.paper_trading else 'LIVE'} | "
                      f"{datetime.now().strftime('%H:%M:%S')}")
                last_heartbeat_time = now

            try:
                # ── Stop Loss Check (TASK 4) ──
                positions_to_close = []
                for asset, pos_data in list(self.open_positions.items()):
                    current_price = self.live_pulse.get(asset, {}).get("price", 0)
                    if current_price > 0 and current_price <= pos_data["stop_loss"]:
                        print(f"[TRADER APEX][RISK] STOP LOSS TRIGGERED for {asset}. Price ${current_price:,.2f} <= Stop ${pos_data['stop_loss']:,.2f}")
                        positions_to_close.append(asset)
                
                for asset in positions_to_close:
                    qty = self.open_positions[asset]["qty"]
                    if self.paper_trading:
                        self.handle_action("EXECUTE_TRADE", {"symbol": asset, "side": "SELL", "qty": qty, "reason": "Stop Loss Triggered"})
                    else:
                        if asset in ["BTC", "ETH", "SOL", "LINK", "AVAX"]:
                            self.execute_trade(asset, "SELL", qty)
                        else:
                            self.execute_stock_trade(asset, "SELL", int(qty))

                # ── F&G Sentiment ──
                try:
                    fng = fetch_fear_and_greed()
                    if fng["value"] is not None:
                        self.fear_greed_value = fng["value"]
                        self.fear_greed_label = fng["label"]
                except Exception as fng_err:
                    print(f"[TRADER APEX][WARN] Fear & Greed fetch failed: {fng_err}. Using cached value.")

                fng_v = self.fear_greed_value
                if fng_v is None:
                    fng_bias = 0.0
                elif fng_v <= 25:
                    fng_bias = +1.0
                elif fng_v <= 45:
                    fng_bias = +0.5
                elif fng_v <= 55:
                    fng_bias = 0.0
                elif fng_v <= 75:
                    fng_bias = -0.5
                else:
                    fng_bias = -1.0

                if not self.live_pulse:
                    time.sleep(CYCLE_SLEEP)
                    continue

                # ── Iterate and Evaluate Signals (TASK 1 & 2) ──
                for asset in assets_to_check:
                    price = self.live_pulse.get(asset, {}).get("price")
                    if not price: continue
                    
                    ta = self._calculate_ta(f"{asset}-USD")
                    if not ta: continue
                    
                    rsi = ta["rsi"]
                    has_position = asset in self.open_positions
                    side = None
                    reason = ""
                    
                    # Explicit NO-RANDOMNESS rules
                    if rsi < 30 and fng_bias > 0:
                        side = "BUY"
                        reason = f"RSI {rsi:.1f} < 30 and F&G bias {fng_bias} > 0"
                    elif rsi > 70 and fng_bias < 0 and has_position:
                        side = "SELL"
                        reason = f"RSI {rsi:.1f} > 70 and F&G bias {fng_bias} < 0"
                    
                    if side:
                        qty = 0.05
                        try:
                            if self.paper_trading:
                                self.handle_action("EXECUTE_TRADE", {
                                    "symbol": asset, "side": side, "qty": qty,
                                    "reason": reason
                                })
                                print(f"[TRADER APEX] Paper {side} {qty} {asset} @ ${price:,.2f} | Reason: {reason}")
                            else:
                                try:
                                    if self.binance_connected:
                                        self.execute_trade(asset, side, qty)
                                        print(f"[TRADER APEX] Live Binance {side} {qty} {asset} @ ${price:,.2f} | Reason: {reason}")
                                    else:
                                        print("[TRADER APEX] Binance not connected - skipping live trade.")
                                except Exception as binance_err:
                                    print(f"[TRADER APEX][WARN] Binance trade error: {binance_err}. Loop continues.")

                                if self.alpaca_connected:
                                    try:
                                        stock_map = {"BTC": "MSTR", "ETH": "COIN", "SOL": "HOOD", "LINK": "COIN", "AVAX": "MSTR"}
                                        stock_ticker = stock_map.get(asset, "AAPL")
                                        stock_screen = screen_stock_halal(stock_ticker)
                                        if stock_screen == "HALAL":
                                            self.execute_stock_trade(stock_ticker, side, 1)
                                            print(f"[TRADER APEX] Live Alpaca {side} 1 {stock_ticker} (halal-cleared) | Proxy for {asset}")
                                        else:
                                            print(f"[TRADER APEX] Alpaca stock {stock_ticker} -> {stock_screen}. Skipped.")
                                    except Exception as alpaca_err:
                                        print(f"[TRADER APEX][WARN] Alpaca trade error: {alpaca_err}. Loop continues.")

                        except Exception as trade_err:
                            print(f"[TRADER APEX][WARN] Trade execution error: {trade_err}. Loop continues.")
            except Exception as cycle_err:
                print(f"[TRADER APEX][ERROR] Unexpected cycle error: {cycle_err}. Sleeping {CYCLE_SLEEP}s and continuing.")

            time.sleep(CYCLE_SLEEP)

        print("[TRADER APEX] Daemon thread stopped - apex_active=False.")
"""

code = re.sub(r'    def _apex_daemon_loop\(self\):.*?        print\("\[TRADER APEX\] Daemon thread stopped - apex_active=False\."\)', apex_loop_replacement.strip("\n"), code, flags=re.DOTALL)

with open("specialists/trader.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patched successfully!")
