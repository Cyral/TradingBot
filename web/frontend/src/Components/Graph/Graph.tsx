import {h, render, Component} from 'preact';
import './Graph.styl'

declare const d3: any;
declare const techan: any;

type Point = { date: Date, value: number };

export interface GraphProps {

}

export default class Graph extends Component<GraphProps, any> {
    constructor() {
        super();
    }

    create() {
        const margin = {top: 20, right: 80, bottom: 200, left: 80},
            margin2 = {top: 620, right: 80, bottom: 20, left: 80},
            width = 2560 - margin.left - margin.right,
            height = 800 - margin.top - margin.bottom,
            height2 = 800 - margin2.top - margin2.bottom;

        const parseDate = d3.timeParse("%d-%b-%y");
        let data = [];

        const x = techan.scale.financetime()
            .range([0, width]);

        const x2 = techan.scale.financetime()
            .range([0, width]);

        const y = d3.scaleLinear()
            .range([height, 0]);

        const yVolume = d3.scaleLinear()
            .range([y(0), y(0.3)]);

        const y2 = d3.scaleLinear()
            .range([height2, 0]);

        let lastBrush = new Date();
        const brush = d3.brushX()
            .extent([[0, 0], [width, height2]])
            .on("brush", () => {
                const now = new Date();
                if (now.getTime() - lastBrush.getTime() > 0) {
                    lastBrush = now;
                    brushed();
                }
            })
            .on("end", brushed);

        const candlestick = techan.plot.candlestick()
            .xScale(x)
            .yScale(y);

        const tradearrow = techan.plot.tradearrow()
            .xScale(x)
            .yScale(y)
            .orient(function (d) {
                return d.type.startsWith("buy") ? "up" : "down";
            });


        const ema1 = techan.plot.ema()
            .xScale(x)
            .yScale(y);

        const ema2 = techan.plot.ema()
            .xScale(x)
            .yScale(y);

        const volume = techan.plot.volume()
            .xScale(x)
            .yScale(yVolume);

        const close = techan.plot.close()
            .xScale(x2)
            .yScale(y2);

        const xAxis = d3.axisBottom(x);

        const xAxis2 = d3.axisBottom(x2);

        const yAxis = d3.axisLeft(y);

        const yAxis2 = d3.axisLeft(y2)
            .ticks(0);

        const ohlcAnnotation = techan.plot.axisannotation()
            .axis(yAxis)
            .orient('left')
            .format(d3.format(',.2f'));

        const timeAnnotation = techan.plot.axisannotation()
            .axis(xAxis)
            .orient('bottom')
            .format(d3.timeFormat('%Y-%m-%d'))
            .width(65)
            .translate([0, height]);

        const crosshair = techan.plot.crosshair()
            .xScale(x)
            .yScale(y)
            .xAnnotation(timeAnnotation)
            .yAnnotation(ohlcAnnotation);

        const svg = d3.select(".graph").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);

        const focus = svg.append("g")
            .attr("class", "focus")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        focus.append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", y(1))
            .attr("width", width)
            .attr("height", y(0) - y(1));

        focus.append("g")
            .attr("class", "volume")
            .attr("clip-path", "url(#clip)");

        focus.append("g")
            .attr("class", "indicator ema ma-1")
            .attr("clip-path", "url(#clip)");

        focus.append("g")
            .attr("class", "indicator ema ma-2")
            .attr("clip-path", "url(#clip)");

        focus.append("g")
            .attr("class", "candlestick")
            .attr("clip-path", "url(#clip)");

        focus.append("g")
            .attr("class", "tradearrow")
            .attr("clip-path", "url(#clip)");

        focus.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");

