  /* eslint-disable prettier/prettier */
  import config from '../../config';
  import logger from '../../loaders/logger';

  import { Container } from 'typedi';
  import schedule from 'node-schedule';
  import PineChannel from './Pine-PolygonChannel';
  import { ethers } from 'ethers';
  export default () => {
    const startTime = new Date(new Date().setHours(0, 0, 0, 0));

    const oneHourRule = new schedule.RecurrenceRule();
    oneHourRule.hour = new schedule.Range(0, 23, 1);
    oneHourRule.minute = 0;
    oneHourRule.second = 0;

    const sixHourRule = new schedule.RecurrenceRule();
    sixHourRule.hour = new schedule.Range(0, 23, 6);
    sixHourRule.minute = 0;
    sixHourRule.second = 0; 

    logger.info(`     🛵 Scheduling Showrunner - Pine [on 1 hour] [${new Date(Date.now())}]`);
    const channel = Container.get(PineChannel);


    // Loan expiry notification
    schedule.scheduleJob({ start: startTime, rule: oneHourRule }, async function () {

      const taskName = 'checking for loan expiry in pine protocol';

      try {
        await channel.checkExpiry(false);
        logger.info(`[${new Date(Date.now())}] 🐣 Cron Task Completed -- ${taskName}`);
      } catch (err) {
        logger.error(`[${new Date(Date.now())}] ❌ Cron Task Failed -- ${taskName}`);
        logger.error(`[${new Date(Date.now())}] Error Object: %o`, err);
      }
    });

    logger.info(`     🛵 Scheduling Showrunner - Pine [on 6 hour] [${new Date(Date.now())}]`);

    // Loan liquidation alert
     schedule.scheduleJob({ start: startTime, rule: sixHourRule }, async function () {
      const channel = Container.get(PineChannel);
      const taskName = 'checking for loan liquidation in pine protocol';

      try {
        await channel.checkForLiquidation(false);
        logger.info(`[${new Date(Date.now())}] 🐣 Cron Task Completed -- ${taskName}`);
      } catch (err) {
        logger.error(`[${new Date(Date.now())}] ❌ Cron Task Failed -- ${taskName}`);
        logger.error(`[${new Date(Date.now())}] Error Object: %o`, err);
      }
    } 
    );
  };


