import { Service, Inject } from 'typedi';
import config from '../../config';
import { EPNSChannel } from '../../helpers/epnschannel';
import { Logger } from 'winston';
import { request, gql } from 'graphql-request';
 
import { ethers } from "ethers";
import crosspay from "./crosspay.json";

const NETWORK_TO_MONITOR = config.web3PolygonMumbaiRPC;
const crosspayAbi = crosspay.abi;
const crosspayAddress = "0xDb633b200D568D7bC49d8E0a1E16FEb3924C3695"

@Service()
export default class CrosspayChannel extends EPNSChannel {
  constructor(@Inject('logger') public logger: Logger) {
    super(logger, {
      networkToMonitor: NETWORK_TO_MONITOR,
      dirname: __dirname,
      name: 'Crosspay',
      url: 'https://arv-bitcloud.vercel.app/',
      useOffChain: true,
    });
  }

  /*
    event TxInitiated(address sender, address receiver, uint256 amount, string chain, uint256 startTime);
    event TxAccepted(address sender, address receiver, uint256 amount, string chain);
    event TxApproved(address sender, address receiver, uint256 amount, string chain);
*/

  async startEventListener(simulate) {
    try {
      
    } catch (error) {
      
    }
    this.logInfo("EventListener function started!")
    
    const provider = new ethers.providers.WebSocketProvider('wss://polygon-mumbai.g.alchemy.com/v2/jPp5II90BUILENlH5dGYkQMMKndhuOGd');
    const contract = new ethers.Contract(crosspayAddress, crosspayAbi, provider);

    contract.on("TxInitiated", async (sender, receiver, amount, chain, startTime, event) => {
        // call functions in channel
        this.logInfo("Calling ---> getTxInitiated()");
        const subscribers = await this.getChannelSubscribers();

        if (subscribers.includes(receiver)) this.getTxInitiated(sender, receiver, amount, chain, simulate);    
    })

    contract.on("TxAccepted", async (sender, receiver, amount, chain, event) => {
        // call functions in channel
        this.logInfo("Calling ---> getTxAccepted()");
        const subscribers = await this.getChannelSubscribers();

        if (subscribers.includes(sender)) this.getTxAccepted(sender, receiver, amount, chain, simulate);    
    })

    contract.on("TxApproved", async (sender, receiver, amount, chain, startTime, event) => {
        // call functions in channel
        this.logInfo("Calling ---> getTxApproved()");
        const subscribers = await this.getChannelSubscribers();

        if (subscribers.includes(receiver)) this.getTxApproved(sender, receiver, amount, chain, simulate);    
    })
  }

  async getTxInitiated(sender, receiver, amount, chain, simulate) {
    try {
      this.logInfo("Getting events ---> TxInitiated");
      const crosspayContract = await this.getContract(crosspayAddress, crosspayAbi);

      const title = "TxInitiated Event Title";
      const payloadTitle = "TxInitiated Event Payload Title";
      const message = `Message: ${sender} is trying to send you(${receiver}) ${amount} of aUSDC in ${chain} chain.`;
      const payloadMsg = `Payload Message: ${sender} is trying to send you(${receiver}) ${amount} of aUSDC in ${chain} chain.`;


      const notificationType = 3;
      await this.sendNotification({
        recipient: receiver,
        title,
        message,
        payloadMsg,
        cta:`https://arv-bitcloud.vercel.app/`,
        payloadTitle,
        notificationType,
        simulate,
        image: null
      });

    }catch (error) {
      this.logInfo("Error caused in the getInitiated function", error);
    }
  }

  async getTxAccepted(sender, receiver, amount, chain, simulate) {
    try {
      this.logInfo("Getting events ---> TxInitiated");
      const crosspayContract = await this.getContract(crosspayAddress, crosspayAbi);

      const title = "TxAccepted Event Title";
      const payloadTitle = "TxAccepted Event Payload Title";
      const message = `Message: ${receiver} has accepted ${amount} of aUSDC in ${chain} chain.`;
      const payloadMsg = `Payload Message: ${receiver} has accepted ${amount} of aUSDC in ${chain} chain.`;

      const notificationType = 3;
      await this.sendNotification({
        recipient: sender,
        title,
        message,
        payloadMsg,
        cta:`https://arv-bitcloud.vercel.app/`,
        payloadTitle,
        notificationType,
        simulate,
        image: null
      });

    }catch (error) {
      this.logInfo("Error caused in the getTxAccepted function", error);
    }
  }

  async getTxApproved(sender, receiver, amount, chain, simulate) {
    try {
      this.logInfo("Getting events ---> TxApproved");
      const crosspayContract = await this.getContract(crosspayAddress, crosspayAbi);

      const title = "TxApproved Event Title";
      const payloadTitle = "TxApproved Event Payload Title";
      const message = `Message: ${sender} has approved your(${receiver}) transaction for ${amount} of aUSDC in ${chain} chain.`;
      const payloadMsg = `Payload Message: ${sender} has approved your(${receiver}) transaction for ${amount} of aUSDC in ${chain} chain.`;

      const notificationType = 3;
      await this.sendNotification({
        recipient: receiver,
        title,
        message,
        payloadMsg,
        cta:`https://arv-bitcloud.vercel.app/`,
        payloadTitle,
        notificationType,
        simulate,
        image: null
      });

    }catch (error) {
      this.logInfo("Error caused in the getTxAccepted function", error);
    }
  }
}
