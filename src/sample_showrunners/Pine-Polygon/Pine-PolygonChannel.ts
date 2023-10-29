import { Service, Inject } from 'typedi';
import config from '../../config';
import { EPNSChannel } from '../../helpers/epnschannel';
import { Logger } from 'winston';
import { PgIOpenLoan, OpenLoanModel, PgILoanEvent, LoanEventModel } from './Pine-PolygonModel';
import moment from 'moment';
import { request, gql } from 'graphql-request';
import { forEach } from 'lodash';

@Service()
export default class PineChannel extends EPNSChannel {
  constructor(@Inject('logger') public logger: Logger) {
    super(logger, {
      networkToMonitor: config.web3MainnetNetwork,
      dirname: __dirname,
      name: 'Pine',
      url: 'https://pine.loans/',
      useOffChain: true,
    });
  }

  URL_OPEN_LOANS = 'https://api.thegraph.com/subgraphs/name/pinedefi/open-loans-polygon';

  URL_LOAN_EVENTS = 'https://api.thegraph.com/subgraphs/name/pinedefi/open-loans-polygon';


  // -------------------------- Loan Expiry Alert --------------------------------------\\

  // main
  async checkExpiry(simulate) {
   // await this.deleteAllLoansFromDB()
    let loansDB = await this.getAllLoansFromDB();

    if (!loansDB) return;

    let filteredloans = await this.fetchAndStoreLoans(loansDB);

    if (filteredloans.length !== 0) {
      await this.storeLoans(filteredloans);
      loansDB = await this.getAllLoansFromDB();
      this.logInfo(`Loans from loansDb is ${loansDB}`)
    }

    for (const loan of loansDB) {
      await this.handleLoans(loan, simulate);
    }

    // console.log(this.timestamp)
    // const loan = new OpenLoanModel({id:"0x3acce66cd37518a6d77d9ea3039e00b3a2955460/6438",loanExpiretimestamp:"1657528224",h24:true,h2:false,h0:false,})

    // await this.handleLoans(loan,simulate)
  }

  // query loan data from pine sub graph
  async getLoans(page: number, limit = 1000) {
    this.logInfo(`Getting loan info from ${(page - 1) * limit} to ${(page - 1) * limit + limit}`);
    const loanQuery = gql`
    {
      loans(first: ${limit},skip: ${(page - 1) * limit
      }, where:{loanExpiretimestamp_gte:${this.timestamp}}) {
        id
        loanExpiretimestamp
        collectionName
        borrower
      }  
    }
    `;
    //collectionName

    const loans = await request(this.URL_OPEN_LOANS, loanQuery);
    return loans.loans;
  }

  // filter out loan data
  async filterLoansByDB(loansDB: PgIOpenLoan[], loans: PgIOpenLoan[]): Promise<PgIOpenLoan[]> {
    let ids = [];
    loansDB.forEach((element) => {
      ids.push(element.id);
    });
    let filteredLoans = loans.filter((loan) => !ids.includes(loan.id));
    this.logInfo(`${filteredLoans.length} of new loans`);
    return filteredLoans;
  }

  // store new loans update on DB
  async storeLoans(loans: PgIOpenLoan[]) {
    let loansInserted = await OpenLoanModel.insertMany(loans);
    return loansInserted;
  }

  // deleting all loan entries on DB
  async deleteAllLoansFromDB() {
    let loansInserted = await OpenLoanModel.remove({});
    return loansInserted;
  }

  async deletExpiredLoans(loan) {
    if (loan.loanExpiretimestamp < this.timestamp.toFixed(0)) {
      let data = await OpenLoanModel.findByIdAndRemove(loan._id);
    }
  }

  // fetching loans
  async getAllLoansQuery(): Promise<PgIOpenLoan[]> {
    let i = 1;
   // const limit = pLimit(10);
    const queue = [];

    while (true) {
      try {
        let loans = await this.getLoans(i++);
        if (loans.length == 0) {
          this.logInfo(`All Loans Covered Exiting`);
          break;
        }
        for (const loan of loans) {
          queue.push(loan);
        }
      } catch (error) {
        this.logError(`An error occured skipped loop`);
      }
    }
    this.logInfo(`Total of ${queue.length} loans fetched from subgraph`);

    return queue;
  }

  // exicuting filter logic

  async fetchAndStoreLoans(loansDB: PgIOpenLoan[]) {
    let loansQuery = await this.getAllLoansQuery();

    let filteredloans = await this.filterLoansByDB(loansDB, loansQuery);
    return filteredloans;
  }

  // Get all loans from DB
  async getAllLoansFromDB(): Promise<PgIOpenLoan[]> {
    let i = 1;

    let ts = this.timestamp;
    //const limit = pLimit(10);
    const queue = [];

    while (true) {
      try {
        let loans = await OpenLoanModel.find()
          .skip((i - 1) * 1000)
          .limit(1000);
        i++;
        if (loans.length == 0) {
          this.logInfo(`All Loans from DB`);
          break;
        }

        for (const loan of loans) {
          queue.push(loan);
        }
      } catch (error) {
        this.logError(`An error occured skipped loop`);
      }
    }

    this.logInfo(`Got total ${queue.length} from DB`);
    return queue;
  }

