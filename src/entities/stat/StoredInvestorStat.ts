export class StoredInvestorStat {

    public carbonReduction: number;
    public targetRate: number;
    public totalPortfolio: number;


    constructor(carbonReduction: number, totalPortfolio: number, targetRate: number) {
        this.carbonReduction = Math.round(carbonReduction / 10) * 10;
        this.totalPortfolio = Math.round(totalPortfolio / 100) * 100;
        this.targetRate = targetRate;
    }

}
