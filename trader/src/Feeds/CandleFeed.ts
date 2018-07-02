import {Subject} from 'rxjs/Subject';
import {Candle} from "../../../common/Candle";
import {ExchangeMatch} from "../../../common/ExchangeMatch";
import {BigNumber} from "bignumber.js/bignumber";
import {Exchange} from "../Exchanges/Exchange";

/**
 * Represents a feed of candle points, which are batched order prices for a timeframe (e.g. 15 minutes)
 */
export abstract class CandleFeed {
    public onNewCandle$: Subject<Candle>;
    public onMatch$: Subject<ExchangeMatch>;
    public exchange: Exchange;
    
    public candles: Candle[];
    public currentPrice: BigNumber = new BigNumber(0);
    
    protected destroyed: boolean;

    constructor(exchange: Exchange) {
        this.exchange = exchange;
        this.candles = [];
        this.onNewCandle$ = new Subject<Candle>();
        this.onMatch$ = new Subject<ExchangeMatch>();
    }

    public abstract async load();
    public abstract async start();
    public abstract async destroy();

    public subscribe(fn: (candle: Candle) => void) {
        this.onNewCandle$.subscribe(fn);
    }
    
    protected emit(candle: Candle) {
        if (candle) {
            this.currentPrice = new BigNumber(candle.close);
            this.candles.push(candle);
            this.onNewCandle$.next(candle);
        }
    }

    /**
     * Emits the match event signaling two orders were matched.
     */
    protected match(match: ExchangeMatch) {
        this.currentPrice = new BigNumber(match.price);
        this.onMatch$.next(match);
    }
}