        focus.append("g")
            .attr("class", "y axis")
            .append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 6)
            .attr("dy", ".71em")
            .style("text-anchor", "end")
            .text("Price ($)");

        focus.append('g')
            .attr("class", "crosshair")
            .call(crosshair);

        const context = svg.append("g")
            .attr("class", "context")
            .attr("transform", "translate(" + margin2.left + "," + margin2.top + ")");

        context.append("g")
            .attr("class", "close");

        context.append("g")
            .attr("class", "pane");

        context.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height2 + ")");

        context.append("g")
            .attr("class", "y axis")
            .call(yAxis2);

        let ema10: Point[] = [];
        let ema21: Point[] = [];


        const result = d3.csv('/api/data', function (error, d) {
            const accessor = candlestick.accessor(),
                timestart = Date.now();

            data = d.map(function (d) {
                return {
                    date: new Date(parseInt(d.Timestamp) * 1000),
                    open: parseInt(d.Open),
                    high: parseInt(d.High),
                    low: parseInt(d.Low),
                    close: parseInt(d.Close),
                    volume: parseInt(d.Volume)
                };
            }).filter(function(d) {
                return d.date > new Date("8/1/2017");
            }).sort(function (a, b) {
                    return d3.ascending(accessor.d(a), accessor.d(b));
            });

            x.domain(data.map(accessor.d));
            x2.domain(x.domain());
            y.domain(techan.scale.plot.ohlc(data, accessor).domain());
            y2.domain(y.domain());
            yVolume.domain(techan.scale.plot.volume(data).domain());

            focus.select("g.candlestick").datum(data);
            focus.select("g.volume").datum(data);

            ema10 = techan.indicator.ema().period(7)(data);
            ema21 = techan.indicator.ema().period(21)(data);
            focus.select("g.ema.ma-1").datum(ema10).call(ema1);
            focus.select("g.ema.ma-2").datum(ema21).call(ema2);

            context.select("g.close").datum(data).call(close);
            context.select("g.x.axis").call(xAxis2);

            // Associate the brush with the scale and render the brush only AFTER a domain has been applied
            context.select("g.pane").call(brush).selectAll("rect").attr("height", height2);

            x.zoomable().domain(x2.zoomable().domain());
            calculateTrades();

            draw();
        });

        function brushed() {
            const zoomable = x.zoomable(),
                zoomable2 = x2.zoomable();

            zoomable.domain(zoomable2.domain());
            if (d3.event.selection !== null) zoomable.domain(d3.event.selection.map(zoomable.invert));
            draw();
        }

        let trades = [];

        function draw() {
            const candlestickSelection = focus.select("g.candlestick"),
                data = candlestickSelection.datum();
            y.domain(techan.scale.plot.ohlc(data.slice.apply(data, x.zoomable().domain()), candlestick.accessor()).domain());
            candlestickSelection.call(candlestick);
            focus.select("g.volume").call(volume);
            // using refresh method is more efficient as it does not perform any data joins
            // Use this if underlying data is not changing
            //svg.select("g.candlestick").call(candlestick.refresh);

            focus.select("g.tradearrow").datum(trades).call(tradearrow);

            focus.select("g.x.axis").call(xAxis);
            focus.select("g.y.axis").call(yAxis);
            focus.select("g.ema.ma-1").call(ema1.refresh);
            focus.select("g.ema.ma-2").call(ema2.refresh);
        }

        const calculateTrades = () => {
            const length = data.length;

            for (let a = 1; a < 21; a++) {
                ema21.unshift({date: data[a].date, value: data[a].close});
            }
            for (let a = 1; a < 7; a++) {
                ema10.unshift({date: data[a].date, value: data[a].close});
            }
            console.log(length);
            let type = "sell";
            for (let i = 21; i < data.length - 2; i++) {
               const crossUnder = ema21[i].value > ema10[i].value && ema21[i-1].value < ema10[i-1].value;
               const crossOver = ema21[i].value < ema10[i].value && ema21[i-1].value > ema10[i-1].value;
             
                if (crossUnder || crossOver) {
                    
                    /*
                    this.intersects(
                        i, ema10[i].value,
                        i + 1, ema10[i + 1].value,
                        i, ema21[i].value,
                        i + 1, ema21[i + 1].value
                    )
                     */
                    const price = data[i].close;
                    if (trades.length > 1) {
                        const lastTrade = trades[trades.length - 1];
                        const diff = lastTrade.price - price;
                       // console.log(diff);
                    }
                    trades.push({
                        date: data[i].date,
                        type: type,
                        price: price,
                        quantity: 1,
                        tick: i,
                    });
                    type = crossUnder ? "buy" : "sell";
                    console.log(`Intersect at ${ema10[i].date} @${price} =? ${data[i].date}`)
                }
            }

            calculateProfit();
        };

        const calculateProfit = () => {
            let initialCoins = 10;
            let initialUsd;
            let lastUsd;
            let coins = initialCoins;
            let usd = 0;
            
            let lastTrade = 0;
            let change = 0;

            for (let trade of trades) {
                if (trade.type == "sell") {
                    let previousUsd = lastTrade * coins;
                    usd = coins * trade.price;
                    change = (usd - previousUsd) / previousUsd * 100;
                    coins = 0;
                    lastUsd = usd;
                    if (!initialUsd)
                        initialUsd = usd;
                } else {
                    coins = usd / trade.price;
                    usd = 0;
                }
                lastTrade = trade.price;

                let css = trade.type === "sell" ? 'background-color: red; color: black;' 
                    : 'background-color: lawngreen; color: black;';
                let cssReset = 'background-color: transparent; color: white';

                console.log(`[${trade.tick}]%c${trade.type}%c @ ${trade.price} USD: ${Math.round(usd * 100) / 100}, Coins: ${Math.round(coins * 100) / 100}`, css, cssReset);
                if (trade.type === "sell") {
                    console.log(`${change.toFixed(2)}% change`);
                }
            }
            
            const marketChange = (data[data.length -1 ].open - data[0].open)/ data[0].open *100;
            const tradingChange = (lastUsd - (data[0].open * initialCoins))/ (data[0].open * initialCoins) *100;
            console.log(`%c\nMarket Change: ${marketChange.toFixed(2)}%   $${(data[0].open  * initialCoins).toFixed(2)}->$${(data[data.length -1 ].close * initialCoins).toFixed(2)}`, 'color: white; font-size: 28px');
            console.log(`%c\nTrading Change: ${tradingChange.toFixed(2)}%   $${(data[0].open * initialCoins).toFixed(2)}->$${lastUsd.toFixed(2)}`, 'color: white; font-size: 28px');
        };
    }

    componentDidMount() {
        this.create();
    }

    render(props: GraphProps) {
        return (
            <div class="graph">
            </div>
        );
    }
}

