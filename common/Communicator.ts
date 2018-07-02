import * as redis from 'redis';

export class Communicator {
    private pub: redis.RedisClient;
    private sub: redis.RedisClient;
    private didQuit: boolean;
    private pendingSubscribes: { channel: string, accept: Function }[];

    constructor() {
        this.pendingSubscribes = [];
    }
    
    public quit() {
        this.didQuit = true;
        if (this.pub)
            this.pub.quit();
        if (this.sub)
            this.sub.quit();
    }

    public async connect() {
        return new Promise((accept, reject) => {
            let subConnected = false, pubConnected = false;
            this.pub = redis.createClient(6379, "redis");
            this.sub = redis.createClient(6379, "redis");

            this.pub.on("connect", () => {
                pubConnected = true;
                if (subConnected)
                    accept();
            });

            this.sub.on("connect", () => {
                subConnected = true;
                if (pubConnected)
                    accept();
            });

            this.sub.on("subscribe", (channel, count) => {
                console.log(`Subscribed to ${channel}`)
                for (let i = this.pendingSubscribes.length - 1; i >= 0; i--) {
                    const pending = this.pendingSubscribes[i];
                    if (pending.channel === channel) {
                        this.pendingSubscribes.splice(i, 1);
                        pending.accept();
                    }
                }
            });
        });
    }

    public publish(channel: string, data: any) {
        if (this.didQuit) return;
        if (!this.pub) return;
        const json = JSON.stringify(data);
        if (json === undefined) {
            throw new Error('Tried to publish undefined data!');
        }
        this.pub.publish(channel, json);
    }

    public async subscribe(channel: string, handler: (message) => void) {
        if (this.didQuit) return;
        if (!this.sub) return;
        return new Promise(accept => {
            this.pendingSubscribes.push({
                channel,
                accept,
            });
            this.sub.on("message", (msgChannel, json) => {
                const data = JSON.parse(json);
                if (msgChannel === channel) {
                    handler(data);
                }
            });
            this.sub.subscribe(channel);
        });
    }
}