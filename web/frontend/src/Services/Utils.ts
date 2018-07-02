declare const moment: any;

export class Utils {
    public static formatTime(time: Date) {
        return moment(time).format('hh:mm:ss');
    }

    public static formatDate(time: Date) {
        return moment(time).format('M/D hh:mm:ss');
    }

    public static formatPrice(price: number) {
        return price.toFixed(2);
    }

    public static roundPrice(size: number, mul: number) {
        return Math.round(size * mul) / mul;
    }
    
    public static formatNumber(value: number) {
            return value.toLocaleString();
    }
}
