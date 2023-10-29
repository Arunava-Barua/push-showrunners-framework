import { model, Schema } from 'mongoose';

export interface PgIOpenLoan {
  h2:boolean,
  h24:boolean,
  h0:boolean,
  id:string,
  loanExpiretimestamp:string,
  collectionName:string,
  borrower:string,
}

const pineSchema = new Schema<PgIOpenLoan>({
  _id: {
    type: String,
  },
  id:{
    type:String,
  },
  loanExpiretimestamp:{
    type:String,
  },
  collectionName:{
    type:String,
  },
  borrower:{
    type:String,
  },
  h24:{
    type:Boolean,
    default:false,
  },
  h2:{
    type:Boolean,
    default:false,
  },
  h0:{
    type:Boolean,
    default:false,
  },
},);

export const OpenLoanModel = model<PgIOpenLoan>('PgOpenLoanDB', pineSchema); 

export interface PgILoanEvent {
  sent:boolean,
  id:string,
  eventTimestamp:string,
  collectionName:string,
}

const loanEventScheme = new Schema<PgILoanEvent>({
  _id: {
    type: String,
  },
  id:{
    type:String,
  },
  eventTimestamp:{
    type:String,
  },
  sent:{
    type:Boolean,
    default:false,
  },
  collectionName:{
    type:String,
  },
},);

export const LoanEventModel = model<PgILoanEvent>('PgPineEventDB', loanEventScheme); 
