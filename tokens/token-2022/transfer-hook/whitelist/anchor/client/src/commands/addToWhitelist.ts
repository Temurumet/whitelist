import { connection } from '../utils/connection';
import { walletKeypair } from '../utils/keys';
import { PublicKey, Transaction } from '@solana/web3.js';
import { Program, Provider, web3 } from '@coral-xyz/anchor';
import { TransferHook } from '../../target/types/transfer_hook';
import idl from '../../target/idl/transfer_hook.json';

const programId = new PublicKey(idl.metadata.address);
const provider = new Provider(connection, walletKeypair, {});
const program = new Program(idl as any, programId, provider) as Program<TransferHook>;

export const addToWhitelist = async (newAccount: PublicKey) => {
  const [whiteListPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('whitelist')],
    program.programId
  );

  const transaction = await program.methods
    .addToWhitelist()
    .accounts({
      newAccount,
      whiteList: whiteListPDA,
      authority: walletKeypair.publicKey,
    })
    .transaction();

  const txSig = await provider.sendAndConfirm(transaction, [walletKeypair]);
  console.log(`Added to Whitelist: ${txSig}`);
};