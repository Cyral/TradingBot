import {h, render, Component} from 'preact';
import {WebSocket} from "../../Services/WebSocket";
import './PriceChart.styl'

declare const d3: any;
declare const techan: any;

type PlotPoint = { name: string, date: Date, value: number };
type Point = { date: Date, value: number };
type Candle = { date: Date, open: number, close: number, high: number, low: number }

export interface PriceChartProps {

}

export default class PriceChart extends Component<PriceChartProps, any> {
    private ws: WebSocket = WebSocket.instance;
    private plotPoints: { [name: string]: Point[] } = {};
    private plotCharts: { [name: string]: any } = {};
    private data: Candle[];

    constructor() {
        super();
    }

    componentDidMount() {
        this.create();
    }

    render(props: PriceChartProps) {
        return (
            <div class="price-chart section">
                <div class="section-header">Price Chart</div>
                <div class="section-body">
                    <div class="graph">
                    </div>
                </div>
            </div>
        );
    }

    create() {

        const parent = document.querySelector(".graph");
        const margin = {top: 20, right: 20, bottom: 30, left: 50},
            width = parent.clientWidth - margin.left - margin.right,
            height = 700 - margin.top - margin.bottom;

        // Chart components
        const x = techan.scale.financetime()
            .range([0, width]);

        const y = d3.scaleLinear()
            .range([height, 0]);

        const yVolume = d3.scaleLinear()
            .range([y(0), y(0.25)]);

        const tradearrow = techan.plot.tradearrow()
            .xScale(x)
            .yScale(y)
            .orient(d => d.type.startsWith("buy") ? "up" : "down");

        const candlestick = techan.plot.candlestick()
            .xScale(x)
            .yScale(y);

        const volume = techan.plot.volume()
            .xScale(x)
            .yScale(yVolume);

        const xAxis = d3.axisBottom()
            .scale(x);

        const yAxis = d3.axisLeft()
            .scale(y);

        const svg = d3.select(".graph").append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        // Chart data
        let trades = [];

        this.ws.on("candle", d => {
            this.data.push(parseCandle(d));
            draw();
        });
        this.ws.on("new-trade", o => {
            trades.push(parseTrade(o));
            draw();
        });
        this.ws.on("plot", (p: PlotPoint) => {
            const name = p.name;
            if (!Array.isArray(this.plotPoints[name])) {
                createChart(name);
            }
            this.plotPoints[name].push(parsePlotPoint(p));
             draw();
        });
        this.ws.on("price-history", existingChart => {
            this.data = existingChart.map(d => parseCandle(d));
            draw(true);
        });
        this.ws.on("trade-history", existingOrders => {
            trades = existingOrders.map(o => parseTrade(o));
            draw(true);
        });
        this.ws.on("plot-history", existingPlot => {
            this.plotPoints = {};
            this.plotCharts = {};
            for (const name in existingPlot) {
                if (existingPlot.hasOwnProperty(name)) {
                    createChart(name, existingPlot);
                }
            }

            draw(true);
        });

        const createChart = (name: string, existingPlot?: PlotPoint[]) => {
            console.log('Creating chart for ' + name);
            // Create the d3 line.
            if (!this.plotCharts[name]) {
                this.plotCharts[name] = d3.line()
                    //.curve(d3.curveMonotoneX)
                    .x(d => x(d.date))
                    .y(d => y(d.value));
                svg.append("g")
                    .attr("class", "line " + name + " indicator indicator-" + Object.keys(this.plotCharts).length)
                    .append('path')
                    .attr("clip-path", "url(#clip)");
            }

            // Parse points for this chart.
            if (existingPlot)
                this.plotPoints[name] = existingPlot[name].map(p => parsePlotPoint(p));
            else
                this.plotPoints[name] = [];
        };

        function parseCandle(d) {
            return {
                date: new Date(d.date),
                open: +d.open,
                high: +d.high,
                low: +d.low,
                close: +d.close,
                volume: +d.volume
            };
        }

        function parseTrade(o) {
            return {
                date: new Date(o.date),
                price: o.askingPrice,
                type: o.side,
            };
        }

        function parsePlotPoint(p): Point {
            return {
                date: new Date(p.date),
                value: p.value
            }
        }

        // Chart DOM
        const defs = svg.append("defs");

        defs.append("clipPath")
            .attr("id", "clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height);

        svg.append("g")
            .attr("class", "volume")
            .attr("clip-path", "url(#clip)");

        svg.append("g")
            .attr("class", "candlestick")
            .attr("clip-path", "url(#clip)");

        svg.append("g")
            .attr("class", "tradearrow")
            .attr("clip-path", "url(#clip)");

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + height + ")");

        svg.append("g")
            .attr("class", "y axis");

        let lastDraw = new Date();
        const draw = (force: boolean = false) => {
            const now = new Date();
            if (!force && now.getTime() - lastDraw.getTime() < 100) return;
            
            const history = 200;
            const slicedData = this.data.length > history ? this.data.slice(this.data.length - history, this.data.length) : this.data;
            x.domain(this.data.map(candlestick.accessor().d));
            x.zoomable().domain([this.data.length - history, this.data.length]);
            y.domain(techan.scale.plot.ohlc(slicedData).domain());
            yVolume.domain(techan.scale.plot.volume(slicedData).domain());

            for (const line in this.plotCharts) {
                if (this.plotCharts.hasOwnProperty(line) && this.plotPoints[line] && this.plotPoints[line].length > 0 && this.plotPoints[line][0].date) {
                    svg.selectAll("g.line.indicator." + line + " path").datum(this.plotPoints[line]).attr("d", this.plotCharts[line]);
                }
            }

            svg
                .transition()
                .each(() => {
                    svg.selectAll("g.candlestick").datum(this.data).call(candlestick);
                    svg.selectAll("g.tradearrow").datum(trades).call(tradearrow);
                    svg.selectAll("g.x.axis").call(xAxis);
                    svg.selectAll("g.y.axis").call(yAxis);
                    svg.selectAll("g.volume").datum(this.data).call(volume);
                });

            lastDraw = now;
        }
    }
}

