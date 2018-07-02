import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as chalk from 'chalk';
import {GraphController} from "./GraphController";
import {Communicator} from "../../../common/Communicator";
import {ExchangeMatch} from "../../../common/ExchangeMatch";
import {WebSocket} from './WebSocket';
import {createServer} from "http";
import {State} from "./State";

export class Server {
    private app: Koa;
    private router: Router;
    private graphController: GraphController;
    private redis: Communicator;
    private ws: WebSocket;
    private state: State;

    constructor() {
        console.log(chalk.cyan("\n*** Web Backend ***\n"));
        
        this.app = new Koa();
        this.router = new Router();
        this.graphController = new GraphController();
        this.redis = new Communicator();

        this.start();
    }

    private async start() {
        await this.graphController.loadData();
        await this.redis.connect();
        console.log('Connected to redis.');

        this.router.get('*', async (ctx, next) => {
            const start = Date.now();
            await next();
            const ms = Date.now() - start;
            console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
        });

        this.router.get('/api', (ctx) => {
            ctx.body = {
                success: true,
                message: 'Hello'
            }
        });

        this.router.get('/api/data', async (ctx) => {
            ctx.body = await this.graphController.getData();
        });

        this.router.get('/api/metadata', (ctx) => {
            ctx.body = this.graphController.getMetaData();
        });


        this.app.use(this.router.routes())
            .use(this.router.allowedMethods());

        const server = createServer(this.app.callback());
        this.ws = new WebSocket(server);
        this.state = new State(this.redis, this.ws);
        await this.state.subscribe();
        
        server.listen(3000);
        console.log('Running HTTP and WebSockets server.');
    }
}