  // exicuting notificaton logic
  async handleLoans(loan: any, simulate) {
    try {
      // {
      //   h24: true,
      //   h2: true,
      //   h0: false,
      //   _id: '62c3b323b12d221ec3f5bd75',
      //   id: '0x3acce66cd37518a6d77d9ea3039e00b3a2955460/6438',
      //   loanExpiretimestamp: '1657127919',
      //   __v: 0
      // }
      // {
      //   h24: true,
      //   h2: false,
      //   h0: false,
      //   _id: '62c3b323b12d221ec3f5bd75',
      //   id: '0x3acce66cd37518a6d77d9ea3039e00b3a2955460/6438',
      //   loanExpiretimestamp: '1657127919',
      //   __v: 0
      // }

      if (!loan) return;
      let loanExpiretimestamp = loan.loanExpiretimestamp;
      if (
        loanExpiretimestamp >= (this.timestamp + 86400).toFixed(0) &&
        loanExpiretimestamp < (this.timestamp + 172800).toFixed(0) &&
        !loan.h24
      ) {
        await OpenLoanModel.findOneAndUpdate({ id: loan.id }, { h24: true });
        this.logInfo('notification sent for 24 hours ');
        this.sendExpiryNotification(loan, `Your Loan of ${loan.collectionName} with id ${loan.id} will expire in 24 hours`, simulate);
      } else if (
        loanExpiretimestamp >= (this.timestamp + 7200).toFixed(0) &&
        loanExpiretimestamp < (this.timestamp + 86400).toFixed(0) &&
        !loan.h2
      ) {
        let data = await OpenLoanModel.findOneAndUpdate({ id: loan.id }, { h2: true });
        this.logInfo('notification sent for 2 hours ');
        this.sendExpiryNotification(loan, `Your Loan of ${loan.collectionName} will expire in 2 hours`, simulate);
      } else if (
        loanExpiretimestamp >= this.timestamp.toFixed(0) &&
        loanExpiretimestamp < (this.timestamp + 7200).toFixed(0) &&
        !loan.h0
      ) {
        await OpenLoanModel.findOneAndUpdate({ id: loan.id }, { h0: true });
        this.logInfo('notification sent for 0 hours ');
        this.sendExpiryNotification(loan, `Your Loan of ${loan.collectionName} is expire in a moment`, simulate);
      }

      await this.deletExpiredLoans(loan);
    } catch (error) {
      this.logError(error);
    }
  }

  // sending notification
  async sendExpiryNotification(loan: any, info: string, simulate) {
    if (!loan) return;
    let expiry = this.formatDate(loan.loanExpiretimestamp);
    try {
      const title = `${info}`;
      const payloadTitle = `${info}`;
      const message = `${info} \nLoan will expire on ${expiry}`;
      const payloadMsg = `${info} \nLoan will expire on ${expiry}`;
      const notificationType = 1;

//this.logInfo(`borrower is ${loan.borrower}`)

        await this.sendNotification({
          recipient: loan.borrower,
          title: title,
          message: message,
          payloadMsg: payloadMsg,
          payloadTitle: payloadTitle,
          notificationType: notificationType,
          simulate: simulate,
          image: null,
          cta: `https://app.pine.loans/pools/polygon/${loan.id.split('/')[0]}`,
          timestamp: loan.loanExpiretimestamp,
        }); 

    } catch (e) {
      this.logError(e);
    }
  }

  // ------------------------------ Loan Liquidation alert -----------------------------\\

  // query all liquidated loan from loan event sub graph
  async getLoanEvents(page: number, limit = 1000) {
    this.logInfo(`Getting loan events info from ${(page - 1) * limit} to ${(page - 1) * limit + limit}`);
    this.logInfo(`Limit value is ${limit}`)
    const loanQuery = gql`
    {
      loans(first: ${limit},skip: ${(page - 1) * limit}, status: "closed", where: {borrowedWei_gt: "0", repaidInterestWei: "0",loanExpiretimestamp_gte:${this.timestamp}}) {
        id
        loanExpiretimestamp
        collectionName
      }
    }
    `;
    //        collectionName
    // borrower
    const loans = await request(this.URL_LOAN_EVENTS, loanQuery);
    // this.logInfo(`Loans are ${JSON.stringify(loans.loans)}`)
    return loans.loans;
  }

