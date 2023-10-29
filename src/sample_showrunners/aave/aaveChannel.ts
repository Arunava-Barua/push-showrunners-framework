// @name: Aave Channel
// @version: 1.0

import { Service, Inject } from "typedi";
import config from "../../config";
import { ethers } from "ethers";
import aaveSettings from "./aaveSettings.json";
import aaveLendingPoolDeployedContractABI from "./aave_LendingPool.json";
import { EPNSChannel } from "../../helpers/epnschannel";
import { Logger } from "winston";

// Import Push SDK for Notification settings
import { PushAPI } from "@pushprotocol/restapi";

const NETWORK_TO_MONITOR = config.web3MainnetNetwork;
const HEALTH_FACTOR_THRESHOLD = 1.6;
const CUSTOMIZABLE_SETTINGS = {
  precision: 3,
};

@Service()
export default class AaveChannel extends EPNSChannel {
  constructor(@Inject("logger") public logger: Logger) {
    super(logger, {
      networkToMonitor: NETWORK_TO_MONITOR,
      dirname: __dirname,
      name: "Aave",
      url: "https://aave.com/",
      useOffChain: true,
      address: "0xAA940b3501176af328423d975C350d0d1BaAae50",
    });
  }

  // To add channel-settings to your channel
  public async createChannelSettings() {
      // Initializing a provider
      const provider = new ethers.providers.JsonRpcProvider(process.env.ALCHEMY_API);

      // Creating a random signer from a wallet, ideally this is the wallet you will connect
      const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

      // Initialize wallet user, pass 'prod' instead of 'staging' for mainnet apps
      const userAlice = await PushAPI.initialize(signer, { env: process.env.SHOWRUNNERS_ENV }); // env error

      // Creates channel settings
      const createChannelSettingRes = await userAlice.channel.setting([
        {
          type: 1, // Boolean type
          default: 1,
          description: "Receive Governance related NEWS",
        },
        {
          type: 2, // Slider type
          default: 10,
          description: "Notify when liquidation of assets happen",
          data: { upper: 100, lower: 5, ticker: 1 }, // Ticker error
        },
      ]);

      this.logInfo('Notification Settings: ', createChannelSettingRes)

      // const aliceSubscriptions = await userAlice.notification.subscriptions();
  }

  // To form and write to smart contract
  public async sendMessageToContract(simulate) {
    this.logInfo("sendMessageToContract");

    //simulate object settings START
    const logicOverride =
      typeof simulate == "object"
        ? simulate.hasOwnProperty("logicOverride") &&
          simulate.logicOverride.mode
          ? simulate.logicOverride.mode
          : false
        : false;

    const simulateAaveNetwork =
      logicOverride && simulate.logicOverride.hasOwnProperty("aaveNetwork")
        ? simulate.logicOverride.aaveNetwork
        : false;

    let aave: any;

    if (simulateAaveNetwork) {
      this.logInfo("Using Simulated Aave Network");
      aave = this.getInteractableContract(
        simulateAaveNetwork,
        this.walletKey,
        aaveSettings.aaveLendingPoolDeployedContractMainnet,
        aaveLendingPoolDeployedContractABI
      );
    } else {
      this.logInfo("Getting Aave Contract");
      aave = await this.getContract(
        aaveSettings.aaveLendingPoolDeployedContractMainnet,
        JSON.stringify(aaveLendingPoolDeployedContractABI)
      );
      this.log(`Got Contract`);
    }

    this.logInfo(`Getting subscribed users`);

    const users = await this.getChannelSubscribers();
    for (const user of users) {
      let res = await this.checkHealthFactor(aave, user, simulate);
    }

    return true;
  }

  public async checkHealthFactor(aave, userAddress, simulate) {
    this.logInfo(`Checking Health Factor`);
    try {
      const logicOverride =
        typeof simulate == "object"
          ? simulate.hasOwnProperty("logicOverride") &&
            simulate.logicOverride.mode
            ? simulate.logicOverride.mode
            : false
          : false;
      const simulateApplyToAddr =
        logicOverride && simulate.logicOverride.hasOwnProperty("applyToAddr")
          ? simulate.logicOverride.applyToAddr
          : false;
      const simulateAaveNetwork =
        logicOverride && simulate.logicOverride.hasOwnProperty("aaveNetwork")
          ? simulate.logicOverride.aaveNetwork
          : false;

      if (!aave) {
        aave = await this.getContract(
          aaveSettings.aaveLendingPoolDeployedContractMainnet,
          JSON.stringify(aaveLendingPoolDeployedContractABI)
        );
      }
      if (!userAddress) {
        if (simulateApplyToAddr) {
          userAddress = simulateApplyToAddr;
        } else {
          this.logDebug("userAddress is not defined");
        }
      }
    } catch (err) {
      this.logError("An error occured while checking health factor");
      this.logError(err);
    }
    //simulate object settings END

    const userData = await aave.contract.getUserAccountData(userAddress);
    let healthFactor = ethers.utils.formatEther(userData.healthFactor);
    this.logInfo(
      "For wallet: %s, Health Factor: %o",
      userAddress,
      healthFactor
    );
    if (Number(healthFactor) <= HEALTH_FACTOR_THRESHOLD) {
      const precision = CUSTOMIZABLE_SETTINGS.precision;
      const newHealthFactor = parseFloat(healthFactor).toFixed(precision);
      const title = "Aave Liquidity Alert!";
      const message =
        userAddress +
        " your account has healthFactor " +
        newHealthFactor +
        ". Maintain it above 1 to avoid liquidation.";
      const payloadTitle = "Aave Liquidity Alert!";
      const payloadMsg = `Your account has healthFactor [b:${newHealthFactor}] . Maintain it above 1 to avoid liquidation.`;
      const notificationType = 3;
      const tx = await this.sendNotification({
        recipient: userAddress,
        title: title,
        message: message,
        payloadTitle: payloadTitle,
        payloadMsg: payloadMsg,
        notificationType: notificationType,
        cta: "https://app.aave.com/#/dashboard",
        image: null,
        simulate: simulate,
      });

      return {
        success: true,
        data: tx,
      };
    } else {
      this.logInfo(
        `[Wallet: ${userAddress} is SAFE with Health Factor:: ${healthFactor}`
      );
      return {
        success: false,
        data: userAddress + " is not about to get liquidated",
      };
    }
  }
}
