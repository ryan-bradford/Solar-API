import { getRepository, LessThan } from 'typeorm';
import { IPersistedContract, PersistedContract, IStorableContract, IPersistedInvestment, PersistedInvestment } from '@entities';
import { getDaos } from '@daos';
import { singleton } from 'tsyringe';

export interface IContractDao {
    getContracts(userId?: string): Promise<IPersistedContract[]>;
    getContract(id: string): Promise<IPersistedContract>;
    getInvestmentsForContract(contractId?: string): Promise<IPersistedInvestment[]>;
    createContract(contract: IStorableContract): Promise<IPersistedContract>;
    saveContract(contract: IPersistedContract): Promise<void>;
    getContractPositionInQueue(unsoldAmount: number): Promise<number>;
}

@singleton()
export class SqlContractDao implements IContractDao {


    public async getContract(id: string): Promise<IPersistedContract> {
        return getRepository(PersistedContract).findOne(id, {
            relations: ['homeowner', 'investments'],
        }).then((contract) => {
            if (!contract) {
                throw new Error('not found');
            }
            return contract;
        });
    }


    public async getContracts(userId?: string): Promise<IPersistedContract[]> {
        return getRepository(PersistedContract).find({
            relations: ['homeowner', 'investments'],
        }).then((contracts: IPersistedContract[]) =>
            contracts.filter((contract) => !userId || contract.homeowner.id === userId));
    }


    public async getInvestmentsForContract(contractId: string): Promise<IPersistedInvestment[]> {
        return getRepository(PersistedInvestment).find({
            relations: ['contract', 'owner'],
            where: { contractId },
        });
    }


    public async createContract(contract: IStorableContract): Promise<IPersistedContract> {
        const daos = await getDaos();
        const homeownerDao = new daos.SqlHomeownerDao();
        const newContract = new PersistedContract();
        const homeowner = await homeownerDao.getOne(contract.homeownerId);
        if (!homeowner) {
            throw new Error(`Homeowner with id ${contract.homeownerId} not found.`);
        }
        newContract.homeowner = homeowner;
        newContract.investments = [];
        newContract.totalLength = contract.length;
        newContract.monthlyPayment = contract.monthlyPayment;
        newContract.saleAmount = contract.saleAmount;
        const toReturn = await getRepository(PersistedContract).save(newContract);
        homeowner.contract = toReturn;
        return toReturn;
    }


    public async saveContract(contract: IPersistedContract): Promise<void> {
        await getRepository(PersistedContract).update(contract.id, {
            firstPaymentDate: contract.firstPaymentDate as number,
        });
        return;
    }


    // TODO: make actually work!
    public async  getContractPositionInQueue(unsoldAmount: number): Promise<number> {
        return (await getRepository(PersistedContract).findAndCount())[1] - 1;
    }
}