  async checkForLiquidation(simulate) {
    // await this.deleteAllLoansEventsFromDB()

    var loansDB = await this.getAllLoanEventsFromDB();

    let filteredloans = await this.filterNewLiquidation(loansDB);
//this.logInfo(`Filtered loans : ${filteredloans}`)
    if (filteredloans.length !== 0) {
      this.storeLoansEvents(filteredloans);
      loansDB = await this.getAllLoanEventsFromDB();
      //this.logInfo(`Loans from DB : ${JSON.stringify(loansDB)}`)
    }
    for (const loan of loansDB) {
      // let loan = new LoanEventModel({
      //   sent: false,
      //   _id: '62cb9fb7545971311e915190',
      //   id: '0xca7ca7bcc765f77339be2d648ba53ce9c8a262bd/7355/1654087290/0x11ad22a9a6ba4b7c9fcf5817370763c2c3b8ae6cc2c7f8eebec20b7dc3bf0f76',
      //   eventTimestamp: '1656941643',
      //   __v: 0
      // })
      this.handleLiquidation(loan, simulate);
    }
  }

  // filter out loan data
  async filterLoansEventsByDB(loansDB: PgILoanEvent[], loans: PgILoanEvent[]): Promise<PgILoanEvent[]> {
    let ids = [];
    loansDB.forEach((element) => {
      ids.push(element.id);
    });
    let filteredLoans = loans.filter((loan) => !ids.includes(loan.id));
    this.logInfo(`${filteredLoans.length} new liquidations are happend`);
    //this.logInfo(`Filtered Loans : ${JSON.stringify(filteredLoans)}`)
    return filteredLoans;
  }

  // store new loans events update on DB
  async storeLoansEvents(loans: PgILoanEvent[]) {
    let loansInserted = await LoanEventModel.insertMany(loans);
    return loansInserted;
  }

  // deleting all loan entries on DB
  async deleteAllLoansEventsFromDB() {
    let loansInserted = await LoanEventModel.remove({});
    return loansInserted;
  }

  // fetching loans
  async getAllLoansEventQuery(): Promise<PgILoanEvent[]> {
    let i = 1;
    const queue = [];

    while (true) {
      try {
        let loans = await this.getLoanEvents(i++);
        if (loans.length == 0) {
          this.logInfo(`All Loans Covered Exiting`);
          break;
        }
        for (const loan of loans) {
          queue.push(loan);
        }
        await this.storeLoans(loans);
      } catch (error) {
        this.logError(`An error occured skipped loop`);
      }
    }
    this.logInfo(`${queue.length} loan events are fetched from subgraph`);

    return queue;
  }

  // exicuting filter logic
  async filterNewLiquidation(loansDB: PgILoanEvent[]) {
    let loansQuery = await this.getAllLoansEventQuery();
    let filteredloans = await this.filterLoansEventsByDB(loansDB, loansQuery);
    return filteredloans;
  }

  // Get all loans from DB
  async getAllLoanEventsFromDB(): Promise<PgILoanEvent[]> {
    let i = 1;
    const queue = [];

    while (true) {
      try {
        let loans = await LoanEventModel.find()
          .skip((i - 1) * 1000)
          .limit(1000);
        i++;
        if (loans.length == 0) {
          break;
        }

        for (const loan of loans) {
          queue.push(loan);
        }
      } catch (error) {
        this.logError(`An error occured skipped loop`);
      }
    }
    this.logInfo(`Total of ${queue.length} loan events fetched from DB`);
    return queue;
  }

  // exicuting notificaton logic
  async handleLiquidation(loan: any, simulate) {
    try {
      //this.logInfo(`Loans : ${loan}`)
      if (!loan.sent || simulate.logicOverride.mode) {
        await LoanEventModel.findOneAndUpdate({ id: loan.id }, { sent: true });
        this.sendLiquidationNotification(
          loan,
          `liquidation of ${loan.collectionName} happend on loan with id ${loan.id.substring(0, 20)}...`,
          simulate,
        );
      }
    } catch (error) {
      this.logError(error);
    }
  }

  // sending liquidation notification
  async sendLiquidationNotification(loan: PgILoanEvent, info: string, simulate) {
    if (!loan) return;
    let liquidationTime = this.formatDate(Number(loan.eventTimestamp));
    try {
      const title = `${info}`;
      const payloadTitle = `${info}`;
      const message = `${info} on ${liquidationTime}`;
      const payloadMsg = `${info} on ${liquidationTime}`;
      const notificationType = 1;

      //this.logInfo(`Sending notification of ${info}`)
       await this.sendNotification({
        recipient: this.channelAddress,
        title: title,
        message: message,
        payloadMsg: payloadMsg,
        payloadTitle: payloadTitle,
        notificationType: notificationType,
        simulate: simulate,
        image: null,
        cta: `https://app.pine.loans/pools/polygon/${loan.id.split('/')[0]}`,
        timestamp: Number(loan.eventTimestamp),
      }); 
    } catch (e) {
      this.logError(e);
    }
  }

  // ---------------------------- General Functions ----------------------------------\\

  // timestamp into date
  formatDate(ts: number) {
    ts = ts * 1000;

    return moment(ts).format('MMMM Do YYYY, h:mm:ss a');
  }
}
