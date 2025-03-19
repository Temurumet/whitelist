import { connection } from '../utils/connection';
import { walletKeypair } from '../utils/keys';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import { 
  createTransferCheckedWithTransferHookInstruction, 
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
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

export const transfer = async (
  mintAddress: PublicKey,
  destination: PublicKey, 
  amount: number, 
  decimals: number
) => {
  try {
    console.log(`Transferring ${amount} tokens from ${mintAddress.toString()} to ${destination.toString()}...`);
    
    const [extraAccountMetaListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('extra-account-metas'), mintAddress.toBuffer()],
      PROGRAM_ID
    );
    
    const [whiteListPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('whitelist')],
      PROGRAM_ID
    );
    
    console.log(`Found whitelist PDA at: ${whiteListPDA.toString()}`);
    console.log(`Found extraAccountMetaList PDA at: ${extraAccountMetaListPDA.toString()}`);
    
    const sourceTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      walletKeypair.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    const destinationTokenAccount = await getAssociatedTokenAddress(
      mintAddress,
      destination,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    console.log(`Source token account: ${sourceTokenAccount.toString()}`);
    console.log(`Destination token account: ${destinationTokenAccount.toString()}`);
    
    // Используем BigInt вместо BN для совместимости с SPL Token
    const amountBigInt = BigInt(amount * Math.pow(10, decimals));
    
    const transferInstruction = await createTransferCheckedWithTransferHookInstruction(
      connection,
      sourceTokenAccount,
      mintAddress,
      destinationTokenAccount,
      walletKeypair.publicKey,
      amountBigInt,
      decimals,
      [],
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
      PROGRAM_ID,
      [extraAccountMetaListPDA, whiteListPDA]
    );
    
    const transaction = new Transaction().add(transferInstruction);
    const txSig = await provider.sendAndConfirm(transaction, [walletKeypair]);
    console.log(`Transfer Successful: ${txSig}`);
    return txSig;
  } catch (error) {
    console.error('Error transferring tokens:', error);
    throw error;
  }
};
