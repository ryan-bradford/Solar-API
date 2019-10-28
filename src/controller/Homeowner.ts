import { Request, Response } from 'express';
import { IUserDao, IContractDao } from '@daos';
import { IPersistedHomeowner, IStorableHomeowner, StoredHomeowner, StoredContract } from '@entities';
import { IContractService } from '@services';
import { OK, CREATED, NOT_FOUND } from 'http-status-codes';
import { paramMissingError, addMonth, logger } from '@shared';
import { ParamsDictionary } from 'express-serve-static-core';
import { injectable, inject } from 'tsyringe';

@injectable()
export default class HomeownerController {
    constructor(
        @inject('HomeownerDao') private homeownerDao: IUserDao<IPersistedHomeowner, IStorableHomeowner>,
        @inject('ContractDao') private contractDao: IContractDao,
        @inject('ContractService') private contractService: IContractService) { }


    public async getUsers(req: Request, res: Response) {
        const users = await this.homeownerDao.getAll();
        const stored = await Promise.all(users.map(async (user) => {
            let contract: StoredContract | undefined;
            if (user.contract) {
                const contractInvestments = await this.contractDao.getInvestmentsForContract(user.contract.id);
                let investmentValue = 0;
                user.contract.investments = contractInvestments;
                const positionInQueue = user.contract.unsoldAmount !== 0 ?
                    await this.contractDao.getContractPositionInQueue(user.contract.unsoldAmount) : null;
                contractInvestments.forEach((investment) => investmentValue += investment.amount);
                contract = new StoredContract(user.contract.id, user.contract.saleAmount,
                    user.contract.totalLength, user.contract.monthlyPayment, user.contract.firstPaymentDate,
                    investmentValue / user.contract.saleAmount, positionInQueue, user.id);
            }
            return new StoredHomeowner(user.id, user.name, user.email, user.pwdHash, contract);
        }));
        return res.status(OK).json({ users: stored });
    }


    public async addUser(req: Request, res: Response) {
        // Check parameters
        const { user } = req.body;
        if (!user) {
            throw new Error(paramMissingError);
        }
        // Add new user
        await this.homeownerDao.add(user);
        return res.status(CREATED).send(user);
    }


    public async getUser(req: Request, res: Response) {
        const { email } = req.params;
        const user = await this.homeownerDao.getOneByEmail(email);
        if (user) {
            let contract: StoredContract | undefined;
            if (user.contract) {
                const contractInvestments = await this.contractDao.getInvestmentsForContract(user.contract.id);
                user.contract.investments = contractInvestments;
                const positionInQueue = user.contract.unsoldAmount !== 0 ?
                    await this.contractDao.getContractPositionInQueue(user.contract.unsoldAmount) : null;
                let investmentValue = 0;
                contractInvestments.forEach((investment) => investmentValue += investment.amount);
                contract = new StoredContract(user.contract.id, user.contract.saleAmount,
                    user.contract.totalLength, user.contract.monthlyPayment, user.contract.firstPaymentDate,
                    investmentValue / user.contract.saleAmount, positionInQueue, user.id);
            }
            return res.status(OK).json(new StoredHomeowner(user.id, user.name, user.email, user.pwdHash, contract));
        } else {
            return res.status(NOT_FOUND).end();
        }
    }


    public async deleteUser(req: Request, res: Response) {
        const { email } = req.params as ParamsDictionary;
        const homeowner = await this.homeownerDao.getOneByEmail(email);
        if (!homeowner || !homeowner.id) {
            return res.status(NOT_FOUND).end();
        }
        await this.homeownerDao.delete(homeowner.id);
        return res.status(OK).end();
    }


    public async signUpHome(req: Request, res: Response) {
        const { email } = req.params;
        const { amount } = req.body;
        if (!amount && !(typeof amount === 'number')) {
            throw new Error('Bad amount');
        }
        const user = await this.homeownerDao.getOneByEmail(email);
        if (user && user.id) {
            await this.contractService.createContract(amount, user.id);
            return res.status(OK).end();
        } else {
            return res.status(NOT_FOUND).end();
        }
    }


    public async makePayment(req: Request, res: Response) {
        const { email } = req.params as ParamsDictionary;
        const payment = await this.contractService.makePayment(email);
        if (payment === null) {
            return res.status(203).end();
        }
        return res.status(OK).send({ payment });
    }


    public async makeAllPayments(req: Request, res: Response) {
        const allContracts = await this.contractDao.getContracts();
        await Promise.all(allContracts.map((contract) => this.contractService.makePayment(contract.homeowner.email)));
        addMonth();
        return res.status(OK).send();
    }


    // TODO: make better
    public async getOptionDetails(req: Request, res: Response) {
        const { option, email } = req.params;
        let contractSize;
        let electricity;
        switch (option) {
            case '0': {
                contractSize = 6000;
                electricity = 60;
                break;
            }
            case '1': {
                contractSize = 10000;
                electricity = 100;
                break;
            }
            case '2': {
                contractSize = 15000;
                electricity = 150;
                break;
            }
            default: throw new Error('Invalid option');
        }
        const homeowner = await this.homeownerDao.getOneByEmail(email);
        if (!homeowner) {
            throw new Error('Not found');
        }
        const proposedContract = await this.contractService.createContract(contractSize, homeowner.id, true);
        return res.json({
            electricity,
            contractSize,
            monthlyPayment: proposedContract.monthlyPayment,
        });
    }
}
