declare const io: any;

export class WebSocket {
    public static instance: WebSocket;
    private socket: any;
    constructor() {
        WebSocket.instance = this;
    }
    
    public async connect() {
        this.socket = io(window.location.href, {
            path: "/live"
        });
    }
    
    public on(type: string, fn: (data: any) => void) {
        this.socket.on(type, fn);
    }
    
    public emit(type: string, data?: any) {
        this.socket.emit(type, data);
    }
}