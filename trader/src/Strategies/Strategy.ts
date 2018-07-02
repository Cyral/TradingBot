import {Subject} from 'rxjs/Subject';
import {HasIndicators, Indicator} from "../Indicators/Indicator";
import {CandleFeed} from "../Feeds/CandleFeed";
import {Signal} from "../Signal";
import {PlotPoint} from "../../../common/PlotPoint";
import BigNumber from "bignumber";

export abstract class Strategy extends HasIndicators {
    public onSignal$: Subject<Signal>;
    public onPlot$: Subject<PlotPoint>;
    public onTick$: Subject<any>;
    private iteration: number = 0;
    private currentDate: Date;
     
    constructor() {
        super();
        this.onSignal$ = new Subject<Signal>();
        this.onPlot$ = new Subject<PlotPoint>();
        this.onTick$ = new Subject<any>()
    }
    
    protected abstract tick();
    
    public get now() {
        return this.currentDate;
    }
    
    public subscribe(feed: CandleFeed) {
        feed.subscribe(() => this.update(feed));
    }
    
    protected crossover(a: Indicator<any>, b: Indicator<any>) {
        return a.getCurrent() > b.getCurrent() && a.getLast() < b.getLast();
    }
    
    protected crossunder(a: Indicator<any>, b: Indicator<any>) {
        return a.getCurrent() < b.getCurrent() && a.getLast() > b.getLast();
    }
    
    protected buy(percent?: BigNumber) {
        this.onSignal$.next(new Signal("buy", this.iteration, percent));
    }
    
    protected sell(percent?: BigNumber) {
        this.onSignal$.next(new Signal("sell", this.iteration, percent));
    }
    
    protected plot(indicator: Indicator<number>) {
        this.onPlot$.next(new PlotPoint(indicator.name, this.currentDate, indicator.getCurrent()));
    }
    
    private update(feed: CandleFeed) {
        // Update indicators
        let minLead = 0;
        this.updateIndicators(feed.candles);
        for (let indicator of this.indicators) {
            const leadTicks = indicator.getLeadTicks();
            if (leadTicks > minLead)
                minLead = leadTicks;
        }
        
        // Only run the tick if enough leads have elapsed.
        this.currentDate = feed.candles[feed.candles.length - 1].date;
        if (this.iteration > minLead) {
            this.tick();
        }
        
        this.onTick$.next();
        this.iteration++;
    }
}