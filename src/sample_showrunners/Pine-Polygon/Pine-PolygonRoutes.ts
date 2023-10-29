import { Router, Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import PineChannel from './Pine-PolygonChannel';
import middlewares from '../../api/middlewares';
import { celebrate, Joi } from 'celebrate';
import { Logger } from 'winston';

const route = Router();

export default (app: Router) => {
  const channel = Container.get(PineChannel);
  app.use('/showrunners/pine', route);

  //This route can't be used as the subgraph is not available
  route.post(
    '/notify_expiry',
    celebrate({
      body: Joi.object({
        simulate: [Joi.bool(), Joi.object()],
      }),
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      logger.debug('Calling /showrunners/pine ticker endpoint with body: %o', req.body);
      try {
        const response = await channel.checkExpiry(req.body.simulate);
        return res.status(201).json(response);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );

  route.post(
    '/notify_liquidation',
    celebrate({
      body: Joi.object({
        simulate: [Joi.bool(), Joi.object()],
      }),
    }),
    middlewares.onlyLocalhost,
    async (req: Request, res: Response, next: NextFunction) => {
      const logger: Logger = Container.get('logger');
      logger.debug('Calling /showrunners/pine ticker endpoint with body: %o', req.body);
      try {
        const response = await channel.checkForLiquidation(req.body.simulate);
        return res.status(201).json(response);
      } catch (e) {
        logger.error('🔥 error: %o', e);
        return next(e);
      }
    },
  );
};
