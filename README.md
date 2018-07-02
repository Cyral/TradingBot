# Trading Bot

This is a work-in-progress cryptocurrency trading bot.

**Disclaimer:** This project was last active in 2017, the APIs used for live trading may or may not work anymore. There are unresolved bugs with this bot, and it is not recommended for live trading outside of experimental use. I am not an expert and the terminology used in this project may not be 100% correct.+

### Features:

- Live trading with GDAX (now Coinbase Pro) via their Financial Information Exchange (FIX) API. 
  - This enables much faster trading than their standard HTTP API. See [my fork](https://github.com/Cyral/gdax-node) of gdax-node which adds FIX support.
- Simple API for adding new exchanges, technical indicators, and strategies.
- Backtesting mode for strategies against historical data.

### How to Run:

Just `docker-compose up` :)

To use live trading, switch to the GDAXExchange in Trader.ts and create a gdax.dat file in trader/config/ that contains
your API key, secret, and passphrase on three separate lines.

The web UI will show a graph of the price and any indicators that are plotted with the strategy. It also shows the
market history, trade history, and the current price and gain of the market versus the bot. The buy and sell buttons allow
for manual trades to be placed. A key feature of this is that when a buy or sell is attempted, the bot will cancel and replace
the order if the price moves. This allows for quick trading at the market price without paying the maker fees, but it does have
the potential to trade at prices you don't expect if the liquidity is too low.

### Design:

There are three applications that are needed to run the full trader:

- Web UI Frontend (using Preact)
- Web UI Backend
- Trading Bot

The trading bot communicates with the UI backend to store trading data and history, which is sent to the frontend via WebSockets.

There is an additional data-downloader application to fetch historical data from GDAX.

Technologies used: TypeScript, Node.js, Preact, Webpack, Docker, NGINX, Redis, MongoDB

### Creating a Strategy:

To create a trading strategy, you must implement the `Strategy` class.

To choose the current strategy and exchange, see the `setup` function of Trader.ts.

##### Example Strategy:

This strategy uses two exponential moving averages to determine when the price switches direction. This is just an example,
and while this method works great when backtesting without a delay, it will usually lose money with live trading. This is
why this bot supports backtesting with execution delays, as order execution timing is critical to accurate testing because in the real world orders may take a while to be matched.

```
export class EMAStrategy extends Strategy {
  private fast: EMAIndicator;
  private slow: EMAIndicator;
  private price: OHLCIndicator;

  constructor() {
    super();

    // The current price, represented as an Open/High/Low/Close stream.
    this.price = this.addIndicator(new OHLCIndicator());

    // Two exponential moving average indicators based off the close price.
    this.fast = this.addIndicator(new EMAIndicator(this.price.close, 20));
    this.slow = this.addIndicator(new EMAIndicator(this.price.close, 50));
  }

  // This function is called by the exchange when new data (e.g. an OHLC candle) is ready.
  tick() {
    // These two are not used for this strategy but could be useful.
    const currentPrice = this.price.getCurrent().open;
    const date = this.price.getCurrent().date;

    // If the slow EMA crosses the fast EMA, buy, if the opposite is true, sell.
    if (this.crossover(this.fast, this.slow)) {
      this.buy();
    } else if (this.crossunder(this.fast, this.slow)) {
      this.sell();
    }
    
    // Plot the EMA graph on the web UI.
    this.plot(this.fast);
    this.plot(this.slow);
  }
}
```