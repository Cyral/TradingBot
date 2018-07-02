export class Utils {
    public static async wrapRequest(request: (cb) => any) {
        return new Promise<any>(accept => {
            request(accept);
        });
    }
    
    public static dateFromUnix(unixTimestamp: number) {
        return new Date(unixTimestamp * 1000)
    }

    public static async sleep(ms: number) {
        await Utils.wrapRequest(cb => setTimeout(cb, ms));
    }
    
    public static rand(min: number, max: number) {
        return Math.random() * (max - min) + min;
    }
}