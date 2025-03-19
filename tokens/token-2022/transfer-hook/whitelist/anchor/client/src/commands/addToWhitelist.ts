import { connection } from '../utils/connection';
import { walletKeypair } from '../utils/keys';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, BN, web3 } from '@coral-xyz/anchor';
import { IDL, PROGRAM_ID } from '../idl/program';

// Создаем провайдера с правильными типами
const provider = new AnchorProvider(
  connection,
  {
    publicKey: walletKeypair.publicKey,
    signTransaction: async (tx) => {
      tx.partialSign(walletKeypair);
      return tx;
    },
    signAllTransactions: async (txs) => {
      return txs.map((tx) => {
        tx.partialSign(walletKeypair);
        return tx;
      });
    },
  },
  { commitment: 'confirmed' }
);

// Создаем программу с IDL
const program = new Program(IDL, PROGRAM_ID, provider);

export const addToWhitelist = async (newAccount: PublicKey) => {
  try {
    console.log(`Adding account ${newAccount.toString()} to whitelist...`);
    
    const [whiteListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist')],
      PROGRAM_ID
    );
    
    console.log(`Found whitelist PDA at: ${whiteListPDA.toString()}`);
    
    const transaction = await program.methods
      .addToWhitelist()
      .accounts({
        newAccount: newAccount,
        whiteList: whiteListPDA,
        authority: walletKeypair.publicKey,
      })
      .transaction();
      
    const txSig = await provider.sendAndConfirm(transaction, [walletKeypair]);
    console.log(`Added to Whitelist: ${txSig}`);
    return txSig;
  } catch (error) {
    console.error('Error adding to whitelist:', error);
    throw error;
  }
};
