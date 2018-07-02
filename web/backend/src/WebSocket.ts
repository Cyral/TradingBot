import {Server} from "http";
import {Subject} from 'rxjs/Subject';
import * as chalk from 'chalk';
import * as SocketIO from 'socket.io';

export class WebSocket {
    public onConnect$: Subject<SocketIO.Socket>;
    private io: SocketIO.Server;

    constructor(server: Server) {
        this.io = SocketIO(server, {
            path: '/live'
        });
        this.io.on('connection', (socket: SocketIO.Socket) => this.onConnect(socket));
        
        this.onConnect$ = new Subject<SocketIO.Socket>();
    }
    
    private onConnect(socket: SocketIO.Socket) {
        console.log('A client has connected.');
        this.onConnect$.next(socket);
    }
    
    public broadcast(type: string, data: any) {
        this.io.emit(type, data);
    }
}