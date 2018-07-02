import {MongoClient, Db, Collection} from 'mongodb';
import {Trade} from "../../common/Trade";
import BigNumber from "bignumber.js";

export class DB {
    private readonly MONGODB_CONNECTION: string = "mongodb://mongo:27017/trader";
    private db: Db;
    private tradeCollection: Collection;
    constructor() {
        
    }   
    
    public async connect() {
        this.db = await MongoClient.connect(this.MONGODB_CONNECTION);
       
        this.tradeCollection = await this.db.createCollection('trades');
    }
    
    public async saveTrade(trade: Trade) {
        await this.tradeCollection.insertOne(this.serializeTrade(trade));
    }
    
    public async getTrades(lastN: number = 50) {
        const trades: Trade[] = [];
        const cursor = await this.tradeCollection.find().sort({$natural: -1}).limit(lastN);
        
        await new Promise(accept => { 
            cursor.forEach(t => {
                trades.push(this.deserializeTrade(t));
            }, accept);
        });
        
        return trades;
    }
    
    private deserializeTrade(raw: any) {
        const trade = new Trade();
        trade.ID = raw.id;
        trade.date = new Date(raw.date);
        trade.side = raw.side;
        trade.askingPrice = new BigNumber(raw.askingPrice);
        trade.totalSize = new BigNumber(raw.totalSize);
        trade.state = raw.state;
        return trade;
    }
    
    private serializeTrade(trade: Trade) {
        return {
            id: trade.ID,
            date: trade.date,
            side: trade.side,
            askingPrice: trade.askingPrice.toString(),
            totalSize: trade.totalSize.toString(),
            state: trade.state
        }
    }
}