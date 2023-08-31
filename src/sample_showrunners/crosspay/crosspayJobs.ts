import logger from '../../loaders/logger';

import { Container } from 'typedi';
import schedule from 'node-schedule';
import crosspayChannel from './crosspayChannel';

export default () => {
  const channel = Container.get(crosspayChannel);
  channel.startEventListener(false);
};


