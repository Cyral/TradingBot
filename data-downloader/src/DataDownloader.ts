import {PublicClient} from 'gdax';
import * as chalk from 'chalk';
import * as fs from 'fs';
import {DataPoint} from './DataPoint';

export class DataDownloader {
    // Settings
    private granularity = 60;
    private maxPoints = 190;
    private daysAgo = 30;
    private rateLimit = 3;
    private product = 'BTC-USD';
    private dataFile = 'data/%FILE%.csv';

    private client: PublicClient;

    constructor() {
        this.client = new PublicClient(this.product);
        this.start();


    }

    private async start() {
        console.log(chalk.green("\n*** Data Downloader ***\n"));

        const points = await this.download();
        await this.save(points);

        console.log(chalk.green("\n*** Done! ***\n"));
    }

    private async download() {
        const points: DataPoint[] = [];

        // Maximum time in seconds that we can request in one request.
        const interval = this.granularity * this.maxPoints;

        // Get the start date, rounded to the nearest minute
        let today = new Date();
        const coeff = 1000 * 60 * 5;
        today = new Date(Math.floor(today.getTime() / coeff) * coeff);

        // Get the initial start and end, where the end is start + interval.
        let start = new Date(today.valueOf());
        start.setDate(today.getDate() - this.daysAgo);
        start.setSeconds(start.getSeconds());
        let end = new Date(today.valueOf());
        end.setDate(today.getDate() - this.daysAgo);
        end.setSeconds(end.getSeconds() + interval);

        const totalRequestsNeeded = (((today.getTime() - start.getTime()) / 1000) / interval) - 1;
        let requests = 0;

        // Download in batches until we have all the data.
        while (end < today) {
            console.log(`[${Math.round(requests / totalRequestsNeeded * 100)}%] Downloading data from ${start} to ${end}`);

            let newPoints: DataPoint[] = [];
            let retries = 0;
            while (newPoints.length === 0 && retries < 3) {
                newPoints = await this.getHistoricRates(start, end);
                
                if (newPoints.length === 0) {
                    console.log(chalk.red(`Got 0 results. Retrying... (${retries + 1})`));
                    retries++;
                }
                await this.sleep(1000 / this.rateLimit);
            }
            points.push.apply(points, newPoints);

            // Add the interval to the start and end.
            start.setSeconds(start.getSeconds() + interval);
            end.setSeconds(end.getSeconds() + interval);
            requests++;
        }

        console.log(`Downloaded ${points.length} data points.`);

        return points;
    }

    private async save(points: DataPoint[]) {
        console.log("Saving data...");
        let data: string = "";

        const appendValues = (...values: any[]) => {
            data += values.join(',') + '\n';
        };

        // Header
        appendValues("Timestamp", "Low", "High", "Open", "Close", "Volume");

        // CSV values for all the data.
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            appendValues(point.date, point.low, point.high, point.open, point.close, point.volume);
        }

        const filename = `gdax_historical_${this.product.toLowerCase()}_${this.daysAgo}d_${Math.round(this.granularity / 60 * 10) / 10}m`;
        await this.wrapRequest(cb => fs.writeFile(this.dataFile.replace('%FILE%', filename), data, (err) => {
            if (err) {
                console.log(err);
            } else {
                cb();
            }
        }));
    }

    private async getHistoricRates(start: Date, end: Date) {
        const startISO = start.toISOString();
        const endISO = end.toISOString();
        const points: DataPoint[] = [];

        const req = {
            start: startISO,
            end: endISO,
            granularity: this.granularity,
        };

        const data = await this.client.getProductHistoricRates(req);

        // Convert the raw JS array from GDAX to our DataPoint class.
        for (let i = data.length - 1; i >= 0; i--) {
            const raw = data[i];
            const date = raw[0];
            const low = raw[1];
            const high = raw[2];
            const open = raw[3];
            const close = raw[4];
            const volume = Math.round(raw[5] * 100) / 100;
            const point = new DataPoint(date, low, high, open, close, volume);
            points.push(point);
        }
        
       // points.push(new DataPoint(0,0,0));

        return points;
    }

    private async sleep(ms: number) {
        await this.wrapRequest(cb => setTimeout(cb, ms));
    }

    private async wrapRequest(request: (cb) => any) {
        return new Promise<any>(accept => {
            request(accept);
        });
    }
}