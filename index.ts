import * as dotenv from 'dotenv';
dotenv.config()
import * as bitcore from 'bitcore-lib-cash';
import * as zmq from 'zeromq';
import * as crypto from 'crypto';

const _rpcClient = require('bitcoin-rpc-promise-retry');
const connectionString = 'http://' + process.env.rpc_user + ':' + process.env.rpc_pass + '@' + process.env.rpc_host + ':' + process.env.rpc_port
let rpc = new _rpcClient(connectionString);

let sock: any = zmq.socket('sub');
sock.connect('tcp://' + process.env.rpc_host + ':28332');
sock.subscribe('rawtx');
sock.subscribe('hashblock');
sock.on('message', async function(topic: string, message: Buffer) {
    if (topic.toString() === 'rawtx') {
        let rawtx = message.toString('hex');
        let txn = new bitcore.Transaction(rawtx);
        let inputs = [];
        for(let i = 0; i < txn.inputs.length; i++) {
            let txid = txn.inputs[i].prevTxId.toString('hex');
            let idx = txn.inputs[i].outputIndex;
            inputs.push(await rpc.getTxOut(txid, idx, true));
        }

        console.log('-----');
        let hash1 = crypto.createHash('sha256');
        let hash2 = crypto.createHash('sha256');
        hash1.update(message);
        hash2.update(hash1.digest());
        let txid = Buffer.from(hash2.digest().toJSON().data.reverse()).toString('hex');
        console.log("New Txn (mempool or block acceptance):", txid);
        console.log("Input Count:", txn.inputs.length);
        for(let i = 0; i < txn.inputs.length; i++) {
            let txid = txn.inputs[i].prevTxId.toString('hex');
            let idx = txn.inputs[i].outputIndex;
            console.log("Input:", txid, idx);
            if(inputs[i])
                throw Error("Error: Txn notified but UTXO not spent in 'gettxout'.");
            else
                console.log("OK (marked spent)")
        }
        console.log('-----');
    }
})

export interface TxOutResult {
    bestblock: string
    confirmations: number
    value: number
    scriptPubKey: {
      asm: string
      hex: string
      reqSigs: number
      type: string
      addresses: string[]
    }
    version: number
    coinbase: boolean
}

// @ts-ignore
process.on('uncaughtException', async (err: any, origin: any) => {
    console.log("[ERROR] uncaughtException", err);
    try {
        console.log(`[${(new Date()).toUTCString()}] ${err.stack}`);
    } catch(_) {
        console.log(err);
    } finally {
        process.exit(0);
    }
});

process.on('unhandledRejection', async (err: any, promise: any) => {
    console.log("[ERROR] unhandledRejection", err);
    try {
        console.log(`[${(new Date()).toUTCString()}] ${err.stack}`);
    } catch(_) {
        console.log(err);
    } finally {
        process.exit(0);
    }
});
