import {CandleFeed} from "./CandleFeed";
import {Candle} from "../../../common/Candle";
import {Utils} from "../Utils";
import {ExchangeMatch} from "../../../common/ExchangeMatch";
import * as chalk from 'chalk';
import {GDAXExchange} from "../Exchanges/GDAXExchange";
import * as uuidv4 from 'uuid/v4';

export class LiveGDAXFeed extends CandleFeed {
    private matches: ExchangeMatch[];
    private candleStart: Date;
    private timeout;

    private config = {
        candleTime: 30,
        requestRateLimit: 3,
        maxPointsPerRequest: 190,
        historyDays: 1 / 4,
        syncTime: false, // Synchronize to the nearest minute (or whatever candleTime is)
    };

    constructor(exchange: GDAXExchange) {
        super(exchange);
        this.exchange.onMessage$.subscribe(data => {
            const type = data.type;
            if (type === "match") {
                // Create new tick
                const match = new ExchangeMatch();
                match.id = uuidv4();
                match.price = +data.price;
                match.side = data.side;
                match.volume = +data.size;
                match.date = new Date(data.time);

                this.match(match);
                this.matches.push(match);
            }
        });
    }

    public async load() {
        await this.downloadHistory();
    }

    public async start() {
        this.matches = [];
        await this.timer();
    }

    private async timer() {
        // Find the number of seconds to wait in order to be aligned with the time interval
        // We want to start at exactly 00:05 for example if the interval is 5m and the time is 00:02
        if (this.config.syncTime) {
            const now = new Date();
            const wait = this.config.candleTime - (now.getTime() / 1000) % this.config.candleTime;
            console.log(`Resting for ${wait.toFixed(2)}s`);
            await Utils.sleep(wait * 1000);
        }

        this.reset();

        this.check();
    }

    private check() {
        // Check if the candle timeframe has elapsed, if so, create a new candle.
        if (this.matches.length > 0) {
            const candle = this.createCandle();
            this.emit(candle);
            this.reset();
        }

        this.timeout = setTimeout(() => this.check(), this.config.candleTime * 1000);
    }

    private reset() {
        this.candleStart = new Date();
        this.matches = [];
    }

    private createCandle() {
        const firstTick = this.matches[0];
        const tick = this.matches[this.matches.length - 1];

        const open = firstTick.price;
        const close = tick.price;
        let low: number = null;
        let high: number = null;
        let volume = 0;

        for (let i = 0; i < this.matches.length; i++) {
            const t = this.matches[i];

            if (low === null || t.price < low) {
                low = t.price;
            }
            if (high === null || t.price > high) {
                high = t.price;
            }
            volume += t.volume;
        }

        const candle = new Candle(this.candleStart, low, high, open, close, volume);
        console.log(`New candle created from ${this.matches.length} ticks.`);
        candle.print();
        return candle;
    }


    private async downloadHistory() {
        const points: Candle[] = [];

        // Maximum time in seconds that we can request in one request.
        const interval = this.config.candleTime * this.config.maxPointsPerRequest;

        // Get the current date, rounded to the nearest minute, plus two extra minutes to make sure we are getting the
        // very latest.
        let today = new Date();
        const coeff = 1000 * 60;
        today = new Date(Math.floor(today.getTime() / coeff) * coeff);

        // Get the initial start and end, where the end is start + interval.
        let start = new Date(today.valueOf());
        start.setDate(today.getDate() - this.config.historyDays);
        start.setSeconds(start.getSeconds());
        let end = new Date(today.valueOf());
        end.setDate(today.getDate() - this.config.historyDays);
        end.setSeconds(end.getSeconds() + interval);

        const totalRequestsNeeded = (((today.getTime() - start.getTime()) / 1000) / interval);
        let requests = 0;

        // Download in batches until we have all the data.
        while (start < today) {
            if (this.destroyed)
                return null;
            if (end > today)
                end = new Date(today);
            console.log(`GDAX: Downloading historical data. (${Math.round(requests / totalRequestsNeeded * 100)}%)`);

            let newPoints: Candle[] = [];
            let retries = 0;
            while (newPoints.length === 0 && retries < 3) {
                newPoints = await this.getHistoricRates(start, end);

                if (newPoints.length === 0) {
                    console.log(chalk.red(`Got 0 results. Retrying... (${retries + 1})`));
                    retries++;
                }
                await Utils.sleep(1000 / this.config.requestRateLimit);
            }
            // If we couldn't get any of the data, we cannot continue as it could result in an accidental sale or buy
            // as the history will be outdated.
            if (retries >= 3)
                throw new Error("Could not download initial data.");
            points.push.apply(points, newPoints);

            // Add the interval to the start and end.
            start.setSeconds(start.getSeconds() + interval);
            end.setSeconds(end.getSeconds() + interval);
            requests++;
        }

        // console.log(`Downloaded ${points.length} data points.`);

        for (let i = points.length - 425; i < points.length - 1; i++) {
            const candle = points[i];
            this.emit(candle);
        }

        return points;
    }

    private async getHistoricRates(start: Date, end: Date) {
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        const points: Candle[] = [];

        const req = {
            start: startISO,
            end: endISO,
            granularity: this.config.candleTime,
        };

        const data = await (<GDAXExchange>this.exchange).client.getProductHistoricRates(req);

        // Convert the raw JS array from GDAX to our Candle class.
        for (let i = data.length - 1; i >= 0; i--) {
            const raw = data[i];
            const date = raw[0];
            const low = raw[1];
            const high = raw[2];
            const open = raw[3];
            const close = raw[4];
            const volume = Math.round(raw[5] * 100) / 100;
            const point = new Candle(date, low, high, open, close, volume);
            points.push(point);
        }

        return points;
    }

    public async destroy() {
        this.destroyed = true;
        if (this.timeout)
            clearTimeout(this.timeout);
    }
}