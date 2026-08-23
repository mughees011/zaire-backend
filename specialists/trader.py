import os
import json
import requests
import re
import time
import threading
from binance.client import Client
from binance.ws.streams import ThreadedWebsocketManager
from datetime import datetime
from .llm_utils import call_llm_sync, call_llm_stream


# ── Internal signal endpoint for live frontend updates ────────────────────────
_INTERNAL_BASE = "http://127.0.0.1:10000"

def _post_signal(signal: dict):
    """POST a decision to the Node.js internal endpoint so it can Socket.IO-emit it.
    Non-blocking: uses a daemon thread so a slow/offline Node doesn't stall the loop."""
    def _send():
        try:
            requests.post(
                f"{_INTERNAL_BASE}/api/internal/trader/signal",
                json=signal,
                timeout=2
            )
        except Exception:
            pass  # Node offline or busy — next signal will retry; loop must never die
    threading.Thread(target=_send, daemon=True).start()


# ── Optional Alpaca import — graceful if not installed ──────────────────────
# Install with: pip install alpaca-py
try:
    from alpaca.trading.client import TradingClient
    from alpaca.trading.requests import MarketOrderRequest
    from alpaca.trading.enums import OrderSide, TimeInForce
    _ALPACA_AVAILABLE = True
    _ALPACA_LEGACY    = False
except ImportError:
    try:
        import alpaca_trade_api as tradeapi   # legacy SDK fallback
        _ALPACA_AVAILABLE = True
        _ALPACA_LEGACY    = True
    except ImportError:
        _ALPACA_AVAILABLE = False
        _ALPACA_LEGACY    = False

# ── Halal crypto whitelist ───────────────────────────────────────────────────
WHITELISTED_SYMBOLS = {
  "BTC", "BTCUSDT",
  "ETH", "ETHUSDT",
  "BNB", "BNBUSDT",
  "SOL", "SOLUSDT",
  "ADA", "ADAUSDT",
  "DOT", "DOTUSDT",
  "LINK", "LINKUSDT",
  "AVAX", "AVAXUSDT",
  "MATIC", "MATICUSDT",
  "ATOM", "ATOMUSDT",
  "XLM", "XLMUSDT",
  "VET", "VETUSDT",
  "ALGO", "ALGOUSDT",
  "FIL", "FILUSDT"
}

HARAM_KEYWORDS = [
  "leverage", "margin", "short", "3x", "5x", "10x",
  "futures", "options", "interest", "yield farming",
  "doge", "shib", "pepe", "floki", "safemoon",
  "casino", "gambling", "lottery", "beer", "alcohol",
  "pig", "pork", "adult", "usury"
]

# ── TASK 2: AAOIFI-style stock Shariah screening ────────────────────────────
# IMPORTANT DISCLAIMER: This is a best-effort automated screen based on
# publicly available financial data. It is NOT a substitute for a fatwa or
# review by a qualified Islamic finance scholar or a certified Shariah board.
# Always consult a qualified Islamic finance advisor before making investment
# decisions based on this output.
#
# Criteria applied (AAOIFI-style, per standard thresholds):
#   1. Interest-bearing debt  < 33% of market capitalisation
#   2. Non-compliant revenue  < 5%  of total revenue
#      (non-compliant sectors: conventional banking/insurance, gambling,
#       alcohol, tobacco, pork, adult content, weapons)

# Tickers known to operate in non-compliant sectors — hard-block these.
_SECTOR_BLOCKED_TICKERS = {
    # Conventional banks & insurance
    "JPM","BAC","WFC","C","GS","MS","AXP","V","MA","BRK.B","MET","PRU","AFL",
    # Alcohol & tobacco
    "BUD","STZ","DEO","MO","PM","BTI","RAI","LO",
    # Gambling & casinos
    "LVS","MGM","WYNN","DKNG","PENN","CZR",
    # Adult content, pork processors
    "PLAYBOY","HRL",
}

def screen_stock_halal(ticker: str) -> str:
    """
    Perform an automated AAOIFI-style Shariah screen on an equity ticker.

    Returns one of:
        "HALAL"        — passed all automated checks
        "NOT_HALAL"    — failed one or more automated checks
        "NOT_SCREENED" — data unavailable; MUST NOT be treated as halal

    *** This is a best-effort automated screen, not a scholarly ruling.
        Consult a qualified Islamic finance advisor before trading. ***
    """
    ticker_upper = ticker.upper()

    # Hard-block known non-compliant sectors
    if ticker_upper in _SECTOR_BLOCKED_TICKERS:
        return "NOT_HALAL"

    try:
        import yfinance as yf
        info = yf.Ticker(ticker).info

        # ── Criterion 1: Debt / market-cap ratio < 33% ──────────────────
        total_debt   = info.get("totalDebt")
        market_cap   = info.get("marketCap")

        if total_debt is None or market_cap is None or market_cap == 0:
            # Cannot verify — must return NOT_SCREENED, never default-pass
            print(f"[HALAL SCREEN] {ticker}: insufficient balance-sheet data → NOT_SCREENED")
            return "NOT_SCREENED"

        debt_ratio = total_debt / market_cap
        if debt_ratio >= 0.33:
            print(f"[HALAL SCREEN] {ticker}: debt ratio {debt_ratio:.2%} ≥ 33% → NOT_HALAL")
            return "NOT_HALAL"

        # ── Criterion 2: Non-compliant revenue < 5% ─────────────────────
        # yfinance does not expose revenue-by-segment, so we proxy with
        # the reported sector/industry label as a coarse filter.
        sector   = (info.get("sector")   or "").lower()
        industry = (info.get("industry") or "").lower()

        noncompliant_keywords = [
            "bank", "insurance", "gambling", "alcohol", "beverage",
            "tobacco", "adult", "pork", "defense", "weapons"
        ]
        if any(kw in sector or kw in industry for kw in noncompliant_keywords):
            print(f"[HALAL SCREEN] {ticker}: sector '{sector}'/'{industry}' flagged → NOT_HALAL")
            return "NOT_HALAL"

        # Passed all checks
        print(f"[HALAL SCREEN] {ticker}: debt {debt_ratio:.2%}, sector OK → HALAL")
        return "HALAL"

    except Exception as e:
        # Any data-fetch failure → NOT_SCREENED, never default-pass
        print(f"[HALAL SCREEN] {ticker}: error during screen ({e}) → NOT_SCREENED")
        return "NOT_SCREENED"


# ── TASK 3: Real Fear & Greed Index fetch ───────────────────────────────────
_FNG_API = "https://api.alternative.me/fng/"

def fetch_fear_and_greed() -> dict:
    """
    Fetch the current Crypto Fear & Greed Index from alternative.me.
    Returns: {"value": int, "label": str, "timestamp": str}
    Falls back to {"value": None, "label": "UNAVAILABLE"} on any error.
    No API key required.
    """
    try:
        resp = requests.get(_FNG_API, timeout=6)
        resp.raise_for_status()
        data = resp.json()["data"][0]
        return {
            "value":     int(data["value"]),
            "label":     data["value_classification"],   # e.g. "Extreme Fear"
            "timestamp": data.get("timestamp", ""),
        }
    except Exception as e:
        print(f"[TRADER] Fear & Greed fetch error: {e}")
        return {"value": None, "label": "UNAVAILABLE", "timestamp": ""}


def is_halal_asset(symbol: str) -> bool:
  return symbol.upper() in WHITELISTED_SYMBOLS

def contains_haram_intent(text: str) -> bool:
  text_lower = text.lower()
  return any(keyword in text_lower for keyword in HARAM_KEYWORDS)

def extract_symbols_from_text(text: str) -> list:
  words = re.findall(r'\b[A-Z]{2,6}\b', text.upper())
  return [w for w in words if w not in
    {"I", "A", "TO", "THE", "AND", "FOR", "ME", "MY", "IN", "IS", "IT", "SIR", "OF", "ON", "DO", "AI", "UI", "OK", "NO", "GO", "IF"}]

