import yfinance as yf
import pandas as pd
import requests

def fetch_historical_fng(limit=14):
    url = f"https://api.alternative.me/fng/?limit={limit}"
    try:
        resp = requests.get(url, timeout=10)
        data = resp.json()['data']
        # Returns list of dicts with 'value', 'value_classification', 'timestamp'
        # Reverse to get chronological
        return list(reversed(data))
    except Exception as e:
        print("Error fetching F&G:", e)
        return []

def get_action(rsi, fng_bias, has_position):
    if pd.isna(rsi):
        return "HOLD", "RSI is NaN"
    if rsi < 30 and fng_bias > 0:
        return "BUY", f"RSI {rsi:.1f} < 30 (Oversold) AND F&G Bias {fng_bias} > 0"
    elif rsi > 70 and fng_bias < 0 and has_position:
        return "SELL", f"RSI {rsi:.1f} > 70 (Overbought) AND F&G Bias {fng_bias} < 0"
    else:
        return "HOLD", "Conditions not met"

def get_fng_bias(value):
    if value <= 25: return +1.0
    elif value <= 45: return +0.5
    elif value <= 55: return 0.0
    elif value <= 75: return -0.5
    else: return -1.0

def run_backtest():
    # 14 days of BTC data + 30 days buffer for 14-period RSI
    df = yf.Ticker("BTC-USD").history(period="44d")
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    rsi_series = 100 - (100 / (1 + rs))
    
    # We only care about the last 14 days
    df = df.tail(14).copy()
    df['RSI'] = rsi_series.tail(14)
    
    fng_data = fetch_historical_fng(limit=14)
    if not fng_data:
        print("Failed to load F&G data")
        return
        
    print(f"{'Date':<10} | {'Close':<8} | {'RSI':<5} | {'F&G':<3} | {'Bias':<4} | {'Action':<6} | {'Reasoning'}")
    print("-" * 90)
    
    has_position = True # Assume holding BTC initially
    
    for i in range(14):
        date = df.index[i].strftime("%Y-%m-%d")
        close = df['Close'].iloc[i]
        rsi = df['RSI'].iloc[i]
        
        # Match fng
        fng_val = int(fng_data[i]['value'])
        fng_bias = get_fng_bias(fng_val)
        
        action, reason = get_action(rsi, fng_bias, has_position)
        
        if action == "BUY": has_position = True
        if action == "SELL": has_position = False
        
        print(f"{date:<10} | ${close:<7.0f} | {rsi:<5.1f} | {fng_val:<3} | {fng_bias:<4} | {action:<6} | {reason}")

if __name__ == '__main__':
    run_backtest()