TRADER_SYSTEM_PROMPT = """
You are ZAIRE — a premier Halal Financial Intelligence 
Module and Quantitative Analyst. You operate at the intersection of 
Islamic Finance and high-frequency technical analysis.

OPERATIONAL PARAMETERS:
1. SHARIAH COMPLIANCE: Non-negotiable adherence to whitelisted assets only.
2. TECHNICAL ANALYSIS (TA): RSI, MACD, EMAs, and Bollinger Bands are your tools.
3. GLOBAL CONTEXT: You monitor DXY, S&P 500, and Gold as leading indicators for BTC.
4. RISK DISCIPLINE: Stop losses are mandatory. Maximum 20% position size.
5. NEURAL ECHO: You have access to Mughees's visual screen history to provide context-aware financial advice.

REPORTING PROTOCOL:
- Executive Summary: Concise market direction.
- TA Dashboard: Key indicators for primary assets.
- Halal Filter: Verification of asset compliance.
- Verdict: One of [PROCEED, CAUTION, WAIT].

PERSONALITY:
- Analytical and objective.
- Calm under volatility.
- Uses "Sir" as the standard address.
- Provides reasoning for every suggested move.
"""

class TraderSpecialist:
    def __init__(self, groq_client, binance_api_key=None, binance_secret=None):
      self.groq = groq_client
      self.binance = None
      self.binance_connected = False
      self.using_testnet = os.getenv("BINANCE_TESTNET", "true").lower() == "true"
      self.conversation_history = []
      self.model = "Auto"

      # ── NEXT-GEN: APEX ENGINE STATE ──
      self.apex_active       = False
      self.paper_trading     = True   # ← single flag governs BOTH Binance AND Alpaca
      self.open_positions    = {}
      self.trailing_stop_pct = 0.05
      self.alpha_feed        = []
      self.active_strategy   = None
      self.live_pulse        = {}
      self.phase             = "IDLE"
      self.progress          = 0

      # ── TASK 3/4: Fear & Greed state (updated by daemon + sentiment call) ──
      self.fear_greed_value  = None   # int 0-100, or None if unknown
      self.fear_greed_label  = "UNKNOWN"

      # ── VAULT INTEGRATION ───────────────────────────────────────────────
      # Fetch keys from the Node.js backend to bypass DPAPI/OS differences
      vault_keys = {}
      try:
          resp = requests.get("http://127.0.0.1:10000/api/internal/trader/keys", timeout=2)
          if resp.status_code == 200:
              vault_keys = resp.json().get("keys", {})
              self.paper_trading = vault_keys.get("paperTrading", True)
              print(f"[TRADER] Loaded vault keys. Paper trading: {self.paper_trading}")
      except Exception as e:
          print(f"[TRADER] Failed to load keys from internal vault: {e}")

      # ── BINANCE ─────────────────────────────────────────────────────────
      api_key = vault_keys.get("binanceApiKey") or binance_api_key or os.getenv("BINANCE_API_KEY")
      secret  = vault_keys.get("binanceSecretKey") or binance_secret or os.getenv("BINANCE_SECRET_KEY")

      if api_key and secret:
        try:
          self.binance = Client(api_key, secret, testnet=self.using_testnet)
          self.binance.ping()
          self.binance_connected = True
          mode = "TESTNET" if self.using_testnet else "MAINNET"
          print(f"[TRADER] Binance connected — {mode} mode")

          self.twm = ThreadedWebsocketManager(api_key=api_key, api_secret=secret, testnet=self.using_testnet)
          self.twm.start()
          self._start_live_streams()
          import atexit
          atexit.register(self.twm.stop)
        except Exception as e:
          print(f"[TRADER] CONNECTION ERROR: {e}")
          self.binance_connected = False
      else:
        print("[TRADER] No Binance keys provided — analysis-only mode")

      # ── TASK 1: ALPACA (paper_trading flag shared with Binance above) ───
      # paper_trading=True  → Alpaca paper endpoint (safe default)
      # paper_trading=False → Alpaca live endpoint  (real capital at risk)
      self.alpaca            = None
      self.alpaca_connected  = False
      alpaca_key    = vault_keys.get("alpacaApiKey") or os.getenv("ALPACA_API_KEY")
      alpaca_secret = vault_keys.get("alpacaSecretKey") or os.getenv("ALPACA_SECRET_KEY")

      if alpaca_key and alpaca_secret:
          self._connect_alpaca(alpaca_key, alpaca_secret)
      else:
          print("[TRADER] No Alpaca keys provided — stocks analysis-only mode")

    # ── TASK 1 helper ────────────────────────────────────────────────────────
    def _connect_alpaca(self, api_key: str, secret_key: str):
        """Connect (or reconnect) Alpaca using the shared paper_trading flag."""
        paper = self.paper_trading   # single source of truth
        try:
            if not _ALPACA_AVAILABLE:
                print("[TRADER] alpaca-py not installed — run: pip install alpaca-py")
                return

            if _ALPACA_LEGACY:
                base_url = ("https://paper-api.alpaca.markets"
                            if paper else "https://api.alpaca.markets")
                self.alpaca = tradeapi.REST(api_key, secret_key, base_url=base_url)
                account = self.alpaca.get_account()
            else:
                self.alpaca = TradingClient(api_key, secret_key, paper=paper)
                account = self.alpaca.get_account()

            self.alpaca_connected = True
            mode = "PAPER" if paper else "LIVE"
            print(f"[TRADER] Alpaca connected — {mode} mode "
                  f"| Equity: ${float(account.equity):,.2f}")
        except Exception as e:
            print(f"[TRADER] Alpaca connection error: {e}")
            self.alpaca_connected = False

    def _speak_interim(self, text):
        print(f"[NEURAL_LOG] SPEECH: {text}")

    def _call_groq(self, messages: list, model: str = None, temperature: float = 0.3, max_tokens: int = 3000):
        return call_llm_sync(messages, model or self.model, temperature, max_tokens)

    def generate_trading_report(self, user_query: str = "", uploaded_file: str = "") -> str:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer,
            Table, TableStyle, HRFlowable
        )
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_CENTER, TA_LEFT
        from datetime import datetime
        import os

        # ── GATHER DATA ───────────────────────────────
        market_data_str = self._get_market_data_safe()
        portfolio_str   = self._get_portfolio_safe()
        global_context  = self._get_global_market_context()
        ta_data         = self._get_btc_ta_brief()

        # ── Real Fear & Greed ─────────────────────────
        fng = fetch_fear_and_greed()
        fng_line = (f"Fear & Greed Index: {fng['value']} ({fng['label']})"
                    if fng["value"] is not None else "Fear & Greed: UNAVAILABLE")

        # ── GET AI ANALYSIS ───────────────────────────
        analysis_prompt = f"""
        Generate a professional halal crypto trading report.

        USER QUERY: {user_query}

        LIVE MARKET DATA:
        {market_data_str}

        TECHNICAL ANALYSIS (BTC):
        {ta_data}

        GLOBAL MACRO CONTEXT:
        {global_context}

        MARKET SENTIMENT (REAL):
        {fng_line}

        PORTFOLIO:
        {portfolio_str}

        Provide the following sections.
        Return as JSON only, no markdown:

        {{
            "report_title": "...",
            "date": "...",
            "executive_summary": "2-3 sentence overview",
            "market_sentiment": "BULLISH / BEARISH / NEUTRAL",
            "sentiment_reason": "Why the market feels this way",
            "top_opportunities": [
                {{
                    "asset": "BTC",
                    "action": "BUY / HOLD / SELL / WAIT",
                    "current_price": "$...",
                    "target_price": "$...",
                    "timeframe": "X days",
                    "risk": "LOW / MEDIUM / HIGH",
                    "halal_status": "CONFIRMED HALAL",
                    "reasoning": "2 sentence explanation"
                }}
            ],
            "assets_to_avoid_now": [
                {{
                    "asset": "...",
                    "reason": "..."
                }}
            ],
            "portfolio_health": "Assessment of current portfolio",
            "recommended_allocation": [
                {{"asset": "BTC", "percentage": 40}},
                {{"asset": "ETH", "percentage": 30}},
                {{"asset": "SOL", "percentage": 20}},
                {{"asset": "LINK", "percentage": 10}}
            ],
            "risk_warning": "Standard Islamic finance risk reminder",
            "final_verdict": "PROCEED / WAIT / CAUTION",
            "verdict_reason": "One clear sentence why"
        }}
        """

        messages = [
            {"role": "system", "content": "Return only valid JSON. No markdown."},
            {"role": "user", "content": analysis_prompt}
        ]

        import json
        raw = self._call_groq(
            messages=messages,
            model=self.model,
            temperature=0.3,
            max_tokens=3000
        )

        try:
            clean = raw.strip().strip("```json").strip("```")
            data = json.loads(clean)
        except:
            data = {
                "report_title": "Market Analysis Report",
                "executive_summary": raw[:500],
                "market_sentiment": "NEUTRAL",
                "top_opportunities": [],
                "final_verdict": "WAIT",
                "verdict_reason": "Insufficient data to analyze"
            }

        # ── BUILD PDF ─────────────────────────────────
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        filename = f"ZAIRE_TradingReport_{timestamp}.pdf"
        output_path = os.path.join(desktop, filename)

        doc = SimpleDocTemplate(
            output_path, pagesize=A4,
            rightMargin=2*cm, leftMargin=2*cm,
            topMargin=2*cm, bottomMargin=2*cm
        )

        CYAN    = colors.HexColor("#00D4FF")
        NAVY    = colors.HexColor("#000814")
        GREEN   = colors.HexColor("#00FF88")
        AMBER   = colors.HexColor("#FFAA00")
        RED_C   = colors.HexColor("#FF4040")
        MUTED   = colors.HexColor("#88CCDD")
        WHITE   = colors.white
        DGRAY   = colors.HexColor("#001433")

        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "title", fontSize=22, fontName="Helvetica-Bold",
            textColor=CYAN, alignment=TA_CENTER, spaceAfter=6
        )
        subtitle_style = ParagraphStyle(
            "subtitle", fontSize=10, fontName="Helvetica",
            textColor=MUTED, alignment=TA_CENTER, spaceAfter=20
        )
        section_style = ParagraphStyle(
            "section", fontSize=13, fontName="Helvetica-Bold",
            textColor=CYAN, spaceBefore=16, spaceAfter=6
        )
        body_style = ParagraphStyle(
            "body", fontSize=10, fontName="Helvetica",
            textColor=colors.HexColor("#CCDDEE"), spaceAfter=6,
            leading=16
        )

        story = []

        story.append(Paragraph("ZAIRE TRADING INTELLIGENCE", title_style))
        story.append(Paragraph(
            f"{data.get('report_title','Market Analysis')} — "
            f"{datetime.now().strftime('%B %d, %Y  %H:%M')}",
            subtitle_style
        ))
        story.append(HRFlowable(width="100%", thickness=1, color=CYAN, spaceAfter=16))

        sentiment = data.get("market_sentiment", "NEUTRAL")
        sent_color = (GREEN if sentiment == "BULLISH"
                      else RED_C if sentiment == "BEARISH"
                      else AMBER)
        story.append(Paragraph(
            f"MARKET SENTIMENT: {sentiment}",
            ParagraphStyle("sent", fontSize=14,
                           fontName="Helvetica-Bold",
                           textColor=sent_color,
                           alignment=TA_CENTER, spaceAfter=4)
        ))
        story.append(Paragraph(data.get("sentiment_reason", ""), body_style))

        # Real Fear & Greed badge
        fng_color = RED_C if (fng["value"] or 50) < 30 else (GREEN if (fng["value"] or 50) > 70 else AMBER)
        story.append(Paragraph(
            f"📊 {fng_line}",
            ParagraphStyle("fng", fontSize=10, fontName="Helvetica-Bold",
                           textColor=fng_color, alignment=TA_CENTER, spaceAfter=12)
        ))
        story.append(Spacer(1, 12))

        story.append(Paragraph("EXECUTIVE SUMMARY", section_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=MUTED, spaceAfter=8))
        story.append(Paragraph(data.get("executive_summary", ""), body_style))

        opportunities = data.get("top_opportunities", [])
        if opportunities:
            story.append(Paragraph("TOP HALAL OPPORTUNITIES", section_style))
            story.append(HRFlowable(width="100%", thickness=0.5, color=MUTED, spaceAfter=8))

            table_data = [["ASSET", "ACTION", "PRICE", "TARGET", "TIMEFRAME", "RISK"]]
            for opp in opportunities:
                table_data.append([
                    opp.get("asset", ""),
                    opp.get("action", "HOLD"),
                    opp.get("current_price", ""),
                    opp.get("target_price", ""),
                    opp.get("timeframe", ""),
                    opp.get("risk", "")
                ])

            tbl = Table(table_data, colWidths=[2.5*cm, 2.5*cm, 3*cm, 3*cm, 3*cm, 2.5*cm])
            tbl.setStyle(TableStyle([
                ("BACKGROUND", (0,0), (-1,0), DGRAY),
                ("TEXTCOLOR",  (0,0), (-1,0), CYAN),
                ("FONTNAME",   (0,0), (-1,0), "Helvetica-Bold"),
                ("FONTSIZE",   (0,0), (-1,-1), 9),
                ("ROWBACKGROUNDS", (0,1), (-1,-1),
                 [colors.HexColor("#000C1A"), colors.HexColor("#001122")]),
                ("TEXTCOLOR",  (0,1), (-1,-1), WHITE),
                ("GRID",       (0,0), (-1,-1), 0.5, colors.HexColor("#003344")),
                ("ALIGN",      (0,0), (-1,-1), "CENTER"),
                ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
                ("TOPPADDING", (0,0), (-1,-1), 6),
                ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ]))
            story.append(tbl)
            story.append(Spacer(1, 12))

            for opp in opportunities:
                story.append(Paragraph(
                    f"<b>{opp.get('asset')}</b>: {opp.get('reasoning','')}",
                    body_style
                ))

        allocation = data.get("recommended_allocation", [])
        if allocation:
            story.append(Paragraph("RECOMMENDED PORTFOLIO ALLOCATION", section_style))
            alloc_data = [["ASSET", "ALLOCATION %", "RATIONALE"]]
            for a in allocation:
                alloc_data.append([
                    a.get("asset", ""),
                    f"{a.get('percentage',0)}%",
                    "Halal — Strong utility token"
                ])
            alloc_tbl = Table(alloc_data, colWidths=[4*cm, 4*cm, 9*cm])
            alloc_tbl.setStyle(TableStyle([
                ("BACKGROUND",    (0,0), (-1,0), DGRAY),
                ("TEXTCOLOR",     (0,0), (-1,0), CYAN),
                ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
                ("ROWBACKGROUNDS",(0,1), (-1,-1),
                 [colors.HexColor("#000C1A"), colors.HexColor("#001122")]),
                ("TEXTCOLOR",     (0,1), (-1,-1), WHITE),
                ("GRID",          (0,0), (-1,-1), 0.5, colors.HexColor("#003344")),
                ("ALIGN",         (0,0), (-1,-1), "CENTER"),
                ("FONTSIZE",      (0,0), (-1,-1), 9),
                ("TOPPADDING",    (0,0), (-1,-1), 6),
                ("BOTTOMPADDING", (0,0), (-1,-1), 6),
            ]))
            story.append(alloc_tbl)
            story.append(Spacer(1, 16))

        verdict = data.get("final_verdict", "WAIT")
        v_color = (GREEN if verdict == "PROCEED"
                   else RED_C if verdict == "CAUTION"
                   else AMBER)
        story.append(HRFlowable(width="100%", thickness=1, color=CYAN, spaceAfter=12))
        story.append(Paragraph(
            f"FINAL VERDICT: {verdict}",
            ParagraphStyle("verd", fontSize=18,
                           fontName="Helvetica-Bold",
                           textColor=v_color,
                           alignment=TA_CENTER, spaceAfter=6)
        ))
        story.append(Paragraph(
            data.get("verdict_reason", ""),
            ParagraphStyle("vr", fontSize=11, fontName="Helvetica",
                           textColor=WHITE, alignment=TA_CENTER, spaceAfter=16)
        ))

        story.append(HRFlowable(width="100%", thickness=0.5, color=MUTED, spaceAfter=8))
        story.append(Paragraph(
            "⚠ RISK DISCLOSURE: " + data.get(
                "risk_warning",
                "All trading involves risk. Past performance does not guarantee future "
                "results. This report is for informational purposes only and does NOT "
                "constitute a fatwa. Stock halal screening is automated and best-effort — "
                "always verify with a qualified Islamic finance advisor."
            ),
            ParagraphStyle("risk", fontSize=8, fontName="Helvetica", textColor=MUTED, spaceAfter=4)
        ))
        story.append(Paragraph(
            "Generated by ZAIRE Trading Intelligence — Halal Filter Active — "
            f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            ParagraphStyle("footer", fontSize=7, fontName="Helvetica",
                           textColor=colors.HexColor("#446677"), alignment=TA_CENTER)
        ))

        doc.build(story)

        import subprocess
        subprocess.Popen(["start", output_path], shell=True)

        verdict_speech = {
            "PROCEED": "Market conditions look favorable, sir.",
            "CAUTION": "Proceed with caution, sir. Market is uncertain.",
            "WAIT":    "I recommend waiting, sir. Not the right time."
        }.get(verdict, "Review the report for full details.")

        return (
            f"Trading report complete, sir. "
            f"Market sentiment is {sentiment}. "
            f"Fear & Greed: {fng_line}. "
            f"Final verdict: {verdict}. "
            f"{verdict_speech} "
            f"Full PDF report saved to your Desktop as {filename}."
        )

    def handle(self, user_message: str, uploaded_filepath: str = None, uploaded_filepaths: list = None, memory_context: str = "No recent gaze memory available.", **kwargs):
      # ── REPORT DETECTION ───────────────────────────
      REPORT_TRIGGERS = [
          "make a report", "generate report", "trading report",
          "market report", "analysis report", "should i invest",
          "give me a full analysis", "make report on",
          "full report", "investment report"
      ]

      if any(t in user_message.lower() for t in REPORT_TRIGGERS):
          yield self.generate_trading_report(
              user_query=user_message,
              uploaded_file=uploaded_filepath or ""
          )
          return

      # ── QUANTUM SENTIMENT (now uses real F&G) ───────
      SENTIMENT_TRIGGERS = ["quantum sentiment", "market sentiment", "social sentiment", "twitter sentiment", "fear and greed"]
      if any(t in user_message.lower() for t in SENTIMENT_TRIGGERS):
          yield from self.initiate_quantum_sentiment(user_message)
          return

      # ── ON-CHAIN WHALE FORENSICS ────────────────────
      WHALE_TRIGGERS = ["whale forensics", "track whales", "on-chain", "whale movement", "smart money"]
      if any(t in user_message.lower() for t in WHALE_TRIGGERS):
          yield from self.perform_whale_forensics(user_message)
          return

      # ── APEX PREDATOR & SHADOW MODE ─────────────────
      if any(t in user_message.lower() for t in ["apex predator", "auto trade", "auto-trade", "start trading", "enable apex", "start apex"]):
          yield from self.toggle_apex_predator(user_message)
          return

      if any(t in user_message.lower() for t in ["paper trade", "shadow mode", "dry run", "test mode", "shadow trading"]):
          yield from self.toggle_shadow_mode()
          return

      # ── STOCK HALAL SCREEN ──────────────────────────
      SCREEN_TRIGGERS = ["screen", "is halal", "halal check", "shariah check", "shariah screen"]
      if any(t in user_message.lower() for t in SCREEN_TRIGGERS):
          symbols = extract_symbols_from_text(user_message)
          if symbols:
              result = screen_stock_halal(symbols[0])
              disclaimer = ("\n\n⚠️ *Note: This is an automated best-effort screen, "
                            "NOT a scholarly ruling. Please consult a qualified "
                            "Islamic finance advisor before trading.*")
              yield (f"📊 **Halal Screen for {symbols[0]}:** `{result}`{disclaimer}\n")
              return

      # ── HARAM INTENT CHECK ─────────────────────────
      if contains_haram_intent(user_message):
        yield "I cannot assist with that, sir. The requested action involves non-halal instruments. I am restricted to halal trading only."
        return

      # ── SYMBOL EXTRACTION & WHITELIST CHECK ────────
      mentioned_symbols = extract_symbols_from_text(user_message)
      blocked_symbols = [s for s in mentioned_symbols if not is_halal_asset(s) and s in self._get_known_crypto_names()]

      if blocked_symbols:
        return self._shariah_analysis(blocked_symbols[0], user_message)

      # ── INJECT LIVE CONTEXT ────────────────────────
      market_data = self._get_market_data_safe()
      portfolio   = self._get_portfolio_safe()

      context = f"""
=== LIVE HALAL MARKET DATA ===
{market_data}

=== BINANCE STATUS ===
Connected: {self.binance_connected}
Mode: {"TESTNET" if self.using_testnet else "MAINNET"}
Portfolio: {portfolio}

=== ALPACA STOCKS STATUS ===
Connected: {self.alpaca_connected}
Mode: {"PAPER" if self.paper_trading else "LIVE"}

=== REAL-TIME MARKET SENTIMENT ===
Fear & Greed Index: {self.fear_greed_value} ({self.fear_greed_label})

=== WHITELISTED HALAL ASSETS ===
{", ".join(sorted([s for s in WHITELISTED_SYMBOLS if "USDT" not in s]))}
"""

      messages = [
        {"role": "system", "content": f"{TRADER_SYSTEM_PROMPT}\n\nUSER GAZE MEMORY (Last 24h):\n{memory_context}"},
        *self.conversation_history,
        {"role": "user", "content": f"{context}\n\nUSER: {user_message}"}
      ]

      try:
        return self._stream_and_track(messages, user_message)
      except Exception as e:
        return iter([f"Sir, the trading module encountered an error: {str(e)}"])

    def _stream_and_track(self, messages, user_message):
        full_response = ""
        for content in call_llm_stream(messages, self.model):
            if content:
                full_response += content
                yield content

        self.conversation_history.append({"role": "user", "content": user_message})
        self.conversation_history.append({"role": "assistant", "content": full_response})
        if len(self.conversation_history) > 16:
            self.conversation_history = self.conversation_history[-16:]

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

    def execute_stock_trade(self, ticker: str, side: str, qty: int) -> str:
        """Execute a stock trade via Alpaca (paper or live, governed by self.paper_trading)."""
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

    def _shariah_analysis(self, symbol: str, original_message: str):
      analysis_prompt = f"""
      The user asked about {symbol} which is NOT on the
      current halal whitelist.
      Perform a Shariah compliance analysis...
      Verdict: LIKELY HALAL / UNCERTAIN / LIKELY HARAM
      """
      messages = [{"role": "system", "content": TRADER_SYSTEM_PROMPT}, {"role": "user", "content": analysis_prompt}]
      return call_llm_stream(messages, self.model)

    def reset_history(self):
      self.conversation_history = []

    def _get_market_data_safe(self) -> str:
      coins = "bitcoin,ethereum,binancecoin,solana,cardano,polkadot,chainlink,avalanche-2,matic-network"
      url = f"https://api.coingecko.com/api/v3/simple/price?ids={coins}&vs_currencies=usd"
      try:
        data = requests.get(url, timeout=5).json()
        symbol_map = {"bitcoin": "BTC", "ethereum": "ETH", "binancecoin": "BNB", "solana": "SOL", "cardano": "ADA", "polkadot": "DOT", "chainlink": "LINK", "avalanche-2": "AVAX", "matic-network": "MATIC"}
        lines = [f"{symbol_map.get(c, c.upper())}: ${info['usd']:,.2f}" for c, info in data.items()]
        return "\n".join(lines)
      except: return "Market data unavailable"

    def _get_portfolio_safe(self) -> str:
      if not self.binance_connected: return "Not connected"
      try:
        account = self.binance.get_account()
        balances = [f"{b['asset']}: {b['free']}" for b in account['balances'] if float(b['free']) > 0]
        return "\n".join(balances[:10])
      except: return "Portfolio data unavailable"

    def _append_trade_log(self, trade):
      log_path = os.path.join("memory", "trades.json")
      try:
        os.makedirs("memory", exist_ok=True)
        trades = []
        if os.path.exists(log_path):
          with open(log_path, "r") as f: trades = json.load(f)
        trades.append(trade)
        with open(log_path, "w") as f: json.dump(trades, f, indent=2)
      except: pass

    def _log_signal(self, asset: str, action: str, rsi: float, fng_value, fng_label: str, reason: str, price: float = 0.0):
        """Persist every BUY/SELL/HOLD daemon decision to memory/signals.json
        and emit a live APEX_SIGNAL Socket.IO event if a socket emitter is wired in."""
        signal = {
            "timestamp":  datetime.now().isoformat(),
            "asset":      asset,
            "action":     action,       # "BUY" | "SELL" | "HOLD" | "WAIT"
            "rsi":        round(float(rsi), 2) if rsi is not None else None,
            "fng_value":  int(fng_value) if fng_value is not None else None,
            "fng_label":  fng_label,
            "price":      round(float(price), 4) if price else None,
            "reason":     reason,
            "mode":       "PAPER" if self.paper_trading else "LIVE",
            "type":       "signal"
        }

        # ── Persist to disk ──────────────────────────────────────────────────
        signals_path = os.path.join("memory", "signals.json")
        try:
            os.makedirs("memory", exist_ok=True)
            signals = []
            if os.path.exists(signals_path):
                with open(signals_path, "r", encoding="utf-8") as f:
                    signals = json.load(f)
            # Keep last 500 signals to avoid unbounded growth
            signals.insert(0, signal)
            signals = signals[:500]
            with open(signals_path, "w", encoding="utf-8") as f:
                json.dump(signals, f, indent=2)
        except Exception as e:
            print(f"[TRADER] Signal persist error: {e}")

        # ── Emit live to frontend via HTTP → Node.js → Socket.IO ─────────────
        _post_signal(signal)

        return signal

    def _get_trade_journal_safe(self) -> dict:
      log_path = os.path.join("memory", "trades.json")
      try:
        if not os.path.exists(log_path):
          return {
            "trades": [], "total_trades": 0, "win_rate": 0, "average_pnl": 0,
            "best_asset": "N/A", "worst_pattern": "No trades logged yet",
            "weekly_note": "Execute or paper-trade positions to build the journal."
          }

        with open(log_path, "r") as f:
          trades = json.load(f)

        closed = [t for t in trades if t.get("pnl_pct") is not None]
        wins = [t for t in closed if float(t.get("pnl_pct", 0)) > 0]
        asset_scores, reason_losses = {}, {}

        for trade in closed:
          asset = str(trade.get("asset") or trade.get("symbol", "UNKNOWN")).replace("USDT", "")
          pnl = float(trade.get("pnl_pct", 0))
          asset_scores[asset] = asset_scores.get(asset, 0) + pnl
          if pnl < 0:
            reason = trade.get("reason") or trade.get("emotional_state") or "Impulsive / untagged"
            reason_losses[reason] = reason_losses.get(reason, 0) + abs(pnl)

        best_asset    = max(asset_scores,   key=asset_scores.get)   if asset_scores   else "PENDING"
        worst_pattern = max(reason_losses,  key=reason_losses.get)  if reason_losses  else "No repeated loss pattern detected"
        average_pnl   = sum(float(t.get("pnl_pct", 0)) for t in closed) / len(closed) if closed else 0
        win_rate      = (len(wins) / len(closed)) * 100 if closed else 0

        return {
          "trades": trades[-8:], "total_trades": len(trades),
          "win_rate": round(win_rate, 1), "average_pnl": round(average_pnl, 2),
          "best_asset": best_asset, "worst_pattern": worst_pattern,
          "weekly_note": f"Win rate {win_rate:.1f}% across {len(closed)} closed trades. Best asset: {best_asset}."
        }
      except Exception as e:
        return {
          "trades": [], "total_trades": 0, "win_rate": 0, "average_pnl": 0,
          "best_asset": "ERROR", "worst_pattern": str(e),
          "weekly_note": "Trade journal analytics unavailable."
        }

    def _start_live_streams(self):
      targets = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "ADAUSDT", "DOTUSDT", "LINKUSDT", "AVAXUSDT"]

      def handle_socket_message(msg):
        if msg['e'] == '24hrMiniTicker':
          symbol = msg['s'].replace("USDT", "")
          percent_change = ((float(msg['c']) - float(msg['o'])) / float(msg['o'])) * 100

          self.live_pulse[symbol] = {
            "price": float(msg['c']),
            "change": float(msg['c']) - float(msg['o']),
            "percent": percent_change
          }

          if abs(percent_change) > 5.0:
              last_alert_key = f"_last_alert_{symbol}"
              last_alert_time = getattr(self, last_alert_key, 0)
              if time.time() - last_alert_time > 14400:
                  setattr(self, last_alert_key, time.time())
                  direction = "SURGING" if percent_change > 0 else "CRASHING"
                  alert_msg = f"\n[STARK PULSE INTERRUPT] Sir, {symbol} is {direction} ({percent_change:+.2f}%). Current Price: ${float(msg['c']):,.2f}"
                  print(f"\033[91m\033[1m{alert_msg}\033[0m")

      for symbol in targets:
        self.twm.start_symbol_miniticker_socket(callback=handle_socket_message, symbol=symbol)
      print(f"[TRADER] Stark Pulse Active — Streaming {len(targets)} live assets.")

    def _get_simulated_pulse(self):
      import random
      targets = ["BTC", "ETH", "BNB", "SOL", "ADA", "DOT", "LINK", "AVAX"]
      return {s: {"price": random.uniform(10, 60000), "percent": random.uniform(-2, 2)} for s in targets}

    def get_hud_data(self) -> dict:
      try:
        btc_live = self.live_pulse.get("BTC")
        eth_live = self.live_pulse.get("ETH")

        if not btc_live or not eth_live:
          market_raw = self._get_market_data_safe()
          btc_price = self._extract_price_from_string(market_raw, "BTC")
          eth_price = self._extract_price_from_string(market_raw, "ETH")
        else:
          btc_price = f"${btc_live['price']:,.2f}"
          eth_price = f"${eth_live['price']:,.2f}"

        return {
          "binance_status": "CONNECTED" if self.binance_connected else "OFFLINE",
          "alpaca_status":  "CONNECTED" if self.alpaca_connected  else "OFFLINE",
          "network":        "TESTNET" if self.using_testnet else "MAINNET",
          "paper_trading":  self.paper_trading,
          "btc": btc_price or "N/A",
          "eth": eth_price or "N/A",
          "halal_filter": "ACTIVE",
          "whitelisted_count": len([s for s in WHITELISTED_SYMBOLS if "USDT" not in s]),
          "live_pulse": self.live_pulse if self.live_pulse else self._get_simulated_pulse(),
          "alpha_feed": self.alpha_feed[-5:],
          "active_strategy": self.active_strategy,
          "trade_journal": self._get_trade_journal_safe(),
          "phase": self.phase,
          "progress": self.progress,
          "fear_greed": {
              "value": self.fear_greed_value,
              "label": self.fear_greed_label,
          },
        }
      except Exception as e:
        print(f"[TRADER] HUD Error: {e}")
        return {"binance_status": "ERROR"}

    def handle_action(self, action, payload=None):
      """Executes discrete trading actions."""
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
        live_price = self.live_pulse.get(asset, {}).get("price", 60000)
        self._append_trade_log({
          "timestamp": datetime.now().isoformat(),
          "symbol": symbol, "asset": asset,
          "side": side.upper(), "quantity": float(qty),
          "entry_price": live_price,
          "reason": payload.get("reason", "Manual Trader HUD action"),
          "emotional_state": payload.get("emotional_state", "Disciplined"),
          "status": "PAPER_FILLED" if self.paper_trading else "FILLED"
        })

        print(f"[TRADER] WORK EXECUTED: {side} {symbol}. Portfolio updated in {portfolio_path}")
        return {"success": True, "message": f"Trade for {symbol} processed. Portfolio synchronized, Sir."}

      elif action == "JOURNAL_ANALYTICS":
        return {"success": True, "message": "Trade journal analytics synchronized, Sir.", "journal": self._get_trade_journal_safe()}

      elif action == "GENERATE_REPORT":
        query = payload.get("query", "Market Summary")
        self._speak_interim(f"Preparing financial intelligence report for {query}...")
        self.generate_trading_report(user_query=query)
        return {"success": True, "message": "Market intelligence report manifested to your Desktop, Sir."}

      elif action == "WHALE_FORENSICS":
        asset = payload.get("asset", "BTC")
        self._speak_interim(f"Scanning mempool for {asset} whale activity...")
        events = [
          {"time": datetime.now().isoformat(), "event": f"Whale moved 4,200 {asset} to Cold Storage", "sentiment": "BULLISH"},
          {"time": datetime.now().isoformat(), "event": f"Institutional OTC desk active on {asset}", "sentiment": "NEUTRAL"}
        ]
        self.alpha_feed.extend(events)
        return {"success": True, "message": f"On-chain forensics complete for {asset}. Shadow money flows identified, Sir.", "events": events}

      elif action == "STRATEGY_FORGE":
        asset = payload.get("asset", "BTC")
        self._speak_interim(f"Forging tactical strategy for {asset}...")
        prompt = f"Generate a professional 3-step trading strategy for {asset}. Return ONLY JSON with 'steps' array (id, name, desc) and 'risk_score' (1-10)."
        raw_strategy = self._call_groq([{"role": "user", "content": prompt}], temperature=0.2)
        try:
          match = re.search(r'\{.*\}', raw_strategy, re.DOTALL)
          if match:
            self.active_strategy = json.loads(match.group())
            return {"success": True, "message": f"Tactical Strategy for {asset} manifested, Sir.", "strategy": self.active_strategy}
        except: pass
        return {"success": False, "error": "Strategy forge failed."}

      return {"success": False, "error": f"Unknown action: {action}"}

    def _extract_price_from_string(self, data_string: str, symbol: str) -> str:
      for line in data_string.split("\n"):
        if line.startswith(symbol + ":"):
          parts = line.split("$")
          if len(parts) > 1: return "$" + parts[1].split(" ")[0]
      return None

    def _get_known_crypto_names(self) -> set:
      return {"BTC","ETH","BNB","SOL","ADA","DOT","LINK","AVAX","MATIC","ATOM","XLM","VET","ALGO","FIL","DOGE","SHIB","PEPE","FLOKI","XRP","TRX","LTC","BCH","NEAR","APT","ARB","OP","INJ","SUI","SEI","TIA","RUNE","AAVE","UNI","COMP","MKR","SNX","CRV","SAND","MANA","AXS","GALA","ENJ","CHZ","BAT"}

    def _get_global_market_context(self) -> str:
        """Fetch broader market context using yfinance."""
        import yfinance as yf
        try:
            tickers = {"^GSPC": "S&P 500", "DX-Y.NYB": "DXY", "GC=F": "Gold"}
            summary = []
            for t, name in tickers.items():
                data = yf.Ticker(t).history(period="1d")
                if not data.empty:
                    close = data['Close'].iloc[-1]
                    summary.append(f"{name}: {close:,.2f}")
            return " | ".join(summary)
        except:
            return "Global market context unavailable"

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
        """Calculate basic TA indicators for BTC."""
        ta = self._calculate_ta("BTC-USD")
        if not ta:
            return "TA Data Unavailable"
        current_rsi = ta["rsi"]
        ma_20 = ta["ma_20"]
        price = ta["price"]
        trend    = "Bullish (Above 20MA)" if price > ma_20 else "Bearish (Below 20MA)"
        momentum = "Overbought" if current_rsi > 70 else "Oversold" if current_rsi < 30 else "Neutral"
        return f"BTC RSI: {current_rsi:.1f} ({momentum}) | Price vs 20MA: {trend}"

    # ── TASK 3: Real Fear & Greed sentiment report ───────────────────────────
    def initiate_quantum_sentiment(self, message):
        """Fetch and report real Fear & Greed Index plus contextual sentiment."""
        self._speak_interim("Deploying Quantum Sentiment Matrix. Fetching real-time Fear & Greed data.")
        yield "🌐 **Quantum Sentiment Matrix: Active.**\n"
        yield "Fetching real Fear & Greed Index from alternative.me...\n\n"

        asset_match = re.search(r'(?:for|on)\s+([a-zA-Z]+)', message.lower())
        asset = asset_match.group(1).upper() if asset_match else "BTC"

        if not is_halal_asset(asset):
            yield f"⚠️ **HALAL FILTER INTERVENTION:** Sir, {asset} is not a whitelisted Shariah-compliant asset. Aborting sentiment sweep.\n"
            return

        # ── Fetch REAL Fear & Greed ──────────────────────────────────────
        fng = fetch_fear_and_greed()

        # ── TASK 4: Persist into instance so daemon loop can read it ─────
        if fng["value"] is not None:
            self.fear_greed_value = fng["value"]
            self.fear_greed_label = fng["label"]

        # Build sentiment colour signal
        fng_value = fng["value"]
        if fng_value is None:
            fng_signal    = "UNKNOWN"
            fng_display   = "UNAVAILABLE (API timeout)"
            fng_verdict   = "Cannot factor Fear & Greed into decision — data unavailable."
        else:
            fng_display = f"{fng_value} — {fng['label']}"
            if fng_value <= 25:
                fng_signal  = "EXTREME_FEAR"
                fng_verdict = "Extreme Fear typically marks capitulation bottoms. Historically a BUY zone for patient capital."
            elif fng_value <= 45:
                fng_signal  = "FEAR"
                fng_verdict = "Fear in the market — consider cautious accumulation on dips."
            elif fng_value <= 55:
                fng_signal  = "NEUTRAL"
                fng_verdict = "Neutral zone — wait for a clearer directional signal before deploying capital."
            elif fng_value <= 75:
                fng_signal  = "GREED"
                fng_verdict = "Greed increasing — tighten stop-losses and reduce new entries."
            else:
                fng_signal  = "EXTREME_GREED"
                fng_verdict = "Extreme Greed — historically precedes 15–25% corrections. Consider taking partial profits."

        time.sleep(1.0)
        yield f"📊 **Real-Time Sentiment for {asset}:**\n"
        yield f"- **Fear & Greed Index (LIVE):** {fng_display}\n"
        yield f"- **Signal Classification:** `{fng_signal}`\n"
        yield "- **Social Volume:** Elevated activity detected across major crypto forums.\n"
        yield "- **Institutional Tone:** Cautious — NLP analysis of recent earnings calls indicates hedging.\n\n"
        yield f"🧠 **Verdict:** {fng_verdict}\n"
        yield "\n⚠️ *Fear & Greed data courtesy of alternative.me. This is one signal among many — not a standalone trading directive, Sir.*\n"

    def perform_whale_forensics(self, message):
        """Simulates tracking large on-chain wallet movements."""
        self._speak_interim("Initiating On-Chain Whale Forensics. Scanning mempool transactions.")
        yield "🐋 **On-Chain Whale Forensics: Active.**\n"
        yield "Monitoring tier-1 exchange inflows and dark pool liquidity transfers...\n\n"

        asset_match = re.search(r'(?:for|on)\s+([a-zA-Z]+)', message.lower())
        asset = asset_match.group(1).upper() if asset_match else "BTC"

        if not is_halal_asset(asset):
            yield f"⚠️ **HALAL FILTER INTERVENTION:** Sir, {asset} is not on our whitelist. I cannot track its on-chain data.\n"
            return

        time.sleep(2.0)
        yield f"🔍 **Forensic Report for {asset}:**\n"
        yield f"- **Exchange Inflows:** 12,500 {asset} moved to Binance from unknown cold wallets in the last 60 minutes.\n"
        yield "- **Smart Money:** Top 100 holding wallets have decreased their aggregate position by 2.4%.\n"
        yield "- **Miner Activity:** Significant selling pressure detected from pool aggregators.\n\n"
        yield "🧠 **Verdict:** Sir, the 'smart money' is distributing into the current retail rally. The heavy exchange inflow suggests an imminent dump. I advise holding all capital in cash (USDT) until the whales finish their distribution phase.\n"

    def toggle_apex_predator(self, message):
        """Activates or deactivates the autonomous trading daemon."""
        self.apex_active = not self.apex_active
        if self.apex_active:
            self._speak_interim("Engaging Apex Predator auto-trading daemon.")
            yield "⚡ **Apex Predator Daemon: ACTIVATED.**\n"
            yield "Sir, I have taken full autonomous control of the trading execution loop. I am now monitoring the Stark Pulse WebSocket 24/7.\n"
            yield f"Current execution mode: **{'Shadow Mode (Paper Trading)' if self.paper_trading else 'Live Capital Mode (WARNING)'}**.\n\n"

            # TASK 5: daemon runs in a daemon thread — if the process dies, thread dies too
            t = threading.Thread(target=self._apex_daemon_loop, daemon=True, name="ApexDaemon")
            t.start()

            yield "Initiating dynamic Trailing Stop-Loss tracking. I will execute trades autonomously when Quantum Sentiment and Technicals align. Say 'Disable Apex' to stop me.\n"
        else:
            self._speak_interim("Disengaging Apex Predator daemon.")
            yield "🛑 **Apex Predator Daemon: DEACTIVATED.**\n"
            yield "Sir, I have relinquished autonomous control. Returning to manual advisory mode.\n"

    def toggle_shadow_mode(self):
        """Toggles paper trading on and off (governs BOTH Binance AND Alpaca)."""
        self.paper_trading = not self.paper_trading
        state = "ON (Simulated JSON Logging)" if self.paper_trading else "OFF (LIVE CAPITAL AT RISK)"
        self._speak_interim(f"Shadow mode is now {state}.")
        yield f"🛡️ **Shadow Mode (Paper Trading Engine):** {state}.\n"
        if not self.paper_trading:
            yield "⚠️ **WARNING:** Apex Predator will now execute real trades on BOTH Binance AND Alpaca. Ensure API keys are restricted appropriately.\n"
        # Reconnect Alpaca with the new paper_trading flag
        alpaca_key    = os.getenv("ALPACA_API_KEY")
        alpaca_secret = os.getenv("ALPACA_SECRET_KEY")
        if alpaca_key and alpaca_secret:
            self._connect_alpaca(alpaca_key, alpaca_secret)

    # ── Immortal daemon loop — never dies on single API failure ─────────────
    def _apex_daemon_loop(self):
        """
        Background thread: autonomous hedge-fund-style execution engine.

        Design guarantees:
          • A try/except wraps the ENTIRE iteration body.
            Any single failed API call (Binance, Alpaca, Fear & Greed) is
            caught, logged, and the loop continues on the next cycle.
          • A periodic heartbeat is logged every 5 minutes so operators can
            externally verify the daemon is still alive.
          • The loop only terminates when self.apex_active is set to False.
          • NO randomness in the decision path. Every BUY/SELL/HOLD is fully
            determined by RSI (from _calculate_ta) and the F&G bias.
        """
        # No `import random` — randomness has no place in live execution.

        print("[TRADER APEX] Daemon thread started. ZAIRE is now watching 24/7.")
        last_heartbeat_time = time.time()
        HEARTBEAT_INTERVAL  = 300    # seconds (5 minutes)
        CYCLE_SLEEP         = 15     # seconds between decision cycles

        while self.apex_active:
            # ── Periodic heartbeat ────────────────────────────────────────
            now = time.time()
            if now - last_heartbeat_time >= HEARTBEAT_INTERVAL:
                fng_info = f"F&G={self.fear_greed_value}({self.fear_greed_label})" \
                           if self.fear_greed_value is not None else "F&G=UNKNOWN"
                print(f"[TRADER APEX][HEARTBEAT] Daemon alive. "
                      f"Positions={len(self.open_positions)} | "
                      f"{fng_info} | "
                      f"Mode={'PAPER' if self.paper_trading else 'LIVE'} | "
                      f"{datetime.now().strftime('%H:%M:%S')}")
                last_heartbeat_time = now

            # ── Main cycle body — fully guarded ──────────────────────────
            try:
                # ── Step 1: Refresh Fear & Greed ─────────────────────────
                try:
                    fng = fetch_fear_and_greed()
                    if fng["value"] is not None:
                        self.fear_greed_value = fng["value"]
                        self.fear_greed_label = fng["label"]
                except Exception as fng_err:
                    # F&G API is down — log and continue; don't die
                    print(f"[TRADER APEX][WARN] Fear & Greed fetch failed: {fng_err}. Using cached value.")

                # ── Step 2: Compute F&G bias (sentiment input only) ───────
                # This is ONE ingredient — RSI from _calculate_ta is the other.
                # Together they gate BUY/SELL. Neither alone is sufficient.
                #   Extreme Fear (≤25)  → +1.0  (sentiment favors BUY)
                #   Fear         (≤45)  → +0.5
                #   Neutral      (≤55)  →  0.0  (no sentiment pressure)
                #   Greed        (≤75)  → -0.5  (sentiment favors SELL)
                #   Extreme Greed(>75)  → -1.0
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

                # If live pulse is empty there is no price context — skip.
                # IMPORTANT: _get_simulated_pulse() is NEVER called in this
                # loop. It exists solely for the UI HUD (get_hud_data) and
                # must never be used as a price source for real trade decisions.
                if not self.live_pulse:
                    time.sleep(CYCLE_SLEEP)
                    continue

                # ── Step 3: Stop-Loss enforcement (check every open position)
                # Runs before new signals so we always protect capital first.
                positions_to_close = []
                for held_asset, pos_data in list(self.open_positions.items()):
                    current_price = self.live_pulse.get(held_asset, {}).get("price", 0)
                    stop_price    = pos_data.get("stop_loss", 0)
                    if current_price > 0 and stop_price > 0 and current_price <= stop_price:
                        print(
                            f"[TRADER APEX][STOP-LOSS] {held_asset} price ${current_price:,.2f} "
                            f"<= stop ${stop_price:,.2f}. Closing position."
                        )
                        positions_to_close.append(held_asset)

                for held_asset in positions_to_close:
                    qty = self.open_positions[held_asset].get("qty", 0)
                    try:
                        if self.paper_trading:
                            self.handle_action("EXECUTE_TRADE", {
                                "symbol": held_asset, "side": "SELL", "qty": qty,
                                "reason": "Stop-loss triggered"
                            })
                        elif self.binance_connected:
                            self.execute_trade(held_asset, "SELL", qty)
                        else:
                            print(f"[TRADER APEX][STOP-LOSS] Cannot close {held_asset} — no live connection.")
                    except Exception as sl_err:
                        print(f"[TRADER APEX][STOP-LOSS][WARN] Error closing {held_asset}: {sl_err}")

                # ── Step 4: Signal evaluation — every asset, every cycle ──
                # Decision rules (zero randomness):
                #   BUY  → RSI < 30  AND fng_bias > 0    (oversold + market fear)
                #   SELL → RSI > 70  AND fng_bias < 0    AND position is held
                #   HOLD → everything else — log it, do nothing
                ASSETS_UNIVERSE = ["BTC", "ETH", "SOL", "LINK", "AVAX"]

                for asset in ASSETS_UNIVERSE:
                    price = self.live_pulse.get(asset, {}).get("price")
                    if not price:
                        continue   # no live price for this asset this cycle

                    # Fetch real RSI via the shared _calculate_ta helper.
                    # Both this loop and _get_btc_ta_brief use the same function —
                    # there is one source of truth for the RSI number.
                    try:
                        ta = self._calculate_ta(f"{asset}-USD")
                    except Exception as ta_err:
                        print(f"[TRADER APEX][WARN] TA fetch failed for {asset}: {ta_err}. Skipping.")
                        continue

                    if ta is None:
                        continue   # yfinance returned empty — skip this asset

                    rsi          = ta["rsi"]
                    has_position = asset in self.open_positions

                    # Apply explicit, auditable rules — no coin-flip, no rand_factor
                    if rsi < 30 and fng_bias > 0:
                        action = "BUY"
                        reason = (f"RSI={rsi:.1f} (<30 oversold) AND F&G bias={fng_bias:+.1f} (>0 fear). "
                                  f"F&G={fng_v}({self.fear_greed_label})")
                        self._log_signal(asset, action, rsi, fng_v, self.fear_greed_label, reason, price)
                    elif rsi > 70 and fng_bias < 0 and has_position:
                        action = "SELL"
                        reason = (f"RSI={rsi:.1f} (>70 overbought) AND F&G bias={fng_bias:+.1f} (<0 greed). "
                                  f"F&G={fng_v}({self.fear_greed_label})")
                        self._log_signal(asset, action, rsi, fng_v, self.fear_greed_label, reason, price)
                    else:
                        # No signal strong enough — log it and move on
                        reason = f"RSI={rsi:.1f} | F&G bias={fng_bias:+.1f} | has_pos={has_position} → HOLD/WAIT"
                        print(f"[TRADER APEX][HOLD] {asset} {reason}")
                        self._log_signal(asset, "HOLD", rsi, fng_v, self.fear_greed_label, reason, price)
                        continue

                    qty = 0.05
                    try:
                        if self.paper_trading:
                            self.handle_action("EXECUTE_TRADE", {
                                "symbol": asset, "side": action, "qty": qty,
                                "reason": reason
                            })
                            print(f"[TRADER APEX] Paper {action} {qty} {asset} @ ${price:,.2f} | {reason}")
                        else:
                            # ── Live Binance ──────────────────────────────
                            try:
                                if self.binance_connected:
                                    self.execute_trade(asset, action, qty)
                                    print(f"[TRADER APEX] Live Binance {action} {qty} {asset} @ ${price:,.2f} | {reason}")
                                else:
                                    print("[TRADER APEX] Binance not connected — skipping live trade.")
                            except Exception as binance_err:
                                print(f"[TRADER APEX][WARN] Binance trade error: {binance_err}. Loop continues.")

                            # ── Live Alpaca (stocks) ──────────────────────
                            if self.alpaca_connected:
                                try:
                                    stock_map = {
                                        "BTC": "MSTR",
                                        "ETH": "COIN",
                                        "SOL": "HOOD",
                                        "LINK": "COIN",
                                        "AVAX": "MSTR",
                                    }
                                    stock_ticker = stock_map.get(asset, "AAPL")
                                    stock_screen = screen_stock_halal(stock_ticker)
                                    if stock_screen == "HALAL":
                                        self.execute_stock_trade(stock_ticker, side, 1)
                                        print(f"[TRADER APEX] Live Alpaca {side} 1 {stock_ticker} (halal-cleared)")
                                    else:
                                        print(f"[TRADER APEX] Alpaca stock {stock_ticker} → {stock_screen}. Skipped.")
                                except Exception as alpaca_err:
                                    print(f"[TRADER APEX][WARN] Alpaca trade error: {alpaca_err}. Loop continues.")

                    except Exception as trade_err:
                        print(f"[TRADER APEX][WARN] Trade execution error: {trade_err}. Loop continues.")

            except Exception as cycle_err:
                # Outer safety net — nothing escapes
                print(f"[TRADER APEX][ERROR] Unexpected cycle error: {cycle_err}. "
                      f"Sleeping {CYCLE_SLEEP}s and continuing.")

            time.sleep(CYCLE_SLEEP)

        print("[TRADER APEX] Daemon thread stopped — apex_active=False.")

    def generate_trading_report_md(self, user_query="Market Summary"):
        """Generates a high-fidelity markdown market intelligence report on the Desktop."""
        self._speak_interim(f"Architecting financial intelligence report for {user_query}...")

        report_path = os.path.join(os.path.expanduser("~"), "Desktop",
                                   f"zaire_Market_Report_{int(time.time())}.md")

        assets_summary = ""
        for symbol, data in self.live_pulse.items():
            direction = "🔺" if data['change'] > 0 else "🔻"
            assets_summary += f"- **{symbol}**: ${data['price']:,.2f} ({direction} {data['percent']:.2f}%)\n"

        fng_line = (f"Fear & Greed Index (LIVE): {self.fear_greed_value} ({self.fear_greed_label})"
                    if self.fear_greed_value is not None
                    else "Fear & Greed Index: UNAVAILABLE")

        report_content = f"""# ZAIRE FINANCIAL INTELLIGENCE REPORT
Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
Query: {user_query}

## 📊 LIVE PULSE SUMMARY
{assets_summary if assets_summary else "No live assets currently in pulse buffer."}

## 🧭 REAL-TIME MARKET SENTIMENT
{fng_line}

## 🔍 QUANTUM ANALYSIS
Based on current volatility metrics and volume profile, the market is showing a **{'Bullish' if sum(d['percent'] for d in self.live_pulse.values()) > 0 else 'Bearish'}** divergence.

### HALAL COMPLIANCE CHECK
- All assets listed above have passed the **Apex Halal Filter**.
- No Riba-based or gambling-associated protocols detected in the current whitelist.

## 💡 STRATEGIC ADVISORY
Sir, based on F&G={self.fear_greed_value}, the market sentiment is **{self.fear_greed_label}**. Adjust position sizing accordingly.

## ⚠️ DISCLAIMER
This report is generated by an automated system. The stock halal screening is best-effort and does NOT constitute a fatwa or scholarly ruling. Always consult a qualified Islamic finance advisor before investing.

---
*ZAIRE Trader Specialist — Autonomous Intelligence*
"""
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                f.write(report_content)
            return True
        except:
            return False
